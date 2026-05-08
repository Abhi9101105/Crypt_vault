from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "SecureVault"
    environment: str = "development"
    database_url: str = "sqlite:///./securevault.db"
    storage_dir: Path = Path("vault")
    max_upload_bytes: int = 25 * 1024 * 1024

    # Comma-separated CORS origins string (parsed at runtime)
    allowed_origins: str = "http://localhost:5173"

    # Render injects PORT; used by uvicorn start command
    port: int = 8000

    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 15
    refresh_token_days: int = 14

    encryption_keys: str = Field(
        description="Comma-separated keyring entries like v1:base64-32-byte-key,v2:base64-32-byte-key"
    )
    active_key_id: str = "v1"
    audit_hmac_secret: str

    secure_cookies: bool = True
    log_level: str = "INFO"

    @property
    def cors_origins(self) -> list[str]:
        """Parse comma-separated origins string into a list."""
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.storage_dir.mkdir(parents=True, exist_ok=True)
    return settings
