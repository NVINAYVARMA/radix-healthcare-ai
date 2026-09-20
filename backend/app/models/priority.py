from datetime import datetime, timezone
from sqlalchemy import String, Float, DateTime, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class PriorityFactor(Base):
    __tablename__ = "priority_factors"

    id: Mapped[int] = mapped_column(primary_key=True, index=True, autoincrement=True)
    study_id: Mapped[str] = mapped_column(String(64), ForeignKey("studies.study_id", ondelete="CASCADE"), index=True, nullable=False)
    factor_name: Mapped[str] = mapped_column(String(64), nullable=False)
    factor_value: Mapped[float] = mapped_column(Float, nullable=False)
    weight: Mapped[float] = mapped_column(Float, nullable=False)
    contribution: Mapped[float] = mapped_column(Float, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    study: Mapped["Study"] = relationship("Study", back_populates="factors")
