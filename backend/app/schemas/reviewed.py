from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, ConfigDict, field_serializer


class ReviewedStudyItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    study_id: str
    patient_id: Optional[str] = None
    patient_name: Optional[str] = None
    age: Optional[int] = None
    sex: Optional[str] = None
    modality: str = "X-RAY"
    body_part: Optional[str] = "Chest"

    priority_level: Optional[str] = None
    priority_score: Optional[float] = None
    ai_score: Optional[float] = None
    ai_confidence: Optional[float] = None
    ai_findings: Optional[str] = None

    reviewer_id: str = "Dr. Attending Radiologist, MD"
    review_status: str = "NORMAL"
    review_notes: Optional[str] = None
    turnaround_time_mins: Optional[float] = None

    arrival_time: datetime
    reviewed_at: datetime
    image_path: Optional[str] = None
    uploaded_by: Optional[str] = None

    @field_serializer("arrival_time")
    def serialize_arrival_time(self, dt: datetime, _info):
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat().replace("+00:00", "Z")

    @field_serializer("reviewed_at")
    def serialize_reviewed_at(self, dt: datetime, _info):
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat().replace("+00:00", "Z")


class ReviewedStudyStats(BaseModel):
    total_reviewed: int = 0
    critical_count: int = 0
    abnormal_count: int = 0
    normal_count: int = 0
    avg_turnaround_time_mins: float = 0.0
    reviewed_today_count: int = 0


class ReviewedStudyListResponse(BaseModel):
    items: List[ReviewedStudyItem]
    total: int
    stats: ReviewedStudyStats
