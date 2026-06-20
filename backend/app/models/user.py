import uuid
from datetime import date, datetime
from sqlalchemy import Boolean, Date, DateTime, Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    primary_mobile: Mapped[str] = mapped_column(String(20), nullable=False)
    secondary_mobile: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Full ciphertext — AES-256-GCM, never plaintext
    aadhaar_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    pan_encrypted: Mapped[str] = mapped_column(Text, nullable=False)

    # Pre-computed masked values stored at write time so list queries never decrypt
    # e.g. "XXXXXXXX9012", "ABXXXXX34F"
    # Nullable for rows created before this column was added (migration compat)
    aadhaar_masked: Mapped[str | None] = mapped_column(String(20), nullable=True)
    pan_masked: Mapped[str | None] = mapped_column(String(20), nullable=True)

    date_of_birth: Mapped[date] = mapped_column(Date, nullable=False)
    place_of_birth: Mapped[str] = mapped_column(String(255), nullable=False)
    current_address: Mapped[str] = mapped_column(Text, nullable=False)
    permanent_address: Mapped[str] = mapped_column(Text, nullable=False)

    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        server_default=func.now(),
        onupdate=datetime.utcnow,
        nullable=False,
    )

    __table_args__ = (
        Index("ix_users_email", "email"),
        Index("ix_users_name", "name"),
        Index("ix_users_is_deleted", "is_deleted"),
        # Composite index: WHERE is_deleted = FALSE ORDER BY created_at DESC
        # MySQL uses this for both filtering and sorting in one index scan — no separate sort step
        Index("ix_users_is_deleted_created_at", "is_deleted", "created_at"),
    )
