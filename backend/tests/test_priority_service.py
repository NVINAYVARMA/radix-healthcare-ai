from datetime import datetime, timezone, timedelta
from app.services.priority_service import PriorityService, PriorityLevel
from app.models.study import Study, StudyStatus
from app.models.priority import PriorityFactor


def test_priority_exact_formula_calculation():
    service = PriorityService()
    # Values matching section 10 of Description.md:
    # AI=87, Confidence=91, Waiting=60, Quality=95 -> Priority = 85.5
    total_score, level, factors = service.compute_priority(
        ai_score=87.0,
        confidence=91.0,
        waiting_score=60.0,
        quality_score=95.0
    )

    assert total_score == 85.5
    assert level == PriorityLevel.HIGH.value
    assert len(factors) == 4
    
    factor_map = {f["factor_name"]: f for f in factors}
    assert factor_map["AI_SIGNAL"]["contribution"] == 60.9
    assert factor_map["CONFIDENCE"]["contribution"] == 9.1
    assert factor_map["WAITING_TIME"]["contribution"] == 6.0
    assert factor_map["IMAGE_QUALITY"]["contribution"] == 9.5


def test_priority_level_classification():
    service = PriorityService()
    assert service.classify_priority_level(90.0) == "HIGH"
    assert service.classify_priority_level(80.0) == "HIGH"
    assert service.classify_priority_level(79.9) == "MEDIUM"
    assert service.classify_priority_level(50.0) == "MEDIUM"
    assert service.classify_priority_level(49.9) == "STANDARD"
    assert service.classify_priority_level(15.0) == "STANDARD"


def test_waiting_time_capped_fairness():
    service = PriorityService()
    now = datetime.now(timezone.utc)

    # 1 hour wait
    arrival_1h = now - timedelta(hours=1)
    score_1h, mins_1h = service.calculate_waiting_score(arrival_1h, now)
    assert score_1h == 10.0
    assert mins_1h == 60.0

    # 5 hours wait
    arrival_5h = now - timedelta(hours=5)
    score_5h, mins_5h = service.calculate_waiting_score(arrival_5h, now)
    assert score_5h == 50.0

    # 24 hours wait -> should be strictly capped at 100.0 (max 10 pts contribution)
    arrival_24h = now - timedelta(hours=24)
    score_24h, mins_24h = service.calculate_waiting_score(arrival_24h, now)
    assert score_24h == 100.0


def test_calculate_and_save_priority_db(db_session):
    service = PriorityService()
    now = datetime.now(timezone.utc) - timedelta(hours=2)

    study = Study(
        study_id="XR-PRIO-01",
        image_path="studies/XR-PRIO-01/scan.png",
        arrival_time=now,
        status=StudyStatus.PROCESSING.value,
        ai_score=85.0,
        ai_confidence=90.0,
        image_quality_score=92.0
    )
    db_session.add(study)
    db_session.commit()

    updated_study = service.calculate_and_save_priority(db_session, study)
    
    assert updated_study.priority_score is not None
    assert updated_study.priority_score >= 70.0
    assert updated_study.status == StudyStatus.PENDING_REVIEW.value
    assert updated_study.priority_level in ["HIGH", "MEDIUM"]

    # Verify factors persisted in DB
    factors = db_session.query(PriorityFactor).filter_by(study_id="XR-PRIO-01").all()
    assert len(factors) == 4
    factor_names = {f.factor_name for f in factors}
    assert factor_names == {"AI_SIGNAL", "CONFIDENCE", "WAITING_TIME", "IMAGE_QUALITY"}
