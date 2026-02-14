"""
Tests for translation endpoints
"""
from fastapi.testclient import TestClient
from app.main import app


def test_translate_single():
    """Test single language translation"""
    client = TestClient(app)
    response = client.post(
        "/api/v1/translate",
        json={
            "text": "Hello",
            "source_lang": "en",
            "target_lang": "tl",
            "tone": "neutral",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["input_text"] == "Hello"
    assert data["source_lang"] == "en"
    assert data["target_lang"] == "tl"
    assert "output_text" in data
    assert "detected_tone" in data


def test_translate_multi():
    """Test multi-language translation"""
    client = TestClient(app)
    response = client.post(
        "/api/v1/translate/multi",
        json={
            "text": "Hello",
            "source_lang": "en",
            "target_langs": ["tl", "ceb"],
            "tone": "neutral",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["input_text"] == "Hello"
    assert data["source_lang"] == "en"
    assert len(data["output_texts"]) == 2
    assert len(data["target_langs"]) == 2
