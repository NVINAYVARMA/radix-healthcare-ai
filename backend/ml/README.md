# Reading Backlog AI - Trained Model

## Model
Architecture: ResNet18
Framework: PyTorch
Weights: reading_backlog_resnet18.pth
Number of classes: 2

## Model Architecture

The model was created using:

from torchvision.models import resnet18
import torch.nn as nn

model = resnet18(weights=None)
model.fc = nn.Linear(model.fc.in_features, 2)

The trained state_dict is stored in:
reading_backlog_resnet18.pth

## Input Preprocessing

Every image must be processed as follows:

1. Resize to 224 x 224
2. Convert to grayscale
3. Convert grayscale image to 3 channels
4. Convert to Tensor
5. Normalize using:

mean = [0.485, 0.456, 0.406]
std  = [0.229, 0.224, 0.225]

## Prediction

The model outputs 2 logits.

Probability is calculated using:

probabilities = torch.softmax(output, dim=1)

Abnormality probability:

probabilities[0, 1]

IMPORTANT:
The .pth file is a PyTorch state_dict, so the backend must recreate the ResNet18 architecture before loading the weights.

## Known Test Performance

Test set:
624 images

Correct predictions:
518

Incorrect predictions:
106

Accuracy:
83.01%

## Files

reading_backlog_resnet18.pth
    Trained model weights

model_config.json
    Model architecture and preprocessing configuration

README.md
    Instructions for integrating the model
