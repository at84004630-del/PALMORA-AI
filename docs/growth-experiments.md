# Palmora AI — Growth Experiments & Experimentation Register

## 1. Executive Summary & Experimentation Philosophy

Palmora AI approaches growth through **rigorous, scientific experimentation** rather than dark patterns, fake urgency, or predatory paywalls. Because consumer palmistry applications have historically suffered from high customer skepticism, excessive chargebacks, and deceptive cancellation flows, Palmora’s competitive edge is **demonstrated transparency, anatomical validity, and genuine user trust**.

### Core Experimentation Rules:
1. **Never declare victory on small samples**: All experiments require minimum sample sizes calculated a priori with 80% statistical power ($\beta = 0.20$) and significance ($\alpha = 0.05$).
2. **Mandatory Guardrail Metrics**: Every experiment tests a primary conversion metric against strict trust and quality guardrails (e.g., refund rates, user deletion requests, image rejection rate).
3. **No deceptive paywalls or simulated transactions**: If payment processing is unavailable, checkout remains disabled. Never simulate successful charges.
4. **Denominators are always explicit**: Every tracked percentage displays both numerator and denominator in reporting.

---

## 2. The 5 Core Product Hypotheses

| ID | Hypothesis Name | Primary Metric | Guardrail Metric | Test Duration | Target Sample Size | Decision Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **EXP-01** | **Ephemeral Privacy Disclosure vs Generic Badge** | Visitor → Scan Initiation Rate (`scans_started / landing_views`) | Upload Quality / False Upload Rate | 14 days | $N \ge 1,200$ visitors per variant | Roll out if Scan Initiation $+15\%$ ($p < 0.05$) without increasing image rejection. |
| **EXP-02** | **Interactive Crease Overlay vs Text-Only Summary** | Reading Save & Comprehension Rate (`reading_saved / readings_generated`) | Time to Reading Generation / Bounce Rate | 21 days | $N \ge 800$ completed scans per variant | Roll out if Save Rate increases by $\ge 20\%$ with perceived accuracy $\ge 4.2/5$. |
| **EXP-03** | **Privacy-Safe 9:16 Story Card with Optional Photo** | Share Card Creation & Referral Completion Rate | Account Deletion Requests (`account_deletion_requested`) | 30 days | $N \ge 1,500$ generated readings per variant | Adopt if Share Action Rate $\ge 12\%$ and Referral-to-Scan $\ge 8\%$, with zero uptick in deletion requests. |
| **EXP-04** | **Unbundled $4.99 Single Report vs $9.99/mo Subscription** | Total Net Revenue per Visitor & Checkout Intent Rate | Refund / Dispute Rate ($< 1.0\%$) | 30 days | $N \ge 2,000$ pricing page views per variant | Roll out if One-Time Report achieves $\ge 2.5\times$ checkout intent compared to recurring subscription. |
| **EXP-05** | **Actionable Retake Feedback vs Silent Forgiveness** | Day-7 Return Rate & Overall Reading Satisfaction | Complete Scan Drop-off / Abandonment Rate | 21 days | $N \ge 1,000$ poor/borderline image uploads | Roll out if Day-7 return rate $+25\%$ despite immediate retake prompt, confirming trust building. |

---

## 3. Detailed Experiment Profiles

### EXP-01: Ephemeral Privacy Disclosure vs Generic Trust Badge

- **Problem Statement**: Users are hesitant to upload photos of their bare palms to unknown mobile apps due to privacy fears regarding fingerprint/biometric harvesting and cloud storage leaks.
- **Variant A (Control)**: Standard generic trust badge ("100% Secure & Private AI Reading").
- **Variant B (Treatment)**: Explicit, transparent privacy architecture statement displayed directly in the upload dropzone: *"Images processed in volatile RAM only. No biometrics or fingerprints recorded. Immediate memory wipe upon reading completion."*
- **Primary Metric**: `visitor_to_scan_started` ($Numerator: \text{scan\_started}, Denominator: \text{landing\_view}$).
- **Guardrail Metric**: `upload_rejected` rate ($< 15\%$).
- **Sample Size Calculation**: Baseline conversion = $18\%$. Minimum Detectable Effect (MDE) = $3.5\%$ relative ($18\% \to 21.5\%$). Required sample per arm: $N = 1,180$ unique visitors.
- **Decision Status**: Active testing.

---

### EXP-02: Interactive Crease Overlay vs Text-Only Summary

