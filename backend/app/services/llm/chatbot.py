import json
import logging
from datetime import datetime, timezone
from typing import Iterator

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langchain_core.output_parsers import StrOutputParser
from sqlmodel import Session

from app.models import ChatMessage, ChatRole, ChatSession
from app.core.config import get_config
from app.services.llm.llm_client import get_model
from app.services.llm.agent import graph
from app.services.llm.prompts import TITLE_TEMPLATE

logger = logging.getLogger(__name__)

TITLE_FALLBACK_MAX_LENGTH = 60
FALLBACK_REPLY = "Something went wrong answering that — try again."


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def _generate_title(question: str) -> str:
    """A short AI-written summary of the question, for the session list —
    falls back to a truncated version of the question itself if the (cheap,
    best-effort) model call fails."""
    try:
        chain = TITLE_TEMPLATE | get_model(get_config().budget_llm_model) | StrOutputParser()
        title = chain.invoke({"question": question}).strip()
        if title:
            return title
    except Exception:
        logger.exception("Title generation failed, falling back to a truncated question")

    question = question.strip()
    return question[:TITLE_FALLBACK_MAX_LENGTH] + "…" if len(question) > TITLE_FALLBACK_MAX_LENGTH else question


def stream_turn(chat_session: ChatSession, user_message: str, session: Session) -> Iterator[str]:
    """Runs one turn and yields it back as Server-Sent Events (`token`* then
    `done`), streaming real tokens from the graph's `write_answer` node as
    they're generated (every other node's LLM calls also pass through this
    same stream — see `graph.stream(..., stream_mode="messages")` — so
    everything not tagged `write_answer` is discarded).

    Persistence — the assistant's reply plus the session's
    title/last-activity/question-count — happens in `finally`, so it still
    runs even if the client disconnects mid-stream (the generator is closed
    at whatever `yield` it's suspended on, which would otherwise skip any
    code written after the streaming loop)."""
    history = chat_session.messages[-get_config().chat_history_limit:]
    llm_history = _to_llm_format(history)
    stock = chat_session.stock
    is_first_message = chat_session.title is None

    logger.info(
        "Streaming turn for chat session %s (history=%d messages)",
        chat_session.id, len(llm_history),
    )

    # Persisted immediately so the question survives even if the model call fails.
    session.add(ChatMessage(chat_session_id=chat_session.id, role=ChatRole.USER, content=user_message))
    session.commit()

    full_reply = ""
    try:
        for chunk, metadata in graph.stream(
            { # type: ignore[arg-type]
                "raw_task": user_message,
                "history": llm_history,
                "ticker": stock.ticker,
            },
            stream_mode="messages",
        ):
            if metadata.get("langgraph_node") != "write_answer" or not chunk.content:
                continue
            full_reply += chunk.content
            yield _sse("token", {"content": chunk.content})
    except Exception:
        logger.exception("Graph streaming failed for chat session %s", chat_session.id)
        if not full_reply:
            full_reply = FALLBACK_REPLY
            yield _sse("token", {"content": full_reply})
    finally:
        session.add(ChatMessage(
            chat_session_id=chat_session.id,
            role=ChatRole.ASSISTANT,
            content=full_reply.strip() or FALLBACK_REPLY,
        ))
        # Title generation is a second model call, so it happens after the
        # visible reply has already streamed out rather than adding to that wait.
        if is_first_message:
            chat_session.title = _generate_title(user_message)
        chat_session.message_count += 1
        chat_session.last_message_at = datetime.now(timezone.utc)
        session.add(chat_session)
        session.commit()
        logger.info("Persisted turn for chat session %s", chat_session.id)

    yield _sse("done", {})

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
