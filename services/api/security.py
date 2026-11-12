import hmac
import hashlib
import secrets
import time
import uuid
from typing import Optional, Tuple, Dict, Any, Set
from fastapi import Header, HTTPException, status
from .config import settings

# Default TTL for guest session tokens: 7 days
DEFAULT_GUEST_TTL_SECONDS: int = 7 * 24 * 3600
# Default TTL for authenticated user tokens: 30 days
DEFAULT_AUTH_TTL_SECONDS: int = 30 * 24 * 3600

# Server-side revocation registries
REVOKED_TOKENS: Set[str] = set()
REVOKED_SESSIONS: Set[str] = set()

def revoke_token(token: str) -> None:
    """Explicitly revokes a specific token on the server."""
    if token and isinstance(token, str):
        REVOKED_TOKENS.add(token.strip())

def revoke_session(user_id: str) -> None:
    """Explicitly revokes all tokens associated with a given user/session ID on the server."""
    if user_id and isinstance(user_id, str):
        REVOKED_SESSIONS.add(user_id.strip())

def is_revoked(token: str, user_id: Optional[str] = None) -> bool:
    """Checks whether a token or its associated user session has been revoked on the server."""
    if token and token.strip() in REVOKED_TOKENS:
        return True
    if user_id and user_id.strip() in REVOKED_SESSIONS:
        return True
    return False