- **Problem Statement**: Competitors (Nebula, Kasamba, Astroline) generate text fortunes that feel completely generic and disconnected from the user's hand, leaving users feeling cheated by black-box horoscopes.
- **Variant A (Control)**: Display immediate text synthesis without visual overlay.
- **Variant B (Treatment)**: Display high-contrast SVG crease path overlays (Heart, Head, Life) directly aligned onto the palm coordinates with hover inspection and geometric curvature metrics.
- **Primary Metric**: `reading_saved` rate ($Numerator: \text{reading\_saved}, Denominator: \text{reading\_generated}$).
- **Guardrail Metric**: Post-scan bounce rate ($< 25\%$).
- **Hypothesis**: Giving users visual proof of the computer vision extraction grounds the reading in reality and increases emotional ownership of the reflection.
- **Decision Status**: Built into core reading page (`/reading`).

---

### EXP-03: Privacy-Safe 9:16 Social Story Card

- **Problem Statement**: Traditional astrology apps encourage sharing entire charts or full photos, which triggers social anxiety and privacy reluctance.
- **Variant A (Control)**: Standard horizontal summary card containing user palm photo thumbnail by default.
- **Variant B (Treatment)**: 9:16 vertical story card (1080x1920) featuring mystical celestial theme, one impactful insight (Love, Career, or Vitality), subtle Palmora branding, a referral link, and **user palm photo hidden by default** with a clear toggle switch.
- **Primary Metric**: `share_card_created` and `share_action` ($Numerator: \text{share\_action}, Denominator: \text{share\_card\_created}$).
- **Secondary Metric**: `referral_visit_to_completed_reading` ($Numerator: \text{completions}, Denominator: \text{referral\_visits}$).
- **Guardrail Metric**: Account deletion or data erasure requests.
- **Decision Status**: Implemented via `apps/web/components/ShareCardModal.tsx`.

---

### EXP-04: Transparent $4.99 Single Report vs $9.99/mo Subscription

- **Problem Statement**: 82% of public negative reviews on competitor apps cite deceptive auto-renewing weekly/monthly subscription traps with hidden fees and impossible cancellation procedures.
- **Variant A (Control)**: Standard industry paywall defaulting to $9.99/month recurring membership.
- **Variant B (Treatment)**: Prominent $4.99 one-time deep-dive contemplative report with no subscription commitment, alongside an optional membership with transparent annual discount and 14-day refund policy.
- **Primary Metric**: Checkout intent rate (`checkout_started / pricing_viewed`) and customer acquisition revenue per visitor.
- **Guardrail Metric**: Refund request rate ($< 1.0\%$) and cancellation friction complaints ($0\%$).
- **Integrity Rule**: Real payment processing remains disabled in test environments until payment gateway verification is fully certified.
- **Decision Status**: Implemented on `/pricing`.

---

### EXP-05: Actionable Retake Guidance vs Silent Hallucination

- **Problem Statement**: When an image is blurry, poorly lit, or contains the back of the hand, competitors hallucinate an arbitrary horoscope. This creates immediate user disillusionment once the user realizes the app cannot actually see their hand.
- **Variant A (Control)**: Silent forgiveness (generate a generic reading even if crease confidence is low).
- **Variant B (Treatment)**: Immediate quality gate with specific, actionable retake guidance (e.g., *"Photo is blurry: hold camera steady"*, *"Back of hand detected: flip hand to show palm"*, *"Low contrast: move to softer indirect light"*).
- **Primary Metric**: Day-7 return rate and user trust rating.
- **Guardrail Metric**: Abandonment rate at the quality gate ($< 30\%$).
- **Decision Status**: Implemented in CV validator and `/scan` page.

---

## 4. Analytics Event Telemetry Architecture

All experiment events are ingested through the privacy-conscious telemetry router at `services/api/routers/analytics.py` and visualized in the User Console at `apps/web/app/dashboard/page.tsx`:

```
+-------------------------------------------------------------+
|                     Telemetry Schema                        |
+-------------------------------------------------------------+
| Event Name                    | Key Sanitized Properties    |
|-------------------------------|-----------------------------|
| landing_view                  | source, device, variant     |
| scan_started                  | device, camera_mode         |
| upload_rejected               | error_category, quality     |
| scan_completed                | detector_version, latency   |
| scan_failed                   | failure_reason              |
| feature_overlay_viewed        | lines_detected_count        |
| reading_generated             | prompt_version, has_retake  |
| reading_saved                 | storage_type (local)        |
| share_card_created            | aspect, theme, incl_photo   |
| share_action                  | channel (native/download)   |
| referral_visit                | ref_code, landing_variant   |
| pricing_viewed                | experiment_variant, cycle   |
| checkout_started              | plan_id, billing_cycle      |
| purchase_verified             | transaction_id, gateway     |
| account_deletion_requested    | source_portal               |
+-------------------------------------------------------------+
```

*Note: Raw photos, facial images, full reading text, passwords, and credit card numbers are strictly stripped from all analytics logs.*
