# Palmora AI — 6 Copy-Paste Implementation Prompts

> Feed these **one at a time** in the order listed. Each is self-contained.

---

## PROMPT 1 — Database Connection Pool (P0)

```
Act as a Principal Database & Infrastructure Engineer working on the Palmora AI FastAPI monorepo.

CONTEXT:
- `services/api/database.py` already has RLS identity helpers: `build_transaction_identity_statements()`, `validate_authenticated_uuid()`, and custom exceptions. Phase 1 is complete.
- `services/api/config.py` has `DATABASE_URL`, `DATABASE_POOL_MIN_SIZE`, `DATABASE_POOL_MAX_SIZE`, `DATABASE_CONNECT_TIMEOUT_SECONDS`, `DATABASE_STATEMENT_TIMEOUT_SECONDS`, and `DATABASE_ENABLED = False`.
- `services/api/routers/readings.py` uses an in-memory `READINGS_STORE = {}` dict — data is lost on every server restart.
- `services/api/routers/palm.py` uses an in-memory `EPHEMERAL_ANALYSIS_STORE = {}` dict.

YOUR TASKS:
1. Add `asyncpg` to `services/api/requirements.txt`.

2. In `services/api/main.py`, replace the module-level app instantiation with an `@asynccontextmanager` lifespan function that:
   - On startup: if `settings.DATABASE_ENABLED`, creates an asyncpg pool using `DATABASE_URL`, min/max size, and connect timeout from settings, stores it on `app.state.db_pool`.
   - On shutdown: closes the pool cleanly.
   - If DATABASE_ENABLED is False, sets `app.state.db_pool = None`.

3. In `services/api/database.py`, add four async CRUD functions:
   - `async def insert_reading(pool, user_id: str, report_dict: dict) -> str`
   - `async def get_reading_by_id(pool, reading_id: str, user_id: str) -> Optional[dict]`
   - `async def list_readings_by_user(pool, user_id: str) -> List[dict]`
   - `async def soft_delete_reading(pool, reading_id: str, user_id: str) -> bool`
   Each must: acquire a connection from the pool, call `build_transaction_identity_statements(user_id)` to get SQL statements and params, execute them to set `SET LOCAL ROLE authenticated` and `set_config('request.jwt.claim.sub', ...)`, then run the CRUD query inside the same transaction.

4. Add a FastAPI dependency `get_db_pool(request: Request) -> Optional[asyncpg.Pool]` that returns `request.app.state.db_pool`.

5. Refactor `services/api/routers/readings.py`:
   - Each endpoint receives `pool = Depends(get_db_pool)`.
   - When pool is not None: use DB CRUD functions.
   - When pool is None: fall back to the existing `READINGS_STORE` dict (so the app still works in ephemeral dev mode).

6. Create `services/api/migrations/001_readings.sql` with:
   - `CREATE TABLE readings (id UUID PRIMARY KEY, user_id UUID NOT NULL, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT now(), deleted_at TIMESTAMPTZ DEFAULT NULL)`
   - `ALTER TABLE readings ENABLE ROW LEVEL SECURITY`
   - RLS policy: `CREATE POLICY readings_owner ON readings USING (user_id = current_setting('request.jwt.claim.sub')::UUID)`

7. Write `services/api/tests/test_database.py` with 3 async pytest tests using `unittest.mock.AsyncMock` to mock the asyncpg pool, covering: insert_reading returns a UUID string, get_reading_by_id returns None for wrong user_id, soft_delete_reading returns False when reading not found.

Verify: `cd services/api && python -m pytest tests/test_database.py -v`
```

---

## PROMPT 2 — Real Supabase Authentication (P0)

