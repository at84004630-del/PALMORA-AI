# Privacy Architecture & Data Retention Guidelines

## Overview

Palmora AI implements privacy by design. We recognize that biometric and bodily images require the highest standard of ethical custody.

## Key Commitments

1. **Ephemeral Processing Standard:**
   - Palm photographs are decoded into temporary memory buffers.
   - Once feature extraction coordinates are computed, image buffers are cleared.
   - No raw palm photographs are saved as permanent database records by default.

2. **Zero Biometric Profiling:**
   - Features extracted from palms are strictly normalized geometric polyline vectors used solely for displaying visual overlays and selecting corresponding traditional interpretations.
   - We do not generate, store, or match facial or biometric identification templates.

3. **Data Subject Rights:**
   - **Right to Access:** Users can export their reading history at any time in standard JSON format via `/settings`.
   - **Right to Erasure:** A single click on &ldquo;Permanently Delete All Data&rdquo; in settings executes a complete wipe of all local readings, session storage, and server records.

4. **Telemetry Privacy:**
   - Product analytics events record only high-level journey milestones (e.g. `scan_started`, `scan_completed`).
   - Image payloads, polyline coordinates, and reading text are strictly stripped prior to logging.
