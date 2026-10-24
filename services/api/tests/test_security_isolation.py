import pytest
from httpx import AsyncClient, ASGITransport
from services.api.main import app
from services.api.security import create_guest_token, create_auth_token
from services.api.routers.palm import EPHEMERAL_ANALYSIS_STORE
from services.api.config import validate_production_secret_key

@pytest.mark.asyncio
async def test_guest_session_generation():
    """Verify that the backend issues signed, verifiable guest session tokens with timestamp."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/v1/account/guest-session")
        assert res.status_code == 200
        data = res.json()
        assert "session_token" in data
        assert data["session_token"].startswith("gst.guest_")
        # Ensure timestamped 4-segment format
        parts = data["session_token"].split(".")
        assert len(parts) == 4
        assert int(parts[2]) > 0
        assert data["is_guest"] is True
        assert "user_id" in data
        assert data["user_id"].startswith("guest_")

@pytest.mark.asyncio
async def test_guest_a_cannot_list_guest_b_readings(synthetic_palm_image_bytes):
    """Regression test: Guest A cannot list Guest B's private readings."""
    token_a, guest_a = create_guest_token()
    token_b, guest_b = create_guest_token()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Guest A generates reading A
        res_a = await client.post(
            "/api/v1/readings/generate",
            headers={"Authorization": f"Bearer {token_a}"},
            json={"tier": "free", "user_notes": "Guest A private notes"}
        )
        assert res_a.status_code == 200
        reading_a_id = res_a.json()["id"]

        # Guest B generates reading B
        res_b = await client.post(
            "/api/v1/readings/generate",
            headers={"Authorization": f"Bearer {token_b}"},
            json={"tier": "free", "user_notes": "Guest B private notes"}
        )
        assert res_b.status_code == 200
        reading_b_id = res_b.json()["id"]

        # Guest A lists readings -> only reading A is present
        list_a = await client.get(
            "/api/v1/readings",
            headers={"Authorization": f"Bearer {token_a}"}
        )
        assert list_a.status_code == 200
        readings_for_a = list_a.json()
        ids_for_a = [r["id"] for r in readings_for_a]
        assert reading_a_id in ids_for_a
        assert reading_b_id not in ids_for_a

        # Guest B lists readings -> only reading B is present
        list_b = await client.get(
            "/api/v1/readings",
            headers={"Authorization": f"Bearer {token_b}"}
        )
        assert list_b.status_code == 200
        readings_for_b = list_b.json()
        ids_for_b = [r["id"] for r in readings_for_b]
        assert reading_b_id in ids_for_b
        assert reading_a_id not in ids_for_b

@pytest.mark.asyncio
async def test_guest_a_cannot_retrieve_guest_b_reading_by_id():
    """Regression test: Guest A cannot retrieve Guest B's reading by ID (403 Forbidden)."""
    token_a, guest_a = create_guest_token()
    token_b, guest_b = create_guest_token()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create reading for Guest B
        res_b = await client.post(
            "/api/v1/readings/generate",
            headers={"Authorization": f"Bearer {token_b}"},
            json={"tier": "free", "user_notes": "Confidential for B"}
        )
        assert res_b.status_code == 200
        reading_b_id = res_b.json()["id"]

        # Guest A attempts to view Guest B's reading -> 403 Forbidden
        get_res = await client.get(
            f"/api/v1/readings/{reading_b_id}",
            headers={"Authorization": f"Bearer {token_a}"}
        )
        assert get_res.status_code == 403
        assert "not have authorization" in get_res.json()["detail"]

@pytest.mark.asyncio
async def test_guest_a_cannot_delete_guest_b_reading():
    """Regression test: Guest A cannot delete Guest B's reading (403 Forbidden)."""
    token_a, guest_a = create_guest_token()
    token_b, guest_b = create_guest_token()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create reading for Guest B
        res_b = await client.post(
            "/api/v1/readings/generate",
            headers={"Authorization": f"Bearer {token_b}"},
            json={"tier": "free", "user_notes": "Delete attempt target"}
        )
        assert res_b.status_code == 200
        reading_b_id = res_b.json()["id"]

        # Guest A attempts to delete Guest B's reading -> 403 Forbidden
        del_res = await client.delete(
            f"/api/v1/readings/{reading_b_id}",
            headers={"Authorization": f"Bearer {token_a}"}
        )
        assert del_res.status_code == 403

        # Confirm reading B still exists for Guest B
        verify_b = await client.get(
            f"/api/v1/readings/{reading_b_id}",
            headers={"Authorization": f"Bearer {token_b}"}
        )
        assert verify_b.status_code == 200

