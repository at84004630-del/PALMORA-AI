# Palmora AI — Architectural Documentation

## 1. System Overview

Palmora AI is structured as a modular full-stack application designed to provide respectful, culturally grounded palmistry interpretations based on observable physical hand creases.

```
                           +---------------------------+
                           |     Client Applications   |
                           | (Next.js Web, Future iOS) |
                           +-------------+-------------+
                                         |
                                         | REST / JSON
                                         v
                           +---------------------------+
                           |    FastAPI Gateway API    |
                           |  - Rate Limiting / CORS   |
                           |  - Pydantic Validation    |
                           |  - Privacy Sanitization   |
                           +-------------+-------------+
                                         |
                 +-----------------------+-----------------------+
                 |                                               |
                 v                                               v
     +-----------------------+                       +-----------------------+
     |   Computer Vision     |                       |    Reading Engine     |
     |  - Validator (Blur/   |                       |  - Cultural Library   |
     |    Illumination/Skin) |                       |  - LLM Adapter        |
     |  - Crease Extractor   |                       |    (Gemini/OpenAI)    |
     |  - Polyline Sampler   |                       |  - Grounded Synthesis |
     +-----------------------+                       +-----------------------+
                 |                                               |
                 +-----------------------+-----------------------+
                                         |
                                         v
                           +---------------------------+
                           |  Storage & State Layer    |
                           | - Ephemeral Memory (Base) |
                           | - Supabase PostgreSQL/RLS |
                           | - Private Object Storage  |
                           +---------------------------+
```

## 2. Core Architectural Principles

1. **Non-Biometric & Ephemeral by Default:**
   Palm photographs are processed in-memory to compute ridge contours and discarded immediately. No raw palm photographs are saved as permanent database records.

2. **Grounded Cultural Symbolism:**
   Readings are grounded strictly in observable physical measurements (e.g. curvature index, length ratio) rather than random prompts. If a feature is not observable, it is honestly labeled as `not_detected` rather than hallucinated.

3. **Deterministic Fallback Guarantee:**
   If external LLM APIs are unconfigured or unavailable, the system uses a comprehensive curated traditional palmistry library with zero downtime.

4. **Honest Monetization:**
   Unconfigured payment providers are visibly disabled with clear explanations rather than simulating fake transactions.
