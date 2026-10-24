# Computer Vision Pipeline & Future ML Roadmap

## Current Implementation: Multi-Scale Morphological Crease Extractor (`v1.0`)

The current detector uses computer vision algorithms optimized for edge execution and low latency:
1. **Quality Assessment:** Laplacian variance sharpness calculation, luminance distribution checks in HSV space, and skin segmentation in YCrCb/HSV space.
2. **Palm Center Isolation:** Euclidean distance transform on segmented hand contours to identify maximum inscribed circle radius.
3. **Crease Filtering:** Contrast-Limited Adaptive Histogram Equalization (CLAHE, clip=3.5) combined with **12-orientation** morphological Black-Hat transforms (kernels at 0°, 15°, 30°, 45°, 60°, 75°, 90°, 105°, 120°, 135°, 150°, 165°) with contrast-adaptive 68th/75th-percentile energy clipping.
4. **Ridge Tracing:** Adaptive thresholding, connected component contour analysis, and anatomical zone partitioning.

### Known Limitations of v1.0
- **Skin Contrast Variance:** Hands under direct sunlight glare or extreme backlighting may suffer from washed-out crease valleys.
- **Accessory Creases:** Secondary fine lines or skin micro-texture can occasionally break continuity of the head line or heart line.
- **Hand Orientation:** Currently assumes palm faces the camera within ±25 degrees of vertical.

---

## Future ML Architecture Roadmap (`v2.0` - `v3.0`)

```
[Palm Image] 
      │
      ▼
[Stage 1: MediaPipe Hand Landmark Detector (21 3D Points)]
      │
      ├── Normalizes palm rotation & affine transforms to canonical coordinate space
      │
      ▼
[Stage 2: Lightweight Deep Crease Segmentation (MobileNet-V3 / UNet-Lite)]
      │
      ├── Pixel-level probability map for major crease ridges
      │
      ▼
[Stage 3: Graph Ridge Skeletonization & Topological Parsing]
      │
      └── Robust centerline vectors with calibrated uncertainty bounds
```

1. **Stage 1 (Landmark Normalization):**
   Utilize MediaPipe or BlazeHand to detect wrist, MCP, and PIP joint landmarks to rotate the palm to a standardized vertical canonical frame.

2. **Stage 2 (Trained Crease Segmentation Network):**
   Train a lightweight U-Net or MobileNet-V3 semantic segmentation network on synthetic palm datasets (e.g. CASIA-Palmprint or synthetic 3D hand models with crease textures) to output probability masks for Heart, Head, and Life lines.

3. **Stage 3 (Topological Ridge Parsing):**
   Apply graph-based minimum-cost path search (Dijkstra on inverted cost grid) between anatomical anchor points to guarantee single continuous centerline vectors.
