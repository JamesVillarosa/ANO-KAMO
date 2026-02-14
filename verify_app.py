import requests
import json
import time

def test_health():
    try:
        response = requests.get("http://localhost:8000/api/v1/health")
        print(f"Health check: {response.status_code}")
        print(response.json())
        return response.status_code == 200
    except Exception as e:
        print(f"Health check failed: {e}")
        return False

def test_translate():
    try:
        payload = {
            "text": "Hello",
            "source_lang": "en",
            "target_lang": "tl",
            "tone": "neutral"
        }
        response = requests.post("http://localhost:8000/api/v1/translate", json=payload)
        print(f"Translate check: {response.status_code}")
        print(response.json())
        return response.status_code == 200
    except Exception as e:
        print(f"Translate check failed: {e}")
        return False

if __name__ == "__main__":
    if test_health() and test_translate():
        print("\n✅ Backend is working correctly!")
    else:
        print("\n❌ Backend issues detected!")
