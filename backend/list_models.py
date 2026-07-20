import os
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("GOOGLE_API_KEY")

if not API_KEY:
    print("[ERRO] GOOGLE_API_KEY não encontrada no .env")
    exit(1)

import requests

url = f"https://generativelanguage.googleapis.com/v1beta/models?key={API_KEY}"
resp = requests.get(url)

if resp.status_code != 200:
    print(f"[ERRO] A própria chamada de listagem falhou: {resp.status_code}")
    print(resp.text)
    exit(1)

data = resp.json()
models = data.get("models", [])

print(f"\nTotal de modelos visíveis para essa API key: {len(models)}\n")

print("=== Modelos que suportam embedContent (uso: embeddings) ===")
for m in models:
    methods = m.get("supportedGenerationMethods", [])
    if "embedContent" in methods:
        print(f"  - {m['name']}")

print("\n=== Modelos que suportam generateContent (uso: chat/LLM) ===")
for m in models:
    methods = m.get("supportedGenerationMethods", [])
    if "generateContent" in methods:
        print(f"  - {m['name']}")