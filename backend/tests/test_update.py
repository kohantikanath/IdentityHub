from fastapi import status
from tests.helpers import VALID_USER


def _create(client, overrides=None):
    payload = {**VALID_USER, **(overrides or {})}
    return client.post("/api/v1/users/", json=payload).json()


def test_update_name_only(client):
    created = _create(client)
    res = client.patch(f"/api/v1/users/{created['id']}", json={"name": "Updated Name"})
    assert res.status_code == status.HTTP_200_OK
    assert res.json()["name"] == "Updated Name"
    # Unpatched fields must stay unchanged
    assert res.json()["email"] == VALID_USER["email"]


def test_update_nonexistent_user_returns_404(client):
    res = client.patch("/api/v1/users/fake-id", json={"name": "X"})
    assert res.status_code == status.HTTP_404_NOT_FOUND


def test_update_email_to_existing_returns_409(client):
    _create(client, {"email": "first@example.com"})
    second = _create(client, {"email": "second@example.com"})
    res = client.patch(
        f"/api/v1/users/{second['id']}", json={"email": "first@example.com"}
    )
    assert res.status_code == status.HTTP_409_CONFLICT


def test_update_pan_is_reencrypted_and_masked(client):
    created = _create(client)
    res = client.patch(
        f"/api/v1/users/{created['id']}", json={"pan_number": "ZZZZZ9999Z"}
    )
    assert res.status_code == status.HTTP_200_OK
    assert res.json()["pan_number"] == "ZZXXXXX99Z"


def test_update_invalid_pan_returns_422(client):
    created = _create(client)
    res = client.patch(f"/api/v1/users/{created['id']}", json={"pan_number": "INVALID"})
    assert res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_update_invalid_aadhaar_returns_422(client):
    created = _create(client)
    res = client.patch(f"/api/v1/users/{created['id']}", json={"aadhaar_number": "123"})
    assert res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_update_blank_name_returns_422(client):
    created = _create(client)
    res = client.patch(f"/api/v1/users/{created['id']}", json={"name": "   "})
    assert res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
