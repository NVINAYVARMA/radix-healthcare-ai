"""
Verification script for the final trained DenseNet121 multi-label AI model.
Demonstrates multi-pattern detection across 6 radiographic findings:
  1. Pneumothorax (weight: 0.30)
  2. Consolidation (weight: 0.20)
  3. Edema (weight: 0.20)
  4. Effusion (weight: 0.15)
  5. Atelectasis (weight: 0.10)
  6. Cardiomegaly (weight: 0.05)

Usage:
    & .\\.venv\\Scripts\\python.exe tests\\verify_densenet.py
    & .\\.venv\\Scripts\\python.exe tests\\verify_densenet.py path\\to\\chest_xray.png
"""
import asyncio
import io
import os
import sys
import time
import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def make_synthetic_xray() -> bytes:
    """Creates a 224x224 synthetic grayscale X-ray image for testing."""
    from PIL import Image
    import numpy as np
    arr = np.zeros((224, 224), dtype=np.uint8)
    arr[40:184, 40:184] = 160
    arr[70:154, 70:154] = 210
    arr[95:129, 90:134] = 55
    img = Image.fromarray(arr, mode="L")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


async def main():
    from app.services.ai_service import DenseNet121AIProvider
    from app.services.priority_service import PriorityService

    weights_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "ml", "reading_backlog_densenet121_best.pth")
    )

    print("\n" + "="*65)
    print("  RadiX AI -- Final DenseNet121 Multi-Label Model Verification")
    print("="*65)

    if not os.path.exists(weights_path):
        print(f"\n[FAIL] DenseNet121 weights file NOT found at:\n  {weights_path}")
        sys.exit(1)

    size_mb = os.path.getsize(weights_path) / (1024 * 1024)
    print(f"\n[OK]  Weights file found: {weights_path}")
    print(f"      File size: {size_mb:.1f} MB (DenseNet121 checkpoint)")

    if len(sys.argv) > 1:
        image_path = sys.argv[1]
        if not os.path.exists(image_path):
            print(f"\n[FAIL] Image file not found: {image_path}")
            sys.exit(1)
        with open(image_path, "rb") as f:
            image_bytes = f.read()
        filename = os.path.basename(image_path)
        print(f"[IMG] Using input image: {image_path}")
    else:
        image_bytes = make_synthetic_xray()
        filename = "synthetic_xray_test.png"
        print(f"[IMG] Using synthetic test X-ray image (224x224 px)")

    print(f"\n[...] Loading DenseNet121 and running multi-label inference...")
    provider = DenseNet121AIProvider(weights_path=weights_path)
    t_start = time.perf_counter()
    result = await provider.analyze(image_bytes, filename=filename)
    t_total = time.perf_counter() - t_start

    print(f"\n{'-'*65}")
    print(f"  AI INFERENCE RESULTS: {result.model_name} v{result.model_version}")
    print(f"{'-'*65}")
    print(f"  AI Pattern Score:      {result.score:6.1f} / 100")
    print(f"  Max Model Confidence:  {round(result.confidence * 100, 1):6.1f} %")
    print(f"  Image Quality Score:   {result.image_quality_score:6.1f} / 100")
    print(f"  Inference Latency:     {result.processing_time_ms:6.1f} ms")
    print(f"  (Total incl. model load: {t_total*1000:.1f} ms)")

    print(f"\n{'-'*65}")
    print(f"  DETECTED RADIOGRAPHIC PATTERNS (6 Finding Probabilities)")
    print(f"{'-'*65}")
    weights_map = provider.PATTERN_WEIGHTS
    for label, prob in result.findings.items():
        weight = weights_map.get(label, 0.0)
        pct = prob * 100.0
        bar = "#" * int(pct / 4)
        print(f"  {label:15s} : {pct:5.1f}%  (weight: {weight:4.2f})  {bar}")

    # Compute Priority
    priority_service = PriorityService()
    normalized_conf = round(result.confidence * 100.0, 1)
    arrival = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=30)
    waiting_score, _ = priority_service.calculate_waiting_score(arrival)
    priority_score, level, factors = priority_service.compute_priority(
        ai_score=result.score,
        confidence=normalized_conf,
        waiting_score=waiting_score,
        quality_score=result.image_quality_score
    )

    print(f"\n{'-'*65}")
    print(f"  PRIORITY ENGINE OUTPUT")
    print(f"{'-'*65}")
    print(f"  Priority Score:  {priority_score:6.1f} / 100")
    print(f"  Priority Level:  {level}")
    print(f"\n  Factor Breakdown:")
    for f in factors:
        bar = "#" * int(f["contribution"] / 2)
        print(f"    {f['factor_name']:15s}  +{f['contribution']:5.2f} pts  {bar}")

    print(f"\n{'='*65}")
    verdict = {
        "HIGH":     "[RED]    URGENT -- High acute pattern detected, review first",
        "MEDIUM":   "[YELLOW] MEDIUM -- Moderate findings, standard review",
        "STANDARD": "[GREEN]  STANDARD -- Routine case / low acute findings",
    }
    print(f"  WORKLIST VERDICT:  {verdict[level]}")
    print(f"{'='*65}\n")


if __name__ == "__main__":
    asyncio.run(main())
