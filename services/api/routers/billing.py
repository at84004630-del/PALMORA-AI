from typing import Literal, Dict, Any, List, Optional
import time
import uuid
import hmac
import hashlib
import logging
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Header, Request, status
import httpx
import razorpay

from ..config import settings
from ..security import get_current_user_id
from ..database import get_db_pool, update_user_entitlement

logger = logging.getLogger("palmora.billing")

router = APIRouter(prefix="/billing", tags=["Billing & Payments"])

# In-memory purchases store keyed by user_id for tracking purchase fulfillment
PURCHASES_STORE: Dict[str, List[Dict[str, Any]]] = {}

def fulfill_user_purchase(user_id: str, product: str) -> None:
    """
    Fulfills user entitlement in the in-memory USER_PROFILES store, ensuring
    subscription_tier, readings_quota, and consultation entitlements immediately
    reflect the completed purchase.
    """
    try:
        from .account import USER_PROFILES
        from ..schemas.account import UserProfile
        from datetime import datetime, timezone

        str_uid = str(user_id)
        if str_uid in USER_PROFILES:
            profile = USER_PROFILES[str_uid]
        else:
            profile = UserProfile(
                id=str_uid,
                email=f"{str_uid}@palmora.ai",
                display_name="Seeker",
                created_at=datetime.now(timezone.utc).isoformat(),
                subscription_tier="free",
                readings_count=0,
                quota_limit=1,
                retention_policy="ephemeral_only"
            )
            USER_PROFILES[str_uid] = profile

        if product == "membership_monthly":
            profile.subscription_tier = "membership"
            profile.quota_limit = 999
        elif product == "dual_hand_report":
            if profile.subscription_tier != "membership":
                profile.subscription_tier = "dual_hand"
            profile.quota_limit = max(profile.quota_limit, 5)
        elif product == "premium_report":
            if profile.subscription_tier not in ("membership", "dual_hand"):
                profile.subscription_tier = "premium_report"
            profile.quota_limit = max(profile.quota_limit, 3)
    except Exception as exc:
        logger.warning(f"Could not synchronize USER_PROFILES for user {user_id}: {exc}")

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class CheckoutSessionRequest(BaseModel):
    product: Literal["premium_report", "dual_hand_report", "membership_monthly"]
    provider: Literal["razorpay", "paypal"] = "razorpay"
    currency: Optional[Literal["INR", "USD"]] = None
    success_url: str
    cancel_url: str

class CheckoutSessionResponse(BaseModel):
    checkout_url: str
    order_id: Optional[str] = None
    provider: str = "razorpay"

class RazorpayOrderRequest(BaseModel):
    product: Literal["premium_report", "dual_hand_report", "membership_monthly"]

class RazorpayOrderResponse(BaseModel):
    order_id: str
    amount: int  # in paise
    currency: str = "INR"
    key_id: str
    product: str

class RazorpayVerifyRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    product: Literal["premium_report", "dual_hand_report", "membership_monthly"]

class RazorpayVerifyResponse(BaseModel):
    verified: bool
    product: str
    payment_id: str
    message: str

class PayPalOrderRequest(BaseModel):
    product: Literal["premium_report", "dual_hand_report", "membership_monthly"]
    return_url: str
    cancel_url: str

class PayPalOrderResponse(BaseModel):
    order_id: str
    approve_url: str
    currency: str = "USD"
    amount: float
    product: str

class PayPalCaptureRequest(BaseModel):
    order_id: str
    product: Optional[Literal["premium_report", "dual_hand_report", "membership_monthly"]] = None

class PayPalCaptureResponse(BaseModel):
    captured: bool
    order_id: str
    status: str

class WebhookResponse(BaseModel):
    received: bool

# ---------------------------------------------------------------------------
# Pricing Helpers
# ---------------------------------------------------------------------------

def get_product_amount_inr(product: str) -> int:
    """Returns amount in paise (1 INR = 100 paise)"""
    if product == "premium_report":
        return int(settings.PRICE_PREMIUM_REPORT_INR * 100)
    elif product == "dual_hand_report":
        return int(settings.PRICE_DUAL_REPORT_INR * 100)
    elif product == "membership_monthly":
        return int(settings.PRICE_MEMBERSHIP_INR_MONTHLY * 100)
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unsupported product '{product}'")

