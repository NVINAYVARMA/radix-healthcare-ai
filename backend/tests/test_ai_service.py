import pytest
from app.services.ai_service import MockAIProvider, AIService
from app.models.study import Study, StudyStatus
from app.models.model_run import ModelRun


@pytest.mark.asyncio
async def test_mock_ai_provider_scoring():
    provider = MockAIProvider()
    
    # 1. Critical pattern test
    critical_res = await provider.analyze(b"fake-image-bytes-critical", filename="scan_critical_pneumo.png")
    assert 80.0 <= critical_res.score <= 100.0
    assert 0.85 <= critical_res.confidence <= 1.0
    assert critical_res.model_name == "DenseNet121-Mock"
    assert critical_res.processing_time_ms > 0

    # 2. Normal pattern test
    normal_res = await provider.analyze(b"fake-image-bytes-normal", filename="scan_normal_clear.png")
    assert 10.0 <= normal_res.score <= 45.0
    assert 0.80 <= normal_res.confidence <= 1.0


@pytest.mark.asyncio
async def test_ai_service_process_and_model_run_persistence(db_session):
    # Explicitly inject MockAIProvider so the test is independent of AI_PROVIDER env setting
    ai_service = AIService(provider=MockAIProvider())
    
    study = Study(
        study_id="XR-TEST-01",
        image_path="studies/XR-TEST-01/scan.png",
        status=StudyStatus.PROCESSING.value
    )
    db_session.add(study)
    db_session.commit()

    result = await ai_service.process_study_ai(
        db=db_session,
        study=study,
        image_bytes=b"sample-chest-xray-content",
        filename="urgent_xray.png"
    )

    # Check that study was updated
    assert study.ai_score == result.score
    assert study.ai_confidence == round(result.confidence * 100, 1)
    assert study.image_quality_score == result.image_quality_score

    # Check model_runs record
    runs = db_session.query(ModelRun).filter_by(study_id="XR-TEST-01").all()
    assert len(runs) == 1
    assert runs[0].model_name == "DenseNet121-Mock"
    assert runs[0].score == result.score
    assert runs[0].processing_time_ms == result.processing_time_ms
