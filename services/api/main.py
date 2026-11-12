import time
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from .config import settings, validate_production_secret_key
from .cache import cache_client
from .routers import palm_router, readings_router, account_router, analytics_router, billing_router

logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("palmora.api")

# Ensure production environment fails closed if SECRET_KEY is missing or insecure
validate_production_secret_key(settings.SECRET_KEY, settings.ENVIRONMENT)

# Initialize Sentry error tracking if configured
if getattr(settings, "SENTRY_DSN", None) and settings.SENTRY_DSN.strip():
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        sentry_sdk.init(
            dsn=settings.SENTRY_DSN.strip(),
            environment=settings.ENVIRONMENT,
            traces_sample_rate=0.2 if settings.ENVIRONMENT == "production" else 1.0,
            profiles_sample_rate=0.1,
            integrations=[FastApiIntegration()]
        )
        logger.info("Sentry monitoring initialized successfully.")
    except Exception as e:
        logger.warning(f"Sentry SDK initialization skipped: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manages the lifecycle of the application's asyncpg connection pool.
    Initializes pool on startup when DATABASE_ENABLED=True, closes cleanly on shutdown.
    """
    if settings.DATABASE_ENABLED:
        import asyncpg
        logger.info("Initializing asyncpg connection pool...")
        try:
            app.state.db_pool = await asyncpg.create_pool(
                dsn=settings.DATABASE_URL,
                min_size=settings.DATABASE_POOL_MIN_SIZE,
                max_size=settings.DATABASE_POOL_MAX_SIZE,
                timeout=settings.DATABASE_CONNECT_TIMEOUT_SECONDS,
                command_timeout=settings.DATABASE_STATEMENT_TIMEOUT_SECONDS,
            )
            logger.info("asyncpg connection pool initialized successfully.")
        except Exception as exc:
            logger.warning(
                f"Failed to connect to PostgreSQL/Supabase database ({exc}). "
                "Operating in resilient ephemeral in-memory mode."
            )
            app.state.db_pool = None
    else:
        app.state.db_pool = None

    yield

    if getattr(app.state, "db_pool", None) is not None:
        logger.info("Closing asyncpg connection pool...")
        await app.state.db_pool.close()
        logger.info("asyncpg connection pool closed.")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "Production API for Palmora AI: An intelligent palmistry exploration platform "
        "providing culturally grounded traditional readings via computer vision analysis."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# 1. CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Security Headers Middleware
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(self)"
        return response

app.add_middleware(SecurityHeadersMiddleware)

# 3. Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception during {request.method} {request.url.path}: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "InternalServerError",
            "message": "An unexpected error occurred during processing. No personal images or data were exposed."
        }
    )

# 4. Health Check
@app.get("/health", tags=["System"])
@app.get("/api/health", tags=["System"])
async def health_check():
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "llm_provider": "configured" if (settings.GEMINI_API_KEY or settings.OPENAI_API_KEY) else "deterministic_fallback",
        "persistent_storage": settings.ENABLE_PERSISTENT_STORAGE,
        "cache": cache_client.check_health()
    }

# 5. Mount API Routes
app.include_router(palm_router, prefix="/api/v1")
app.include_router(readings_router, prefix="/api/v1")
app.include_router(account_router, prefix="/api/v1")
app.include_router(analytics_router, prefix="/api/v1")
app.include_router(billing_router, prefix="/api/v1")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
