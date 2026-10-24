# Palmora AI Production Orchestration & Deployment Guide

This directory contains the production-grade container orchestration specifications and deployment manifests for Palmora AI.

## Architecture Summary

```
                       [ Public Client Traffic ]
                                   │
                                   ▼
                   ┌──────────────────────────────┐
                   │   Next.js 15 Web Service     │
                   │  (Cloud Run: 1 vCPU, 1Gi RAM)│
                   └───────────────┬──────────────┘
                                   │  /api/v1/* (Reverse Proxy)
                                   ▼
                   ┌──────────────────────────────┐
                   │    FastAPI CV Engine         │
                   │  (Cloud Run: 2 vCPU, 2Gi RAM)│
                   └───┬──────────────────────┬───┘
                       │                      │
        HTTP REST API  │                      │ Async Pool
                       ▼                      ▼
          ┌───────────────────────┐  ┌───────────────────────┐
          │     Upstash Redis     │  │  Supabase PostgreSQL  │
          │  - Ephemeral Scans    │  │  - Row-Level Security │
          │  - Sliding Rate Limits│  │  - User Profiles & RLS│
          └───────────────────────┘  └───────────────────────┘
```

---

## 1. Local Staging Orchestration (Docker Compose)

For multi-container local testing and staging parity:

```bash
# Start all containers in background (PostgreSQL, Redis 7, FastAPI API, Next.js Web)
docker-compose up -d --build

# Inspect running services
docker-compose ps

# Follow logs
docker-compose logs -f api web redis

# Teardown
docker-compose down -v
```

Services exposed locally:
- **Web Client**: http://localhost:3000
- **API Engine**: http://localhost:8000 (Healthcheck: http://localhost:8000/api/health)
- **Postgres Database**: localhost:5432
- **Redis Cache**: localhost:6379

---

## 2. Serverless GCP Cloud Run Deployment

### Prerequisites
1. Install [Google Cloud CLI (`gcloud`)](https://cloud.google.com/sdk/docs/install).
2. Set your Google Cloud project:
   ```bash
   gcloud config set project YOUR_PROJECT_ID
   ```
3. Enable required GCP services:
   ```bash
   gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
   ```

### Secrets Setup (Secret Manager)
Store production secrets in Google Cloud Secret Manager:
```bash
gcloud secrets create palmora-secrets --replication-policy="automatic"

# Add secret payload containing keys:
# upstash_redis_rest_url, upstash_redis_rest_token, supabase_url, supabase_service_role_key, stripe_secret_key, stripe_webhook_secret
```

### Automated Deployment via Cloud Build
Trigger the automated multi-stage build and deploy pipeline:
```bash
gcloud builds submit --config=deploy/cloudrun/cloudbuild.yaml .
```

### Declarative Service Deployment (Knative YAML)
Alternatively, apply Knative service specs directly:
```bash
# Deploy Backend API
gcloud run services replace deploy/cloudrun/service-api.yaml --region=us-central1

# Deploy Frontend Web App
gcloud run services replace deploy/cloudrun/service-web.yaml --region=us-central1
```

---

## 3. High Availability & Failure Recovery
- **Zero Cold Start Option**: Set `autoscaling.knative.dev/minScale: "1"` in `service-api.yaml` during high-traffic launch events.
- **Fail-Open Redis Resilience**: If Upstash Redis is temporarily unavailable or unreachable over network, the FastAPI backend automatically falls back to internal thread-safe `InMemoryTTLStore` without returning 500 errors to users.
- **Strict Ephemeral Biometric Security**: Biometric photos are processed strictly in volatile memory and never written to disk or long-term databases.
