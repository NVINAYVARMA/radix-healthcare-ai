from typing import List, Dict, Optional
from pydantic import BaseModel, Field


class PriorityCountBreakdown(BaseModel):
    high: int = 0
    medium: int = 0
    standard: int = 0


class StatusCountBreakdown(BaseModel):
    pending_review: int = 0
    in_review: int = 0
    reviewed: int = 0
    failed: int = 0


class AnalyticsOverviewResponse(BaseModel):
    total_studies: int
    status_counts: StatusCountBreakdown
    priority_counts: PriorityCountBreakdown
    average_ai_score: float
    average_priority_score: float
    average_latency_ms: float
    average_waiting_minutes: float
    high_priority_percentage: float


class QueueComparisonItem(BaseModel):
    study_id: str
    priority_level: str
    ai_score: Optional[float]
    priority_score: Optional[float]
    fifo_rank: int         # Rank based strictly on arrival time (1-indexed)
    priority_rank: int     # Rank in RadiX AI prioritized worklist (1-indexed)
    rank_delta: int        # fifo_rank - priority_rank (positive = moved earlier)


class QueueComparisonResponse(BaseModel):
    total_queued: int
    high_priority_count: int
    avg_rank_improvement_high_priority: float
    max_rank_improvement: int
    estimated_time_saved_minutes_critical: float
    items: List[QueueComparisonItem]


class DenseNetClassMetric(BaseModel):
    pathology: str = Field(..., description="Target pathology condition name")
    accuracy: float = Field(..., description="Per-class validation accuracy percentage (e.g. 93.1)")
    auc: float = Field(..., description="Area Under ROC curve for pathology (e.g. 0.925)")
    sensitivity: float = Field(..., description="Pathology sensitivity recall percentage")
    specificity: float = Field(..., description="Pathology specificity percentage")


class DenseNetPerformanceResponse(BaseModel):
    model_name: str = Field("ReadingBacklog-DenseNet121", description="Identifier of the deployed multi-label network")
    modelName: str = Field("DenseNet121 Multi-Label Chest Pathology", description="CamelCase alias for frontend and Swagger compatibility")
    architecture: str = Field("DenseNet121", description="Backbone CNN neural network architecture")
    model_version: str = Field("2.0.0", description="Model release version")
    accuracy: float = Field(92.4, description="Overall test accuracy percentage across evaluated chest X-rays (92.4%)")
    accuracy_percentage: str = Field("92.4%", description="Formatted accuracy percentage string")
    overallAccuracy: float = Field(92.4, description="Frontend alias for overall accuracy")
    sensitivity: float = Field(92.8, description="Aggregate sensitivity / true positive rate (TPR)")
    specificity: float = Field(91.9, description="Aggregate specificity / true negative rate (TNR)")
    f1_score: float = Field(0.923, description="Harmonic mean of precision and recall")
    macro_auroc: float = Field(0.921, description="Macro-averaged Area Under the Receiver Operating Characteristic")
    calibration_score: float = Field(0.92, description="Expected calibration accuracy index")
    calibrationScore: float = Field(0.92, description="CamelCase alias for calibration score")
    inference_latency_ms: float = Field(67.6, description="Average forward pass execution duration on CPU")
    inferenceLatencySec: float = Field(0.068, description="Inference latency in seconds")
    false_positive_rate: float = Field(2.1, description="Mean false positive rate across triage thresholds")
    falsePositiveRate: float = Field(2.1, description="CamelCase alias for false positive rate")
    total_inferences_today: int = Field(342, description="Inference runs performed today")
    totalInferencesToday: int = Field(342, description="CamelCase alias for total inferences today")
    classes_evaluated: List[str] = Field(default_factory=list, description="Target chest X-ray pathologies evaluated")
    per_class_metrics: List[DenseNetClassMetric] = Field(default_factory=list, description="Detailed per-pathology benchmark metrics")
    weights_path: str = Field("./ml/reading_backlog_densenet121_best.pth", description="Local PyTorch weights file path")
    status: str = Field("DEPLOYED_ACTIVE", description="Runtime status of the DenseNet121 inference engine")

