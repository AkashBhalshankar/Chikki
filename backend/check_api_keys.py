"""
Targeted NVIDIA NIM Probe for Active Models
"""

import os
import requests
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("NVIDIA_API_KEY")
CHAT_URL = "https://integrate.api.nvidia.com/v1/chat/completions"

# Active 2026 conversational and instruct models on build.nvidia.com
CANDIDATE_MODELS = [
    "nvidia/nemotron-3-super-120b-a12b",
    "nvidia/nemotron-3.5-lightning-30b-a3b",
    "mistralai/mistral-small-4",
    "mistralai/mistral-nemotron",
    "meta/llama-3.2-11b-vision-instruct",
    "meta/llama-3.2-90b-vision-instruct",
    "meta/llama-3.2-3b-instruct",
    "meta/llama-3.2-1b-instruct",
    "google/gemma-3-27b-it",
    "google/gemma-3-12b-it",
]

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
}

print(f"Testing key: {API_KEY[:12]}...")
working = []

for model in CANDIDATE_MODELS:
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": "Reply with OK"}],
        "max_tokens": 10,
        "temperature": 0.2,
    }
    try:
        resp = requests.post(CHAT_URL, headers=headers, json=payload, timeout=12)
        if resp.ok:
            content = resp.json()["choices"][0]["message"]["content"].strip()
            print(f"✅ WORKING ({resp.elapsed.total_seconds():.2f}s): {model} -> {content!r}")
            working.append(model)
        else:
            err_detail = resp.text[:90].replace("\n", " ")
            print(f"❌ {resp.status_code} on {model}: {err_detail}")
    except Exception as e:
        print(f"❌ Exception on {model}: {e}")

print("\n" + "=" * 50)
if working:
    print(f"🎯 Add to your .env:\nNVIDIA_MODEL={working[0]}")
else:
    print("No tested model responded. Check build.nvidia.com for active models on your account.")