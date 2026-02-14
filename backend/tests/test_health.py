"""
Tests for health endpoint
"""
from fastapi.testclient import TestClient
from app.main import app


def test_health_check():
    """Test health check endpoint"""
    client = TestClient(app)
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "timestamp" in data