@pytest.mark.asyncio
async def test_guest_cannot_access_authenticated_user_private_readings():
    """Regression test: A guest cannot view or delete an authenticated user's readings."""
    token_auth = create_auth_token("auth_user_demo")
    token_guest, _ = create_guest_token()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Authenticated user creates reading
        res_auth = await client.post(
            "/api/v1/readings/generate",
            headers={"Authorization": f"Bearer {token_auth}"},
            json={"tier": "free", "user_notes": "Private Auth User Reading"}
        )
        assert res_auth.status_code == 200
        auth_reading_id = res_auth.json()["id"]

        # Guest lists readings -> does not include auth reading
        list_res = await client.get(
            "/api/v1/readings",
            headers={"Authorization": f"Bearer {token_guest}"}
        )
        assert list_res.status_code == 200
        ids = [r["id"] for r in list_res.json()]
        assert auth_reading_id not in ids

        # Guest tries to GET auth reading -> 403
        get_res = await client.get(
            f"/api/v1/readings/{auth_reading_id}",
            headers={"Authorization": f"Bearer {token_guest}"}
        )
        assert get_res.status_code == 403

        # Guest tries to DELETE auth reading -> 403
        del_res = await client.delete(
            f"/api/v1/readings/{auth_reading_id}",
            headers={"Authorization": f"Bearer {token_guest}"}
        )
        assert del_res.status_code == 403

@pytest.mark.asyncio
async def test_authenticated_user_can_access_own_readings():
    """Verify that authenticated users can access and manage their own readings."""
    token_auth = create_auth_token("auth_user_demo")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create reading
        res = await client.post(
            "/api/v1/readings/generate",
            headers={"Authorization": f"Bearer {token_auth}"},
            json={"tier": "free", "user_notes": "Auth reading self access"}
        )
        assert res.status_code == 200
        reading_id = res.json()["id"]

        # List readings -> contains reading
        list_res = await client.get(
            "/api/v1/readings",
            headers={"Authorization": f"Bearer {token_auth}"}
        )
        assert list_res.status_code == 200
        ids = [r["id"] for r in list_res.json()]
        assert reading_id in ids

        # Retrieve specific reading -> 200 OK
        get_res = await client.get(
            f"/api/v1/readings/{reading_id}",
            headers={"Authorization": f"Bearer {token_auth}"}
        )
        assert get_res.status_code == 200
        assert get_res.json()["id"] == reading_id

        # Delete own reading -> 200 OK
        del_res = await client.delete(
            f"/api/v1/readings/{reading_id}",
            headers={"Authorization": f"Bearer {token_auth}"}
        )
        assert del_res.status_code == 200
        assert del_res.json()["success"] is True

@pytest.mark.asyncio
async def test_unauthenticated_requests_cannot_bypass_ownership():
    """Verify that unauthenticated requests and forged tokens are rejected with 401 Unauthorized."""
    token_auth = create_auth_token("auth_user_demo")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create private reading
        res = await client.post(
            "/api/v1/readings/generate",
            headers={"Authorization": f"Bearer {token_auth}"},
            json={"tier": "free", "user_notes": "Top secret reading"}
        )
        assert res.status_code == 200
        reading_id = res.json()["id"]

        # 1. Unauthenticated request without headers is rejected with 401
        unauth_get = await client.get(f"/api/v1/readings/{reading_id}")
        assert unauth_get.status_code == 401
        assert "credentials were not provided" in unauth_get.json()["detail"]

        # 2. Unauthenticated request without headers cannot delete private reading
        unauth_del = await client.delete(f"/api/v1/readings/{reading_id}")
        assert unauth_del.status_code == 401

        # 3. Request with tampered/forged token is rejected with 401 Unauthorized
        forged_get = await client.get(
            f"/api/v1/readings/{reading_id}",
            headers={"Authorization": "Bearer gst.guest_tampered.1893456000.invalidsig123"}
        )
        assert forged_get.status_code == 401
        assert "Invalid or expired session credentials" in forged_get.json()["detail"]

        # 4. Request with arbitrary raw UUID is rejected with 401 Unauthorized
        uuid_get = await client.get(
            f"/api/v1/readings/{reading_id}",
            headers={"Authorization": "Bearer 550e8400-e29b-41d4-a716-446655440000"}
        )
        assert uuid_get.status_code == 401

