import json

p = r"C:\Users\ABHINAV TRIPATHI\.gemini\antigravity-ide\brain\7bd423e0-8bc1-45d5-a1c8-66b771e79947\.system_generated\logs\transcript_full.jsonl"
with open(p, "r", encoding="utf-8") as f:
    for idx, line in enumerate(f):
        d = json.loads(line)
        if d.get("type") == "USER_INPUT":
            print(f"Line {idx}, step {d.get('step_index')}: {d.get('content')[:120]}")
