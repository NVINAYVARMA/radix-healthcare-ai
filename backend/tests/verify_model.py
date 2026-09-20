"""
Manual verification script for the ResNet18 AI model.
Run this standalone to confirm the model loads and produces valid predictions.

Usage (from the backend/ directory):
    ..\\.venv\\Scripts\\python.exe tests\\verify_model.py

Or test with a real image:
    ..\\.venv\\Scripts\\python.exe tests\\verify_model.py path\\to\\chest_xray.png
"""
import asyncio
import io
import os
import sys
import time
import datetime

# Make sure the backend package is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def make_synthetic_xray() -> bytes:
    """Creates a 224x224 synthetic grayscale X-ray image for testing."""
    from PIL import Image
    import numpy as np
    arr = np.zeros((224, 224), dtype=np.uint8)
    arr[40:184, 40:184] = 170
    arr[70:154, 70:154] = 210
    arr[95:129, 90:134] = 55
    img = Image.fromarray(arr, mode="L")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


async def main():
    from app.services.ai_service import LocalResNet18AIProvider
    from app.services.priority_service import PriorityService

    weights_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "ml", "reading_backlog_resnet18.pth")
    )

    print("\n" + "="*60)
    print("  RadiX AI -- ResNet18 Model Verification")
    print("="*60)

    # --- Check weights file ---
    if not os.path.exists(weights_path):
        print(f"\n[FAIL]  Weights file NOT found at:\n    {weights_path}")
        print("    Make sure backend/ml/reading_backlog_resnet18.pth exists.")
        sys.exit(1)

    size_mb = os.path.getsize(weights_path) / (1024 * 1024)
    print(f"\n[OK]  Weights file found")
    print(f"      Path: {weights_path}")
    print(f"      Size: {size_mb:.1f} MB")

    # --- Load image ---
    if len(sys.argv) > 1:
        image_path = sys.argv[1]
        if not os.path.exists(image_path):
            print(f"\n[FAIL]  Image file not found: {image_path}")
            sys.exit(1)
        with open(image_path, "rb") as f:
            image_bytes = f.read()
        filename = os.path.basename(image_path)
        print(f"\n[IMG]  Using provided image: {image_path}")
    else:
        image_bytes = make_synthetic_xray()
        filename = "synthetic_xray_test.png"
        print(f"\n[IMG]  Using synthetic test X-ray image (224x224 px)")

    # --- Run inference ---
    print(f"\n[...] Loading ResNet18 model and running inference...")
    provider = LocalResNet18AIProvider(weights_path=weights_path)
    t_start = time.perf_counter()
    result = await provider.analyze(image_bytes, filename=filename)
    t_total = time.perf_counter() - t_start

    print(f"\n{'-'*60}")
    print(f"  AI INFERENCE RESULTS")
    print(f"{'-'*60}")
    print(f"  Model:              {result.model_name} v{result.model_version}")
    print(f"  Abnormality Score:  {result.score:6.1f} / 100")
    print(f"  Model Confidence:   {round(result.confidence * 100, 1):6.1f} %")
    print(f"  Image Quality:      {result.image_quality_score:6.1f} / 100")
    print(f"  Inference Latency:  {result.processing_time_ms:6.1f} ms")
    print(f"  (Total incl. model load: {t_total*1000:.1f} ms)")

    # --- Simulate priority calculation ---
    priority_service = PriorityService()
    normalized_confidence = round(result.confidence * 100.0, 1)
    arrival = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=30)
    waiting_score, _ = priority_service.calculate_waiting_score(arrival)
    priority_score, level, factors = priority_service.compute_priority(
        ai_score=result.score,
        confidence=normalized_confidence,
        waiting_score=waiting_score,
        quality_score=result.image_quality_score
    )

    print(f"\n{'-'*60}")
    print(f"  PRIORITY ENGINE OUTPUT")
    print(f"{'-'*60}")
    print(f"  Priority Score:  {priority_score:6.1f} / 100")
    print(f"  Priority Level:  {level}")
    print(f"\n  Factor Breakdown:")
    for f in factors:
        bar = "#" * int(f["contribution"] / 2)
        print(f"    {f['factor_name']:15s}  +{f['contribution']:5.2f} pts  {bar}")

    print(f"\n{'='*60}")
    verdict = {
        "HIGH":     "[RED]    URGENT -- Should be reviewed first",
        "MEDIUM":   "[YELLOW] MEDIUM -- Review within normal schedule",
        "STANDARD": "[GREEN]  STANDARD -- Routine backlog case",
    }
    print(f"  WORKLIST VERDICT:  {verdict[level]}")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    asyncio.run(main())
