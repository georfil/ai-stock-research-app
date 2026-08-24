from contextlib import contextmanager
from sqlmodel import create_engine, Session

from app.core.config import get_config

engine = create_engine(
    get_config().database_url.get_secret_value(),
    pool_pre_ping=True,
    # pool_recycle=300,
)

def get_session():
    with Session(engine) as session:
        yield session

session_scope = contextmanager(get_session)
