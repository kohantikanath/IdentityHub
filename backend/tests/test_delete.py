from fastapi import status
from tests.helpers import VALID_USER


def _create(client):
    return client.post("/api/v1/users/", json=VALID_USER).json()


def test_delete_returns_204(client):
    created = _create(client)
    res = client.delete(f"/api/v1/users/{created['id']}")
    assert res.status_code == status.HTTP_204_NO_CONTENT


def test_deleted_user_returns_404_on_get(client):
    created = _create(client)
    client.delete(f"/api/v1/users/{created['id']}")
    res = client.get(f"/api/v1/users/{created['id']}")
    assert res.status_code == status.HTTP_404_NOT_FOUND


def test_deleted_user_excluded_from_list(client):
    created = _create(client)
    client.delete(f"/api/v1/users/{created['id']}")
    res = client.get("/api/v1/users/")
    assert res.json()["total"] == 0


def test_double_delete_returns_404(client):
    created = _create(client)
    client.delete(f"/api/v1/users/{created['id']}")
    res = client.delete(f"/api/v1/users/{created['id']}")
    assert res.status_code == status.HTTP_404_NOT_FOUND


def test_delete_nonexistent_returns_404(client):
    res = client.delete("/api/v1/users/nonexistent-id")
    assert res.status_code == status.HTTP_404_NOT_FOUND
