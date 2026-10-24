# Palmora AI

> **Scan your palm. Explore your story.**

Palmora AI is a production-ready, full-stack palmistry exploration application that combines real computer vision analysis with traditional cultural interpretations to deliver personalized reflections on Love, Career, and Vitality.

---

## 🌟 Key Features

1. **Real Computer Vision Pipeline:**
   - Evaluates image resolution, sharpness (Laplacian variance), illumination, and hand presence.
   - Segments palm region using Euclidean distance transforms.
   - Extracts anatomical palm creases (Heart, Head, Life, and Fate lines) via multi-angle morphological Black-Hat filtering.
   - Honestly labels features as `detected`, `uncertain`, or `not_detected` without fabricating measurements or fake accuracies.

2. **Interactive Visual Overlay:**
   - Renders detected crease polylines directly over the uploaded palm photograph.
   - Interactive feature toggles (Heart, Head, Life, Fate lines, ROI bounding box, glow effects).
   - Real-time measurement inspector displaying length ratios, curvature indices, and confidence explanations.

3. **Grounded Cultural Readings:**
   - Multi-dimensional reports covering Love, Career, and Personality/Vitality.
   - Grounded strictly in observable crease characteristics rather than generic horoscopes.
   - Thoughtful mindfulness reflection prompts for self-discovery.
   - Provider-independent LLM integration (Gemini / OpenAI compatible) with a verified deterministic cultural fallback library.

4. **Privacy-First Architecture:**
   - Ephemeral image processing: photos are analyzed in-memory and discarded immediately.
   - Zero biometric profiling, surveillance matching, or model training on user photos.
   - Complete GDPR / CCPA compliant data deletion and JSON export controls.

5. **Modern Mystical UI/UX:**
   - Deep midnight backgrounds (`#070913`), elegant gold accents (`#C8AA6E`), subtle celestial particle glow.
   - Mobile-first responsive design tested on desktop, tablet, Android, and iOS browsers.
   - Accessible keyboard navigation and mobile navigation drawer.

---

## 🏗️ Monorepo Architecture

```
palmora-ai/
├── apps/
│   └── web/                   # Next.js 16 (App Router), TypeScript, Tailwind CSS v4, Lucide icons
├── services/
│   └── api/                   # Python FastAPI, OpenCV, Pydantic, LLM provider layer
├── packages/
│   └── shared-types/          # Shared TypeScript type definitions
├── supabase/
│   └── migrations/            # Supabase PostgreSQL schema with Row-Level Security (RLS)
├── docs/                      # Architecture, CV Roadmap, Privacy & Retention specs
├── .env.example               # Environment variables template
└── README.md
```

---

## 🚀 Quickstart & Local Development

### Prerequisites
- **Node.js** >= 18.x
- **Python** >= 3.10
- **npm** >= 9.x

### 1. Backend Service (FastAPI)

```bash
# From repository root:
# 1. Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate       # On Linux/macOS
.venv\Scripts\activate          # On Windows

# 2. Install dependencies
pip install -r services/api/requirements.txt

# 3. Start the FastAPI server
python -m uvicorn services.api.main:app --host 127.0.0.1 --port 8000 --reload
```
The API Swagger documentation will be available at: `http://127.0.0.1:8000/docs`

### 2. Frontend Application (Next.js) & Shared Types

```bash
# From repository root (npm workspaces):
# 1. Install all monorepo workspace dependencies
npm install

# 2. Build shared contract types
npm run build:types

# 3. Start the Next.js development server
npm run dev:web
```
The web application will be live at: `http://localhost:3000`

---

## 🧪 Running Automated Tests

## 🧪 Running Automated Tests & Benchmark Evaluation

### 1. Automated Test Suite (19 Tests)
Run the complete backend test suite covering computer vision validation, crease analysis, reading generation groundedness, referral flows, and sensitive telemetry sanitization:

```bash
# From repository root:
.venv\Scripts\python -m pytest services/api/tests -v
```

All 19 automated tests run in ~3.5s:
- `test_health_endpoint`
- `test_palm_validate_endpoint`
- `test_palm_analyze_endpoint`
- `test_readings_generate_endpoint`
- `test_account_and_quota_endpoints`
- `test_analytics_event_endpoint`
- `test_analytics_track_and_referral_flow` *(NEW: referral attribution & abuse prevention)*
- `test_analytics_sensitive_data_stripped` *(NEW: strict stripping of image & card keys)*
- `test_account_deletion_request_tracking` *(NEW: external portal deletion tracking)*
- `test_validate_palm_image_valid`
- `test_validate_palm_image_blank`
- `test_validate_palm_image_invalid_bytes`
- `test_analyze_palm_creases_on_synthetic_hand`
- `test_analyze_palm_creases_on_unusable_image`
- `test_crease_analyzer_returns_pixel_paths_and_detector_version` *(NEW)*
- `test_validator_returns_actionable_guidance_on_issues` *(NEW)*
- `test_evaluation_suite_benchmark` *(NEW)*
- `test_generate_reading_grounded_fallback`
- `test_unsupported_or_not_detected_features_never_fabricated` *(NEW)*

### 2. Standalone Computer Vision Benchmark Suite
Run the reproducible evaluation benchmark across 7 image capture perturbation conditions (baseline, blurry, underexposed, overexposed, inverted, non-hand, cropped):

```bash
.venv\Scripts\python -m services.api.cv.evaluator
```

### 3. Frontend Production Build & Static Page Generation
Compile all 23 Next.js pages, educational guides, and dynamic sitemap:

```bash
cd apps/web
npm run build
```

---

## 📚 Product & Engineering Documentation

- [docs/product-research.md](file:///docs/product-research.md): Competitor landscape analysis (Nebula, Kasamba, Astroline, Gismart), pricing comparison, public customer complaint taxonomy, and 5 testable product hypotheses.
- [docs/vision-evaluation.md](file:///docs/vision-evaluation.md): Computer vision evaluation methodology, benchmark results, precision/recall, line overlap, and compute cost profile ($0.00 / ~100ms CPU).
- [docs/growth-experiments.md](file:///docs/growth-experiments.md): Growth experiment register with 5 hypotheses, primary metrics, guardrail metrics, and sample size calculations.
- [docs/privacy-and-release-checklist.md](file:///docs/privacy-and-release-checklist.md): Privacy and store release audit against GDPR, CCPA, Apple App Store Guideline 5.1.1(v), and Google Play Data Safety policies.

---

## 🔐 Environment Variables

Copy `.env.example` to `.env` to configure optional credentials:

| Variable | Description | Default |
|---|---|---|
| `HOST` | API host address | `0.0.0.0` |
| `PORT` | API port | `8000` |
| `GEMINI_API_KEY` | Optional Google Gemini API key | *(empty = uses deterministic library)* |
| `OPENAI_API_KEY` | Optional OpenAI API key | *(empty = uses deterministic library)* |
| `SUPABASE_URL` | Optional Supabase Project URL | *(empty = uses local storage)* |
| `SUPABASE_ANON_KEY` | Optional Supabase anon public key | *(empty)* |
| `NEXT_PUBLIC_API_URL` | Frontend API base URL | `http://localhost:8000` |

---

## 📜 Ethical & Cultural Disclaimer

Palmora AI is designed exclusively for contemplative self-reflection, mindfulness, and entertainment. Palmistry is an ancient cultural folklore tradition, not an empirically verified science, psychological diagnosis, or predictive guarantee. Palmora AI never provides medical, financial, or legal advice.
