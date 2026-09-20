from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
import json
import os


class Settings(BaseSettings):
    PROJECT_NAME: str = "RadiX AI Backend"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"
    
    ENV: str = "development"
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # CORS
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, str) and v.startswith("["):
            return json.loads(v)
        return v

    # Database
    DATABASE_URL: str = "sqlite:///./radix.db"

    @field_validator("DATABASE_URL", mode="after")
    @classmethod
    def canonical_db_url(cls, v: str) -> str:
        if v.startswith("sqlite:///") and not v.startswith("sqlite:////") and not (len(v) > 11 and v[11] == ":"):
            # Relative sqlite path
            rel_part = v.replace("sqlite:///", "").lstrip("./\\")
            backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            canonical_path = os.path.abspath(os.path.join(backend_dir, rel_part)).replace("\\", "/")
            return f"sqlite:///{canonical_path}"
        return v

    # Supabase (optional for local development, required for cloud Supabase)
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_KEY: str = ""

    # Storage
    STORAGE_BACKEND: str = "local"  # "local", "firebase", or "supabase"
    STORAGE_LOCAL_DIR: str = "./data/storage"

    @field_validator("STORAGE_LOCAL_DIR", mode="after")
    @classmethod
    def canonical_storage_dir(cls, v: str) -> str:
        if not os.path.isabs(v):
            backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            return os.path.abspath(os.path.join(backend_dir, v.lstrip("./\\")))
        return v

    SUPABASE_BUCKET_NAME: str = "studies"

    # Firebase
    FIREBASE_CREDENTIALS_PATH: str = "./radix-ai-firebase-adminsdk-fbsvc-42c3bbb4d9.json"

    @field_validator("FIREBASE_CREDENTIALS_PATH", mode="after")
    @classmethod
    def canonical_firebase_cred(cls, v: str) -> str:
        if not os.path.isabs(v):
            backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            return os.path.abspath(os.path.join(backend_dir, v.lstrip("./\\")))
        return v

    FIREBASE_PROJECT_ID: str = "radix-ai"
    FIREBASE_STORAGE_BUCKET: str = "radix-ai.appspot.com"
    ENABLE_FIREBASE_SYNC: bool = True

    # AI Service
    AI_PROVIDER: str = "densenet121"  # "densenet121", "resnet18", "mock", or "real"
    AI_MODEL_WEIGHTS_PATH: str = "./ml/reading_backlog_densenet121_best.pth"

    @field_validator("AI_MODEL_WEIGHTS_PATH", mode="after")
    @classmethod
    def canonical_ai_weights(cls, v: str) -> str:
        if not os.path.isabs(v):
            backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            return os.path.abspath(os.path.join(backend_dir, v.lstrip("./\\")))
        return v

    AI_SERVICE_URL: str = ""
    AI_SERVICE_KEY: str = ""

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