def get_product_amount_usd(product: str) -> float:
    """Returns amount in USD dollars"""
    if product == "premium_report":
        return float(settings.PRICE_PREMIUM_REPORT_USD)
    elif product == "dual_hand_report":
        return float(settings.PRICE_DUAL_REPORT_USD)
    elif product == "membership_monthly":
        return float(settings.PRICE_MEMBERSHIP_USD_MONTHLY)
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unsupported product '{product}'")

def get_product_title(product: str) -> str:
    titles = {
        "premium_report": "Palmora Premium Crease Report",
        "dual_hand_report": "Palmora Dual-Hand Evolution Report",
        "membership_monthly": "Palmora Monthly Membership",
    }
    return titles.get(product, "Palmora AI Reading")

# ---------------------------------------------------------------------------
# Razorpay Client & Endpoints (UPI, Cards, NetBanking in INR)
# ---------------------------------------------------------------------------

def is_razorpay_configured() -> bool:
    key_id = (settings.RAZORPAY_KEY_ID or "").strip()
    secret = (settings.RAZORPAY_KEY_SECRET or "").strip()
    return bool(key_id and secret and not key_id.startswith("rzp_test_placeholder"))

def get_razorpay_client() -> Optional[razorpay.Client]:
    if not is_razorpay_configured():
        return None
    return razorpay.Client(auth=(settings.RAZORPAY_KEY_ID.strip(), settings.RAZORPAY_KEY_SECRET.strip()))