@pytest.mark.asyncio
async def test_cross_user_analysis_id_isolation(synthetic_palm_image_bytes):
    """Verify that an analysis_id generated by User A cannot be accessed by User B."""
    token_a, _ = create_guest_token()
    token_b, _ = create_guest_token()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # User A performs analysis
        files = {"file": ("test_palm.jpg", synthetic_palm_image_bytes, "image/jpeg")}
        ana_res = await client.post(
            "/api/v1/palm/analyze",
            headers={"Authorization": f"Bearer {token_a}"},
            files=files
        )
        assert ana_res.status_code == 200
        analysis_id = ana_res.json()["analysis_id"]

        # User B attempts to generate reading referencing User A's analysis_id
        hijack_res = await client.post(
            "/api/v1/readings/generate",
            headers={"Authorization": f"Bearer {token_b}"},
            json={
                "analysis_id": analysis_id,
                "tier": "free"
            }
        )
        assert hijack_res.status_code == 403
        assert "not have authorization" in hijack_res.json()["detail"]

@pytest.mark.asyncio
async def test_account_deletion_purges_only_calling_user_data():
    """Verify that deleting an account purges only the calling user's readings and revokes the token."""
    token_a, guest_a = create_guest_token()
    token_b, guest_b = create_guest_token()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Generate reading for A and reading for B
        res_a = await client.post(
            "/api/v1/readings/generate",
            headers={"Authorization": f"Bearer {token_a}"},
            json={"tier": "free", "user_notes": "A's reading"}
        )
        reading_a_id = res_a.json()["id"]

        res_b = await client.post(
            "/api/v1/readings/generate",
            headers={"Authorization": f"Bearer {token_b}"},
            json={"tier": "free", "user_notes": "B's reading"}
        )
        reading_b_id = res_b.json()["id"]

        # Guest A deletes account
        del_acc = await client.delete(
            "/api/v1/account",
            headers={"Authorization": f"Bearer {token_a}"}
        )
        assert del_acc.status_code == 200

        # Guest A's token is now revoked on the server -> 401 Unauthorized
        get_a = await client.get(
            f"/api/v1/readings/{reading_a_id}",
            headers={"Authorization": f"Bearer {token_a}"}
        )
        assert get_a.status_code == 401
        assert "revoked" in get_a.json()["detail"]

        # Guest B's reading is still completely intact
        get_b = await client.get(
            f"/api/v1/readings/{reading_b_id}",
            headers={"Authorization": f"Bearer {token_b}"}
        )
        assert get_b.status_code == 200

# =========================================================================
# NEW REGRESSION TESTS FOR AUDIT REMEDIATION
# =========================================================================

@pytest.mark.asyncio
async def test_missing_analysis_owner_fails_closed():
    """Regression test: An unowned or missing analysis record fails closed with 403/404."""
    token, _ = create_guest_token()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Nonexistent analysis ID returns 404
        res_missing = await client.post(
            "/api/v1/readings/generate",
            headers={"Authorization": f"Bearer {token}"},
            json={"analysis_id": "nonexistent_analysis_uuid_999", "tier": "free"}
        )
        assert res_missing.status_code == 404
        assert "not found or expired" in res_missing.json()["detail"]

        # 2. Analysis record with user_id = None fails closed with 403 Forbidden
        EPHEMERAL_ANALYSIS_STORE["unowned_analysis_test"] = {
            "user_id": None,
            "features": {"heart_line": {"name": "Heart Line", "status": "detected", "path": [], "measurements": {}, "confidence": 0.8, "confidence_explanation": "test"}}
        }
        res_unowned = await client.post(
            "/api/v1/readings/generate",
            headers={"Authorization": f"Bearer {token}"},
            json={"analysis_id": "unowned_analysis_test", "tier": "free"}
        )
        assert res_unowned.status_code == 403
        assert "not have authorization" in res_unowned.json()["detail"]

