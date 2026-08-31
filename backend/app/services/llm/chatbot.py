import json
import logging
from typing import Iterator

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage

from app.models import ChatMessage, ChatRole, ChatSession
from app.core.config import get_config
from app.core.database import session_scope
from app.services.llm.agent import answer_chain, format_worker_results, graph

logger = logging.getLogger(__name__)


def stream_turn(chat_session_id: str, user_message: str) -> Iterator[str]:
    """Run a turn and yield it as server-sent events.

    Opens its own DB sessions rather than taking one from the caller: this
    generator's body runs lazily as the StreamingResponse is drained, by
    which point a session injected via FastAPI's `Depends` may already be
    closed.
    """
    with session_scope() as session:
        chat_session = session.get(ChatSession, chat_session_id)
        history = chat_session.messages[-get_config().chat_history_limit:]
        llm_history = _to_llm_format(history)
        ticker = chat_session.stock.ticker

    logger.info(
        "Sending turn for chat session %s (history=%d messages)",
        chat_session_id, len(llm_history),
    )

    # 1. GATHER — reformulate, delegate to workers, until enough is known
    result = graph.invoke({ # type: ignore[arg-type]
        "raw_task": user_message,
        "history": llm_history,
        "ticker": ticker,
    })

    # 2. ANSWER — stream the final answer token-by-token
    chunks: list[str] = []
    for chunk in answer_chain.stream({
        "task": result["task"],
        "worker_results": format_worker_results(result.get("results", [])),
    }):
        chunks.append(chunk)
        yield _sse("token", {"content": chunk})

    final_answer = "".join(chunks).strip() or "I wasn't able to gather enough information to answer this question."

    # 3. SAVE both sides (after success)
    with session_scope() as session:
        session.add(ChatMessage(chat_session_id=chat_session_id, role=ChatRole.USER, content=user_message))
        session.add(ChatMessage(chat_session_id=chat_session_id, role=ChatRole.ASSISTANT, content=final_answer))
        session.commit()

    logger.info("Persisted turn for chat session %s", chat_session_id)

    yield _sse("done", {})


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


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
