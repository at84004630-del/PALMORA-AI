import urllib.request
import json

# 1. Create Guest Session
req_sess = urllib.request.Request(
    "http://127.0.0.1:8000/api/v1/account/guest-session",
    data=b"{}",
    headers={"Content-Type": "application/json"}
)
with urllib.request.urlopen(req_sess) as resp:
    sess_data = json.loads(resp.read().decode("utf-8"))
    token = sess_data["session_token"]
    print("Guest Session Token obtained:", token[:15] + "...")

# 2. Upload and Analyze Palm
with open("scratch/actual_user_upload.jpg", "rb") as f:
    img_bytes = f.read()

boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
body = (
    b"--" + boundary.encode() + b"\r\n"
    b'Content-Disposition: form-data; name="file"; filename="palm.jpg"\r\n'
    b"Content-Type: image/jpeg\r\n\r\n"
    + img_bytes
    + b"\r\n--" + boundary.encode() + b"--\r\n"
)

req = urllib.request.Request(
    "http://127.0.0.1:8000/api/v1/palm/analyze",
    data=body,
    headers={
        "Content-Type": f"multipart/form-data; boundary={boundary}",
        "Authorization": f"Bearer {token}"
    }
)

with urllib.request.urlopen(req) as resp:
    res = json.loads(resp.read().decode("utf-8"))
    print("Backend Response Status:", resp.status)
    print("Detected hand side:", res.get("detected_hand_side"))
    print("ROI Box:", res.get("palm_roi_box"))
    feats = res["features"]
    for k in ["heart_line", "head_line", "life_line", "fate_line"]:
        feat = feats.get(k)
        if feat:
            pts = feat.get("path", [])
            print(f"{k}: status={feat.get('status')}, conf={feat.get('confidence')}, pts_len={len(pts)}")
            if pts:
                print(f"   p0: {pts[0]} -> pN: {pts[-1]}")
