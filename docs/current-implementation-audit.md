# Palmora AI — Full Codebase Audit & System Inspection Report

**Date:** October 2026  
**Auditor:** Principal Systems, Computer Vision & Security Engineer  
**Classification:** Engineering Audit & Verification  

---

## Executive Summary

This document reports the technical findings of an exhaustive, line-by-line inspection of the Palmora AI repository (`apps/web`, `services/api`, database migrations, dependencies, and automated test suites).

The objective is to establish ground truth regarding:
1. Whether palm line detection is authentic image processing or cosmetic simulation.
2. Whether confidence values are mathematically calculated or arbitrary placeholders.
3. Whether the reading engine is grounded in measured geometric features or generic LLM prompts.
4. Whether frontend flows call live backend endpoints or rely on mock fallbacks.
5. The state of authentication, local persistence, image retention, and error recovery.

---

## 1. Inventory & Inspection Findings

### 1.1 Image Upload & Camera Capture Implementation
- **Source Files:**
  - Camera & File Picker: [`apps/web/app/scan/page.tsx`](file:///c:/Users/ABHINAV%20TRIPATHI/startup/apps/web/app/scan/page.tsx#L55-L165)
  - Video Stream & Retake Guidance: [`apps/web/components/scan/ScanCamera.tsx`](file:///c:/Users/ABHINAV%20TRIPATHI/startup/apps/web/components/scan/ScanCamera.tsx#L38-L125)
  - Client-Side Quality Validator: [`apps/web/lib/cv/qualityValidator.ts`](file:///c:/Users/ABHINAV%20TRIPATHI/startup/apps/web/lib/cv/qualityValidator.ts#L40-L135)
- **Observed Behavior:**
  - Real browser hardware access via `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } })`.
  - Captures actual uncompressed frames to an in-memory `<canvas>` element via `canvas.toDataURL('image/jpeg', 0.88)`.
  - Client-side pre-validation computes Laplacian variance for blur estimation, luminance histograms for over/under-exposure, and aspect ratio checks before transmission.
  - **Audit Finding (P0 - Resolved):** Previously, if `validatePalmImage(base64)` threw a network or parse exception, `apps/web/app/scan/page.tsx` contained a fallback catch block that silently synthesized fake `ImageQualityMetrics` (`blur_score: 55.0, is_acceptable: true`) and allowed processing to proceed with corrupted images.
  - **Remediation Applied:** The catch block in [`apps/web/app/scan/page.tsx`](file:///c:/Users/ABHINAV%20TRIPATHI/startup/apps/web/app/scan/page.tsx#L140-L155) was refactored to halt execution immediately, display an honest error notification ("Image validation failed due to a network or server error. Please retry."), and reset state without inventing validation metrics.

---

### 1.2 Computer Vision Pipeline & Crease Extraction
- **Source Files:**
  - Pre-flight Validation: [`services/api/cv/pre_flight.py`](file:///c:/Users/ABHINAV%20TRIPATHI/startup/services/api/cv/pre_flight.py#L35-L180) (`validate_palm_image`)
  - Crease Extraction Engine: [`services/api/cv/crease_analyzer.py`](file:///c:/Users/ABHINAV%20TRIPATHI/startup/services/api/cv/crease_analyzer.py#L45-L290) (`analyze_palm_creases`)
  - API Router: [`services/api/routers/palm.py`](file:///c:/Users/ABHINAV%20TRIPATHI/startup/services/api/routers/palm.py#L40-L85)
- **Observed Behavior:**
  - **No ML Hand Detector in Production:** The pipeline uses classical deterministic image processing via OpenCV (`cv2`) and NumPy.
  - **Hand Segmentation:** Converted to HSV (`[0, 20, 70]` to `[25, 255, 255]`) and YCrCb (`[0, 133, 77]` to `[255, 173, 127]`) color spaces. Mask intersection and morphological opening/closing segment the skin region.
  - **Palm Region Normalization:** Uses contour moments and minimum enclosing bounding boxes to extract the central 65% palm bounding region, excluding distal phalanges.
  - **Multiscale Crease Extraction:** Upgraded from 8 angles to 12 directional linear structuring elements ($0^\circ, 15^\circ, 30^\circ, \dots, 165^\circ$ with kernel lengths of 11, 19, and 29 pixels) via morphological Black-Hat transforms ($T_{B}(I) = \text{close}(I, K) - I$).
  - **Thresholding:** Uses contrast-adaptive percentile clipping (`clip_percentile = 68` on low contrast images vs. 75 on high contrast) followed by Otsu thresholding and morphological thinning (`cv2.ximgproc.thinning` or skeletonization).

---

### 1.3 Reality of Palm Line Overlays: Real vs. Decorative
- **Source Files:**
  - Overlay Renderer: [`apps/web/components/analysis/PalmOverlayCanvas.tsx`](file:///c:/Users/ABHINAV%20TRIPATHI/startup/apps/web/components/analysis/PalmOverlayCanvas.tsx#L25-L115)
  - Coordinate Generator: [`services/api/cv/crease_analyzer.py`](file:///c:/Users/ABHINAV%20TRIPATHI/startup/services/api/cv/crease_analyzer.py#L185-L260) (`_extract_line_polyline`)
  - Analysis Page Fallback: [`apps/web/app/analysis/page.tsx`](file:///c:/Users/ABHINAV%20TRIPATHI/startup/apps/web/app/analysis/page.tsx#L70-L110)
- **Observed Behavior:**
  - **Live Scan Flow:** Lines are **REAL**. The backend extracts actual $(x, y)$ coordinate point lists (`pixel_coordinates` and normalized `points: [{x, y}]`) from skeletonized contours. `PalmOverlayCanvas.tsx` iterates over `line.points` and draws HTML5 Canvas `ctx.lineTo(pt.x * width, pt.y * height)` paths.
  - **Audit Finding (P0 - Resolved):** In [`apps/web/app/analysis/page.tsx`](file:///c:/Users/ABHINAV%20TRIPATHI/startup/apps/web/app/analysis/page.tsx), if a user navigated to `/analysis` without having completed a scan in `sessionStorage`, the page loaded a hardcoded `mockAnalysis` object containing pre-baked SVG strings (`M 45 130 Q 90 120 150 125...`) and fake line metrics.
  - **Remediation Applied:** The fake `mockAnalysis` fallback was eliminated. If `sessionStorage` lacks authentic scan output, `apps/web/app/analysis/page.tsx` renders an explicit Empty State informing the user that no active palm scan exists and prompts them to complete an authentic scan at `/scan`.

---

### 1.4 Reading Engine: Measured Features vs. Generic Prompts
- **Source Files:**
  - Deterministic Reading Core: [`services/api/reading/generator.py`](file:///c:/Users/ABHINAV%20TRIPATHI/startup/services/api/reading/generator.py#L42-L210) (`generate_grounded_reading`)
  - Structured Prompt Assembler: [`services/api/reading/prompts.py`](file:///c:/Users/ABHINAV%20TRIPATHI/startup/services/api/reading/prompts.py#L30-L105)
  - Reading Router: [`services/api/routers/readings.py`](file:///c:/Users/ABHINAV%20TRIPATHI/startup/services/api/routers/readings.py#L35-L95)
- **Observed Behavior:**
  - The reading engine **does not use generic unconstrained prompts**.
  - `generate_grounded_reading` accepts structured `DetectedCreaseFeatures` (length in mm, curvature ratio, continuity score, orientation angle, branching count).
  - A deterministic rule-based selection layer (`_select_archetype`) maps geometric metrics to symbolic interpretations before invoking an LLM.
  - **Strict Anti-Hallucination Guardrail:** If a line has `detected: false` or low confidence, `services/api/reading/generator.py` suppresses the interpretation for that line, returning `"Line not sufficiently distinct in this photograph. No interpretation generated."`
  - When the optional Gemini API key is configured, the LLM prompt strictly receives:
    - Allowed detected features only.
    - Prohibited topics: Medical diagnostics, fortune-telling, lifespan prediction, financial fortunes.
    - Rule: If a feature is omitted from the prompt, the model is forbidden from inventing it.
  - When Gemini is offline or unconfigured, the system uses the deterministic fallback engine, outputting reproducible, grounded readings.

---

### 1.5 Confidence Scoring: Authentically Calculated vs. Arbitrary
- **Source Files:**
  - Confidence Computation: [`services/api/cv/crease_analyzer.py`](file:///c:/Users/ABHINAV%20TRIPATHI/startup/services/api/cv/crease_analyzer.py#L225-L255)
  - Pre-flight Quality Scoring: [`services/api/cv/pre_flight.py`](file:///c:/Users/ABHINAV%20TRIPATHI/startup/services/api/cv/pre_flight.py#L130-L165)
- **Observed Behavior:**
  - Quality score is calculated from image metrics:
    $$\text{quality\_score} = 0.35 \cdot \text{focus\_score} + 0.35 \cdot \text{exposure\_score} + 0.30 \cdot \text{contrast\_score}$$
  - Crease confidence is calculated per detected line using:
    $$\text{confidence} = 0.40 \cdot \text{length\_score} + 0.40 \cdot \text{continuity\_score} + 0.20 \cdot \min(1.0, \text{quality\_score} \cdot 3.0)$$
  - **Audit Finding (P1):** While confidence is not a hardcoded constant, it is a **heuristic composite index**, not a calibrated Bayesian posterior probability or precision-calibrated ROC metric. It reflects geometric plausibility under image conditions rather than statistical certainty.
  - **Recommendation:** Document this clearly in user-facing UI ("Geometric Clarity Index" rather than "Detection Accuracy %").

---

### 1.6 Frontend-to-Backend Integration
- **Source Files:**
  - API Client: [`apps/web/lib/api.ts`](file:///c:/Users/ABHINAV%20TRIPATHI/startup/apps/web/lib/api.ts#L20-L115)
  - Scan Controller: [`apps/web/app/scan/page.tsx`](file:///c:/Users/ABHINAV%20TRIPATHI/startup/apps/web/app/scan/page.tsx#L85-L155)
  - Analysis Controller: [`apps/web/app/analysis/page.tsx`](file:///c:/Users/ABHINAV%20TRIPATHI/startup/apps/web/app/analysis/page.tsx#L55-L110)
  - Reading Controller: [`apps/web/app/reading/page.tsx`](file:///c:/Users/ABHINAV%20TRIPATHI/startup/apps/web/app/reading/page.tsx#L45-L95)
- **Observed Behavior:**
  - All pages call the real FastAPI backend via `fetch(`${API_BASE_URL}/api/...`)`.
  - Endpoint mappings:
    - `POST /api/palm/validate` -> executes `validate_palm_image`.
    - `POST /api/palm/analyze` -> executes `analyze_palm_creases`.
    - `POST /api/readings/generate` -> executes `generate_grounded_reading`.
  - Real payload verification: base64 image strings are passed in JSON payloads, decoded into numpy arrays on the backend, and responses return measured pixel coordinates and line metrics.

---

### 1.7 Authentication, Persistence, Privacy & Error Handling
- **Source Files:**
  - Client Storage: [`apps/web/lib/storage.ts`](file:///c:/Users/ABHINAV%20TRIPATHI/startup/apps/web/lib/storage.ts#L15-L85)
  - Account Deletion Page: [`apps/web/app/delete-account/page.tsx`](file:///c:/Users/ABHINAV%20TRIPATHI/startup/apps/web/app/delete-account/page.tsx#L18-L90)
  - Privacy Policy: [`apps/web/app/privacy/page.tsx`](file:///c:/Users/ABHINAV%20TRIPATHI/startup/apps/web/app/privacy/page.tsx#L25-L160)
  - Analytics & Anonymization: [`services/api/routers/analytics.py`](file:///c:/Users/ABHINAV%20TRIPATHI/startup/services/api/routers/analytics.py#L30-L75)
- **Observed Behavior:**
  - **Zero Server Image Retention:** Images are decoded directly in memory (`io.BytesIO`) and discarded upon request completion. No raw biometric photographs are written to disk or database tables.
  - **Client-Side Persistence:** Structured readings and anonymous session keys are cached in `localStorage` (`palmora_readings`, `palmora_user_profile`). Active scan frames exist only in transient `sessionStorage` (`palmora_active_scan`).
  - **Data Erasure:** Both client-side purge (`storage.clearAllData()`) and backend logging (`POST /api/account/delete-request`) are fully wired and covered by automated tests.
  - **Authentication:** Currently session-token-based with anonymous pseudonymous user IDs (`usr_anon_...`). Multi-factor auth and OAuth2 providers are not yet implemented.

---

### 1.8 Summary of Incomplete, Mocked, or Untested Components

| Component | Status | Finding | Severity |
|:---|:---|:---|:---:|
| `Scan page catch block` | **Fixed** | Previously synthesized fake quality scores on error. Now safely resets and halts. | P0 |
| `Analysis page fallback` | **Fixed** | Previously rendered hardcoded mock SVG coordinates. Now shows authentic empty state. | P0 |
| `Crease detection angles` | **Upgraded** | Expanded from 8 (22.5° steps) to 12 directional kernels (15° steps) with adaptive clipping. | P1 |
| `Crease confidence metric` | **Documented** | Heuristic composite index rather than calibrated statistical probability. | P1 |
| `Skin segmentation under extreme lighting` | **Limitation** | Static HSV/YCrCb thresholds can fail on extreme shadows or colored stage lighting. | P1 |
| `Hand landmark pose alignment` | **Missing** | MediaPipe or landmark-based hand rotation alignment is not yet integrated. | P2 |
| `User authentication backend` | **Incomplete** | Only anonymous session IDs are supported; persistent cross-device login is absent. | P2 |

---

## 2. Categorized Defect Ledger

### Priority 0 (P0): Critical Integrity Defects (Resolved)
1. **Mock Image Quality Injection:**  
   *File:* [`apps/web/app/scan/page.tsx`](file:///c:/Users/ABHINAV%20TRIPATHI/startup/apps/web/app/scan/page.tsx#L140-L155)  
   *Observed Behavior:* Caught fetch errors silently generated `blur_score: 55.0` and allowed invalid images to proceed.  
   *Fix:* Removed fake metrics, displayed error toast, reset scan workflow.
2. **Mock SVG Overlay Fallback:**  
   *File:* [`apps/web/app/analysis/page.tsx`](file:///c:/Users/ABHINAV%20TRIPATHI/startup/apps/web/app/analysis/page.tsx#L70-L110)  
   *Observed Behavior:* Direct page access loaded fake SVG path coordinates (`M 45 130...`).  
   *Fix:* Removed `mockAnalysis` fallback entirely; renders honest empty state redirecting to `/scan`.

### Priority 1 (P1): Robustness, Calibration & Validation
1. **Directional Angular Coverage:**  
   *File:* [`services/api/cv/crease_analyzer.py`](file:///c:/Users/ABHINAV%20TRIPATHI/startup/services/api/cv/crease_analyzer.py#L90-L125)  
   *Observed Behavior:* 8 morphological angles left 22.5° gaps where subtly sloped life lines were attenuated.  
   *Fix Applied:* Upgraded to 12 angles ($0^\circ$ to $165^\circ$ in $15^\circ$ increments) and added contrast-adaptive percentile clipping.
2. **Deterministic Repeatability Verification:**  
   *File:* [`services/api/tests/test_cv_pipeline.py`](file:///c:/Users/ABHINAV%20TRIPATHI/startup/services/api/tests/test_cv_pipeline.py#L120-L155)  
   *Observed Behavior:* No test verified that identical image bytes produced bit-for-bit identical coordinates.  
   *Fix Applied:* Added `test_deterministic_repeatability_on_identical_image` asserting zero coordinate deviation across repeated calls.

### Priority 2 (P2): Usability & Calibration Transparency
1. **Confidence Metric Nomenclature:**  
   *File:* [`apps/web/components/analysis/LineMetricsCard.tsx`](file:///c:/Users/ABHINAV%20TRIPATHI/startup/apps/web/components/analysis/LineMetricsCard.tsx)  
   *Observed Behavior:* Labeling heuristic composite indices as "Accuracy" misleads users.  
   *Recommendation:* Re-label as "Line Trace Clarity Index".

---
*End of Codebase Audit Report.*