```
Act as a Security & Identity Architect working on the Palmora AI Next.js + FastAPI monorepo.

CONTEXT:
- `apps/web/app/auth/page.tsx` has a complete sign-in/sign-up/recovery UI but the `handleSubmit` function (lines 36–53) only writes fake data to localStorage — it never calls any real auth service.
- `services/api/security.py` validates HMAC guest tokens (format: `gst.<guest_id>.<expires_at>.<sig>`) via `get_current_user_id`. It has no path for Supabase JWTs.
- `services/api/config.py` has `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` fields but no `SUPABASE_JWT_SECRET`.
- `apps/web/lib/api.ts` has `getSessionAuthToken()` which tries localStorage tokens then falls back to creating a guest session.

YOUR TASKS:
1. Install `@supabase/supabase-js` and `@supabase/auth-helpers-nextjs` — add to `apps/web/package.json` devDependencies.

2. Create `apps/web/lib/supabase.ts`:
   - Export a `createBrowserClient()` singleton using `createClientComponentClient` from `@supabase/auth-helpers-nextjs`.
   - Use `process.env.NEXT_PUBLIC_SUPABASE_URL` and `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY`.

3. Refactor `apps/web/app/auth/page.tsx` `handleSubmit`:
   - Import and use the Supabase browser client.
   - `signin` tab: call `supabase.auth.signInWithPassword({ email, password })`. On success redirect to /dashboard. On error show `error.message` in the existing `errorMessage` state.
   - `signup` tab: call `supabase.auth.signUp({ email, password, options: { data: { display_name: displayName || 'Seeker' } } })`. On success show the existing successMessage and redirect.
   - `recovery` tab: call `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/auth' })`. Keep existing success message text.
   - Remove the localStorage fake writes entirely.

4. Update `apps/web/lib/api.ts` `getSessionAuthToken()`:
   - Before the localStorage fallback logic, import the Supabase browser client and call `supabase.auth.getSession()`.
   - If `session?.access_token` exists and is non-empty, return it.
   - Otherwise fall through to the existing HMAC guest token logic (do NOT remove it).

5. In `services/api/security.py`, extend `get_current_user_id`:
   - Add `SUPABASE_JWT_SECRET: str = ""` to `services/api/config.py`.
   - If the Authorization Bearer token starts with `"ey"` (JWT format) AND `settings.SUPABASE_JWT_SECRET` is non-empty: decode with `python-jose` (`jose.jwt.decode`), verify signature with SUPABASE_JWT_SECRET, extract `sub` claim, return it as user_id.
   - Keep the existing HMAC guest token path as the else/fallback.
   - Install `python-jose[cryptography]` and add to requirements.txt.

6. Run `npx tsc --noEmit` in `apps/web` — fix any type errors.
   Run `python -m pytest services/api/tests/ -v` — all 46+ existing tests must still pass.
```

---

## PROMPT 3 — Fix Image Storage (Blob URL, No More SessionStorage Quota) (P1)

```
Act as a Frontend Performance & Storage Engineer working on the Palmora AI Next.js app.

CONTEXT:
- `apps/web/lib/storage.ts` function `saveCurrentImagePreview` (lines 73–84) stores a raw base64 Data URL string directly in `sessionStorage`.
- Mobile Safari's sessionStorage limit is ~5MB. A single palm photo easily exceeds this.
- Line 81 has a comment: "If quota exceeded on large base64, fail silently" — the catch block does nothing, so the image is lost.
- When the image is lost, `apps/web/app/analysis/page.tsx` loads with `imageUrl = null` and shows "No analysis found" to the user even though analysis data is present.
- `apps/web/app/scan/page.tsx` currently converts the File to a data URL via FileReader before calling `saveCurrentImagePreview`.

YOUR TASKS:
1. Refactor `saveCurrentImagePreview` in `apps/web/lib/storage.ts`:
   - Change signature to: `saveCurrentImagePreview(input: File | Blob | string | null): void`
   - If input is `File` or `Blob`: call `URL.createObjectURL(input)`, store the resulting blob URL string (e.g. `"blob:http://..."`) in sessionStorage under `STORAGE_KEYS.CURRENT_IMAGE`. This string is < 200 chars so quota is never an issue.
   - If input is a `string` (data URL, backward compat): try `sessionStorage.setItem(...)`, catch `QuotaExceededError` specifically and `console.warn` with a user-visible message — do NOT silently swallow.
   - If input is `null`: read the existing sessionStorage value first; if it starts with `"blob:"`, call `URL.revokeObjectURL(value)` to free memory; then `sessionStorage.removeItem(STORAGE_KEYS.CURRENT_IMAGE)`.

2. Export a new function `revokeCurrentImagePreview(): void` that:
   - Reads the current sessionStorage value for `STORAGE_KEYS.CURRENT_IMAGE`.
   - If it starts with `"blob:"`, calls `URL.revokeObjectURL(value)`.
   - Calls `sessionStorage.removeItem(STORAGE_KEYS.CURRENT_IMAGE)`.

