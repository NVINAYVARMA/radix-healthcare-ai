from datetime import datetime, timezone
from app.models.study import Study, StudyStatus, PriorityLevel
from app.models.priority import PriorityFactor
from app.models.review import ReviewLog
from app.models.user import User, UserRole
from app.models.model_run import ModelRun
from sqlalchemy import inspect


def test_tables_exist(db_session):
    inspector = inspect(db_session.bind)
    tables = inspector.get_table_names()
    
    assert "studies" in tables
    assert "priority_factors" in tables
    assert "review_logs" in tables
    assert "users" in tables
    assert "model_runs" in tables


def test_study_and_factors_crud(db_session):
    now = datetime.now(timezone.utc)
    study = Study(
        study_id="XR-0023",
        modality="X-RAY",
        image_path="studies/XR-0023/scan.png",
        arrival_time=now,
        status=StudyStatus.PRIORITIZED.value,
        ai_score=87.0,
        ai_confidence=91.0,
        priority_score=88.6,
        priority_level=PriorityLevel.HIGH.value,
        image_quality_score=95.0,
    )
    db_session.add(study)
    db_session.commit()

    factor = PriorityFactor(
        study_id="XR-0023",
        factor_name="AI_SIGNAL",
        factor_value=87.0,
        weight=0.70,
        contribution=60.9,
        description="AI model detected a high-priority imaging pattern",
    )
    db_session.add(factor)
    db_session.commit()

    fetched = db_session.query(Study).filter_by(study_id="XR-0023").first()
    assert fetched is not None
    assert fetched.priority_level == "HIGH"
    assert len(fetched.factors) == 1
    assert fetched.factors[0].factor_name == "AI_SIGNAL"
    assert fetched.factors[0].contribution == 60.9


def test_user_creation(db_session):
    user = User(
        name="Dr. Jane Smith",
        email="jane.smith@radiology.org",
        role=UserRole.RADIOLOGIST.value
    )
    db_session.add(user)
    db_session.commit()

    fetched_user = db_session.query(User).filter_by(email="jane.smith@radiology.org").first()
    assert fetched_user is not None
    assert fetched_user.role == "RADIOLOGIST"


def test_review_log_and_model_run(db_session):
    study = Study(
        study_id="XR-0045",
        image_path="studies/XR-0045/image.png",
        status=StudyStatus.PENDING_REVIEW.value,
    )
    db_session.add(study)
    db_session.commit()

    # Add model run
    model_run = ModelRun(
        study_id="XR-0045",
        model_name="DenseNet121",
        model_version="1.0",
        score=75.5,
        confidence=89.0,
        processing_time_ms=1420.5
    )
    db_session.add(model_run)

    # Add review log
    review = ReviewLog(
        study_id="XR-0045",
        action="OPENED",
        review_status="IN_REVIEW",
        reviewer_id="RAD-01",
        notes="Opening study for initial read"
    )
    db_session.add(review)
    db_session.commit()

    fetched = db_session.query(Study).filter_by(study_id="XR-0045").first()
    assert len(fetched.model_runs) == 1
    assert fetched.model_runs[0].model_name == "DenseNet121"
    assert len(fetched.reviews) == 1
    assert fetched.reviews[0].action == "OPENED"
