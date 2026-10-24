import os
import time
import httpx
from fastapi.testclient import TestClient
from services.api.main import app

client = TestClient(app)

# Authenticate as guest
sess_res = client.post("/api/v1/account/guest-session")
token = sess_res.json()["session_token"]
headers = {"Authorization": f"Bearer {token}"}

benchmark_dir = "benchmark"
files = [f for f in sorted(os.listdir(benchmark_dir)) if f.endswith(".jpg")]

print(f"{'Image Name':<28} | {'Usable':<6} | {'Runs':<4} | {'Ensemble (ms)':<13} | {'Roundtrip (s)':<13} | {'Vote Shares (H / Hd / L / F)':<30}")
print("-" * 105)

timings = []
for fname in files:
    fpath = os.path.join(benchmark_dir, fname)
    with open(fpath, "rb") as f:
        img_bytes = f.read()

    t0 = time.perf_counter()
    res = client.post(
        "/api/v1/palm/analyze",
        files={"file": (fname, img_bytes, "image/jpeg")},
        headers=headers
    )
    total_elapsed = time.perf_counter() - t0

    if res.status_code != 200:
        print(f"{fname:<28} | Error: {res.status_code}")
        continue

    data = res.json()
    is_usable = data["image_quality"]["is_usable"]
    runs = data.get("ensemble_runs_count", 1)
    ens_ms = data.get("ensemble_timing_ms") or 0.0
    timings.append((fname, ens_ms, total_elapsed))

    feats = data["features"]
    h_share = feats["heart_line"]["confidence"]
    hd_share = feats["head_line"]["confidence"]
    l_share = feats["life_line"]["confidence"]
    f_share = feats.get("fate_line", {}).get("confidence") if feats.get("fate_line") else None

    shares_str = f"H:{h_share} Hd:{hd_share} L:{l_share} F:{f_share}"
    print(f"{fname:<28} | {str(is_usable):<6} | {runs:<4} | {ens_ms:<13.1f} | {total_elapsed:<13.3f} | {shares_str:<30}")

print("-" * 105)
usable_timings = [t for t in timings if t[1] > 0]
if usable_timings:
    avg_ens = sum(t[1] for t in usable_timings) / len(usable_timings)
    max_ens = max(t[1] for t in usable_timings)
    print(f"Summary: Average Ensemble Latency = {avg_ens:.1f}ms ({avg_ens/1000.0:.2f}s) | Max Latency = {max_ens:.1f}ms ({max_ens/1000.0:.2f}s) [Limit: 6000ms]")
