from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    server_name: str = "NowNote Server"
    database_url: str = "sqlite:///./now_server.db"
    storage_dir: str = "./data/recordings"
    api_token: str | None = None
    worker_poll_seconds: int = 5
    worker_batch_size: int = 5
    llm_provider: str = "local"
    openai_api_key: str | None = None
    openai_base_url: str = "https://api.openai.com/v1"
    openai_model: str = "gpt-4o-mini"

    model_config = SettingsConfigDict(env_prefix="NOW_")


@lru_cache
def get_settings() -> Settings:
    return Settings()
