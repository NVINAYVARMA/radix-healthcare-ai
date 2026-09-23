import io
import pytest


def _create_sample_study(client, study_id: str = "XR-TEST-REV-01", patient_name: str = "Arthur Vance"):
    file_content = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
    files = {"file": ("scan.png", io.BytesIO(file_content), "image/png")}
    data = {
        "study_id": study_id,
        "modality": "X-RAY",
        "patient_name": patient_name,
        "patient_id": f"MRN-{study_id}",
    }
    return client.post("/api/v1/studies", data=data, files=files)


def test_reviewed_studies_storage_and_query(client):
    """
    Verifies that when a study is reviewed, it is stored in the new reviewed_studies table,
    can be queried via /api/v1/reviewed-studies, and includes clinical review notes.
    """
    study_id = "XR-ARCHIVE-01"
    res = _create_sample_study(client, study_id, "Jane Doe")
    assert res.status_code == 201

    # Mark as reviewed
    review_payload = {
        "action": "COMPLETED_REVIEW",
        "reviewer_id": "dr_lin",
        "review_status": "NORMAL",
        "notes": "Lungs clear bilaterally. No pneumothorax."
    }
    r = client.patch(f"/api/v1/studies/{study_id}/review", json=review_payload)
    assert r.status_code == 200

    # Query reviewed studies
    archive_res = client.get("/api/v1/reviewed-studies")
    assert archive_res.status_code == 200
    data = archive_res.json()
    assert "items" in data
    assert "stats" in data
    assert data["stats"]["total_reviewed"] >= 1

    matching = [it for it in data["items"] if it["study_id"] == study_id]
    assert len(matching) == 1
    item = matching[0]
    assert item["patient_name"] == "Jane Doe"
    assert item["reviewer_id"] == "dr_lin"
    assert item["review_status"] == "NORMAL"
    assert "Lungs clear" in item["review_notes"]
    assert item["arrival_time"].endswith("Z")
    assert item["reviewed_at"].endswith("Z")

    # Get single reviewed study detail
    single_res = client.get(f"/api/v1/reviewed-studies/{study_id}")
    assert single_res.status_code == 200
    assert single_res.json()["study_id"] == study_id


def test_revert_reviewed_study(client):
    """
    Verifies that a reviewed study can be reopened back to active worklist.
    """
    study_id = "XR-REVERT-01"
    _create_sample_study(client, study_id, "Revert Patient")

    # Review it
    client.patch(
        f"/api/v1/studies/{study_id}/review",
        json={"action": "COMPLETED_REVIEW", "reviewer_id": "dr_lin", "review_status": "NORMAL"}
    )

    # Revert it
    revert_res = client.post(f"/api/v1/reviewed-studies/{study_id}/revert")
    assert revert_res.status_code == 200
    assert revert_res.json()["success"] is True

    # Check that it is removed from reviewed archive
    archive_data = client.get("/api/v1/reviewed-studies").json()
    assert study_id not in [it["study_id"] for it in archive_data["items"]]

    # Check that it is back in active queue
    queue_data = client.get("/api/v1/queue").json()
    assert study_id in [it["study_id"] for it in queue_data["items"]]


def test_reviewed_study_deletion_permissions(client):
    """
    Verifies that when a scan is clinically reviewed:
    1. Other users (including original uploader or other clinicians) cannot delete it (403 Forbidden).
    2. ONLY the reviewing clinician can delete the reviewed study.
    """
    study_id = "XR-PROTECT-DEL-01"
    # Create study uploaded by user_alice
    file_content = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
    client.post(
        "/api/v1/studies",
        data={"study_id": study_id, "modality": "X-RAY", "patient_name": "Protected Study"},
        files={"file": ("scan.png", io.BytesIO(file_content), "image/png")},
        params={"user_id": "user_alice"}
    )

    # Clinician dr_lin reviews and signs off the scan
    client.patch(
        f"/api/v1/studies/{study_id}/review",
        json={"action": "COMPLETED_REVIEW", "reviewer_id": "dr_lin", "review_status": "NORMAL", "notes": "Exam normal."}
    )

    # 1. Attempt to delete without user_id -> 403 Forbidden
    res_no_user = client.delete(f"/api/v1/reviewed-studies/{study_id}")
    assert res_no_user.status_code == 403
    assert "clinically reviewed by dr_lin" in res_no_user.json()["detail"]

    # 2. Attempt to delete by uploader (user_alice) -> 403 Forbidden (reviewer protection!)
    res_uploader = client.delete(f"/api/v1/reviewed-studies/{study_id}?user_id=user_alice")
    assert res_uploader.status_code == 403
    assert "clinically reviewed by dr_lin" in res_uploader.json()["detail"]

    # 3. Attempt to delete by another doctor (dr_stranger) -> 403 Forbidden
    res_other = client.delete(f"/api/v1/studies/{study_id}?user_id=dr_stranger")
    assert res_other.status_code == 403
    assert "clinically reviewed by dr_lin" in res_other.json()["detail"]

    # 4. Attempt to batch delete by another user -> rejected
    res_batch_other = client.post(
        "/api/v1/studies/batch-delete",
        json={"study_ids": [study_id], "user_id": "dr_stranger"}
    )
    assert res_batch_other.status_code == 200
    assert res_batch_other.json()["deletedCount"] == 0
    assert len(res_batch_other.json()["errors"]) >= 1

    # 5. Delete by the reviewer (dr_lin) -> 200 OK success!
    res_reviewer = client.delete(f"/api/v1/reviewed-studies/{study_id}?user_id=dr_lin")
    assert res_reviewer.status_code == 200
    assert res_reviewer.json()["success"] is True

    # Confirm it's gone
    res_check = client.get(f"/api/v1/reviewed-studies/{study_id}")
    assert res_check.status_code == 404


def test_unreviewed_study_deletion_permissions(client):
    """
    Verifies that for an unreviewed study in triage queue:
    1. Only the uploader can delete it.
    2. Other users get 403 Forbidden.
    """
    study_id = "XR-UNREV-DEL-01"
    file_content = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
    client.post(
        "/api/v1/studies",
        data={"study_id": study_id, "modality": "X-RAY", "patient_name": "Unreviewed Study"},
        files={"file": ("scan.png", io.BytesIO(file_content), "image/png")},
        params={"user_id": "uploader_bob"}
    )

    # Other user attempts delete -> 403 Forbidden
    res_other = client.delete(f"/api/v1/studies/{study_id}?user_id=attacker_carol")
    assert res_other.status_code == 403
    assert "Permission denied" in res_other.json()["detail"]

    # Uploader deletes -> 200 OK
    res_uploader = client.delete(f"/api/v1/studies/{study_id}?user_id=uploader_bob")
    assert res_uploader.status_code == 200
    assert res_uploader.json()["success"] is True

