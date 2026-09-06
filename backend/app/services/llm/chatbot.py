import json
import logging
from datetime import datetime, timezone
from typing import Iterator

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langchain_core.output_parsers import StrOutputParser
from sqlmodel import Session

from app.models import ChatMessage, ChatRole, ChatSession, User
from app.core.config import get_config
from app.services.llm.llm_client import get_model
from app.services.llm.agent import graph
from app.services.llm.prompts import TITLE_TEMPLATE

logger = logging.getLogger(__name__)

TITLE_FALLBACK_MAX_LENGTH = 60
FALLBACK_REPLY = "Something went wrong answering that — try again."

# Node name -> what to tell the user while that node is running. Nodes not
# listed here (reformulate_question, write_answer) get no status event —
# write_answer's own tokens are the status once they start arriving.
NODE_STATUS_UPDATE_LABELS = {
    "supervisor": "Thinking…",
    "worker": "Gathering data…",
}

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


def stream_turn(chat_session: ChatSession, user_message: str, session: Session, user: User) -> Iterator[str]:
    """Runs one turn and yields it back as Server-Sent Events — `status`*,
    `token`*, then `done`. Real tokens stream from the graph's `write_answer`
    node as they're generated (every other node's LLM calls also pass
    through the same `stream_mode=["updates", "messages"]` feed, filtered
    out by `langgraph_node`). Status events come from the complementary
    `"updates"` stream — one per node finishing — mapped through
    `NODE_STATUS_UPDATE_LABELS` so the client has something to show during
    the long silent stretch before `write_answer` starts producing visible
    text.

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
    # Counted against the daily limit here too, since this represents the user
    # actually spending one of their messages regardless of how the reply goes.
    session.add(ChatMessage(chat_session_id=chat_session.id, role=ChatRole.USER, content=user_message))
    # Admins have no limit, so there's nothing to count.
    if not user.is_admin:
        user.daily_message_counter += 1
        session.add(user)
    session.commit()

    # Admins have no limit, so there's nothing meaningful to warn them about.
    if not user.is_admin:
        remaining = max(get_config().daily_message_limit - user.daily_message_counter, 0)
        yield _sse("limit", {"remaining": remaining, "resets_at": user.limit_resets_at.isoformat()})

    full_reply = ""
    try:
        for mode, payload in graph.stream(
            { # type: ignore[arg-type]
                "raw_task": user_message,
                "history": llm_history,
                "ticker": stock.ticker,
            },
            stream_mode=["updates", "messages"],
        ):
            if mode == "messages": #LLM writes final asnwer chunk by chunk
                chunk, metadata = payload
                if hasattr(chunk, "tool_calls") and chunk.tool_calls:
                    print(chunk.tool_calls)
                #We stream only the final answer
                if metadata.get("langgraph_node") != "write_answer" or not chunk.content:
                    continue
                full_reply += chunk.content
                yield _sse("token", {"content": chunk.content})

            if mode == "updates": #Fires once per node finishing — used for status updates
                for node_name in payload:
                    label = NODE_STATUS_UPDATE_LABELS.get(node_name)
                    if label:
                        yield _sse("status", {"label": label})
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
