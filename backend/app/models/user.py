from typing import Optional
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base
import enum


class UserRole(str, enum.Enum):
    RADIOLOGIST = "Radiologist"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    email: Mapped[str] = mapped_column(String(256), unique=True, index=True, nullable=False)
    role: Mapped[str] = mapped_column(String(128), default="Radiologist", nullable=False)
    password_hash: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    department: Mapped[Optional[str]] = mapped_column(String(128), default=None, nullable=True)
    institution: Mapped[Optional[str]] = mapped_column(String(128), default=None, nullable=True)
    license_number: Mapped[Optional[str]] = mapped_column(String(64), default=None, nullable=True)
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    avatar: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reset_token: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    reset_token_expiry: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

