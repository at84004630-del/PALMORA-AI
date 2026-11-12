#!/usr/bin/env python3
"""
Palmora AI — Production Secret Generator & Verification Tool
Generates cryptographically random, high-entropy secrets for deployment
and outputs gcloud Secret Manager configuration commands for Cloud Run.
"""

import secrets
import sys

def main():
    secret_key = secrets.token_hex(32)  # 64-character hex string (256 bits of entropy)
    jwt_secret = secrets.token_hex(32)
    razorpay_webhook_secret = f"whsec_{secrets.token_hex(24)}"
    paypal_webhook_id = f"WH-{secrets.token_hex(12).upper()}"

    print("====================================================================")
    print("        PALMORA AI — PRODUCTION SECRET GENERATION TOOL             ")
    print("====================================================================")
    print("\nGenerated High-Entropy Cryptographic Secrets (256-bit CSPRNG):\n")
    print(f"  SECRET_KEY:              {secret_key}")
    print(f"  SUPABASE_JWT_SECRET:     {jwt_secret}")
    print(f"  RAZORPAY_WEBHOOK_SECRET: {razorpay_webhook_secret}")
    print(f"  PAYPAL_WEBHOOK_ID:       {paypal_webhook_id}")

    print("\n====================================================================")
    print("  Google Cloud Secret Manager Upload Command (palmora-secrets):")
    print("====================================================================")
    print(f"""
# 1. Ensure the secret container exists in your GCP project:
gcloud secrets create palmora-secrets --replication-policy="automatic" 2>/dev/null || true

# 2. Provision or update all live production keys in GCP Secret Manager:
# Replace placeholders with your live Supabase, Razorpay, and PayPal credentials.
gcloud secrets versions add palmora-secrets --data-file=- <<'EOF'
{{
  "secret_key": "{secret_key}",
  "supabase_jwt_secret": "{jwt_secret}",
  "database_url": "postgresql://postgres:[YOUR-SUPABASE-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres?sslmode=require",
  "supabase_url": "https://[YOUR-PROJECT-REF].supabase.co",
  "supabase_service_role_key": "[YOUR-LIVE-SUPABASE-SERVICE-ROLE-KEY]",
  "razorpay_key_id": "rzp_live_[YOUR-LIVE-KEY-ID]",
  "razorpay_key_secret": "[YOUR-LIVE-RAZORPAY-SECRET]",
  "razorpay_webhook_secret": "{razorpay_webhook_secret}",
  "paypal_client_id": "[YOUR-LIVE-PAYPAL-CLIENT-ID]",
  "paypal_client_secret": "[YOUR-LIVE-PAYPAL-CLIENT-SECRET]",
  "paypal_webhook_id": "{paypal_webhook_id}",
  "upstash_redis_rest_url": "https://[YOUR-UPSTASH-INSTANCE].upstash.io",
  "upstash_redis_rest_token": "[YOUR-UPSTASH-REST-TOKEN]"
}}
EOF

# 3. Grant the Cloud Run service account access to read palmora-secrets:
# PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format='value(projectNumber)')
# gcloud secrets add-iam-policy-binding palmora-secrets \\
#     --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \\
#     --role="roles/secretmanager.secretAccessor"
""")
    print("Keep these values safe and never commit live secrets to version control.\n")

if __name__ == "__main__":
    main()

