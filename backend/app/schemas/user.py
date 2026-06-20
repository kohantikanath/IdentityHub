import re
from datetime import date, datetime
from typing import Annotated, Generic, TypeVar

from pydantic import AfterValidator, BaseModel, ConfigDict, EmailStr

T = TypeVar("T")


# ---------------------------------------------------------------------------
# Reusable validated types via Annotated
# Defined once here, shared by both UserCreate and UserUpdate — no duplication
# ---------------------------------------------------------------------------

def _check_aadhaar(v: str) -> str:
    if not re.fullmatch(r"\d{12}", v):
        raise ValueError("Aadhaar must be exactly 12 digits")
    return v


def _check_pan(v: str) -> str:
    v = v.upper()
    if not re.fullmatch(r"[A-Z]{5}[0-9]{4}[A-Z]", v):
        raise ValueError("PAN must follow the format ABCDE1234F")
    return v


def _check_mobile(v: str) -> str:
    if not re.fullmatch(r"\+?[1-9]\d{9,14}", v):
        raise ValueError("Mobile must be 10–15 digits, optionally prefixed with +")
    return v


def _check_dob(v: date) -> date:
    if v >= date.today():
        raise ValueError("Date of birth must be in the past")
    return v


def _strip_nonempty(v: str) -> str:
    v = v.strip()
    if not v:
        raise ValueError("This field cannot be empty")
    return v


AadhaarStr = Annotated[str, AfterValidator(_check_aadhaar)]
PanStr = Annotated[str, AfterValidator(_check_pan)]
MobileStr = Annotated[str, AfterValidator(_check_mobile)]
PastDate = Annotated[date, AfterValidator(_check_dob)]
NonEmptyStr = Annotated[str, AfterValidator(_strip_nonempty)]


# ---------------------------------------------------------------------------
# UserCreate — used by POST /users
# All fields required; validators run automatically via Annotated types
# ---------------------------------------------------------------------------

class UserCreate(BaseModel):
    name: NonEmptyStr
    email: EmailStr
    primary_mobile: MobileStr
    secondary_mobile: MobileStr | None = None
    aadhaar_number: AadhaarStr   # plaintext here; encrypted before hitting the DB
    pan_number: PanStr           # plaintext here; encrypted before hitting the DB
    date_of_birth: PastDate
    place_of_birth: NonEmptyStr
    current_address: NonEmptyStr
    permanent_address: NonEmptyStr


# ---------------------------------------------------------------------------
# UserUpdate — used by PATCH /users/{id}
# Every field is Optional so callers only send what they want to change
# The same validators still run when a field is provided
# ---------------------------------------------------------------------------

class UserUpdate(BaseModel):
    name: NonEmptyStr | None = None
    email: EmailStr | None = None
    primary_mobile: MobileStr | None = None
    secondary_mobile: MobileStr | None = None
    aadhaar_number: AadhaarStr | None = None
    pan_number: PanStr | None = None
    date_of_birth: PastDate | None = None
    place_of_birth: NonEmptyStr | None = None
    current_address: NonEmptyStr | None = None
    permanent_address: NonEmptyStr | None = None


# ---------------------------------------------------------------------------
# UserResponse — what the API returns (never the raw DB model)
# aadhaar_number and pan_number arrive already masked from the service layer
# e.g. "XXXXXXXX1234" and "ABCDE****F"
# ---------------------------------------------------------------------------

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    email: str
    primary_mobile: str
    secondary_mobile: str | None
    aadhaar_number: str
    pan_number: str
    date_of_birth: date
    place_of_birth: str
    current_address: str
    permanent_address: str
    is_deleted: bool
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# PaginatedResponse — generic wrapper for list endpoints
# e.g. PaginatedResponse[UserResponse]
# ---------------------------------------------------------------------------

class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    size: int
    pages: int