3. In `apps/web/app/scan/page.tsx`:
   - Find where `saveCurrentImagePreview` is called with a data URL string (currently passing result of FileReader or canvas.toDataURL).
   - Replace it: pass the `selectedFile` (type `File`) object directly to `saveCurrentImagePreview(selectedFile)`. This skips base64 encoding entirely.
   - Make sure `imagePreviewUrl` state (shown in the UI `<img>` tag) is still set via `URL.createObjectURL(selectedFile)` for local display — do not change the display logic.

4. In `apps/web/app/analysis/page.tsx`:
   - In the `useEffect` cleanup (the `return () => { ... }` block), call `revokeCurrentImagePreview()` to prevent tab-lifetime memory leaks.

5. Update TypeScript types throughout — run `npx tsc --noEmit` in `apps/web` and fix all errors.
```

---

## PROMPT 4 — Stripe Payment Integration (P1)

```
Act as a Payments & Commerce Engineer working on the Palmora AI FastAPI + Next.js monorepo.

CONTEXT:
- `apps/web/app/pricing/page.tsx` line 33: `const isPaymentProviderConfigured = false;` — all paid plan CTAs render "Coming Soon" overlays.
- Price constants exist: `PRICES.premiumReport = 4.99`, `PRICES.membershipMonthly = 9.99`.
- `services/api/config.py` has `ENABLE_BILLING_SIMULATION: bool = False` and no Stripe keys.
- The backend has no billing router. `services/api/routers/__init__.py` imports palm, readings, account, analytics routers.

YOUR TASKS:
1. Add `stripe` to `services/api/requirements.txt`.
   Add to `services/api/config.py`:
   - `STRIPE_SECRET_KEY: str = ""`
   - `STRIPE_WEBHOOK_SECRET: str = ""`
   - `STRIPE_PRICE_ID_PREMIUM_REPORT: str = ""`  (filled from Stripe Dashboard)
   - `STRIPE_PRICE_ID_MEMBERSHIP_MONTHLY: str = ""`

2. Create `services/api/routers/billing.py`:
   - `POST /billing/checkout-session` (requires auth via `Depends(get_current_user_id)`):
     - Accepts JSON body `{ "product": "premium_report" | "membership_monthly", "success_url": str, "cancel_url": str }`.
     - If `settings.STRIPE_SECRET_KEY` is empty, raise HTTP 503 "Payment provider not configured".
     - Creates a Stripe Checkout Session (`stripe.checkout.Session.create`) with `mode="payment"` for premium_report, `mode="subscription"` for membership.
     - Returns `{ "checkout_url": session.url }`.
   - `POST /billing/webhook` (NO auth dependency, raw body):
     - Reads raw body bytes and `Stripe-Signature` header.
     - Verifies with `stripe.Webhook.construct_event(body, sig, settings.STRIPE_WEBHOOK_SECRET)`.
     - On `checkout.session.completed`: log the purchase (write to an in-memory `PURCHASES_STORE` dict keyed by user_id for now, DB in Track 1 scope).
     - Returns `{ "received": true }`. On bad signature returns HTTP 400.

3. Register the billing router in `services/api/routers/__init__.py` and mount in `services/api/main.py` as `app.include_router(billing_router, prefix="/api/v1")`.

4. In `apps/web/app/pricing/page.tsx`:
   - Replace `const isPaymentProviderConfigured = false` with:
     `const isPaymentProviderConfigured = !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;`
   - Add an async `handlePurchase(product: 'premium_report' | 'membership_monthly')` function:
     - Calls `POST /api/v1/billing/checkout-session` with auth headers from `getRequiredAuthHeaders()`.
     - On success: `window.location.href = data.checkout_url`.
     - On error: show an inline error message (use existing UI error pattern from the page).
   - Wire each paid plan CTA `onClick` to `handlePurchase` when `isPaymentProviderConfigured` is true.
   - Keep the "Coming Soon" overlay rendering when `isPaymentProviderConfigured` is false.

5. Add `@stripe/stripe-js` to `apps/web/package.json`.
   Create `apps/web/.env.local.example` with `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...`.

6. Write `services/api/tests/test_billing.py` with 2 pytest tests:
   - `test_checkout_session_requires_auth`: POST /api/v1/billing/checkout-session without Authorization header → expect HTTP 401.
   - `test_webhook_rejects_bad_signature`: POST /api/v1/billing/webhook with wrong signature → expect HTTP 400.

Run `python -m pytest services/api/tests/test_billing.py -v`
```

---

## PROMPT 5 — Production Deployment: Docker + CI (P1)

```
Act as a DevOps & Platform Engineer working on the Palmora AI monorepo.

