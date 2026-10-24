# Palmora AI — Privacy, Security & Release Readiness Audit

## 1. Executive Summary & Privacy Posture

Palmora AI implements an **ephemeral-by-design, non-biometric privacy architecture**. Unlike legacy astrology and chiromancy apps that harvest user facial selfies, palm photos, and contact lists to train closed models or sell data to brokers, Palmora processes palm photographs strictly in volatile server RAM and discards them immediately upon feature extraction.

> [!IMPORTANT]
> **Legal Notice**: Implementing technical privacy controls and disclosure forms does not constitute legal certification. This checklist documents current technical safeguards and identifies remaining formal legal and external review items required prior to commercial production release.

---

## 2. Regulatory & App Store Compliance Matrix

| Requirement / Standard | Current Technical Implementation | Status | Remaining Legal / Operational Items |
| :--- | :--- | :--- | :--- |
| **GDPR (EU) Art. 6 & 9**<br>*(Lawful Basis & Special Category Data)* | Ephemeral processing in volatile memory; zero server persistence of user photos; no biometric identification (minutiae/fingerprints); explicit affirmative consent on `/scan`. | **Implemented** | Formal Data Protection Impact Assessment (DPIA) review with European privacy counsel; EU Standard Contractual Clauses (SCCs) for cloud hosting. |
| **GDPR Art. 17**<br>*(Right to Erasure / "Be Forgotten")* | One-click local storage deletion in browser (`/settings` & `/delete-account`); public web portal (`/delete-account`) queues server record erasure; analytics event `account_deletion_requested` tracked. | **Implemented** | Automated webhook job connecting queue to customer support CRM and cold database backups. |
| **CCPA / CPRA (California)**<br>*(Notice at Collection & Do Not Sell)* | Explicit Notice at Collection on `/scan` and `/privacy`; "Do Not Sell or Share My Personal Information" policy; zero third-party tracking pixels or ad data brokers. | **Implemented** | Annual California Privacy Rights verification log review; registered agent contact verification. |
| **Apple App Store Review Guidelines**<br>*(Guideline 5.1.1 - Data Collection & Storage)* | Privacy nutrition labels drafted; only camera capture accessed with user intent; ephemeral photo handling. | **Implemented** | Final App Store Connect Privacy Nutrition Label submission review. |
| **Apple App Store Review Guidelines**<br>*(Guideline 5.1.1(v) - Account Deletion)* | In-app deletion control in settings; dedicated public external web resource at `https://palmora.ai/delete-account`. | **Implemented** | Link verified in App Store Connect app metadata. |
| **Google Play Data Safety Policy**<br>*(Biometric Data & Ephemeral Processing)* | Explicitly declared as non-biometric entertainment/lifestyle; ephemeral in-memory processing declared; public account deletion URL provided. | **Implemented** | Play Console Data Safety questionnaire completion. |
| **FTC Act Section 5**<br>*(Unfair & Deceptive Trade Practices)* | Transparent pricing with disabled checkout when gateway unconfigured; zero fabricated countdown timers; explicit cultural folklore disclaimer on all readings. | **Implemented** | Consumer protection audit of all paid marketing copy. |

---

## 3. Technical Safeguards & Architecture Verification

### 3.1 Ephemeral Image Processing Pipeline
```
Browser Camera / File Input
       │ (Encrypted via TLS 1.3)
       ▼
FastAPI `POST /api/v1/palm/analyze`
       │
       ├─► In-Memory Byte Stream (io.BytesIO / np.frombuffer)
       ├─► cv2.imdecode in volatile RAM (0 bytes written to disk)
       ├─► Otsu + Euclidean Distance Transform Palm Disc Localization
       ├─► Morphological Crease Spline Extraction
       ├─► Structured JSON Metadata generated
       ▼
Memory Garbage Collection (Image buffer explicitly dereferenced)
       ▼
Browser receives non-biometric coordinate path JSON only
```

- **Temporary File Cleanup**: Unit test `test_no_unnecessary_files_persisted` verifies zero `.jpg`, `.png`, or `.tmp` files are left on server filesystems.
- **Secure Transmission**: Enforced TLS 1.3 over HTTPS in production; local development uses strict CORS origin allowlists.

### 3.2 Strict Non-Biometric Classification
- Palmora detects **macro flexion creases** (skin hinge folds formed in utero along metacarpal joints).
- Palmora **does NOT** extract:
  - Friction ridge minutiae (fingerprints).
  - Facial landmarks or geometry.
  - Iris or retina patterns.
  - Person-identification biometric vectors.
- Images are never indexed, fingerprinted, or cross-referenced against criminal, immigration, or identity registries.

### 3.3 AI Provider & Model Training Isolation
- **LLM Decoupling**: Raw images are **never** passed to external multimodal AI models.
- **Input Boundaries**: Large Language Models (LLMs) receive only structured, validated numerical coordinates and historical interpretation database records.
- **Training Policy**: Palmora does not permit external foundation model providers to train on user reading prompts or generated reflections. All LLM API configurations specify zero-retention / opt-out of training data.

### 3.4 Telemetry & Analytics Privacy Isolation
The telemetry endpoint (`/api/v1/analytics/track`) enforces automated redaction of sensitive properties:
- **Disallowed in Telemetry**: Raw photos, base64 strings, full reading text, passwords, credit card tokens, personal names.
- **Allowed in Telemetry**: High-level event names (`scan_started`, `reading_saved`), browser device type, anonymized referral codes, experiment variant tags, and numerical latency.

---

## 4. Pre-Launch Release Readiness Checklist

- [x] **Ephemeral Image Handling**: Verified 100% RAM processing with instant garbage collection.
- [x] **Actionable Quality Feedback**: Real-time rejection of blurry, underexposed, or inverted photos.
- [x] **Separation of CV & LLM**: Deterministic coordinate extraction completely segregated from text generation.
- [x] **No Hallucinated Readings**: Features marked `uncertain` or `not_detected` trigger retake prompts rather than made-up text.
- [x] **Culture & Folklore Framing**: Explicit notices that readings are cultural folklore and contemplative self-reflection, not medical or future predictions.
- [x] **Public Account Deletion URL**: Live at `/delete-account` meeting Apple Guideline 5.1.1(v) and Google Play rules.
- [x] **Transparent Monetization**: Payment checkout disabled until production merchant gateway is connected; no simulated credit card charges.
- [x] **Search Engine Optimization**: XML sitemap, robots.txt, canonical metadata, and 6 original educational guides implemented.
- [x] **Privacy-Safe Sharing**: 9:16 vertical story cards with user palm photo thumbnail hidden by default.
- [ ] **External Legal Audit**: Retain accredited privacy counsel for formal EU/US regulatory sign-off.
- [ ] **Production Merchant Configuration**: Connect and test live Stripe/LemonSqueezy webhooks with test cards.
- [ ] **DDoS & Rate Limiting**: Deploy Cloudflare / reverse-proxy rate limiting on `/api/v1/palm/analyze` to prevent compute exhaustion.
