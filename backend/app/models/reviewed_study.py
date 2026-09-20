from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Float, DateTime, Text, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin


class ReviewedStudy(Base, TimestampMixin):
    """
    Persistent archive table storing fully finalized and clinically signed-off studies.
    Maintains a historical record of radiologist impressions, turnaround times,
    and diagnostic findings separate from the active triage queue.
    """
    __tablename__ = "reviewed_studies"

    id: Mapped[int] = mapped_column(primary_key=True, index=True, autoincrement=True)
    study_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    patient_id: Mapped[Optional[str]] = mapped_column(String(64), index=True, nullable=True)
    patient_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    age: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    sex: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    modality: Mapped[str] = mapped_column(String(32), default="X-RAY", nullable=False)
    body_part: Mapped[Optional[str]] = mapped_column(String(64), default="Chest", nullable=True)

    # Triage and AI assessment at time of sign-off
    priority_level: Mapped[Optional[str]] = mapped_column(String(16), nullable=True, index=True)
    priority_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    ai_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    ai_confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    ai_findings: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Reviewer and clinical decision metadata
    reviewer_id: Mapped[str] = mapped_column(String(64), default="Dr. Sarah Lin, MD", nullable=False)
    review_status: Mapped[str] = mapped_column(String(32), default="NORMAL", nullable=False, index=True)  # NORMAL, ABNORMAL, CRITICAL, CONFIRMED
    review_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    turnaround_time_mins: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Timeline timestamps
    arrival_time: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    reviewed_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True
    )
    image_path: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    uploaded_by: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