@router.post("/razorpay/create-order", response_model=RazorpayOrderResponse)
async def create_razorpay_order(
    payload: RazorpayOrderRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    Creates a Razorpay Order for UPI, Cards, and NetBanking payments in INR.
    Requires user authentication token.
    Fails closed with HTTP 503 if Razorpay credentials are not configured.
    """
    amount_paise = get_product_amount_inr(payload.product)

    if not is_razorpay_configured():
        if settings.ENABLE_BILLING_SIMULATION:
            sim_order_id = f"order_sim_{uuid.uuid4().hex[:12]}"
            return RazorpayOrderResponse(
                order_id=sim_order_id,
                amount=amount_paise,
                currency="INR",
                key_id="rzp_test_simulated",
                product=payload.product,
            )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Payment provider not configured"
        )

    client = get_razorpay_client()
    try:
        receipt_id = f"rcpt_{user_id[:8]}_{int(time.time())}"
        order_data = {
            "amount": amount_paise,
            "currency": "INR",
            "receipt": receipt_id,
            "notes": {
                "user_id": str(user_id),
                "product": payload.product,
            },
        }
        order = client.order.create(data=order_data)
        logger.info(f"Created Razorpay order {order['id']} for user {user_id} ({payload.product})")
        return RazorpayOrderResponse(
            order_id=order["id"],
            amount=order["amount"],
            currency=order.get("currency", "INR"),
            key_id=settings.RAZORPAY_KEY_ID.strip(),
            product=payload.product,
        )
    except Exception as e:
        logger.error(f"Failed to create Razorpay order: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create Razorpay order: {str(e)}"
        )

@router.post("/razorpay/verify", response_model=RazorpayVerifyResponse)
async def verify_razorpay_payment(
    payload: RazorpayVerifyRequest,
    user_id: str = Depends(get_current_user_id),
    pool: Optional[Any] = Depends(get_db_pool)
):
    """
    Verifies the cryptographic HMAC-SHA256 signature returned by Razorpay Checkout.
    Fulfills user entitlement upon valid signature.
    """
    # 1. Simulation verification
    if settings.ENABLE_BILLING_SIMULATION and payload.razorpay_order_id.startswith("order_sim_"):
        user_purchases = PURCHASES_STORE.setdefault(str(user_id), [])
        user_purchases.append({
            "order_id": payload.razorpay_order_id,
            "payment_id": payload.razorpay_payment_id,
            "product": payload.product,
            "provider": "razorpay_simulation",
            "created_at": int(time.time()),
        })
        fulfill_user_purchase(str(user_id), str(payload.product))
        if pool is not None:
            await update_user_entitlement(pool, str(user_id), str(payload.product))
        return RazorpayVerifyResponse(
            verified=True,
            product=payload.product,
            payment_id=payload.razorpay_payment_id,
            message="Payment simulated successfully",
        )

    # 2. Cryptographic signature verification
    secret = (settings.RAZORPAY_KEY_SECRET or "").strip()
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Payment provider not configured"
        )

    msg = f"{payload.razorpay_order_id}|{payload.razorpay_payment_id}"
    expected_signature = hmac.new(
        secret.encode("utf-8"),
        msg.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(expected_signature, payload.razorpay_signature):
        logger.warning(f"Razorpay signature mismatch for order {payload.razorpay_order_id}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Razorpay payment signature"
        )

    # 3. Fulfill purchase
    user_purchases = PURCHASES_STORE.setdefault(str(user_id), [])
    user_purchases.append({
        "order_id": payload.razorpay_order_id,
        "payment_id": payload.razorpay_payment_id,
        "product": payload.product,
        "provider": "razorpay",
        "created_at": int(time.time()),
    })
    fulfill_user_purchase(str(user_id), str(payload.product))
    if pool is not None:
        await update_user_entitlement(pool, str(user_id), str(payload.product))

    logger.info(f"Verified Razorpay payment {payload.razorpay_payment_id} for user {user_id} ({payload.product})")
    return RazorpayVerifyResponse(
        verified=True,
        product=payload.product,
        payment_id=payload.razorpay_payment_id,
        message="Payment verified and product unlocked successfully",
    )

@router.post("/razorpay/webhook", response_model=WebhookResponse)
async def razorpay_webhook(
    request: Request,
    x_razorpay_signature: Optional[str] = Header(None, alias="X-Razorpay-Signature"),
    pool: Optional[Any] = Depends(get_db_pool)
):
    """
    Receives and cryptographically verifies asynchronous webhook events from Razorpay.
    Fails closed with HTTP 400 on missing or invalid signature.
    """
    if not x_razorpay_signature:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing X-Razorpay-Signature header"
        )

    body = await request.body()
    webhook_secret = (settings.RAZORPAY_WEBHOOK_SECRET or "").strip()
    if not webhook_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Webhook secret not configured"
        )

    expected_signature = hmac.new(
        webhook_secret.encode("utf-8"),
        body,
        hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(expected_signature, x_razorpay_signature):
        logger.warning("Razorpay webhook signature verification failed")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid webhook signature"
        )

    try:
        event = await request.json()
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON payload")

    event_type = event.get("event")
    payload = event.get("payload", {})
    payment_entity = payload.get("payment", {}).get("entity", {})
    order_entity = payload.get("order", {}).get("entity", {})

    notes = payment_entity.get("notes") or order_entity.get("notes") or {}
    user_id = notes.get("user_id")
    product = notes.get("product")

    if event_type in ("order.paid", "payment.captured"):
        payment_id = payment_entity.get("id")
        order_id = order_entity.get("id") or payment_entity.get("order_id")
        if user_id and product:
            user_purchases = PURCHASES_STORE.setdefault(str(user_id), [])
            user_purchases.append({
                "order_id": order_id,
                "payment_id": payment_id,
                "product": product,
                "amount": payment_entity.get("amount"),
                "currency": payment_entity.get("currency"),
                "provider": "razorpay_webhook",
                "created_at": int(time.time()),
            })
            fulfill_user_purchase(str(user_id), str(product))
            if pool is not None:
                await update_user_entitlement(pool, str(user_id), str(product))
            logger.info(f"Fitted entitlement via Razorpay webhook for user {user_id}: {payment_id}")

    elif event_type == "refund.processed":
        payment_id = payload.get("refund", {}).get("entity", {}).get("payment_id")
        logger.info(f"Processed refund event for Razorpay payment {payment_id}")
        for uid, purchases in PURCHASES_STORE.items():
            for p in purchases:
                if p.get("payment_id") == payment_id:
                    p["status"] = "refunded"

    return WebhookResponse(received=True)

# ---------------------------------------------------------------------------
# PayPal Client & Endpoints (Global Cards & PayPal Balance in USD)
# ---------------------------------------------------------------------------

def is_paypal_configured() -> bool:
    client_id = (settings.PAYPAL_CLIENT_ID or "").strip()
    secret = (settings.PAYPAL_CLIENT_SECRET or "").strip()
    return bool(client_id and secret and not client_id.startswith("paypal_client_placeholder"))

def get_paypal_base_url() -> str:
    mode = (settings.PAYPAL_MODE or "sandbox").strip().lower()
    return "https://api-m.paypal.com" if mode == "live" else "https://api-m.sandbox.paypal.com"

async def get_paypal_access_token() -> str:
    """Retrieves an OAuth2 bearer token from PayPal REST API."""
    base_url = get_paypal_base_url()
    client_id = settings.PAYPAL_CLIENT_ID.strip()
    client_secret = settings.PAYPAL_CLIENT_SECRET.strip()

    async with httpx.AsyncClient(timeout=10.0) as client:
        res = await client.post(
            f"{base_url}/v1/oauth2/token",
            auth=(client_id, client_secret),
            data={"grant_type": "client_credentials"},
            headers={"Accept": "application/json", "Accept-Language": "en_US"},
        )
        if res.status_code != 200:
            logger.error(f"PayPal OAuth failed: {res.status_code} - {res.text}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Unable to authenticate with PayPal payment service"
            )
        data = res.json()
        return data["access_token"]

@router.post("/paypal/create-order", response_model=PayPalOrderResponse)
async def create_paypal_order(
    payload: PayPalOrderRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    Creates a PayPal v2 checkout order for USD payments.
    Requires user authentication token.
    Fails closed with HTTP 503 if PayPal credentials are not configured.
    """
    amount_usd = get_product_amount_usd(payload.product)

    if not is_paypal_configured():
        if settings.ENABLE_BILLING_SIMULATION:
            sim_order_id = f"PAYPAL_SIM_{uuid.uuid4().hex[:10]}"
            sim_url = payload.return_url.replace("{CHECKOUT_SESSION_ID}", sim_order_id)
            if "{CHECKOUT_SESSION_ID}" not in payload.return_url:
                delim = "&" if "?" in payload.return_url else "?"
                sim_url = f"{payload.return_url}{delim}token={sim_order_id}"
            return PayPalOrderResponse(
                order_id=sim_order_id,
                approve_url=sim_url,
                currency="USD",
                amount=amount_usd,
                product=payload.product,
            )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Payment provider not configured"
        )

    token = await get_paypal_access_token()
    base_url = get_paypal_base_url()
    product_title = get_product_title(payload.product)

    order_payload = {
        "intent": "CAPTURE",
        "purchase_units": [
            {
                "reference_id": str(user_id),
                "description": product_title,
                "custom_id": f"{user_id}:{payload.product}",
                "amount": {
                    "currency_code": "USD",
                    "value": f"{amount_usd:.2f}",
                },
            }
        ],
        "application_context": {
            "return_url": payload.return_url,
            "cancel_url": payload.cancel_url,
            "brand_name": "Palmora AI",
            "user_action": "PAY_NOW",
        },
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        res = await client.post(
            f"{base_url}/v2/checkout/orders",
            json=order_payload,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
        )
        if res.status_code not in (200, 201):
            logger.error(f"PayPal create-order error: {res.status_code} - {res.text}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Failed to initiate PayPal checkout order"
            )

        order_data = res.json()
        order_id = order_data["id"]
        approve_url = ""
        for link in order_data.get("links", []):
            if link.get("rel") == "approve":
                approve_url = link.get("href")
                break

        if not approve_url:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="PayPal did not return an approval link"
            )

        return PayPalOrderResponse(
            order_id=order_id,
            approve_url=approve_url,
            currency="USD",
            amount=amount_usd,
            product=payload.product,
        )