@pytest.mark.asyncio
async def test_legacy_guest_user_analysis_owner_fails_closed():
    """Regression test: An analysis record owned by legacy 'guest_user' cannot be consumed by callers."""
    token, _ = create_guest_token()
    EPHEMERAL_ANALYSIS_STORE["legacy_guest_analysis_test"] = {
        "user_id": "guest_user",
        "features": {"heart_line": {"name": "Heart Line", "status": "detected", "path": [], "measurements": {}, "confidence": 0.8, "confidence_explanation": "test"}}
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # A guest with a real guest token cannot hijack it
        res = await client.post(
            "/api/v1/readings/generate",
            headers={"Authorization": f"Bearer {token}"},
            json={"analysis_id": "legacy_guest_analysis_test", "tier": "free"}
        )
        assert res.status_code == 403

        # An unauthenticated request is rejected at the auth boundary with 401
        res_unauth = await client.post(
            "/api/v1/readings/generate",
            json={"analysis_id": "legacy_guest_analysis_test", "tier": "free"}
        )
        assert res_unauth.status_code == 401

@pytest.mark.asyncio
async def test_malformed_tampered_and_expired_tokens():
    """Regression test: Malformed, tampered, or expired tokens receive 401 responses."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Non-Bearer header
        res1 = await client.get("/api/v1/account", headers={"Authorization": "Basic dXNlcjpwYXNz"})
        assert res1.status_code == 401

        # 2. Malformed token format (too few parts)
        res2 = await client.get("/api/v1/account", headers={"Authorization": "Bearer gst.guest_abc"})
        assert res2.status_code == 401

        # 3. Tampered signature
        token_valid, _ = create_guest_token()
        tampered = token_valid[:-4] + "ffff"
        res3 = await client.get("/api/v1/account", headers={"Authorization": f"Bearer {tampered}"})
        assert res3.status_code == 401

        # 4. Expired token (TTL = -10 seconds in the past)
        expired_token, _ = create_guest_token(ttl_seconds=-10)
        res4 = await client.get("/api/v1/account", headers={"Authorization": f"Bearer {expired_token}"})
        assert res4.status_code == 401
        assert "expired" in res4.json()["detail"].lower()

@pytest.mark.asyncio
async def test_session_revocation_endpoint_and_invalidation():
    """Regression test: Revoking a session immediately invalidates the token on the server."""
    token, guest_id = create_guest_token()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Verify token works initially
        initial_res = await client.get("/api/v1/account", headers={"Authorization": f"Bearer {token}"})
        assert initial_res.status_code == 200

        # Revoke session via endpoint
        revoke_res = await client.post(
            "/api/v1/account/revoke-session",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert revoke_res.status_code == 200
        assert revoke_res.json()["success"] is True

        # Subsequent request with the same token is rejected with 401
        after_res = await client.get("/api/v1/account", headers={"Authorization": f"Bearer {token}"})
        assert after_res.status_code == 401
        assert "revoked" in after_res.json()["detail"].lower()

@pytest.mark.asyncio
async def test_account_deletion_purges_ephemeral_analyses_for_calling_user_only(synthetic_palm_image_bytes):
    """Regression test: Account deletion purges EPHEMERAL_ANALYSIS_STORE entries for caller only."""
    token_a, guest_a = create_guest_token()
    token_b, guest_b = create_guest_token()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # User A performs analysis
        res_a = await client.post(
            "/api/v1/palm/analyze",
            files={"file": ("test_palm.jpg", synthetic_palm_image_bytes, "image/jpeg")},
            headers={"Authorization": f"Bearer {token_a}"}
        )
        assert res_a.status_code == 200
        analysis_a_id = res_a.json()["analysis_id"]

        # User B performs analysis
        res_b = await client.post(
            "/api/v1/palm/analyze",
            files={"file": ("test_palm.jpg", synthetic_palm_image_bytes, "image/jpeg")},
            headers={"Authorization": f"Bearer {token_b}"}
        )
        assert res_b.status_code == 200
        analysis_b_id = res_b.json()["analysis_id"]

        # Confirm both exist in EPHEMERAL_ANALYSIS_STORE
        assert analysis_a_id in EPHEMERAL_ANALYSIS_STORE
        assert analysis_b_id in EPHEMERAL_ANALYSIS_STORE

        # User A deletes account
        del_res = await client.delete("/api/v1/account", headers={"Authorization": f"Bearer {token_a}"})
        assert del_res.status_code == 200

        # User A's analysis record is purged
        assert analysis_a_id not in EPHEMERAL_ANALYSIS_STORE

        # User B's analysis record is still completely intact
        assert analysis_b_id in EPHEMERAL_ANALYSIS_STORE
        assert EPHEMERAL_ANALYSIS_STORE[analysis_b_id]["user_id"] == guest_b

def test_production_secret_key_validation():
    """Verify that production configuration validation fails closed on missing/weak/default secrets."""
    # 1. Empty secret in production raises ValueError
    with pytest.raises(ValueError, match="SECRET_KEY must be configured"):
        validate_production_secret_key("", environment="production")

    # 2. Known default secret in production raises ValueError
    with pytest.raises(ValueError, match="Insecure or known-default"):
        validate_production_secret_key("palmora-security-session-signing-secret-v1-production", environment="production")

    # 3. Secret shorter than 32 characters in production raises ValueError
    with pytest.raises(ValueError, match="at least 32 characters long"):
        validate_production_secret_key("short-secret-under-32-chars", environment="production")

    # 4. Strong 32+ character unique secret in production passes without error
    strong_secret = "a" * 32
    validate_production_secret_key(strong_secret, environment="production")

    # 5. Development environment allows default key
    validate_production_secret_key("palmora-dev-session-signing-key-for-local-testing-only-32bytes", environment="development")


def test_supabase_jwt_verification(monkeypatch):
    """Verifies that Supabase JWT tokens are decoded, signature verified, and sub claim extracted."""
    import uuid
    import time
    from jose import jwt
    from services.api.security import get_current_user_id
    from services.api.config import settings
    from fastapi import HTTPException

    test_secret = "test-supabase-jwt-secret-for-unit-testing-32-bytes"
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", test_secret)

    user_sub = str(uuid.uuid4())

    # 1. Valid Supabase JWT returns sub as user_id
    valid_payload = {
        "sub": user_sub,
        "aud": "authenticated",
        "role": "authenticated",
        "email": "seeker@example.com",
        "exp": int(time.time()) + 3600
    }
    token = jwt.encode(valid_payload, test_secret, algorithm="HS256")
    extracted_user_id = get_current_user_id(f"Bearer {token}")
    assert extracted_user_id == user_sub

    # 2. Expired JWT raises 401 with expired detail
    expired_payload = {
        "sub": user_sub,
        "aud": "authenticated",
        "exp": int(time.time()) - 100
    }
    expired_token = jwt.encode(expired_payload, test_secret, algorithm="HS256")
    with pytest.raises(HTTPException) as exc_info:
        get_current_user_id(f"Bearer {expired_token}")
    assert exc_info.value.status_code == 401
    assert "expired" in exc_info.value.detail.lower()

    # 3. Invalid signature raises 401
    tampered_token = jwt.encode(valid_payload, "wrong-secret-key-32-characters-long", algorithm="HS256")
    with pytest.raises(HTTPException) as exc_info:
        get_current_user_id(f"Bearer {tampered_token}")
    assert exc_info.value.status_code == 401
    assert "invalid" in exc_info.value.detail.lower()

    # 4. Missing sub claim raises 401
    missing_sub_payload = {"email": "test@example.com", "exp": int(time.time()) + 3600}
    missing_sub_token = jwt.encode(missing_sub_payload, test_secret, algorithm="HS256")
    with pytest.raises(HTTPException) as exc_info:
        get_current_user_id(f"Bearer {missing_sub_token}")
    assert exc_info.value.status_code == 401

