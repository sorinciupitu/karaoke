from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "changeme"
    SECRET_KEY: str = "dev-secret-change-me"
    DATABASE_URL: str = "sqlite:///./data/karaoke.db"
    MEDIA_DIR: str = "./media"
    MODELS_DIR: str = "./models"
    WHISPER_MODEL: str = "large-v3"
    WHISPER_LANGUAGE: str = "ro"
    DEVICE: str = "auto"  # auto | cuda | cpu
    WHISPER_COMPUTE_TYPE: str = "auto"  # auto | float16 | int8_float16 | int8
    DEMUCS_MODEL: str = "htdemucs_ft"
    OLLAMA_ENABLED: bool = True
    OLLAMA_URL: str = "http://host.docker.internal:11434"
    OLLAMA_MODEL: str = "qwen2.5:7b"
    COOKIE_NAME: str = "karaoke_session"
    TOKEN_EXPIRE_DAYS: int = 7

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
