from fastapi import status
from tests.helpers import VALID_USER


def _create(client, overrides=None):
    payload = {**VALID_USER, **(overrides or {})}
    return client.post("/api/v1/users/", json=payload).json()


def test_get_by_id_success(client):
    created = _create(client)
    res = client.get(f"/api/v1/users/{created['id']}")
    assert res.status_code == status.HTTP_200_OK
    assert res.json()["id"] == created["id"]
    assert res.json()["name"] == VALID_USER["name"]


def test_get_by_id_not_found(client):
    res = client.get("/api/v1/users/nonexistent-id")
    assert res.status_code == status.HTTP_404_NOT_FOUND


def test_get_all_empty_list(client):
    res = client.get("/api/v1/users/")
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert data["total"] == 0
    assert data["items"] == []
    assert data["pages"] == 0


def test_get_all_pagination_correct(client):
    for i in range(12):
        _create(client, {"email": f"user{i}@example.com"})

    page1 = client.get("/api/v1/users/?page=1&size=10").json()
    assert len(page1["items"]) == 10
    assert page1["total"] == 12
    assert page1["pages"] == 2
    assert page1["page"] == 1

    page2 = client.get("/api/v1/users/?page=2&size=10").json()
    assert len(page2["items"]) == 2
    assert page2["page"] == 2


def test_get_all_excludes_soft_deleted(client):
    created = _create(client)
    client.delete(f"/api/v1/users/{created['id']}")
    res = client.get("/api/v1/users/")
    assert res.json()["total"] == 0
    assert res.json()["items"] == []


def test_get_deleted_user_by_id_returns_404(client):
    created = _create(client)
    client.delete(f"/api/v1/users/{created['id']}")
    res = client.get(f"/api/v1/users/{created['id']}")
    assert res.status_code == status.HTTP_404_NOT_FOUND


def test_get_all_size_capped_at_100(client):
    res = client.get("/api/v1/users/?size=200")
    assert res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
