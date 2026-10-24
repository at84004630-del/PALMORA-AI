# Palmora AI — Dual Payment Gateway Setup Runbook (Razorpay + PayPal)

This document provides complete instructions for configuring, testing, and going live with Palmora AI's payment processing infrastructure:
1. **Razorpay** — Primary domestic gateway supporting instant **UPI** (Google Pay, PhonePe, Paytm, BHIM, QR), Indian Debit/Credit cards, and NetBanking in **₹ INR**.
2. **PayPal** — Global international gateway supporting **PayPal Balance** and international cards in **$ USD**.

---

## 1. Razorpay Configuration (UPI & Indian Cards)

### Step 1.1: Create Razorpay Account & Obtain API Keys
1. Go to the [Razorpay Dashboard](https://dashboard.razorpay.com/) and sign in.
2. Under **Account & Settings > API Keys**, generate your **Key ID** and **Key Secret**.
   - Test mode format: `rzp_test_...`
   - Live mode format: `rzp_live_...`
3. Enable **UPI Payments** in your Razorpay dashboard (under Payment Methods). Ensure Intent Flow and QR code flows are active for Google Pay, PhonePe, and Paytm.

### Step 1.2: Register Razorpay Webhook
1. Go to **Settings > Webhooks > Add New Webhook**.
2. Set **Webhook URL** to:
   ```
   https://api.palmora.ai/api/v1/billing/razorpay/webhook
   ```
3. Set **Secret** to a strong secret string (e.g. `openssl rand -hex 24`).
4. Select the following **Active Events**:
   - `order.paid`
   - `payment.captured`
   - `refund.processed`
5. Save the webhook and copy the secret into `RAZORPAY_WEBHOOK_SECRET`.

### Step 1.3: Approved INR Pricing
- **Free Discovery**: ₹0 (1 free reading with instant CV line detection)
- **Deep-Dive Single-Hand Report**: ₹399
- **Dual-Hand Evolution Report**: ₹549
- **Seeker Club Membership**: ₹699 / month (or ₹524/mo on annual plan)

---

## 2. PayPal Configuration (USD & Global Cards)

### Step 2.1: Create PayPal Developer App
1. Go to the [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/applications/).
2. Create an App under **REST API apps**:
   - App Name: `Palmora AI Production`
   - Type: `Merchant`
3. Copy the **Client ID** and **Secret Key**.
4. Set `PAYPAL_MODE=sandbox` for development testing or `PAYPAL_MODE=live` for public launch.

### Step 2.2: Register PayPal Webhook
1. In your PayPal App dashboard, click **Add Webhook**.
2. Set **Webhook URL** to:
   ```
   https://api.palmora.ai/api/v1/billing/paypal/webhook
   ```
3. Select event types:
   - `Checkout order approved` (`CHECKOUT.ORDER.APPROVED`)
   - `Payment capture completed` (`PAYMENT.CAPTURE.COMPLETED`)
4. Copy the Webhook ID into `PAYPAL_WEBHOOK_ID`.

### Step 2.3: Approved USD Pricing
- **Free Discovery**: $0
- **Deep-Dive Single-Hand Report**: $4.99
- **Dual-Hand Evolution Report**: $6.99
- **Seeker Club Membership**: $7.99 / month (or $5.99/mo on annual plan)

---

## 3. Environment Variables Reference

Add these variables to your `.env` (local) or Google Cloud Secret Manager (`palmora-secrets`):

```bash
# Razorpay (India & UPI)
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...

# PayPal (Global & USD)
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_WEBHOOK_ID=...
PAYPAL_MODE=live

# Pricing
PRICE_PREMIUM_REPORT_INR=399
PRICE_DUAL_REPORT_INR=549
PRICE_MEMBERSHIP_INR_MONTHLY=699

PRICE_PREMIUM_REPORT_USD=4.99
PRICE_DUAL_REPORT_USD=6.99
PRICE_MEMBERSHIP_USD_MONTHLY=7.99

# Keep false in production to enforce real transactions
ENABLE_BILLING_SIMULATION=false
```

---

## 4. End-to-End Flow & Verification

### Razorpay Checkout Flow:
1. User selects **UPI & Cards (₹ INR)** on `/pricing`.
2. Client calls `POST /api/v1/billing/razorpay/create-order` with the selected product.
3. Backend creates order in paise (e.g. ₹399 = 39900 paise) and returns `order_id` and `key_id`.
4. Client opens Razorpay Checkout modal (`checkout.js`).
5. User completes payment via Google Pay, PhonePe, Paytm, BHIM, or Card.
6. Razorpay returns `razorpay_payment_id` and `razorpay_signature`.
7. Client calls `POST /api/v1/billing/razorpay/verify`.
8. Backend verifies HMAC-SHA256 signature using `RAZORPAY_KEY_SECRET`. Upon match, user entitlement is updated in PostgreSQL/in-memory store.

### PayPal Checkout Flow:
1. User selects **PayPal & Global ($ USD)** on `/pricing`.
2. Client calls `POST /api/v1/billing/paypal/create-order`.
3. Backend calls PayPal REST API `/v2/checkout/orders` and returns `approve_url`.
4. Client redirects user to PayPal approval page.
5. User approves transaction and PayPal redirects to `/reading?product=...&token=...`.
6. Backend captures payment via `POST /api/v1/billing/paypal/capture-order` and updates user entitlement.

### Anti-Dark-Pattern Guarantee
- If neither provider is configured, the system **fails closed** returning HTTP 503 (`Payment provider not configured`) rather than charging silently or faking purchases.
- All purchases feature a 14-day refund guarantee and 1-click self-serve cancellation.
