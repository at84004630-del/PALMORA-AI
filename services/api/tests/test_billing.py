import pytest
import hmac
import hashlib
from httpx import AsyncClient, ASGITransport
from services.api.main import app
from services.api.config import settings
from services.api.routers.billing import PURCHASES_STORE

@pytest.mark.asyncio
async def test_checkout_session_requires_auth():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # POST /api/v1/billing/checkout-session without Authorization header -> expect HTTP 401
        res = await client.post(
            "/api/v1/billing/checkout-session",
            json={
                "product": "premium_report",
                "success_url": "http://localhost:3000/reading?session_id={CHECKOUT_SESSION_ID}",
                "cancel_url": "http://localhost:3000/pricing",
            }
        )
        assert res.status_code == 401
        assert "detail" in res.json()

@pytest.mark.asyncio
async def test_razorpay_unconfigured_returns_503():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        sess_res = await client.post("/api/v1/account/guest-session")
        assert sess_res.status_code == 200
        token = sess_res.json()["session_token"]

        orig_key = settings.RAZORPAY_KEY_ID
        orig_sec = settings.RAZORPAY_KEY_SECRET
        orig_sim = settings.ENABLE_BILLING_SIMULATION
        settings.RAZORPAY_KEY_ID = ""
        settings.RAZORPAY_KEY_SECRET = ""
        settings.ENABLE_BILLING_SIMULATION = False
        try:
            res = await client.post(
                "/api/v1/billing/razorpay/create-order",
                json={"product": "premium_report"},
                headers={"Authorization": f"Bearer {token}"}
            )
            assert res.status_code == 503
            assert "Payment provider not configured" in res.json()["detail"]
        finally:
            settings.RAZORPAY_KEY_ID = orig_key
            settings.RAZORPAY_KEY_SECRET = orig_sec
            settings.ENABLE_BILLING_SIMULATION = orig_sim

@pytest.mark.asyncio
async def test_razorpay_simulation_order_creation():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        sess_res = await client.post("/api/v1/account/guest-session")
        assert sess_res.status_code == 200
        token = sess_res.json()["session_token"]

        orig_sim = settings.ENABLE_BILLING_SIMULATION
        orig_key = settings.RAZORPAY_KEY_ID
        settings.ENABLE_BILLING_SIMULATION = True
        settings.RAZORPAY_KEY_ID = ""
        try:
            res = await client.post(
                "/api/v1/billing/razorpay/create-order",
                json={"product": "premium_report"},
                headers={"Authorization": f"Bearer {token}"}
            )
            assert res.status_code == 200
            data = res.json()
            assert "order_id" in data
            assert data["order_id"].startswith("order_sim_")
            assert data["amount"] == 39900  # ₹399 in paise
            assert data["currency"] == "INR"
        finally:
            settings.ENABLE_BILLING_SIMULATION = orig_sim
            settings.RAZORPAY_KEY_ID = orig_key

@pytest.mark.asyncio
async def test_razorpay_signature_verification():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        sess_res = await client.post("/api/v1/account/guest-session")
        assert sess_res.status_code == 200
        token = sess_res.json()["session_token"]

        test_secret = "test_razorpay_secret_key_12345"
        orig_sec = settings.RAZORPAY_KEY_SECRET
        orig_sim = settings.ENABLE_BILLING_SIMULATION
        settings.RAZORPAY_KEY_SECRET = test_secret
        settings.ENABLE_BILLING_SIMULATION = False

        order_id = "order_live_987654321"
        payment_id = "pay_live_123456789"
        msg = f"{order_id}|{payment_id}"
        valid_signature = hmac.new(test_secret.encode(), msg.encode(), hashlib.sha256).hexdigest()

        try:
            # 1. Invalid signature test -> 400
            bad_res = await client.post(
                "/api/v1/billing/razorpay/verify",
                json={
                    "razorpay_order_id": order_id,
                    "razorpay_payment_id": payment_id,
                    "razorpay_signature": "invalid_signature_hex",
                    "product": "dual_hand_report",
                },
                headers={"Authorization": f"Bearer {token}"}
            )
            assert bad_res.status_code == 400
            assert "Invalid Razorpay payment signature" in bad_res.json()["detail"]

            # 2. Valid signature test -> 200
            good_res = await client.post(
                "/api/v1/billing/razorpay/verify",
                json={
                    "razorpay_order_id": order_id,
                    "razorpay_payment_id": payment_id,
                    "razorpay_signature": valid_signature,
                    "product": "dual_hand_report",
                },
                headers={"Authorization": f"Bearer {token}"}
            )
            assert good_res.status_code == 200
            data = good_res.json()
            assert data["verified"] is True
            assert data["product"] == "dual_hand_report"
            assert data["payment_id"] == payment_id
        finally:
            settings.RAZORPAY_KEY_SECRET = orig_sec
            settings.ENABLE_BILLING_SIMULATION = orig_sim