CONTEXT:
- `services/api/main.py` is a FastAPI app running uvicorn. It uses OpenCV (requires libgl1-mesa-glx, libglib2.0-0 on Linux).
- `apps/web` is a Next.js 14+ app. Currently no `output: 'standalone'` in next.config.
- Root `package.json` uses pnpm workspaces (`apps/*`, `packages/*`).
- `services/api/config.py` defines all required environment variables.
- No Dockerfile, no docker-compose, no CI, no .env.example currently exists.

YOUR TASKS:
1. Create `services/api/Dockerfile`:
   - Stage 1 (builder): `FROM python:3.11-slim AS builder`. Install build tools. Copy and pip install requirements.txt into `/install`.
   - Stage 2 (runner): `FROM python:3.11-slim`. Install runtime system deps: `libgl1-mesa-glx libglib2.0-0 curl`. Copy installed packages from builder. Copy source. Create non-root user `palmora` (UID 1001). `USER palmora`. `EXPOSE 8000`.
   - `HEALTHCHECK --interval=30s --timeout=5s CMD curl -f http://localhost:8000/api/health || exit 1`
   - `CMD ["uvicorn", "services.api.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]`

2. Add `output: 'standalone'` to `apps/web/next.config.js` (or next.config.ts). Create `apps/web/Dockerfile`:
   - Stage 1 (deps): `FROM node:20-alpine AS deps`. Copy package.json + pnpm-lock.yaml. Run `npm i -g pnpm && pnpm install --frozen-lockfile`.
   - Stage 2 (builder): `FROM node:20-alpine AS builder`. Copy node_modules from deps. Copy source. Run `pnpm --filter @palmora/web build`.
   - Stage 3 (runner): `FROM node:20-alpine AS runner`. Copy `.next/standalone`, `.next/static`, `public`. Non-root user `nextjs` (UID 1001). `EXPOSE 3000`. `CMD ["node", "server.js"]`.

3. Create `docker-compose.yml` at repo root:
   - Service `postgres`: image `postgres:16-alpine`, env `POSTGRES_DB=palmora POSTGRES_USER=palmora POSTGRES_PASSWORD=palmora_dev`, volume `palmora_data:/var/lib/postgresql/data`, healthcheck with `pg_isready`.
   - Service `api`: build from `./services/api`, `env_file: .env`, `depends_on: {postgres: {condition: service_healthy}}`, port `8000:8000`, env override `DATABASE_URL=postgresql://palmora:palmora_dev@postgres:5432/palmora DATABASE_ENABLED=true`.
   - Service `web`: build from `./apps/web`, `env_file: .env`, `depends_on: [api]`, port `3000:3000`, env `NEXT_PUBLIC_API_URL=http://api:8000`.
   - Named volume `palmora_data`.

4. Create `.env.example` at repo root with every required variable and inline comments:
   ```
   # === Backend Core ===
   SECRET_KEY=                    # REQUIRED: min 32 chars, generate: openssl rand -hex 32
   ENVIRONMENT=development        # production | development
   DATABASE_URL=                  # postgresql://user:pass@host:5432/palmora
   DATABASE_ENABLED=false
   
   # === LLM (at least one required for AI readings) ===
   GEMINI_API_KEY=
   OPENAI_API_KEY=
   
   # === Supabase Auth ===
   SUPABASE_URL=
   SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=
   SUPABASE_JWT_SECRET=
   
   # === Stripe Payments ===
   STRIPE_SECRET_KEY=
   STRIPE_WEBHOOK_SECRET=
   STRIPE_PRICE_ID_PREMIUM_REPORT=
   STRIPE_PRICE_ID_MEMBERSHIP_MONTHLY=
   
   # === Frontend (Next.js) ===
   NEXT_PUBLIC_API_URL=http://localhost:8000
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
   ```

5. Create `.github/workflows/ci.yml`:
   - Trigger: `on: [push, pull_request]`
   - Job `test-backend`: ubuntu-latest, python 3.11, `pip install -r services/api/requirements.txt`, `pytest services/api/tests -v --tb=short`
   - Job `test-frontend`: ubuntu-latest, node 20, install pnpm, `pnpm install`, `pnpm --filter @palmora/web test`
   - Job `typecheck`: ubuntu-latest, node 20, pnpm install, `pnpm --filter @palmora/web exec tsc --noEmit`
   - Job `build-images` (only on push to main): docker build both images. No push unless `DOCKER_REGISTRY` secret is set.

