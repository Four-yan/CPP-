import urllib.request
import urllib.error
import json

api_key = ''
with open('.env', 'r', encoding='utf-8') as f:
    for line in f:
        if line.startswith('VITE_AGENTS_API_KEY='):
            api_key = line.strip().split('=', 1)[1]

url = 'https://apihub.agnes-ai.com/v1/chat/completions'

# 构造模拟我们在系统里发出的极其真实的 Payload
fullMessages = [
    { "role": "system", "content": "你是一个贴心的个人财务助理，说话风格亲切幽默，偶尔可以开玩笑。\n用户的财务数据：暂无数据\n帮助用户分析消费、提供建议、回答财务问题。\n回复简洁，不超过100字。" },
    { "role": "user", "content": "为什么没有聊天记录" }
]

data = json.dumps({
    "model": "agnes-2.0-flash",
    "messages": fullMessages,
    "temperature": 0.3,
    "max_tokens": 500
}).encode('utf-8')

req = urllib.request.Request(url, data=data, headers={
    'Content-Type': 'application/json',
    'Authorization': f'Bearer {api_key}'
})

try:
    with urllib.request.urlopen(req) as response:
        result = json.loads(response.read().decode('utf-8'))
        print("Success:", result['choices'][0]['message']['content'])
except urllib.error.HTTPError as e:
    print(f"HTTP Error: {e.code}")
    print(e.read().decode('utf-8'))
except Exception as e:
    print(f"Error: {e}")
