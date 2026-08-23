

from fastapi import APIRouter, status

from app.core.deps import CurrentUser, SessionDep, StockDep, ChatSessionDep
from app.crud import get_all_conversations, delete_chat_session
from app.models import ChatSession
from app.services.llm.chatbot import send_turn
from app.schemas import ChatSessionOut, MessageIn, MessageOut


router = APIRouter(prefix="/chat", tags=["Chat"])

@router.get("/{ticker}/sessions")
def get_all_chat_session(stock: StockDep, user: CurrentUser, session: SessionDep) -> list[ChatSessionOut]:
    return get_all_conversations(user.id, stock.id, session)

@router.post("/{ticker}/session", status_code=status.HTTP_201_CREATED)
def create_session(stock: StockDep, user: CurrentUser, session: SessionDep) -> ChatSessionOut:
    chat_session = ChatSession(user_id=user.id, stock_id=stock.id)
    session.add(chat_session)
    session.commit()
    session.refresh(chat_session)
    return chat_session

@router.delete("/session/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(chat_session: ChatSessionDep, session: SessionDep) -> None:
    delete_chat_session(chat_session, session)


@router.get("/session/{id}")
def get_chat_history(chat_session: ChatSessionDep) -> list[MessageOut]:
    return chat_session.messages

@router.post("/session/{id}")
def send_message(body: MessageIn, chat_session: ChatSessionDep, session: SessionDep) -> MessageOut:
    reply = send_turn(chat_session, body.content, session)
    return MessageOut(content=reply)