from typing import Generator
from sqlalchemy.orm import Session
from app.database import SessionLocal


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency that yields a DB session and guarantees it is closed
    after the request — even if an exception is raised mid-handler.
    Used via: db: Session = Depends(get_db)
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
