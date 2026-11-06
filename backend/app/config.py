from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "changeme"
    SECRET_KEY: str = "dev-secret-change-me"
    DATABASE_URL: str = "sqlite:///./data/karaoke.db"
    MEDIA_DIR: str = "./media"
    MODELS_DIR: str = "./models"
    WHISPER_MODEL: str = "large-v3"
    WHISPER_CPU_MODEL: str = "medium"
    WHISPER_LANGUAGE: str = "ro"
    DEVICE: str = "auto"  # auto | cuda | cpu
    CUDA_MIN_FREE_GB: float = 4.0  # sub acest prag de memorie GPU liberă, trecem pe CPU
    WHISPER_COMPUTE_TYPE: str = "auto"  # auto | float16 | int8_float16 | int8
    DEMUCS_MODEL: str = "htdemucs"
    OLLAMA_ENABLED: bool = True
    OLLAMA_URL: str = "http://host.docker.internal:11434"
    OLLAMA_MODEL: str = "qwen2.5:7b"
    COOKIE_NAME: str = "karaoke_session"
    TOKEN_EXPIRE_DAYS: int = 7

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()

# Modele de separare acceptate (expuse în UI pentru alegere per piesă / global).
#   htdemucs / htdemucs_ft  -> Demucs (torch)
#   roformer                -> BS-RoFormer (audio-separator / ONNX)
#   ensemble                -> RoFormer + htdemucs_ft (Max Spec)
SEPARATION_MODELS = ["htdemucs", "htdemucs_ft", "roformer", "ensemble"]
