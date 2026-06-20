from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.schemas.user import PaginatedResponse, UserCreate, UserResponse, UserUpdate
from app.services.user import UserService

router = APIRouter()


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, db: Session = Depends(get_db)) -> UserResponse:
    return UserService.create_user(db, payload)


@router.get("/", response_model=PaginatedResponse[UserResponse])
def get_all_users(
    page: int = Query(default=1, ge=1),
    size: int = Query(default=10, ge=1, le=100),
    search: str | None = Query(default=None),
    place_of_birth: str | None = Query(default=None),
    dob_year_from: int | None = Query(default=None, ge=1900, le=2100),
    dob_year_to: int | None = Query(default=None, ge=1900, le=2100),
    name_starts_with: str | None = Query(default=None, max_length=1),
    sort_by: str = Query(default="created_at", pattern="^(name|email|created_at|date_of_birth)$"),
    sort_order: str = Query(default="desc", pattern="^(asc|desc)$"),
    db: Session = Depends(get_db),
) -> PaginatedResponse[UserResponse]:
    return UserService.get_all_users(
        db, page, size, search, place_of_birth,
        dob_year_from, dob_year_to, name_starts_with, sort_by, sort_order,
    )


# /meta MUST be defined before /{user_id} — FastAPI matches routes in definition order
@router.get("/meta")
def get_meta(db: Session = Depends(get_db)) -> dict:
    return {"places_of_birth": UserService.get_places(db)}


@router.get("/{user_id}", response_model=UserResponse)
def get_user(user_id: str, db: Session = Depends(get_db)) -> UserResponse:
    return UserService.get_user_by_id(db, user_id)


@router.patch("/{user_id}", response_model=UserResponse)
def update_user(user_id: str, payload: UserUpdate, db: Session = Depends(get_db)) -> UserResponse:
    return UserService.update_user(db, user_id, payload)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: str, db: Session = Depends(get_db)) -> None:
    UserService.delete_user(db, user_id)
