from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.schemas.user import PaginatedResponse, UserCreate, UserResponse
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
