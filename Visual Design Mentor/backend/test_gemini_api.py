"""List and test available Gemini models"""
import os
from dotenv import load_dotenv
load_dotenv()

from google import genai

api_key = os.environ.get("GEMINI_API_KEY")
print(f"Key: {api_key[:15]}...", flush=True)

client = genai.Client(api_key=api_key)

print("\n=== Available Models ===", flush=True)
available = []
try:
    for model in client.models.list():
        name = model.name
        if "gemini" in name.lower():
            # Extract just the model name
            model_id = name.replace("models/", "")
            print(f"  {model_id}", flush=True)
            available.append(model_id)
except Exception as e:
    print(f"Error listing: {e}", flush=True)

# Test a few that might work
test_models = ["gemini-2.0-flash-lite", "gemini-2.5-flash", "gemini-2.0-flash"]
print("\n=== Testing Models ===", flush=True)
for model in test_models:
    if model in available or any(model in m for m in available):
        try:
            print(f"Testing {model}...", flush=True)
            response = client.models.generate_content(
                model=model,
                contents="Say hi"
            )
            print(f"  SUCCESS: {response.text.strip()[:50]}", flush=True)
            break  # Stop on first success
        except Exception as e:
            print(f"  FAILED: {str(e)[:100]}", flush=True)
