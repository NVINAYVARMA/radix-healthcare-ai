"""
Automated tests for DenseNet121 multi-label model provider and pipeline integration.
"""
import io
import os
import pytest
from PIL import Image


def _make_fake_xray_png(width: int = 224, height: int = 224) -> bytes:
    import numpy as np
    arr = np.zeros((height, width), dtype=np.uint8)
    arr[50:174, 50:174] = 160
    arr[80:144, 80:144] = 200
    arr[90:134, 88:136] = 50
    img = Image.fromarray(arr, mode="L")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


@pytest.mark.asyncio
async def test_densenet121_provider_loads_weights():
    from app.services.ai_service import DenseNet121AIProvider
    import torch.nn as nn

    weights_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "ml", "reading_backlog_densenet121_best.pth")
    )
    assert os.path.exists(weights_path), f"Weights file missing: {weights_path}"

    provider = DenseNet121AIProvider(weights_path=weights_path)
    model = provider._load_model()

    assert isinstance(model.classifier, nn.Linear)
    assert model.classifier.out_features == 6  # 6 target labels


@pytest.mark.asyncio
async def test_densenet121_inference_findings_and_score():
    from app.services.ai_service import DenseNet121AIProvider

    weights_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "ml", "reading_backlog_densenet121_best.pth")
    )
    provider = DenseNet121AIProvider(weights_path=weights_path)
    fake_image = _make_fake_xray_png()

    result = await provider.analyze(fake_image, filename="chest_xray_densenet.png")

    assert 0.0 <= result.score <= 100.0
    assert 0.0 <= result.confidence <= 1.0
    assert result.model_name == "ReadingBacklog-DenseNet121"
    assert result.model_version == "1.0.0"
    assert result.processing_time_ms > 0

    # Check 6 distinct findings
    assert len(result.findings) == 6
    expected_findings = [
        "Pneumothorax", "Effusion", "Consolidation",
        "Edema", "Atelectasis", "Cardiomegaly"
    ]
    for label in expected_findings:
        assert label in result.findings
        assert 0.0 <= result.findings[label] <= 1.0


@pytest.mark.asyncio
async def test_densenet121_preprocessing_shape():
    import torch
    from app.services.ai_service import DenseNet121AIProvider

    weights_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "ml", "reading_backlog_densenet121_best.pth")
    )
    provider = DenseNet121AIProvider(weights_path=weights_path)
    fake_image = _make_fake_xray_png()

    tensor = provider._preprocess(fake_image)
    assert tensor.shape == (1, 3, 224, 224)
    assert tensor.dtype == torch.float32


@pytest.mark.asyncio
async def test_ai_service_with_densenet121_records_model_run(db_session):
    from app.services.ai_service import AIService, DenseNet121AIProvider
    from app.models.study import Study, StudyStatus
    from app.models.model_run import ModelRun

    weights_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "ml", "reading_backlog_densenet121_best.pth")
    )
    ai_service = AIService(provider=DenseNet121AIProvider(weights_path=weights_path))

    study = Study(
        study_id="XR-DENSENET-01",
        image_path="studies/XR-DENSENET-01/scan.png",
        status=StudyStatus.PROCESSING.value
    )
    db_session.add(study)
    db_session.commit()

    fake_image = _make_fake_xray_png()
    result = await ai_service.process_study_ai(
        db=db_session,
        study=study,
        image_bytes=fake_image,
        filename="chest_xray.png"
    )

    assert study.ai_score == result.score
    assert study.ai_confidence is not None

    runs = db_session.query(ModelRun).filter_by(study_id="XR-DENSENET-01").all()
    assert len(runs) == 1
    assert runs[0].model_name == "ReadingBacklog-DenseNet121"
    assert runs[0].processing_time_ms > 0