@router.post("/paypal/capture-order", response_model=PayPalCaptureResponse)
async def capture_paypal_order(
    payload: PayPalCaptureRequest,
    user_id: str = Depends(get_current_user_id),
    pool: Optional[Any] = Depends(get_db_pool)
):
    """
    Captures an approved PayPal order and fulfills user entitlement.
    """
    # 1. Simulation capture
    if settings.ENABLE_BILLING_SIMULATION and payload.order_id.startswith("PAYPAL_SIM_"):
        product = payload.product or "premium_report"
        user_purchases = PURCHASES_STORE.setdefault(str(user_id), [])
        user_purchases.append({
            "order_id": payload.order_id,
            "product": product,
            "provider": "paypal_simulation",
            "created_at": int(time.time()),
        })
        fulfill_user_purchase(str(user_id), str(product))
        if pool is not None:
            await update_user_entitlement(pool, str(user_id), str(product))
        return PayPalCaptureResponse(
            captured=True,
            order_id=payload.order_id,
            status="COMPLETED",
        )

    if not is_paypal_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Payment provider not configured"
        )

    token = await get_paypal_access_token()
    base_url = get_paypal_base_url()

    async with httpx.AsyncClient(timeout=10.0) as client:
        res = await client.post(
            f"{base_url}/v2/checkout/orders/{payload.order_id}/capture",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
        )
        if res.status_code not in (200, 201):
            logger.error(f"PayPal capture error: {res.status_code} - {res.text}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unable to capture PayPal payment"
            )

        capture_data = res.json()
        capture_status = capture_data.get("status", "")

        if capture_status == "COMPLETED":
            # Extract product and user
            product = payload.product
            units = capture_data.get("purchase_units", [])
            if units:
                custom_id = units[0].get("payments", {}).get("captures", [{}])[0].get("custom_id") or units[0].get("custom_id")
                if custom_id and ":" in custom_id:
                    _, prod_id = custom_id.split(":", 1)
                    product = prod_id

            if not product:
                product = "premium_report"

            user_purchases = PURCHASES_STORE.setdefault(str(user_id), [])
            user_purchases.append({
                "order_id": payload.order_id,
                "product": product,
                "provider": "paypal",
                "created_at": int(time.time()),
            })
            fulfill_user_purchase(str(user_id), str(product))
            if pool is not None:
                await update_user_entitlement(pool, str(user_id), str(product))

            return PayPalCaptureResponse(
                captured=True,
                order_id=payload.order_id,
                status="COMPLETED",
            )
        else:
            return PayPalCaptureResponse(
                captured=False,
                order_id=payload.order_id,
                status=capture_status or "FAILED",
            )

