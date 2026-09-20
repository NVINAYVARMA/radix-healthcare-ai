from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, field_serializer
from app.schemas.study import PriorityFactorOut


class QueueProcessResponse(BaseModel):
    processed: int
    high: int
    medium: int
    standard: int


class QueueItem(BaseModel):
    rank: int
    id: Optional[int] = None
    study_id: str
    patient_id: Optional[str] = None
    patient_name: Optional[str] = None
    age: Optional[int] = None
    sex: Optional[str] = None
    body_part: Optional[str] = "Chest"
    modality: str
    image_url: str
    arrival_time: datetime
    waiting_minutes: float
    status: str
    ai_score: Optional[float] = None
    ai_confidence: Optional[float] = None
    priority_score: Optional[float] = None
    priority_level: Optional[str] = None
    manual_priority: Optional[str] = None
    override_reason: Optional[str] = None
    key_findings: Optional[str] = None
    uploaded_by: Optional[str] = None
    tie_resolution: Optional[str] = None
    has_critical_finding: bool = False
    urgency_rank: int = 1
    factors: List[PriorityFactorOut] = []
    findings: Optional[dict] = None

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("arrival_time")
    def serialize_arrival_time(self, dt: datetime, _info) -> str:
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat().replace("+00:00", "Z")


class QueueListResponse(BaseModel):
    total: int
    high_count: int
    medium_count: int
    standard_count: int
    items: List[QueueItem]
    studies: Optional[List[QueueItem]] = None
