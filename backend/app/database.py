from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.config import get_settings

settings = get_settings()

# pool_pre_ping=True: tests the connection before handing it out from the pool,
# preventing "MySQL server has gone away" errors after idle periods
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

# autocommit=False: we control transactions explicitly
# autoflush=False: prevents unintended flushes mid-transaction
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass
