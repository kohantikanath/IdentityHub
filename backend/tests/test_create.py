from fastapi import status
from tests.helpers import VALID_USER


def test_create_user_success(client):
    res = client.post("/api/v1/users/", json=VALID_USER)
    assert res.status_code == status.HTTP_201_CREATED
    data = res.json()
    assert data["name"] == VALID_USER["name"]
    assert data["email"] == VALID_USER["email"]
    assert "id" in data
    # PII must always be masked — raw values must never appear in responses
    assert data["aadhaar_number"] == "XXXXXXXX9012"
    assert data["pan_number"] == "ABXXXXX34F"
    assert data["is_deleted"] is False


def test_create_user_duplicate_email_returns_409(client):
    client.post("/api/v1/users/", json=VALID_USER)
    res = client.post("/api/v1/users/", json=VALID_USER)
    assert res.status_code == status.HTTP_409_CONFLICT


def test_create_user_invalid_aadhaar_returns_422(client):
    res = client.post("/api/v1/users/", json={**VALID_USER, "aadhaar_number": "12345"})
    assert res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_create_user_invalid_pan_returns_422(client):
    res = client.post("/api/v1/users/", json={**VALID_USER, "pan_number": "INVALID"})
    assert res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_create_user_future_dob_returns_422(client):
    res = client.post("/api/v1/users/", json={**VALID_USER, "date_of_birth": "2099-01-01"})
    assert res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_create_user_invalid_email_returns_422(client):
    res = client.post("/api/v1/users/", json={**VALID_USER, "email": "not-an-email"})
    assert res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_create_user_blank_name_returns_422(client):
    res = client.post("/api/v1/users/", json={**VALID_USER, "name": "   "})
    assert res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_create_user_invalid_mobile_returns_422(client):
    res = client.post("/api/v1/users/", json={**VALID_USER, "primary_mobile": "123"})
    assert res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_create_user_pan_auto_uppercased(client):
    res = client.post("/api/v1/users/", json={**VALID_USER, "pan_number": "abcde1234f"})
    assert res.status_code == status.HTTP_201_CREATED
