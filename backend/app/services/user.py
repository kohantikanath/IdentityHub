import math
import uuid

from fastapi import HTTPException, status
from sqlalchemy import and_, extract, func, or_, select
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.user import PaginatedResponse, UserCreate, UserResponse, UserUpdate
from app.utils.encryption import decrypt, encrypt, mask_aadhaar, mask_pan

_SORT_COLUMNS = {
    "name": User.name,
    "email": User.email,
    "created_at": User.created_at,
    "date_of_birth": User.date_of_birth,
}


class UserService:

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
            aadhaar_masked=mask_aadhaar(payload.aadhaar_number),
            pan_masked=mask_pan(payload.pan_number),
            date_of_birth=payload.date_of_birth,
            place_of_birth=payload.place_of_birth,
            current_address=payload.current_address,
            permanent_address=payload.permanent_address,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return UserService._to_response(user)

    @staticmethod
    def get_user_by_id(db: Session, user_id: str) -> UserResponse:
        user = UserService._get_active_or_404(db, user_id)
        return UserService._to_response(user)

    @staticmethod
    def get_all_users(
        db: Session,
        page: int,
        size: int,
        search: str | None = None,
        place_of_birth: str | None = None,
        dob_year_from: int | None = None,
        dob_year_to: int | None = None,
        name_starts_with: str | None = None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
    ) -> PaginatedResponse[UserResponse]:

        conditions: list = [User.is_deleted == False]  # noqa: E712

        if search:
            term = f"%{search.lower()}%"
            conditions.append(
                or_(
                    func.lower(User.name).like(term),
                    func.lower(User.email).like(term),
                )
            )

        if name_starts_with:
            conditions.append(User.name.ilike(f"{name_starts_with}%"))

        if place_of_birth:
            conditions.append(User.place_of_birth == place_of_birth)

        if dob_year_from:
            conditions.append(extract("year", User.date_of_birth) >= dob_year_from)
        if dob_year_to:
            conditions.append(extract("year", User.date_of_birth) <= dob_year_to)

        where_clause = and_(*conditions)
        sort_col = _SORT_COLUMNS.get(sort_by, User.created_at)
        order_expr = sort_col.asc() if sort_order == "asc" else sort_col.desc()

        total: int = db.execute(
            select(func.count()).select_from(User).where(where_clause)
        ).scalar_one()

        rows = db.execute(
            select(User)
            .where(where_clause)
            .order_by(order_expr)
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

    @staticmethod
    def get_places(db: Session) -> list[str]:
        rows = db.execute(
            select(User.place_of_birth)
            .where(User.is_deleted == False)  # noqa: E712
            .distinct()
            .order_by(User.place_of_birth)
        ).scalars().all()
        return [r for r in rows if r]

    @staticmethod
    def update_user(db: Session, user_id: str, payload: UserUpdate) -> UserResponse:
        user = UserService._get_active_or_404(db, user_id)
        updates = payload.model_dump(exclude_none=True)
        if "email" in updates and updates["email"] != user.email:
            UserService._assert_email_available(db, str(updates["email"]))
        if "aadhaar_number" in updates:
            plaintext = updates.pop("aadhaar_number")
            user.aadhaar_encrypted = encrypt(plaintext)
            user.aadhaar_masked = mask_aadhaar(plaintext)
        if "pan_number" in updates:
            plaintext = updates.pop("pan_number")
            user.pan_encrypted = encrypt(plaintext)
            user.pan_masked = mask_pan(plaintext)
        for field, value in updates.items():
            setattr(user, field, str(value) if field == "email" else value)
        db.commit()
        db.refresh(user)
        return UserService._to_response(user)

    @staticmethod
    def delete_user(db: Session, user_id: str) -> None:
        user = UserService._get_active_or_404(db, user_id)
        user.is_deleted = True
        db.commit()

    @staticmethod
    def _get_active_or_404(db: Session, user_id: str) -> User:
        user = db.execute(
            select(User).where(User.id == user_id, User.is_deleted == False)  # noqa: E712
        ).scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        return user

    @staticmethod
    def _assert_email_available(db: Session, email: str) -> None:
        existing = db.execute(
            select(User).where(User.email == email, User.is_deleted == False)  # noqa: E712
        ).scalar_one_or_none()
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A user with this email already exists")

    @staticmethod
    def _to_response(user: User) -> UserResponse:
        aadhaar = user.aadhaar_masked or mask_aadhaar(decrypt(user.aadhaar_encrypted))
        pan = user.pan_masked or mask_pan(decrypt(user.pan_encrypted))
        return UserResponse(
            id=user.id, name=user.name, email=user.email,
            primary_mobile=user.primary_mobile, secondary_mobile=user.secondary_mobile,
            aadhaar_number=aadhaar, pan_number=pan,
            date_of_birth=user.date_of_birth, place_of_birth=user.place_of_birth,
            current_address=user.current_address, permanent_address=user.permanent_address,
            is_deleted=user.is_deleted, created_at=user.created_at, updated_at=user.updated_at,
        )
