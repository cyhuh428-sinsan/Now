from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    server_name: str = "NowNote Server"
    database_url: str = "sqlite:///./now_server.db"
    storage_dir: str = "./data/recordings"
    messenger_storage_dir: str = "./data/messenger"
    messenger_max_upload_mb: int = 10
    messenger_allowed_extensions: str = "jpg,jpeg,png,webp,gif,pdf,txt,md,docx,xlsx,pptx,zip"
    messenger_allowed_mime_types: str = (
        "image/jpeg,image/png,image/webp,image/gif,"
        "application/pdf,text/plain,text/markdown,"
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document,"
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,"
        "application/vnd.openxmlformats-officedocument.presentationml.presentation,"
        "application/zip,application/octet-stream"
    )
    api_token: str | None = None
    user_token_required: bool = False
    worker_poll_seconds: int = 5
    worker_batch_size: int = 5
    llm_provider: str = "local"
    openai_api_key: str | None = None
    openai_base_url: str = "https://api.openai.com/v1"
    openai_model: str = "gpt-4o-mini"
    public_base_url: str | None = None
    behind_reverse_proxy: bool = False
    self_registration_enabled: bool = True
    self_account_delete_enabled: bool = True
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_from: str | None = None
    smtp_use_tls: bool = True
    password_reset_code_minutes: int = 30

    model_config = SettingsConfigDict(env_prefix="NOW_")


@lru_cache
def get_settings() -> Settings:
    return Settings()