@pytest.mark.asyncio
async def test_razorpay_webhook_signature():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        orig_sec = settings.RAZORPAY_WEBHOOK_SECRET
        settings.RAZORPAY_WEBHOOK_SECRET = "webhook_secret_xyz"
        body = b'{"event": "payment.captured", "payload": {"payment": {"entity": {"id": "pay_test_123"}}}}'
        valid_sig = hmac.new(b"webhook_secret_xyz", body, hashlib.sha256).hexdigest()

        try:
            # Missing header -> 400
            res1 = await client.post("/api/v1/billing/razorpay/webhook", content=body)
            assert res1.status_code == 400

            # Bad signature -> 400
            res2 = await client.post(
                "/api/v1/billing/razorpay/webhook",
                content=body,
                headers={"X-Razorpay-Signature": "bad_sig"}
            )
            assert res2.status_code == 400

            # Valid signature -> 200
            res3 = await client.post(
                "/api/v1/billing/razorpay/webhook",
                content=body,
                headers={"X-Razorpay-Signature": valid_sig}
            )
            assert res3.status_code == 200
            assert res3.json()["received"] is True
        finally:
            settings.RAZORPAY_WEBHOOK_SECRET = orig_sec

@pytest.mark.asyncio
async def test_paypal_simulation_order_and_capture():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        sess_res = await client.post("/api/v1/account/guest-session")
        assert sess_res.status_code == 200
        token = sess_res.json()["session_token"]

        orig_sim = settings.ENABLE_BILLING_SIMULATION
        orig_client_id = settings.PAYPAL_CLIENT_ID
        settings.ENABLE_BILLING_SIMULATION = True
        settings.PAYPAL_CLIENT_ID = ""
        try:
            # 1. Create order
            order_res = await client.post(
                "/api/v1/billing/paypal/create-order",
                json={
                    "product": "membership_monthly",
                    "return_url": "http://localhost:3000/reading?session_id={CHECKOUT_SESSION_ID}",
                    "cancel_url": "http://localhost:3000/pricing",
                },
                headers={"Authorization": f"Bearer {token}"}
            )
            assert order_res.status_code == 200
            data = order_res.json()
            assert "order_id" in data
            assert data["order_id"].startswith("PAYPAL_SIM_")
            assert "approve_url" in data
            assert data["currency"] == "USD"
            assert data["amount"] == settings.PRICE_MEMBERSHIP_USD_MONTHLY

            # 2. Capture simulated order
            cap_res = await client.post(
                "/api/v1/billing/paypal/capture-order",
                json={
                    "order_id": data["order_id"],
                    "product": "membership_monthly",
                },
                headers={"Authorization": f"Bearer {token}"}
            )
            assert cap_res.status_code == 200
            assert cap_res.json()["captured"] is True
            assert cap_res.json()["status"] == "COMPLETED"
        finally:
            settings.ENABLE_BILLING_SIMULATION = orig_sim
            settings.PAYPAL_CLIENT_ID = orig_client_id

@pytest.mark.asyncio
async def test_unified_checkout_session_dispatch():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        sess_res = await client.post("/api/v1/account/guest-session")
        assert sess_res.status_code == 200
        token = sess_res.json()["session_token"]

        orig_sim = settings.ENABLE_BILLING_SIMULATION
        settings.ENABLE_BILLING_SIMULATION = True
        try:
            # Razorpay route
            res_rzp = await client.post(
                "/api/v1/billing/checkout-session",
                json={
                    "product": "premium_report",
                    "provider": "razorpay",
                    "success_url": "http://localhost:3000/reading?session_id={CHECKOUT_SESSION_ID}",
                    "cancel_url": "http://localhost:3000/pricing",
                },
                headers={"Authorization": f"Bearer {token}"}
            )
            assert res_rzp.status_code == 200
            data_rzp = res_rzp.json()
            assert data_rzp["provider"] == "razorpay"
            assert "order_sim_" in data_rzp["checkout_url"]

            # PayPal route
            res_pp = await client.post(
                "/api/v1/billing/checkout-session",
                json={
                    "product": "premium_report",
                    "provider": "paypal",
                    "success_url": "http://localhost:3000/reading?session_id={CHECKOUT_SESSION_ID}",
                    "cancel_url": "http://localhost:3000/pricing",
                },
                headers={"Authorization": f"Bearer {token}"}
            )
            assert res_pp.status_code == 200
            data_pp = res_pp.json()
            assert data_pp["provider"] == "paypal"
            assert "PAYPAL_SIM_" in data_pp["checkout_url"]
        finally:
            settings.ENABLE_BILLING_SIMULATION = orig_sim
