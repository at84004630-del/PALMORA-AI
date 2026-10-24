import sys
sys.path.insert(0, '.')
import cv2
from services.api.cv.crease_analyzer import analyze_palm_creases
from services.api.cv.validator import validate_palm_image

for path in ['apps/web/public/test_palm_sample.jpg', 'scratch/user_real_palm.jpg']:
    b = open(path, 'rb').read()
    v, q, reason = validate_palm_image(b)
    img = cv2.imread(path)
    palm_features, hand_side, roi_box = analyze_palm_creases(img, q)
    print("=" * 60)
    print("PATH:", path)
    print("hand_side:", hand_side)
    print("roi_box:", roi_box)
    for k in ["heart_line", "head_line", "life_line", "fate_line"]:
        line = getattr(palm_features, k, None)
        if line:
            pts = line.path or []
            print(f"  {k}: status={line.status}, len={line.measurements.get('length_px')}, curv={line.measurements.get('curvature_index')}, pts={len(pts)}")
        else:
            print(f"  {k}: None")
