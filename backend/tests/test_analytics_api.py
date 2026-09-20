import io
from datetime import datetime, timedelta, timezone
from app.models.study import Study, StudyStatus, PriorityLevel


def test_analytics_overview_metrics(client, db_session):
    # Add test studies
    now = datetime.now(timezone.utc)
    s1 = Study(
        study_id="AN-01",
        modality="X-RAY",
        image_path="studies/AN-01/scan.png",
        status=StudyStatus.PENDING_REVIEW.value,
        ai_score=90.0,
        ai_confidence=95.0,
        priority_score=92.0,
        priority_level=PriorityLevel.HIGH.value,
        arrival_time=now - timedelta(minutes=45)
    )
    s2 = Study(
        study_id="AN-02",
        modality="X-RAY",
        image_path="studies/AN-02/scan.png",
        status=StudyStatus.REVIEWED.value,
        ai_score=30.0,
        ai_confidence=80.0,
        priority_score=35.0,
        priority_level=PriorityLevel.STANDARD.value,
        arrival_time=now - timedelta(hours=2)
    )
    s3 = Study(
        study_id="AN-03",
        modality="X-RAY",
        image_path="studies/AN-03/scan.png",
        status=StudyStatus.IN_REVIEW.value,
        ai_score=65.0,
        ai_confidence=85.0,
        priority_score=62.0,
        priority_level=PriorityLevel.MEDIUM.value,
        arrival_time=now - timedelta(minutes=15)
    )
    db_session.add_all([s1, s2, s3])
    db_session.commit()

    resp = client.get("/api/v1/analytics/overview")
    assert resp.status_code == 200
    data = resp.json()

    assert data["total_studies"] >= 3
    assert data["status_counts"]["pending_review"] >= 1
    assert data["status_counts"]["in_review"] >= 1
    assert data["status_counts"]["reviewed"] >= 1
    assert data["priority_counts"]["high"] >= 1
    assert data["priority_counts"]["medium"] >= 1
    assert data["priority_counts"]["standard"] >= 1
    assert data["average_ai_score"] > 0
    assert data["average_priority_score"] > 0
    assert data["high_priority_percentage"] > 0


def test_analytics_queue_comparison_proves_prioritization(client, db_session):
    """
    CRITICAL EVALUATION TEST:
    Demonstrates that an acute emergency arriving LATER jumps ahead of older, non-urgent studies.
    Simulates:
      - Case A (Normal): arrived 120 mins ago (FIFO #1) -> priority = 25.0
      - Case B (Medium): arrived 60 mins ago (FIFO #2)  -> priority = 55.0
      - Case C (Urgent): arrived 5 mins ago (FIFO #3)   -> priority = 94.0 (HIGH)
    Result:
      - Case C jumps from FIFO #3 to Priority #1 (+2 rank improvement).
      - Saves estimated triage turnaround time for critical patients.
    """
    now = datetime.now(timezone.utc)

    # Clean previous queue items from DB to test exact ranks
    db_session.query(Study).delete()
    db_session.commit()

    case_a = Study(
        study_id="CASE-A-ROUTINE",
        modality="X-RAY",
        image_path="studies/a/scan.png",
        status=StudyStatus.PENDING_REVIEW.value,
        ai_score=20.0,
        priority_score=25.0,
        priority_level=PriorityLevel.STANDARD.value,
        arrival_time=now - timedelta(minutes=120)  # Arrived first
    )
    case_b = Study(
        study_id="CASE-B-MODERATE",
        modality="X-RAY",
        image_path="studies/b/scan.png",
        status=StudyStatus.PENDING_REVIEW.value,
        ai_score=50.0,
        priority_score=55.0,
        priority_level=PriorityLevel.MEDIUM.value,
        arrival_time=now - timedelta(minutes=60)   # Arrived second
    )
    case_c = Study(
        study_id="CASE-C-ACUTE-PNEUMO",
        modality="X-RAY",
        image_path="studies/c/scan.png",
        status=StudyStatus.PENDING_REVIEW.value,
        ai_score=95.0,
        priority_score=94.0,
        priority_level=PriorityLevel.HIGH.value,
        arrival_time=now - timedelta(minutes=5)    # Arrived LAST
    )
    db_session.add_all([case_a, case_b, case_c])
    db_session.commit()

    resp = client.get("/api/v1/analytics/queue-comparison?minutes_per_study=8.0")
    assert resp.status_code == 200
    comp = resp.json()

    assert comp["total_queued"] == 3
    assert comp["high_priority_count"] == 1
    assert comp["max_rank_improvement"] == 2
    assert comp["avg_rank_improvement_high_priority"] == 2.0
    # 2 ranks saved * 8.0 mins = 16.0 minutes earlier review!
    assert comp["estimated_time_saved_minutes_critical"] == 16.0

    items_by_id = {it["study_id"]: it for it in comp["items"]}
    # Acute case arrived 3rd in time, but was elevated to #1 in queue
    assert items_by_id["CASE-C-ACUTE-PNEUMO"]["fifo_rank"] == 3
    assert items_by_id["CASE-C-ACUTE-PNEUMO"]["priority_rank"] == 1
    assert items_by_id["CASE-C-ACUTE-PNEUMO"]["rank_delta"] == 2
