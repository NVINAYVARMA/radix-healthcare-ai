import io
import pytest


def _create_sample_study(client, study_id: str = "XR-REV-01"):
    file_content = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
    files = {"file": ("scan.png", io.BytesIO(file_content), "image/png")}
    data = {"study_id": study_id, "modality": "X-RAY"}
    return client.post("/api/v1/studies", data=data, files=files)


def test_submit_study_review_lifecycle(client):
    """
    Tests the radiologist review lifecycle:
      1. Study starts in PENDING_REVIEW
      2. Radiologist starts review -> IN_REVIEW
      3. Radiologist completes review with notes -> REVIEWED
      4. Completed study is removed from active worklist queue
    """
    study_id = "XR-REV-01"
    res = _create_sample_study(client, study_id)
    assert res.status_code == 201

    # 1. Start review
    start_payload = {
        "action": "STARTED_REVIEW",
        "reviewer_id": "dr_smith",
        "notes": "Starting review of acute chest case"
    }
    r1 = client.patch(f"/api/v1/studies/{study_id}/review", json=start_payload)
    assert r1.status_code == 200
    d1 = r1.json()
    assert d1["status"] == "IN_REVIEW"
    assert d1["action"] == "STARTED_REVIEW"
    assert d1["reviewer_id"] == "dr_smith"

    # 2. Complete review
    comp_payload = {
        "action": "COMPLETED_REVIEW",
        "reviewer_id": "dr_smith",
        "review_status": "ABNORMAL",
        "notes": "Right apical pneumothorax confirmed. Chest tube recommended."
    }
    r2 = client.patch(f"/api/v1/studies/{study_id}/review", json=comp_payload)
    assert r2.status_code == 200
    d2 = r2.json()
    assert d2["status"] == "REVIEWED"
    assert d2["review_status"] == "ABNORMAL"

    # 3. Verify detail endpoint reflects review log entries
    detail = client.get(f"/api/v1/studies/{study_id}").json()
    assert detail["status"] == "REVIEWED"
    assert len(detail["reviews"]) == 2
    actions = [rev["action"] for rev in detail["reviews"]]
    assert "STARTED_REVIEW" in actions
    assert "COMPLETED_REVIEW" in actions

    # 4. Verify completed study is removed from active queue
    queue_data = client.get("/api/v1/queue").json()
    queued_ids = [item["study_id"] for item in queue_data["items"]]
    assert study_id not in queued_ids


def test_manual_priority_override_preserves_original_ai(client):
    """
    CRITICAL CLINICAL & COMPLIANCE TEST:
    A radiologist manual override MUST NOT erase or overwrite the underlying AI score.
    Both must be recorded side-by-side for explainability and legal audits.
    """
    study_id = "XR-OVERRIDE-01"
    _create_sample_study(client, study_id)

    # Fetch initial AI score
    initial_detail = client.get(f"/api/v1/studies/{study_id}").json()
    orig_ai_score = initial_detail["ai_score"]
    orig_priority_score = initial_detail["priority_score"]
    assert orig_ai_score is not None

    # Apply manual override
    override_payload = {
        "manual_priority": "HIGH",
        "reason": "Patient has acute desaturation in ED; immediate chest tube assessment required",
        "reviewer_id": "dr_lead_radiologist"
    }
    resp = client.patch(f"/api/v1/studies/{study_id}/priority", json=override_payload)
    assert resp.status_code == 200
    res_data = resp.json()
    assert res_data["manual_priority"] == "HIGH"
    assert res_data["reason"] == override_payload["reason"]
    assert res_data["original_priority_score"] == orig_priority_score

    # Fetch updated detail: AI score must be identical to original
    updated_detail = client.get(f"/api/v1/studies/{study_id}").json()
    assert updated_detail["ai_score"] == orig_ai_score, "Original AI score was modified!"
    assert updated_detail["manual_priority"] == "HIGH"
    assert updated_detail["override_reason"] == override_payload["reason"]

    # Verify an audit entry was added to review_logs
    audit_entries = [r for r in updated_detail["reviews"] if r["action"] == "PRIORITY_OVERRIDE"]
    assert len(audit_entries) == 1
    assert "Manual priority changed to HIGH" in audit_entries[0]["notes"]
