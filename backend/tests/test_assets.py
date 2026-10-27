from __future__ import annotations

import time
from io import BytesIO

from PIL import Image


def _png_bytes() -> bytes:
    buffer = BytesIO()
    Image.new("RGB", (64, 48), (232, 85, 45)).save(buffer, format="PNG")
    return buffer.getvalue()


def _wait_ready(client, asset_id: str) -> dict:
    for _ in range(50):
        response = client.get(f"/api/v1/assets/{asset_id}")
        assert response.status_code == 200
        payload = response.json()
        if payload["status"] in {"ready", "failed"}:
            return payload
        time.sleep(0.1)
    raise AssertionError("asset did not finish processing")


def test_health(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["database"] is True
    assert payload["storage"] is True
    assert payload["model_configured"] is True


def test_upload_list_search_patch_and_delete(client):
    files = [
        ("files", ("夏季防晒清单.txt", "夏季防晒霜推荐，清爽不黏腻。".encode(), "text/plain")),
        ("files", ("product-shot.png", _png_bytes(), "image/png")),
    ]
    response = client.post("/api/v1/assets", files=files)
    assert response.status_code == 201, response.text
    payload = response.json()
    assert len(payload["items"]) == 2
    assert not payload["errors"]

    ids = [item["asset"]["id"] for item in payload["items"]]
    for asset_id in ids:
        detail = _wait_ready(client, asset_id)
        assert detail["status"] == "ready"
        assert detail["summary"]
        assert detail["file_url"].endswith(f"/{asset_id}/file")

    listing = client.get("/api/v1/assets", params={"file_type": "image"})
    assert listing.status_code == 200
    assert listing.json()["total"] == 1

    search = client.post(
        "/api/v1/search",
        json={"query": "夏季防晒", "top_k": 5, "mode": "keyword"},
    )
    assert search.status_code == 200, search.text
    assert search.json()["items"]
    assert any(
        "防晒" in hit["asset"]["name"] or "防晒" in (hit["asset"]["summary"] or "")
        for hit in search.json()["items"]
    )

    patch = client.patch(
        f"/api/v1/assets/{ids[0]}",
        json={"name": "夏季防晒清单（已整理）", "tags": ["防晒", "夏季", "清单"]},
    )
    assert patch.status_code == 200
    assert patch.json()["name"].endswith("（已整理）")
    assert "清单" in patch.json()["tags"]

    duplicate = client.post(
        "/api/v1/assets",
        files=[
            (
                "files",
                ("夏季防晒清单.txt", "夏季防晒霜推荐，清爽不黏腻。".encode(), "text/plain"),
            )
        ],
    )
    assert duplicate.status_code == 201
    assert duplicate.json()["items"][0]["duplicate"] is True

    delete = client.delete(f"/api/v1/assets/{ids[1]}")
    assert delete.status_code == 200
    assert client.get(f"/api/v1/assets/{ids[1]}").status_code == 404


def test_reanalyze_and_stats(client):
    response = client.post(
        "/api/v1/assets",
        files=[
            (
                "files",
                ("活动文案.md", "# 双十一\n\n预售开启，限时优惠。".encode(), "text/markdown"),
            )
        ],
    )
    assert response.status_code == 201
    asset_id = response.json()["items"][0]["asset"]["id"]
    _wait_ready(client, asset_id)

    reanalyze = client.post(f"/api/v1/assets/{asset_id}/reanalyze")
    assert reanalyze.status_code == 200
    assert reanalyze.json()["status"] == "processing"
    _wait_ready(client, asset_id)

    stats = client.get("/api/v1/stats")
    assert stats.status_code == 200
    assert stats.json()["total"] >= 2
    assert stats.json()["ready"] >= 1


def test_agent_task_runs_and_persists_trace(client):
    create = client.post(
        "/api/v1/agent/tasks",
        json={"query": "找一些夏季防晒素材并写一段文案"},
    )
    assert create.status_code == 202
    task_id = create.json()["id"]

    task = None
    for _ in range(80):
        response = client.get(f"/api/v1/agent/tasks/{task_id}")
        assert response.status_code == 200
        task = response.json()
        if task["status"] in {"succeeded", "failed"}:
            break
        time.sleep(0.1)

    assert task is not None
    assert task["status"] == "succeeded", task
    assert task["steps"]
    assert task["result"]["answer"]
    assert task["result"]["assets"]
    assert task["result"]["copy"]["variants"]

    listing = client.get("/api/v1/agent/tasks")
    assert listing.status_code == 200
    assert listing.json()["total"] >= 1

    retry = client.post(f"/api/v1/agent/tasks/{task_id}/retry")
    assert retry.status_code == 200
    assert retry.json()["status"] == "queued"


def test_invalid_file_is_reported(client):
    response = client.post(
        "/api/v1/assets",
        files=[("files", ("payload.exe", b"MZ\x90\x00", "application/octet-stream"))],
    )
    assert response.status_code == 201
    payload = response.json()
    assert not payload["items"]
    assert payload["errors"]
