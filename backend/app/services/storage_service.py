import os
from abc import ABC, abstractmethod
from typing import Optional
from app.core.config import settings
from app.core.logging import logger


class StorageProvider(ABC):
    @abstractmethod
    async def upload_file(self, file_bytes: bytes, destination_path: str, content_type: str = "image/png") -> str:
        """Uploads a file and returns its storage path or public URL."""
        pass

    @abstractmethod
    async def get_file_url(self, file_path: str) -> str:
        """Returns access URL or local path for the stored file."""
        pass

    @abstractmethod
    async def file_exists(self, file_path: str) -> bool:
        """Checks if a file exists in storage."""
        pass

    @abstractmethod
    async def delete_file(self, file_path: str) -> bool:
        """Deletes a file from storage."""
        pass


class LocalStorageProvider(StorageProvider):
    def __init__(self, base_dir: Optional[str] = None):
        self.base_dir = os.path.abspath(base_dir or settings.STORAGE_LOCAL_DIR)
        os.makedirs(self.base_dir, exist_ok=True)

    async def upload_file(self, file_bytes: bytes, destination_path: str, content_type: str = "image/png") -> str:
        # destination_path e.g. "studies/XR-0023/scan.png"
        clean_path = destination_path.lstrip("/\\")
        full_path = os.path.join(self.base_dir, clean_path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        with open(full_path, "wb") as f:
            f.write(file_bytes)
        logger.info(f"[LocalStorage] Saved file to {full_path}")
        return clean_path.replace("\\", "/")

    async def get_file_url(self, file_path: str) -> str:
        clean_path = file_path.lstrip("/\\")
        return f"/api/v1/storage/{clean_path}"

    async def file_exists(self, file_path: str) -> bool:
        clean_path = file_path.lstrip("/\\")
        full_path = os.path.join(self.base_dir, clean_path)
        return os.path.exists(full_path)

    async def delete_file(self, file_path: str) -> bool:
        clean_path = file_path.lstrip("/\\")
        full_path = os.path.join(self.base_dir, clean_path)
        if os.path.exists(full_path):
            try:
                os.remove(full_path)
                parent = os.path.dirname(full_path)
                if os.path.exists(parent) and not os.listdir(parent):
                    os.rmdir(parent)
                logger.info(f"[LocalStorage] Deleted file {full_path}")
                return True
            except Exception as e:
                logger.warning(f"[LocalStorage] Failed to delete file {full_path}: {e}")
        return False


class SupabaseStorageProvider(StorageProvider):
    def __init__(self):
        if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set to use Supabase Storage.")
        from supabase import create_client, Client
        self.client: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
        self.bucket = settings.SUPABASE_BUCKET_NAME

    async def upload_file(self, file_bytes: bytes, destination_path: str, content_type: str = "image/png") -> str:
        clean_path = destination_path.lstrip("/\\").replace("\\", "/")
        response = self.client.storage.from_(self.bucket).upload(
            path=clean_path,
            file=file_bytes,
            file_options={"content-type": content_type, "upsert": "true"}
        )
        logger.info(f"[SupabaseStorage] Uploaded file to {clean_path}")
        return clean_path

    async def get_file_url(self, file_path: str) -> str:
        clean_path = file_path.lstrip("/\\").replace("\\", "/")
        return self.client.storage.from_(self.bucket).get_public_url(clean_path)

    async def file_exists(self, file_path: str) -> bool:
        clean_path = file_path.lstrip("/\\").replace("\\", "/")
        folder = os.path.dirname(clean_path)
        filename = os.path.basename(clean_path)
        try:
            files = self.client.storage.from_(self.bucket).list(folder)
            return any(f.get("name") == filename for f in files)
        except Exception:
            return False

    async def delete_file(self, file_path: str) -> bool:
        clean_path = file_path.lstrip("/\\").replace("\\", "/")
        try:
            self.client.storage.from_(self.bucket).remove([clean_path])
            logger.info(f"[SupabaseStorage] Deleted file {clean_path}")
            return True
        except Exception as e:
            logger.warning(f"[SupabaseStorage] Failed to delete file {clean_path}: {e}")
            return False


class FirebaseStorageProvider(StorageProvider):
    def __init__(self):
        from app.services.firebase_service import get_firebase_app
        from firebase_admin import storage
        app = get_firebase_app()
        if not app:
            raise ValueError("Firebase app not initialized. Check service account key.")
        self.bucket = storage.bucket(app=app)

    async def upload_file(self, file_bytes: bytes, destination_path: str, content_type: str = "image/png") -> str:
        clean_path = destination_path.lstrip("/\\").replace("\\", "/")
        blob = self.bucket.blob(clean_path)
        blob.upload_from_string(file_bytes, content_type=content_type)
        logger.info(f"[FirebaseStorage] Uploaded file to {clean_path}")
        return clean_path

    async def get_file_url(self, file_path: str) -> str:
        clean_path = file_path.lstrip("/\\").replace("\\", "/")
        return f"https://firebasestorage.googleapis.com/v0/b/{self.bucket.name}/o/{clean_path.replace('/', '%2F')}?alt=media"

    async def file_exists(self, file_path: str) -> bool:
        clean_path = file_path.lstrip("/\\").replace("\\", "/")
        blob = self.bucket.blob(clean_path)
        return blob.exists()

    async def delete_file(self, file_path: str) -> bool:
        clean_path = file_path.lstrip("/\\").replace("\\", "/")
        try:
            blob = self.bucket.blob(clean_path)
            if blob.exists():
                blob.delete()
            logger.info(f"[FirebaseStorage] Deleted file {clean_path}")
            return True
        except Exception as e:
            logger.warning(f"[FirebaseStorage] Failed to delete file {clean_path}: {e}")
            return False


def get_storage_provider() -> StorageProvider:
    if settings.STORAGE_BACKEND == "firebase":
        try:
            return FirebaseStorageProvider()
        except Exception as e:
            logger.warning(f"Failed to initialize FirebaseStorageProvider ({e}). Falling back to LocalStorageProvider.")
            return LocalStorageProvider()
    elif settings.STORAGE_BACKEND == "supabase":
        try:
            return SupabaseStorageProvider()
        except Exception as e:
            logger.warning(f"Failed to initialize SupabaseStorageProvider ({e}). Falling back to LocalStorageProvider.")
            return LocalStorageProvider()
    return LocalStorageProvider()
