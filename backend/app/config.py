from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "changeme"
    SECRET_KEY: str = "dev-secret-change-me"
    DATABASE_URL: str = "sqlite:///./data/karaoke.db"
    MEDIA_DIR: str = "./media"
    MODELS_DIR: str = "./models"
    WHISPER_MODEL: str = "medium"
    WHISPER_LANGUAGE: str = "ro"
    COOKIE_NAME: str = "karaoke_session"
    TOKEN_EXPIRE_DAYS: int = 7

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