@router.post("/paypal/webhook", response_model=WebhookResponse)
async def paypal_webhook(
    request: Request,
    pool: Optional[Any] = Depends(get_db_pool)
):
    """
    Receives and processes PayPal webhooks (CHECKOUT.ORDER.APPROVED, PAYMENT.CAPTURE.COMPLETED).
    """
    try:
        event = await request.json()
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON payload")

    event_type = event.get("event_type")
    resource = event.get("resource", {})

    if event_type == "PAYMENT.CAPTURE.COMPLETED":
        custom_id = resource.get("custom_id")
        if custom_id and ":" in custom_id:
            user_id, product = custom_id.split(":", 1)
            user_purchases = PURCHASES_STORE.setdefault(str(user_id), [])
            user_purchases.append({
                "capture_id": resource.get("id"),
                "product": product,
                "provider": "paypal_webhook",
                "created_at": int(time.time()),
            })
            fulfill_user_purchase(str(user_id), str(product))
            if pool is not None:
                await update_user_entitlement(pool, str(user_id), str(product))
            logger.info(f"Entitlement fulfilled via PayPal webhook for {user_id}: {product}")

    return WebhookResponse(received=True)

# ---------------------------------------------------------------------------
# Unified Checkout Session Endpoint (Backward Compatible)
# ---------------------------------------------------------------------------

@router.post("/checkout-session", response_model=CheckoutSessionResponse)
async def create_checkout_session(
    payload: CheckoutSessionRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    Unified checkout session dispatcher.
    Routes to Razorpay (for UPI & INR cards) or PayPal (for USD & International).
    Fails closed with HTTP 503 if the selected provider is not configured.
    """
    # 1. PayPal route
    if payload.provider == "paypal":
        order_res = await create_paypal_order(
            payload=PayPalOrderRequest(
                product=payload.product,
                return_url=payload.success_url,
                cancel_url=payload.cancel_url,
            ),
            user_id=user_id,
        )
        return CheckoutSessionResponse(
            checkout_url=order_res.approve_url,
            order_id=order_res.order_id,
            provider="paypal",
        )

    # 2. Razorpay / UPI route (default)
    order_res = await create_razorpay_order(
        payload=RazorpayOrderRequest(product=payload.product),
        user_id=user_id,
    )

    if settings.ENABLE_BILLING_SIMULATION and order_res.order_id.startswith("order_sim_"):
        sim_url = payload.success_url.replace("{CHECKOUT_SESSION_ID}", order_res.order_id)
        if "{CHECKOUT_SESSION_ID}" not in payload.success_url:
            delim = "&" if "?" in payload.success_url else "?"
            sim_url = f"{payload.success_url}{delim}session_id={order_res.order_id}"
        return CheckoutSessionResponse(
            checkout_url=sim_url,
            order_id=order_res.order_id,
            provider="razorpay",
        )

    # For standard web checkout with Razorpay, frontend opens Razorpay Checkout modal
    # or redirect page with the order_id.
    checkout_url = f"{payload.success_url.split('?')[0]}?razorpay_order_id={order_res.order_id}&product={payload.product}"
    return CheckoutSessionResponse(
        checkout_url=checkout_url,
        order_id=order_res.order_id,
        provider="razorpay",
    )
