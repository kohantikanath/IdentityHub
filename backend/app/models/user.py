import uuid
from datetime import date, datetime
from sqlalchemy import Boolean, Date, DateTime, Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class User(Base):
    __tablename__ = "users"

    # UUID primary key — sequential integers allow enumeration attacks (GET /users/1, /2, /3...)
    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )

    # Core identity
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    primary_mobile: Mapped[str] = mapped_column(String(20), nullable=False)
    secondary_mobile: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # PII fields — stored as AES-256-GCM ciphertext, never plaintext
    # Decryption happens only inside the service layer, never in routes or logs
    aadhaar_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    pan_encrypted: Mapped[str] = mapped_column(Text, nullable=False)

    # Personal details
    date_of_birth: Mapped[date] = mapped_column(Date, nullable=False)
    place_of_birth: Mapped[str] = mapped_column(String(255), nullable=False)
    current_address: Mapped[str] = mapped_column(Text, nullable=False)
    permanent_address: Mapped[str] = mapped_column(Text, nullable=False)

    # Soft delete — rows are never physically removed, preserving audit trail
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Audit timestamps — server_default delegates to MySQL so they are always
    # accurate regardless of application server timezone
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Indexes on columns used in WHERE clauses — avoids full table scans
    __table_args__ = (
        Index("ix_users_email", "email"),
        Index("ix_users_name", "name"),
        Index("ix_users_is_deleted", "is_deleted"),
    )
