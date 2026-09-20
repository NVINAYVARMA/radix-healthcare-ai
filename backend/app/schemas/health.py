from pydantic import BaseModel
from datetime import datetime


class HealthResponse(BaseModel):
    status: str
    database: str
    version: str
    timestamp: datetime
