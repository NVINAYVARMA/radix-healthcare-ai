from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, DateTime, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class ReviewLog(Base):
    __tablename__ = "review_logs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True, autoincrement=True)
    study_id: Mapped[str] = mapped_column(String(64), ForeignKey("studies.study_id", ondelete="CASCADE"), index=True, nullable=False)
    action: Mapped[str] = mapped_column(String(64), nullable=False)  # OPENED, STARTED_REVIEW, COMPLETED_REVIEW, PRIORITY_OVERRIDE, ADDED_NOTE
    review_status: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    reviewer_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True
    )

    study: Mapped["Study"] = relationship("Study", back_populates="reviews")
