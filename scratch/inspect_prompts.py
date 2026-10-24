import json

with open(r'C:\Users\ABHINAV TRIPATHI\.gemini\antigravity-ide\brain\7bd423e0-8bc1-45d5-a1c8-66b771e79947\.system_generated\logs\transcript_full.jsonl', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        data = json.loads(line)
        if data.get('type') == 'USER_INPUT':
            print(f"=== User Input at step {i} ===")
            print(data.get('content', '')[:300])
            print()
