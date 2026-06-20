from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.schemas.user import PaginatedResponse, UserCreate, UserResponse, UserUpdate
from app.services.user import UserService

router = APIRouter()


@router.post(
    "/",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new user",
)
def create_user(payload: UserCreate, db: Session = Depends(get_db)) -> UserResponse:
    return UserService.create_user(db, payload)


@router.get(
    "/",
    response_model=PaginatedResponse[UserResponse],
    summary="List all users (paginated)",
)
def get_all_users(
    page: int = Query(default=1, ge=1, description="Page number, starts at 1"),
    size: int = Query(default=10, ge=1, le=100, description="Items per page, max 100"),
    db: Session = Depends(get_db),
) -> PaginatedResponse[UserResponse]:
    return UserService.get_all_users(db, page, size)


@router.get(
    "/{user_id}",
    response_model=UserResponse,
    summary="Get a single user by ID",
)
def get_user(user_id: str, db: Session = Depends(get_db)) -> UserResponse:
    return UserService.get_user_by_id(db, user_id)


@router.patch(
    "/{user_id}",
    response_model=UserResponse,
    summary="Partially update a user",
)
def update_user(
    user_id: str, payload: UserUpdate, db: Session = Depends(get_db)
) -> UserResponse:
    return UserService.update_user(db, user_id, payload)


@router.delete(
    "/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Soft-delete a user",
)
def delete_user(user_id: str, db: Session = Depends(get_db)) -> None:
    UserService.delete_user(db, user_id)
