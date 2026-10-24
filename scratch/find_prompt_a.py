import json

with open(r'C:\Users\ABHINAV TRIPATHI\.gemini\antigravity-ide\brain\7bd423e0-8bc1-45d5-a1c8-66b771e79947\.system_generated\logs\transcript_full.jsonl', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 193 <= i <= 240:
            data = json.loads(line)
            source = data.get('source')
            msg_type = data.get('type')
            content = data.get('content', '')
            if content and source == 'MODEL':
                print(f'Line {i} ({source}, {msg_type}):')
                print(content[:500])
                print('\n' + '-'*50 + '\n')
