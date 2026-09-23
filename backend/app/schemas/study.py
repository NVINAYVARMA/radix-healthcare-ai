from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, field_serializer


class PriorityFactorOut(BaseModel):
    factor_name: str
    factor_value: float
    weight: float
    contribution: float
    description: str

    model_config = ConfigDict(from_attributes=True)


class ReviewLogOut(BaseModel):
    action: str
    review_status: Optional[str] = None
    reviewer_id: Optional[str] = None
    notes: Optional[str] = None
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)


class ModelRunOut(BaseModel):
    model_name: str
    model_version: str
    score: float
    confidence: float
    processing_time_ms: float
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class StudyCreateResponse(BaseModel):
    study_id: str
    status: str
    message: str = "Study uploaded successfully"
    image_url: Optional[str] = None
    priority_score: Optional[float] = None
    priority_level: Optional[str] = None
    patient_id: Optional[str] = None
    patient_name: Optional[str] = None
    age: Optional[int] = None
    sex: Optional[str] = None
    body_part: Optional[str] = "Chest"
    clinical_notes: Optional[str] = None
    key_findings: Optional[str] = None
    uploaded_by: Optional[str] = None
    arrival_time: Optional[datetime] = None
    findings: Optional[dict] = None

    @field_serializer("arrival_time")
    def serialize_arrival_time(self, dt: Optional[datetime], _info) -> Optional[str]:
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat().replace("+00:00", "Z")


class StudyListItem(BaseModel):
    id: int
    study_id: str
    modality: str
    image_url: str
    arrival_time: datetime
    status: str
    ai_score: Optional[float] = None
    ai_confidence: Optional[float] = None
    priority_score: Optional[float] = None
    priority_level: Optional[str] = None
    image_quality_score: Optional[float] = None
    manual_priority: Optional[str] = None
    patient_id: Optional[str] = None
    patient_name: Optional[str] = None
    age: Optional[int] = None
    sex: Optional[str] = None
    body_part: Optional[str] = "Chest"
    clinical_notes: Optional[str] = None
    key_findings: Optional[str] = None
    uploaded_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    reviewer_id: Optional[str] = None
    review_status: Optional[str] = None
    review_notes: Optional[str] = None
    findings: Optional[dict] = None

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("arrival_time")
    def serialize_arrival_time(self, dt: datetime, _info) -> str:
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat().replace("+00:00", "Z")


class StudyDetailResponse(BaseModel):
    id: int
    study_id: str
    modality: str
    image_path: str
    image_url: str
    arrival_time: datetime
    status: str
    ai_score: Optional[float] = None
    ai_confidence: Optional[float] = None
    priority_score: Optional[float] = None
    priority_level: Optional[str] = None
    image_quality_score: Optional[float] = None
    manual_priority: Optional[str] = None
    override_reason: Optional[str] = None
    patient_id: Optional[str] = None
    patient_name: Optional[str] = None
    age: Optional[int] = None
    sex: Optional[str] = None
    body_part: Optional[str] = "Chest"
    clinical_notes: Optional[str] = None
    key_findings: Optional[str] = None
    uploaded_by: Optional[str] = None
    factors: List[PriorityFactorOut] = []
    reviews: List[ReviewLogOut] = []
    model_runs: List[ModelRunOut] = []
    findings: Optional[dict] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("arrival_time")
    def serialize_arrival_time(self, dt: datetime, _info) -> str:
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat().replace("+00:00", "Z")


class ReviewActionRequest(BaseModel):
    action: Optional[str] = None
    status: Optional[str] = None
    reviewer_id: Optional[str] = None
    reviewer_name: Optional[str] = None
    review_status: Optional[str] = "NORMAL"
    notes: Optional[str] = None
    reviewNotes: Optional[str] = None


class ReviewActionResponse(BaseModel):
    study_id: str
    action: str
    status: str
    reviewer_id: Optional[str] = None
    review_status: Optional[str] = None
    notes: Optional[str] = None
    message: str = "Review recorded successfully"


class PriorityOverrideRequest(BaseModel):
    manual_priority: Optional[str] = None
    newPriority: Optional[str] = None
    reason: Optional[str] = "Clinical triage adjustment"
    reviewer_id: Optional[str] = None
    overriddenBy: Optional[str] = None


class PriorityOverrideResponse(BaseModel):
    study_id: str
    original_priority_score: Optional[float]
    original_priority_level: Optional[str]
    manual_priority: str
    reason: str
    reviewer_id: Optional[str]
    message: str = "Priority overridden successfully while preserving original AI scores"
