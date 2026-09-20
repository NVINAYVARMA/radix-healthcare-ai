from typing import Generic, TypeVar, Optional
from pydantic import BaseModel

T = TypeVar("T")


class MessageResponse(BaseModel):
    message: str
    detail: Optional[str] = None


class DataResponse(BaseModel, Generic[T]):
    data: T
    message: Optional[str] = None
