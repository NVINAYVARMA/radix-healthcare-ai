
# Reading Backlog AI

## Model

ReadingBacklog-DenseNet121

Version: 1.0.0

This package contains a DenseNet121-based multi-label chest X-ray
pattern model designed for a hackathon workflow prototype.

The model outputs probabilities for six radiographic patterns:

1. Pneumothorax
2. Effusion
3. Consolidation
4. Edema
5. Atelectasis
6. Cardiomegaly

The model does NOT directly predict clinical urgency.

The AI Pattern Score is a prototype workflow score derived from the
six model outputs and is intended only to demonstrate queue
prioritization logic.

Every study must remain subject to radiologist review.

---

## Requirements

Python 3.10+

Install dependencies:

pip install -r requirements.txt

---

## Model files

The trained checkpoint is:

model/reading_backlog_densenet121_best.pth

---

## Running inference

Example:

python test_inference.py path/to/chest_xray.png

---

## Python API

from inference import load_default_model, analyze_image

model = load_default_model()

with open("image.png", "rb") as f:
    image_bytes = f.read()

result = analyze_image(
    image_bytes,
    model
)

print(result)

---

## Output

The inference API returns:

{
    "model_name": "ReadingBacklog-DenseNet121",
    "model_version": "1.0.0",
    "ai_score": 17.8,
    "model_confidence": 0.5391,
    "model_confidence_type":
        "uncalibrated_max_pattern_probability",
    "processing_time_ms": 67.64,
    "findings": {
        "Pneumothorax": 0.0818,
        "Effusion": 0.2944,
        "Consolidation": 0.2256,
        "Edema": 0.0127,
        "Atelectasis": 0.5391,
        "Cardiomegaly": 0.155
    }
}

---

## Model evaluation

Validation:

Macro AUROC: 0.84692
Macro AUPRC: 0.33254

Independent test:

Macro AUROC: 0.8355
Macro AUPRC: 0.3078

These are research/hackathon evaluation metrics and should not be
interpreted as clinical validation.

---

## Important safety limitation

This model is a workflow-triage prototype.

It is NOT a diagnostic system.

AI output must not replace radiologist interpretation.

AI prioritization must not prevent or suppress review of any study.

Radiologist review remains required for every study.

The model confidence score is currently an uncalibrated model score,
not a calibrated probability of diagnostic correctness.

---

## Architecture

Chest X-ray
    |
    v
224x224 preprocessing
    |
    v
DenseNet121
    |
    v
Six pattern probabilities
    |
    v
AI Pattern Score
    |
    v
Backend Priority Engine
    |
    v
Dynamic Review Queue
    |
    v
Radiologist Review

---

## Dataset

The model was trained using a selected subset of the NIH
ChestX-ray14 dataset with patient-level train/validation/test splitting.

The dataset labels originate from the ChestX-ray14 dataset and have
known limitations associated with report-derived labeling.

---

## Intended integration

The FastAPI backend should call the inference API after a study is
uploaded.

The backend should store:

- ai_score
- model_confidence
- model_name
- model_version
- processing_time_ms
- individual pattern probabilities

The backend should continue calculating:

- waiting-time factor
- image-quality factor
- final priority score
- priority level

AI score should never overwrite manual radiologist priority.

---

## Model version

1.0.0

Do not modify the checkpoint without creating a new model version.
