"""
Tests for LocalResNet18AIProvider and integration with AIService.
These tests verify model loading, preprocessing, inference output shape,
and end-to-end telemetry recording in the model_runs DB table.
"""
import io
import os
import pytest
from PIL import Image


def _make_fake_xray_png(width: int = 224, height: int = 224) -> bytes:
    """Creates a realistic-looking synthetic grayscale PNG in memory."""
    import numpy as np
    # Simulate chest X-ray: dark background with a bright central region
    arr = np.zeros((height, width), dtype=np.uint8)
    arr[50:174, 50:174] = 180   # bright rib cage region
    arr[80:144, 80:144] = 220   # brighter lung fields
    arr[90:134, 88:136] = 60    # darker heart shadow
    img = Image.fromarray(arr, mode="L")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


# ---------------------------------------------------------------------------
# 1. Model Loading & Weight Verification
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_resnet18_provider_loads_weights():
    from app.services.ai_service import LocalResNet18AIProvider

    weights_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "ml", "reading_backlog_resnet18.pth")
    )
    assert os.path.exists(weights_path), (
        f"ResNet18 weights file missing at: {weights_path}\n"
        "Make sure backend/ml/reading_backlog_resnet18.pth exists."
    )
    provider = LocalResNet18AIProvider(weights_path=weights_path)
    # Trigger model loading
    model = provider._load_model()

    # Verify final layer has exactly 2 output classes
    import torch.nn as nn
    assert isinstance(model.fc, nn.Linear)
    assert model.fc.out_features == 2


# ---------------------------------------------------------------------------
# 2. Inference Output Validity
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_resnet18_inference_output():
    from app.services.ai_service import LocalResNet18AIProvider

    weights_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "ml", "reading_backlog_resnet18.pth")
    )
    provider = LocalResNet18AIProvider(weights_path=weights_path)
    fake_image = _make_fake_xray_png()

    result = await provider.analyze(fake_image, filename="test_chest_xray.png")

    # Score must be in [0, 100]
    assert 0.0 <= result.score <= 100.0, f"Score out of range: {result.score}"

    # Confidence is the highest class probability — always in [0.5, 1.0] for a 2-class softmax
    assert 0.5 <= result.confidence <= 1.0, f"Confidence out of range: {result.confidence}"

    # Quality score must be in [10, 100]
    assert 10.0 <= result.image_quality_score <= 100.0

    # Model metadata must match expectations
    assert result.model_name == "ResNet18"
    assert result.model_version == "1.0"

    # Must record execution time
    assert result.processing_time_ms > 0

    print(
        f"\n[PASS] ResNet18 Inference Result:\n"
        f"   Score:       {result.score}/100\n"
        f"   Confidence:  {round(result.confidence * 100, 1)}%\n"
        f"   Quality:     {result.image_quality_score}/100\n"
        f"   Latency:     {result.processing_time_ms}ms"
    )


# ---------------------------------------------------------------------------
# 3. Preprocessing pipeline correctness
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_resnet18_preprocessing_shape():
    import torch
    from app.services.ai_service import LocalResNet18AIProvider

    weights_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "ml", "reading_backlog_resnet18.pth")
    )
    provider = LocalResNet18AIProvider(weights_path=weights_path)
    fake_image = _make_fake_xray_png()

    tensor = provider._preprocess(fake_image)

    # Must be shape (1, 3, 224, 224)
    assert tensor.shape == (1, 3, 224, 224), f"Unexpected tensor shape: {tensor.shape}"
    assert tensor.dtype == torch.float32


# ---------------------------------------------------------------------------
# 4. AIService telemetry recording with ResNet18
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_ai_service_with_resnet18_records_model_run(db_session):
    from app.services.ai_service import AIService, LocalResNet18AIProvider
    from app.models.study import Study, StudyStatus
    from app.models.model_run import ModelRun

    weights_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "ml", "reading_backlog_resnet18.pth")
    )
    ai_service = AIService(provider=LocalResNet18AIProvider(weights_path=weights_path))

    study = Study(
        study_id="XR-RESNET-01",
        image_path="studies/XR-RESNET-01/scan.png",
        status=StudyStatus.PROCESSING.value
    )
    db_session.add(study)
    db_session.commit()

    fake_image = _make_fake_xray_png()
    result = await ai_service.process_study_ai(
        db=db_session,
        study=study,
        image_bytes=fake_image,
        filename="chest_xray_resnet.png"
    )

    # Study must now have ai_score, ai_confidence, and quality score set
    assert study.ai_score == result.score
    assert study.ai_confidence is not None
    assert study.image_quality_score is not None

    # A model_run record must exist in the database
    runs = db_session.query(ModelRun).filter_by(study_id="XR-RESNET-01").all()
    assert len(runs) == 1
    assert runs[0].model_name == "ResNet18"
    assert runs[0].processing_time_ms > 0
