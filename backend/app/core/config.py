from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

class Config(BaseSettings):

    model_config = SettingsConfigDict(
        env_file="../.env"
    )

    database_url: SecretStr

    #JWT
    jwt_secret_key: SecretStr
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 30

    stock_logo_api_key: SecretStr

    stock_financials_refresh_duration_days: int = 300

    log_level: str = "INFO"

    openai_api_key: SecretStr
    llm_model: str = "openai:gpt-4o-mini"
    chat_history_limit: int = 20


@lru_cache
def get_config() -> Config:
    return Config()

