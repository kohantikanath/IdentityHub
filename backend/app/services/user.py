import math
import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.user import PaginatedResponse, UserCreate, UserResponse, UserUpdate
from app.utils.encryption import decrypt, encrypt, mask_aadhaar, mask_pan


class UserService:

    # ------------------------------------------------------------------
    # Create
    # ------------------------------------------------------------------

    @staticmethod
    def create_user(db: Session, payload: UserCreate) -> UserResponse:
        UserService._assert_email_available(db, str(payload.email))

        user = User(
            id=str(uuid.uuid4()),
            name=payload.name,
            email=str(payload.email),
            primary_mobile=payload.primary_mobile,
            secondary_mobile=payload.secondary_mobile,
            aadhaar_encrypted=encrypt(payload.aadhaar_number),
            pan_encrypted=encrypt(payload.pan_number),
            date_of_birth=payload.date_of_birth,
            place_of_birth=payload.place_of_birth,
            current_address=payload.current_address,
            permanent_address=payload.permanent_address,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return UserService._to_response(user)

    # ------------------------------------------------------------------
    # Read — single
    # ------------------------------------------------------------------

    @staticmethod
    def get_user_by_id(db: Session, user_id: str) -> UserResponse:
        user = UserService._get_active_or_404(db, user_id)
        return UserService._to_response(user)

    # ------------------------------------------------------------------
    # Read — paginated list (never returns deleted users)
    # ------------------------------------------------------------------

    @staticmethod
    def get_all_users(
        db: Session, page: int, size: int
    ) -> PaginatedResponse[UserResponse]:
        base_filter = User.is_deleted == False  # noqa: E712

        total: int = db.execute(
            select(func.count()).select_from(User).where(base_filter)
        ).scalar_one()

        rows = db.execute(
            select(User)
            .where(base_filter)
            .order_by(User.created_at.desc())
            .offset((page - 1) * size)
            .limit(size)
        ).scalars().all()

        return PaginatedResponse(
            items=[UserService._to_response(u) for u in rows],
            total=total,
            page=page,
            size=size,
            pages=math.ceil(total / size) if total else 0,
        )

    # ------------------------------------------------------------------
    # Update (PATCH — only provided fields are changed)
    # ------------------------------------------------------------------

    @staticmethod
    def update_user(db: Session, user_id: str, payload: UserUpdate) -> UserResponse:
        user = UserService._get_active_or_404(db, user_id)
        updates = payload.model_dump(exclude_none=True)

        if "email" in updates and updates["email"] != user.email:
            UserService._assert_email_available(db, str(updates["email"]))

        # Re-encrypt PII fields if they are being updated
        if "aadhaar_number" in updates:
            user.aadhaar_encrypted = encrypt(updates.pop("aadhaar_number"))
        if "pan_number" in updates:
            user.pan_encrypted = encrypt(updates.pop("pan_number"))

        for field, value in updates.items():
            setattr(user, field, str(value) if field == "email" else value)

        db.commit()
        db.refresh(user)
        return UserService._to_response(user)

    # ------------------------------------------------------------------
    # Soft delete (row stays in DB with is_deleted=True)
    # ------------------------------------------------------------------

    @staticmethod
    def delete_user(db: Session, user_id: str) -> None:
        user = UserService._get_active_or_404(db, user_id)
        user.is_deleted = True
        db.commit()

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _get_active_or_404(db: Session, user_id: str) -> User:
        user = db.execute(
            select(User).where(User.id == user_id, User.is_deleted == False)  # noqa: E712
        ).scalar_one_or_none()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
            )
        return user

    @staticmethod
    def _assert_email_available(db: Session, email: str) -> None:
        existing = db.execute(
            select(User).where(User.email == email, User.is_deleted == False)  # noqa: E712
        ).scalar_one_or_none()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this email already exists",
            )

    @staticmethod
    def _to_response(user: User) -> UserResponse:
        """
        Converts a DB row to the API response shape.
        Decryption and masking happen here — nowhere else in the codebase.
        PII is never logged, never returned raw.
        """
        return UserResponse(
            id=user.id,
            name=user.name,
            email=user.email,
            primary_mobile=user.primary_mobile,
            secondary_mobile=user.secondary_mobile,
            aadhaar_number=mask_aadhaar(decrypt(user.aadhaar_encrypted)),
            pan_number=mask_pan(decrypt(user.pan_encrypted)),
            date_of_birth=user.date_of_birth,
            place_of_birth=user.place_of_birth,
            current_address=user.current_address,
            permanent_address=user.permanent_address,
            is_deleted=user.is_deleted,
            created_at=user.created_at,
            updated_at=user.updated_at,
        )
