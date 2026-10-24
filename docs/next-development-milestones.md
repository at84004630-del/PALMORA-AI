# Palmora AI — Next Development Milestones & Repeatability Protocol

**Version:** 2.0.0  
**Status:** Prioritized Engineering Roadmap & Testing Specification  

---

## 1. Prioritized Engineering Milestones

This roadmap organizes all outstanding system improvements into four strict priority tiers:

```
[P0: Real Engine Integrity] (100% Complete)
       │
       ▼
[P1: Robustness & Environmental Validation] (In Progress)
       │
       ▼
[P2: Interpretation Fidelity & User Experience] (Planned)
       │
       ▼
[P3: Growth, Monetization & Community Sharing] (Backlog)
```

### Priority 0 (P0): Core Visual Integrity & Fake Artifact Elimination
*Target: Guarantee that every coordinate, metric, and narrative originates from authentic image processing without mocks or hallucinations.*

- [x] **P0.1: Eliminate Synthetic Image Quality Fallback in Scan Workflow**
  - *Location:* [`apps/web/app/scan/page.tsx`](file:///c:/Users/ABHINAV%20TRIPATHI/startup/apps/web/app/scan/page.tsx)
  - *Status:* **Complete & Verified.** Replaced silent fallback with honest error handling and state reset.
- [x] **P0.2: Eliminate Pre-baked Mock SVG Vectors in Analysis Dashboard**
  - *Location:* [`apps/web/app/analysis/page.tsx`](file:///c:/Users/ABHINAV%20TRIPATHI/startup/apps/web/app/analysis/page.tsx)
  - *Status:* **Complete & Verified.** Replaced `mockAnalysis` with authentic empty state and guidance back to `/scan`.
- [x] **P0.3: Deterministic Feature Extraction Repeatability Test**
  - *Location:* [`services/api/tests/test_cv_pipeline.py`](file:///c:/Users/ABHINAV%20TRIPATHI/startup/services/api/tests/test_cv_pipeline.py)
  - *Status:* **Complete & Verified.** Bit-for-bit identical coordinate assertions passing cleanly.
- [x] **P0.4: Guaranteed Feature Non-Fabrication Rule**
  - *Location:* [`services/api/reading/generator.py`](file:///c:/Users/ABHINAV%20TRIPATHI/startup/services/api/reading/generator.py)
  - *Status:* **Complete & Verified.** Low-confidence or unobserved lines strictly suppressed.

---

### Priority 1 (P1): Robustness, Hand Rectification & Environmental Validation
*Target: Ensure the computer vision pipeline functions reliably across diverse skin tones, angles, and real-world indoor lighting.*

- [x] **P1.1: 12-Angle Morphological Filter & Contrast-Adaptive Energy Clipping**
  - *Location:* [`services/api/cv/crease_analyzer.py`](file:///c:/Users/ABHINAV%20TRIPATHI/startup/services/api/cv/crease_analyzer.py)
  - *Status:* **Complete & Verified.** Expanded angular resolution from 22.5° to 15° steps with dynamic 68th-percentile energy clipping for low-contrast images.
- [ ] **P1.2: Landmark-Guided Hand Affine Rectification**
  - *Objective:* Integrate lightweight MediaPipe Hand Landmark model (or 5-knuckle centroid detector) exclusively for affine pose rectification. Rotate hand so wrist-to-middle-finger axis is $0^\circ$ vertical prior to crease extraction.
  - *Target Latency:* $\le 30\text{ms}$.
  - *Acceptance Criteria:* Invariance to hand rotations up to $\pm 45^\circ$.
- [ ] **P1.3: Chrominance-Adaptive Skin Segmentation for Deep Skin Tones**
  - *Objective:* Replace static HSV/YCrCb rectangular bounding boxes with Otsu thresholding in normalized chromaticity ($r, g$) space or adaptive Lab color clustering to support Fitzpatrick Types V and VI without noise.
- [ ] **P1.4: Multi-Annotator Benchmark Harness (`PALM-BENCH-100`) Execution**
  - *Objective:* Populate the real-world dataset and record live Hausdorff distance and recall metrics.

---

### Priority 2 (P2): Reading Engine Personalization & Usability
*Target: Elevate user engagement, self-reflective depth, and transparent communication.*

- [x] **P2.1: Versioned Traditional Interpretation Library (`v2.1.0`)**
  - *Location:* [`docs/reading-engine-design.md`](file:///c:/Users/ABHINAV%20TRIPATHI/startup/docs/reading-engine-design.md)
  - *Status:* Fully specified with stable IDs, historical citations (Cheiro, Benham, Samudrika Shastra), and reflective questions.
- [ ] **P2.2: Dual-Hand Comparative Analysis (Dominant vs. Non-Dominant)**
  - *Objective:* Implement dual-palm capture flow. In classical chirology, the non-dominant palm represents innate potential while the dominant palm reflects expressed life choices.
- [ ] **P2.3: Epistemic Clarity Index UI Re-labeling**
  - *Location:* [`apps/web/components/analysis/LineMetricsCard.tsx`](file:///c:/Users/ABHINAV%20TRIPATHI/startup/apps/web/components/analysis/LineMetricsCard.tsx)
  - *Objective:* Ensure UI labels clarify that confidence scores measure "Visual Trace Clarity" rather than "Destiny Accuracy".

---

### Priority 3 (P3): Growth, Viral Sharing & Monetization
*Target: Scale user acquisition and retention while preserving ethical transparency.*

- [x] **P3.1: Server-Side OG / Social Share Card Generation**
  - *Status:* Verified in Next.js edge runtime with anonymous referral code injection.
- [x] **P3.2: Account Erasure & Data Retention Self-Service Controls**
  - *Status:* Verified with `POST /api/account/delete-request` and client-side purge.
- [ ] **P3.3: Interactive Daily Reflective Journaling**
  - *Objective:* Allow users to revisit their palm reading archetype and log daily reflections, creating a sticky habit loop.

---

## 2. Repeatability & Consistency Testing Protocol

To ensure system reliability, the following automated and human testing protocols are established:

### 2.1 Repeatability Testing Matrix

| Test Scenario | Input Variation | Expected Outcome | Acceptable Tolerance | Defect Threshold (Fail) |
|:---|:---|:---|:---|:---|
| **Same Image Repeated Analysis** | Identical image bytes submitted $N = 10$ times. | Bit-for-bit identical coordinates, metrics, and archetypes. | **0.00% deviation** (strictly deterministic). | Any difference in coordinates or selected archetype ID. |
| **Same Hand, Consecutive Captures** | User takes 3 photos of the same hand over 60 seconds with slight natural hand tremor. | Minor polyline shift ($\le 4\text{px}$); identical archetype classification. | Metric variation $\le 6\%$; identical archetype ID. | Flip in archetype (e.g. from Curved to Straight). |
| **Different Lighting Conditions** | Warm indoor tungsten ($2700\text{K}$) vs. bright daylight ($5500\text{K}$). | Retains major line classifications; clarity confidence may vary slightly. | Metric variation $\le 12\%$; clarity score within $\pm 0.15$. | Missing a major line in one condition while detecting it in the other. |
| **Different Camera Angles** | Hand tilted at $0^\circ, 15^\circ, 30^\circ$. | Scaled length and curvature consistent within tolerance. | Curvature ratio within $\pm 0.08$. | Crease assignment crossing zones (e.g. life line confused for head line). |
| **LLM Output Variation** | Identical structured features submitted with different seeds. | Narrative tone may rephrase gracefully, but underlying factual claims remain identical. | Tone variation allowed; zero new features introduced. | Hallucination of unlisted features or contradiction of archetype. |

---

## 3. Human User-Testing Protocol

User satisfaction and visual accuracy must be evaluated independently:
1. **Participant Cohort:** 20 diverse users (balanced across Fitzpatrick skin tones, age brackets, and hand anatomies).
2. **Evaluation Metrics (1 to 5 Likert Scale):**
   - **Visual Verifiability:** "The highlighted vector lines on my palm match the real creases I see on my hand." (Target: $\ge 4.4 / 5.0$).
   - **Personal Relevance:** "The reading felt nuanced, reflective, and specific to my hand rather than a generic horoscope." (Target: $\ge 4.2 / 5.0$).
   - **Clarity & Understanding:** "I clearly understood the difference between historical symbolism and scientific measurement." (Target: $\ge 4.7 / 5.0$).
   - **Shareability:** "I felt excited to share or discuss my palm analysis with a friend." (Target: $\ge 4.0 / 5.0$).
3. **Disentanglement Guarantee:** User delight cannot be used as an excuse to tolerate visual hallucinations. If a user enjoys a reading but the detected line is offset by $> 15\text{px}$, the system has failed visual validation.

---
*End of Next Development Milestones.*