6. Update `README.md` — add a "## Production Quickstart" section:
   `cp .env.example .env` → fill in values → `docker compose up --build`
```

---

## PROMPT 6 — End-to-End & Integration Tests (P2)

```
Act as a QA & Test Infrastructure Engineer working on the Palmora AI monorepo.

CONTEXT:
- `services/api/tests/` has 46 passing pytest unit tests (test_api_endpoints.py, test_cv_pipeline.py, test_security.py, test_readings.py).
- The full user pipeline is: POST /palm/validate → POST /palm/analyze → POST /readings/generate → GET /readings/{id}.
- `apps/web` has 3 Jest tests (`__tests__/`). No Playwright or component tests exist.
- `services/api/cv/validator.py` has `validate_palm_image`. `services/api/cv/crease_analyzer.py` has `analyze_palm_creases`. These are the CPU-bound functions offloaded to threadpool.

YOUR TASKS:
1. Create `services/api/tests/test_integration.py`:
   - Use `httpx.AsyncClient(app=app, base_url="http://test")` as a real ASGI test client (install `httpx` if not in requirements.txt).
   - `@pytest.fixture` that patches `validate_palm_image` and `analyze_palm_creases` to return deterministic fixture values (valid ImageQualityMetrics and PalmFeatures with all lines status="detected").
   - `@pytest.fixture` that creates a guest session token via POST /api/v1/account/guest-session.
   - Test `test_full_pipeline_happy_path`: validates image → analyzes palm → generates reading → fetches reading by ID. Assert HTTP 200 at each step. Assert returned reading has `id` field, `love_reading` section present.
   - Test `test_cross_user_reading_access_forbidden`: user A generates a reading, user B (different guest token) tries GET /api/v1/readings/{reading_id} → expect HTTP 403.
   - Test `test_analyze_requires_auth`: POST /api/v1/palm/analyze without Authorization → expect HTTP 401.

2. Create `services/api/tests/test_load.py`:
   - `test_event_loop_not_blocked_during_analysis`: using asyncio.gather, fire 20 concurrent GET /api/health requests WHILE 1 POST /api/v1/palm/analyze runs (mocked CV functions with artificial 0.5s sleep to simulate load).
   - Assert all 20 health responses return HTTP 200.
   - Assert all 21 requests complete within 8 seconds total.
   - This proves run_in_threadpool keeps the asyncio event loop unblocked.

3. In `apps/web`, install Playwright: add `@playwright/test` to devDependencies.
   Create `apps/web/playwright.config.ts`:
   - `baseURL: 'http://localhost:3000'`, `testDir: './e2e'`, webServer config pointing to `npm run dev`.

4. Create `apps/web/e2e/scan_flow.spec.ts`:
   - Copy a small JPEG to `apps/web/e2e/fixtures/test_palm.jpg` (use any existing test image from `services/api/tests/` if available).
   - `test('full scan to reading flow')`:
     - Navigate to /scan.
     - Use `page.route('**/api/v1/palm/validate', ...)` to mock a successful quality metrics response.
     - Use `page.route('**/api/v1/palm/analyze', ...)` to mock a successful analysis response.
     - Use `page.route('**/api/v1/readings/generate', ...)` to mock a reading report response.
     - Upload `test_palm.jpg` via the file input.
     - Assert the quality check UI appears.
     - Click "Analyze Palm" (or equivalent CTA on scan page).
     - Assert navigation to /analysis.
     - Click "Generate My Reading" button.
     - Assert navigation to /reading page.
     - Assert the reading title text is visible on the page.

5. Add to `apps/web/package.json` scripts:
   - `"test:e2e": "playwright test"`
   - `"test:e2e:ui": "playwright test --ui"`

6. Add e2e as a CI job in `.github/workflows/ci.yml` (requires Track 5 prompt to have been run first):
   - Job `e2e`: ubuntu-latest, node 20, pnpm install, `pnpm --filter @palmora/web exec playwright install --with-deps`, build next app, run `pnpm --filter @palmora/web test:e2e`.

Run backend: `python -m pytest services/api/tests/test_integration.py services/api/tests/test_load.py -v`
Run e2e: `pnpm --filter @palmora/web test:e2e`
```

---

## Order to Run

```
PROMPT 1 (DB Pool)  →  PROMPT 2 (Auth)  →  PROMPT 4 (Stripe)  →  PROMPT 6 (Tests)
PROMPT 3 (Storage)  →  any time, independent
PROMPT 5 (Docker/CI)  →  any time, must be last before shipping
```
