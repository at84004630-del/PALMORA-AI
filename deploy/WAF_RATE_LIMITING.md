# Palmora AI — WAF & Edge Rate Limiting Runbook

This guide specifies edge-layer DDoS mitigation and rate-limiting rules for Palmora AI using **Google Cloud Armor** and **Cloudflare WAF**.

---

## 1. Why Edge Rate Limiting is Mandatory

The computer vision endpoint (`POST /api/v1/palm/analyze`) executes multiscale morphological image processing (12-angle Black-Hat transforms, Otsu thresholding, skeletonization, and contour defect analysis). While CPU latency is optimized (~80ms on 2 vCPUs), malicious bursts of high-resolution uploads could exhaust container capacity or trigger runaway horizontal scaling.

Edge rate limiting terminates abusive traffic at the network edge before it reaches container instances.

---

## 2. Google Cloud Armor Setup (GCP Native)

If using Google Cloud HTTPS Load Balancer with Cloud Run backend:

### Step 1: Create the Cloud Armor Policy
```bash
gcloud compute security-policies create palmora-waf-policy \
    --description="Palmora AI edge DDoS and rate limiting policy"
```

### Step 2: Add Rate Limiting Rule on `/api/v1/palm/*`
Cap requests to 20 requests per minute per client IP:
```bash
gcloud compute security-policies rules create 1000 \
    --security-policy=palmora-waf-policy \
    --expression="request.path.matches('/api/v1/palm/.*')" \
    --action=rate-based-ban \
    --rate-limit-threshold-count=20 \
    --rate-limit-threshold-interval-sec=60 \
    --ban-duration-sec=300 \
    --conform-action=allow \
    --exceed-action=deny-429 \
    --enforce-on-key=IP
```

### Step 3: Attach Policy to Cloud Run Backend Service
```bash
gcloud compute backend-services update palmora-api-backend \
    --security-policy=palmora-waf-policy \
    --global
```

---

## 3. Cloudflare WAF Setup (Recommended for Custom Domains)

If routing `https://palmora.ai` and `https://api.palmora.ai` through Cloudflare (Orange Cloud Proxy):

### Rule 1: Vision Endpoint Rate Limiter
- **Rule Name:** `Palmora CV Analyze Flood Protection`
- **When incoming requests match:**
  - `(http.request.uri.path eq "/api/v1/palm/analyze" or http.request.uri.path eq "/api/v1/palm/validate")`
  - AND `http.request.method eq "POST"`
- **Rate limiting criteria:**
  - Requests: `20 requests`
  - Period: `1 minute`
  - Counting characteristics: `IP`
- **Action:** `Managed Challenge` or `Block (Response code 429)`
- **Duration:** `5 minutes`

### Rule 2: Account Deletion Portal Protection
- **Rule Name:** `Delete Account Rate Limiter`
- **When incoming requests match:**
  - `http.request.uri.path eq "/api/v1/account/delete-request"`
- **Rate limiting criteria:**
  - Requests: `5 requests`
  - Period: `1 minute`
  - Counting characteristics: `IP`
- **Action:** `Block (429)`

### Rule 3: File Upload Payload Size Cap
- In Cloudflare Dashboard -> **Rules** -> **Transform Rules** or **WAF**:
  - Enforce max payload limit of `10MB` on `/api/v1/palm/*`.

---

## 4. In-App Defense-in-Depth

Even if edge WAF rules are bypassed or misconfigured, FastAPI enforces distributed rate limits in [`services/api/routers/palm.py`](file:///c:/Users/ABHINAV%20TRIPATHI/startup/services/api/routers/palm.py):
1. User-level limit: 10 scans/minute via `f"cv_analyze:{user_id}"`.
2. IP-level limit: 20 scans/minute via `f"cv_analyze_ip:{client_ip}"`.
3. Validation limit: 20 validations/minute via `f"cv_validate:{client_ip}"`.
4. Max upload size capped at 10MB via `HTTP 413 Payload Too Large`.
