from functools import lru_cache

from langchain.chat_models import init_chat_model
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage

from app.core.config import get_config


# Reasoning models — the GPT-5 family and the o-series. They reject any
# temperature other than the default and take reasoning_effort in its place,
# so the two settings are mutually exclusive per model.
REASONING_MODEL_PREFIXES = ("openai:gpt-5", "openai:o1", "openai:o3", "openai:o4")


def is_reasoning_model(model: str) -> bool:
    return model.startswith(REASONING_MODEL_PREFIXES)


@lru_cache
def get_model(
    model: str | None = None,
    temperature: float = 0.0,
    reasoning_effort: str | None = None,
) -> BaseChatModel:
    model = model or get_config().llm_model

    if is_reasoning_model(model):
        kwargs = {"reasoning_effort": reasoning_effort} if reasoning_effort else {}
    else:
        kwargs = {"temperature": temperature}

    return init_chat_model(
        model,
        api_key=get_config().openai_api_key.get_secret_value(),
        **kwargs,
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