#!/usr/bin/env python3
"""
Palmora AI — Production Secret Generator & Verification Tool
Generates cryptographically random, high-entropy secrets for deployment
and outputs gcloud Secret Manager configuration commands.
"""

import secrets
import sys

def main():
    secret_key = secrets.token_hex(32)  # 64-character hex string (256 bits of entropy)
    jwt_secret = secrets.token_hex(32)
    webhook_secret = f"whsec_{secrets.token_hex(24)}"

    print("====================================================================")
    print("        PALMORA AI — PRODUCTION SECRET GENERATION TOOL             ")
    print("====================================================================")
    print("\nGenerated High-Entropy Cryptographic Secrets (256-bit CSPRNG):\n")
    print(f"  SECRET_KEY:              {secret_key}")
    print(f"  SUPABASE_JWT_SECRET:     {jwt_secret}")
    print(f"  RAZORPAY_WEBHOOK_SECRET: {webhook_secret}")

    print("\n====================================================================")
    print("  Google Cloud Secret Manager Upload Command:")
    print("====================================================================")
    print(f"""
# 1. Create or update the secret in Google Cloud Secret Manager:
gcloud secrets versions add palmora-secrets --data-file=- <<'EOF'
{{
  "secret_key": "{secret_key}",
  "supabase_jwt_secret": "{jwt_secret}",
  "razorpay_webhook_secret": "{webhook_secret}"
}}
EOF
""")
    print("Keep these values safe and never commit them to version control.\n")

if __name__ == "__main__":
    main()
