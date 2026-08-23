from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from sqlmodel import Session

from app.core.config import get_config
from app.core.database import get_session
from app.models import ChatSession, Stock, User
from app.crud import get_or_create_stock

SessionDep = Annotated[Session, Depends(get_session)]

security = HTTPBearer()

def get_current_user(session: SessionDep, credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]) -> User:
    try:
        payload = jwt.decode(
            credentials.credentials,
            get_config().jwt_secret_key.get_secret_value(),
            algorithms=[get_config().jwt_algorithm],
        )
        user_id = payload.get("id")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    return user

CurrentUser = Annotated[User, Depends(get_current_user)]


def get_stock_from_ticker(ticker: str, session: SessionDep) -> Stock:
    stock = get_or_create_stock(session, ticker)
    if not stock:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticker not found")
    return stock

StockDep = Annotated[Stock, Depends(get_stock_from_ticker)]


def get_chat_session(
    id: str,
    user: CurrentUser,
    session: SessionDep,
) -> ChatSession:
    chat_session = session.get(ChatSession, id)
    if not chat_session or chat_session.user_id != user.id:
        raise HTTPException(404, "Conversation not found")
    return chat_session

ChatSessionDep = Annotated[ChatSession, Depends(get_chat_session)]
