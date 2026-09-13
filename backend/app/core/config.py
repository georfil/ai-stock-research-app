from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

class Config(BaseSettings):

    model_config = SettingsConfigDict(
        env_file=".env"
    )

    database_url: SecretStr

    #JWT
    jwt_secret_key: SecretStr
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 30

    stock_logo_api_key: SecretStr
    finnhub_api_key: SecretStr | None = None

    log_level: str = "INFO"

    openai_api_key: SecretStr
    # Three tiers, by how much judgement the call needs. budget: mechanical,
    # high-volume work (filing extraction, titles, reformulation). llm_model:
    # the default — the tool-using worker agents and the supervisor's planning.
    # reasoning: the final answer, few calls but it sets answer quality.
    # budget_llm_model: str = "openai:gpt-5-nano"
    # llm_model: str = "openai:gpt-5-mini"
    # reasoning_llm_model: str = "openai:gpt-5"
    budget_llm_model: str = "openai:gpt-5-nano"
    llm_model: str = "openai:gpt-4o-mini"
    reasoning_llm_model: str = "openai:gpt-5"
    chat_history_limit: int = 20
    daily_message_limit: int = 20

    cors_origins_raw: str = "http://localhost:5173"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip().rstrip("/") for o in self.cors_origins_raw.split(",")]


@lru_cache
def get_config() -> Config:
    return Config()

