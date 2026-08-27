from functools import lru_cache

from langchain.chat_models import init_chat_model
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage

from app.core.config import get_config


@lru_cache
def get_model(model: str | None = None, temperature: float = 0.0) -> BaseChatModel:
    return init_chat_model(
        model or get_config().llm_model,
        temperature=temperature,
        api_key=get_config().openai_api_key.get_secret_value(),
    )

def ask(
    text: str,
    system: str,
    model: str,
    temperature: float = 0.0,
    history: list[BaseMessage] | None = None,
) -> str:
    resp = get_model(model, temperature).invoke([
        SystemMessage(content=system),
        *(history or []),
        HumanMessage(content=text),
    ])
    return resp.content