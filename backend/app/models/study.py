from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import String, Float, DateTime, Text, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin
import enum


class StudyStatus(str, enum.Enum):
    UPLOADED = "UPLOADED"
    PROCESSING = "PROCESSING"
    PRIORITIZED = "PRIORITIZED"
    PENDING_REVIEW = "PENDING_REVIEW"
    IN_REVIEW = "IN_REVIEW"
    REVIEWED = "REVIEWED"
    FAILED = "FAILED"


class PriorityLevel(str, enum.Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    STANDARD = "STANDARD"


class Study(Base, TimestampMixin):
    __tablename__ = "studies"

    id: Mapped[int] = mapped_column(primary_key=True, index=True, autoincrement=True)
    study_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    modality: Mapped[str] = mapped_column(String(32), default="X-RAY", nullable=False)
    image_path: Mapped[str] = mapped_column(String(512), nullable=False)
    arrival_time: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True
    )
    status: Mapped[str] = mapped_column(
        String(32),
        default=StudyStatus.UPLOADED.value,
        nullable=False,
        index=True
    )
    ai_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    ai_confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    priority_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True, index=True)
    priority_level: Mapped[Optional[str]] = mapped_column(String(16), nullable=True, index=True)
    image_quality_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    # Radiologist manual override fields (never overwrites original AI values)
    manual_priority: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    override_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Patient & clinical metadata
    patient_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    patient_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    age: Mapped[Optional[int]] = mapped_column(nullable=True)
    sex: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    body_part: Mapped[Optional[str]] = mapped_column(String(64), default="Chest", nullable=True)
    clinical_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    key_findings: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    uploaded_by: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, index=True)

    # Relationships
    factors: Mapped[List["PriorityFactor"]] = relationship(
        "PriorityFactor", back_populates="study", cascade="all, delete-orphan"
    )
    reviews: Mapped[List["ReviewLog"]] = relationship(
        "ReviewLog", back_populates="study", cascade="all, delete-orphan"
    )
    model_runs: Mapped[List["ModelRun"]] = relationship(
        "ModelRun", back_populates="study", cascade="all, delete-orphan"
    )