def create_guest_token(
    guest_id: Optional[str] = None,
    ttl_seconds: int = DEFAULT_GUEST_TTL_SECONDS
) -> Tuple[str, str]:
    """
    Generates a cryptographically random, timestamped, server-verifiable guest session token.
    Format: gst.<guest_id>.<expires_at>.<signature>
    Uses standard RFC 4122 UUID v4 so database and auth layers accept identity without type mismatches.
    """
    if not guest_id:
        guest_id = str(uuid.uuid4())
    else:
        # If legacy non-UUID string was passed, convert deterministically to standard RFC 4122 UUID
        try:
            uuid.UUID(guest_id)
        except (ValueError, AttributeError):
            guest_id = str(uuid.uuid5(uuid.NAMESPACE_OID, str(guest_id)))
    expires_at = int(time.time()) + ttl_seconds
    payload = f"guest:{guest_id}:{expires_at}"
    sig = hmac.new(
        settings.SECRET_KEY.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()[:32]
    token = f"gst.{guest_id}.{expires_at}.{sig}"
    return token, guest_id

def create_auth_token(
    user_id: str,
    ttl_seconds: int = DEFAULT_AUTH_TTL_SECONDS
) -> str:
    """
    Generates a cryptographically signed, timestamped token for an authenticated user.
    Format: usr.<user_id>.<expires_at>.<signature>
    """
    expires_at = int(time.time()) + ttl_seconds
    payload = f"user:{user_id}:{expires_at}"
    sig = hmac.new(
        settings.SECRET_KEY.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()[:32]
    return f"usr.{user_id}.{expires_at}.{sig}"

def verify_token_with_reason(token: str) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """
    Cryptographically verifies an incoming session token and returns the verified
    identity or an explanatory failure reason (e.g. MALFORMED, EXPIRED, REVOKED, INVALID_SIGNATURE).
    Enforces constant-time signature comparison.
    """
    if not token or not isinstance(token, str):
        return None, "MALFORMED"

    token = token.strip()
    if token in REVOKED_TOKENS:
        return None, "REVOKED"

    # Supabase JWT authentication
    if token.startswith("ey") and settings.SUPABASE_JWT_SECRET and settings.SUPABASE_JWT_SECRET.strip():
        try:
            from jose import jwt, JWTError, ExpiredSignatureError
            payload = jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                options={"verify_aud": False}
            )
            user_id = payload.get("sub")
            if not user_id:
                return None, "MALFORMED"
            if str(user_id) in REVOKED_SESSIONS:
                return None, "REVOKED"
            return {"user_id": str(user_id), "is_guest": False, "email": payload.get("email"), "role": payload.get("role")}, None
        except ExpiredSignatureError:
            return None, "EXPIRED"
        except JWTError:
            return None, "INVALID_SIGNATURE"
        except Exception:
            return None, "MALFORMED"

    parts = token.split(".")
    # Timestamped format has 4 parts: <prefix>.<entity_id>.<expires_at>.<signature>
    # Legacy format has 3 parts: <prefix>.<entity_id>.<signature>
    if len(parts) not in (3, 4):
        return None, "MALFORMED"

    prefix = parts[0]
    entity_id = parts[1]

    if entity_id in REVOKED_SESSIONS:
        return None, "REVOKED"

    current_time = int(time.time())

    if prefix == "gst":
        is_valid_uuid = False
        try:
            uuid.UUID(entity_id)
            is_valid_uuid = True
        except (ValueError, AttributeError):
            pass

        if not (entity_id.startswith("guest_") or is_valid_uuid):
            return None, "MALFORMED"

        if len(parts) == 4:
            try:
                expires_at = int(parts[2])
            except ValueError:
                return None, "MALFORMED"

            sig = parts[3]
            if current_time > expires_at:
                return None, "EXPIRED"

            expected_sig = hmac.new(
                settings.SECRET_KEY.encode("utf-8"),
                f"guest:{entity_id}:{expires_at}".encode("utf-8"),
                hashlib.sha256
            ).hexdigest()[:32]

            if hmac.compare_digest(sig, expected_sig):
                resolved_user_id = entity_id
                if not is_valid_uuid:
                    resolved_user_id = str(uuid.uuid5(uuid.NAMESPACE_OID, entity_id))
                return {"user_id": resolved_user_id, "raw_guest_id": entity_id, "is_guest": True, "expires_at": expires_at}, None
            return None, "INVALID_SIGNATURE"

        # Legacy 3-part guest token (without expiry) is rejected for security
        return None, "EXPIRED"

    if prefix == "usr":
        if len(parts) == 4:
            try:
                expires_at = int(parts[2])
            except ValueError:
                return None, "MALFORMED"

            sig = parts[3]
            if current_time > expires_at:
                return None, "EXPIRED"

            expected_sig = hmac.new(
                settings.SECRET_KEY.encode("utf-8"),
                f"user:{entity_id}:{expires_at}".encode("utf-8"),
                hashlib.sha256
            ).hexdigest()[:32]

            if hmac.compare_digest(sig, expected_sig):
                return {"user_id": entity_id, "is_guest": False, "expires_at": expires_at}, None
            return None, "INVALID_SIGNATURE"

        elif len(parts) == 3:
            # Legacy 3-part user token backward compatibility
            sig = parts[2]
            expected_sig = hmac.new(
                settings.SECRET_KEY.encode("utf-8"),
                f"user:{entity_id}".encode("utf-8"),
                hashlib.sha256
            ).hexdigest()[:32]

            if hmac.compare_digest(sig, expected_sig):
                return {"user_id": entity_id, "is_guest": False, "expires_at": None}, None
            return None, "INVALID_SIGNATURE"

    return None, "MALFORMED"

def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """Convenience wrapper returning verified identity dict or None."""
    identity, _ = verify_token_with_reason(token)
    return identity

def get_current_user_id(authorization: Optional[str] = Header(None)) -> str:
    """
    FastAPI dependency that strictly validates caller identity.
    - Requires a valid, unexpired, non-revoked session token (guest or authenticated).
    - Fails closed: missing, malformed, expired, or tampered credentials raise 401 Unauthorized.
    - Never defaults to a shared guest_user identity.
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided."
        )

    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format. Expected 'Bearer <token>'."
        )

    token = authorization[7:].strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session token must not be empty."
        )

    # Supabase JWT authentication branch
    if token.startswith("ey") and settings.SUPABASE_JWT_SECRET and settings.SUPABASE_JWT_SECRET.strip():
        if token in REVOKED_TOKENS:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session credentials have been revoked."
            )
        try:
            from jose import jwt, JWTError, ExpiredSignatureError
            payload = jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                options={"verify_aud": False}
            )
            user_id = payload.get("sub")
            if not user_id:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token payload: missing sub claim."
                )
            if str(user_id) in REVOKED_SESSIONS:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Session credentials have been revoked."
                )
            return str(user_id)
        except ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session credentials have expired."
            )
        except JWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired session credentials."
            )

    # HMAC guest / session token fallback
    identity, reason = verify_token_with_reason(token)
    if not identity:
        if reason == "EXPIRED":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session credentials have expired."
            )
        elif reason == "REVOKED":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session credentials have been revoked."
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired session credentials."
            )

    return identity["user_id"]

def get_optional_user_id(authorization: Optional[str] = Header(None)) -> Optional[str]:
    """
    FastAPI dependency for explicitly public endpoints that may optionally associate
    data with a caller if valid credentials are provided.
    - If no Authorization header is passed, returns None (genuinely anonymous).
    - If an Authorization header is provided, it must be valid; invalid credentials raise 401.
    """
    if not authorization or not authorization.strip():
        return None
    return get_current_user_id(authorization)

