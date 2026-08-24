import logging

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from sqlmodel import Session

from app.models import ChatMessage, ChatRole, ChatSession
from app.core.config import get_config
from app.services.llm.llm_client import ask
from app.services.llm.agent import graph
from app.schemas import MessageOut

logger = logging.getLogger(__name__)


def send_turn(chat_session: ChatSession, user_message: str, session: Session) -> MessageOut:
    # 1. LOAD history (before adding the new message)
    history = chat_session.messages[-get_config().chat_history_limit:]
    llm_history = _to_llm_format(history)
    stock = chat_session.stock

    logger.info(
        "Sending turn for chat session %s (history=%d messages)",
        chat_session.id, len(llm_history),
    )

    # 2. RUN — history + new message
    reply = graph.invoke({ # type: ignore[arg-type]
        "raw_task":user_message,
        "history":llm_history,
        "ticker": stock.ticker
    })["final_answer"]

    # 3. SAVE both sides (after success)
    session.add(ChatMessage(chat_session_id=chat_session.id, role=ChatRole.USER, content=user_message))
    session.add(ChatMessage(chat_session_id=chat_session.id, role=ChatRole.ASSISTANT, content=reply))
    session.commit()    

    logger.info("Persisted turn for chat session %s", chat_session.id)

    return MessageOut(
        content=reply,
        role=ChatRole.ASSISTANT
    )

_ROLE_TO_MESSAGE = {
    ChatRole.USER: HumanMessage,
    ChatRole.ASSISTANT: AIMessage,
}

def _to_llm_format(messages: list[ChatMessage]) -> list[BaseMessage]:
    """Convert stored chat messages into the LangChain messages `ask()` expects."""
    return [
        _ROLE_TO_MESSAGE[message.role](content=message.content)
        for message in messages
    ]