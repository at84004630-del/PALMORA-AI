import json

with open(r'C:\Users\ABHINAV TRIPATHI\.gemini\antigravity-ide\brain\7bd423e0-8bc1-45d5-a1c8-66b771e79947\.system_generated\logs\transcript_full.jsonl', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 220 <= i <= 230:
            data = json.loads(line)
            c = data.get('content', '')
            if '_evaluate_heart' in c:
                print(f"=== Step {i} ===")
                idx = c.find('def _evaluate_heart')
                if idx != -1:
                    print(c[idx:idx+2500])
                break
