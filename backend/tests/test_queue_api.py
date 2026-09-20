import io
from datetime import datetime, timezone, timedelta
from app.models.study import Study, StudyStatus, PriorityLevel


def test_queue_ordering_and_tie_breaking(client, db_session):
    # Setup test studies directly with exact timestamps and scores to test deterministic sorting
    t0 = datetime(2026, 9, 18, 2, 0, 0, tzinfo=timezone.utc)
    t1 = t0 + timedelta(minutes=15)
    t2 = t0 + timedelta(minutes=30)
    t3 = t0 + timedelta(minutes=45)

    # Study A: Arrived early, STANDARD priority
    study_a = Study(
        study_id="XR-QUEUE-A",
        image_path="studies/XR-QUEUE-A/scan.png",
        arrival_time=t0,
        status=StudyStatus.PENDING_REVIEW.value,
        priority_score=40.0,
        priority_level=PriorityLevel.STANDARD.value,
    )
    # Study B: Arrived later, HIGH priority (urgent case)
    study_b = Study(
        study_id="XR-QUEUE-B",
        image_path="studies/XR-QUEUE-B/scan.png",
        arrival_time=t1,
        status=StudyStatus.PENDING_REVIEW.value,
        priority_score=92.5,
        priority_level=PriorityLevel.HIGH.value,
    )
    # Study C: Arrived even later, MEDIUM priority
    study_c = Study(
        study_id="XR-QUEUE-C",
        image_path="studies/XR-QUEUE-C/scan.png",
        arrival_time=t2,
        status=StudyStatus.PENDING_REVIEW.value,
        priority_score=68.0,
        priority_level=PriorityLevel.MEDIUM.value,
    )
    # Study D: Arrived after C, SAME priority score as C (68.0) -> tests tie-breaking by arrival_time
    study_d = Study(
        study_id="XR-QUEUE-D",
        image_path="studies/XR-QUEUE-D/scan.png",
        arrival_time=t3,
        status=StudyStatus.PENDING_REVIEW.value,
        priority_score=68.0,
        priority_level=PriorityLevel.MEDIUM.value,
    )
    # Study E: Already reviewed -> must NOT appear in active reading queue
    study_e = Study(
        study_id="XR-QUEUE-E",
        image_path="studies/XR-QUEUE-E/scan.png",
        arrival_time=t0,
        status=StudyStatus.REVIEWED.value,
        priority_score=95.0,
        priority_level=PriorityLevel.HIGH.value,
    )

    db_session.add_all([study_a, study_b, study_c, study_d, study_e])
    db_session.commit()

    # Call GET /api/v1/queue
    response = client.get("/api/v1/queue")
    assert response.status_code == 200
    queue_data = response.json()

    assert queue_data["total"] == 4
    assert queue_data["high_count"] == 1
    assert queue_data["medium_count"] == 2
    assert queue_data["standard_count"] == 1

    items = queue_data["items"]
    assert len(items) == 4

    # Verification of queue reordering:
    # 1. Study B (High - 92.5) must be Rank 1 even though it arrived after A
    assert items[0]["study_id"] == "XR-QUEUE-B"
    assert items[0]["rank"] == 1
    assert items[0]["priority_level"] == "HIGH"

    # 2. Tie-breaking check between Study C and Study D (both have 68.0):
    # Study C arrived at t2, Study D arrived at t3 -> C must be before D
    assert items[1]["study_id"] == "XR-QUEUE-C"
    assert items[1]["rank"] == 2
    assert items[2]["study_id"] == "XR-QUEUE-D"
    assert items[2]["rank"] == 3

    # 3. Study A (Standard - 40.0) must be Rank 4
    assert items[3]["study_id"] == "XR-QUEUE-A"
    assert items[3]["rank"] == 4


def test_process_queue_batch_endpoint(client, db_session):
    # Add studies in PROCESSING state
    s1 = Study(
        study_id="XR-BATCH-01",
        image_path="studies/XR-BATCH-01/scan.png",
        status=StudyStatus.PROCESSING.value,
        ai_score=88.0,
        ai_confidence=92.0,
        image_quality_score=95.0,
    )
    s2 = Study(
        study_id="XR-BATCH-02",
        image_path="studies/XR-BATCH-02/scan.png",
        status=StudyStatus.PROCESSING.value,
        ai_score=25.0,
        ai_confidence=85.0,
        image_quality_score=90.0,
    )
    db_session.add_all([s1, s2])
    db_session.commit()

    # Trigger batch queue processing
    response = client.post("/api/v1/queue/process")
    assert response.status_code == 200
    data = response.json()

    assert data["processed"] >= 2
    assert "high" in data
    assert "medium" in data
    assert "standard" in data

    # Verify both studies are now in PENDING_REVIEW and have priority scores
    updated_s1 = db_session.query(Study).filter_by(study_id="XR-BATCH-01").first()
    assert updated_s1.status == StudyStatus.PENDING_REVIEW.value
    assert updated_s1.priority_level == "HIGH"
    assert updated_s1.priority_score is not None

    updated_s2 = db_session.query(Study).filter_by(study_id="XR-BATCH-02").first()
    assert updated_s2.status == StudyStatus.PENDING_REVIEW.value
    assert updated_s2.priority_level == "STANDARD"
