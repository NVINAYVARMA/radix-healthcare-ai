from fastapi import APIRouter, Depends, Query, status
from typing import Optional
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.services.queue_service import QueueService
from app.schemas.queue import QueueListResponse, QueueProcessResponse

router = APIRouter(prefix="/queue", tags=["Queue"])
queue_service = QueueService()


@router.get("", response_model=QueueListResponse)
async def get_prioritized_queue(
    user_id: Optional[str] = Query(None, description="Filter queue by uploading user ID"),
    priority: Optional[str] = Query(None, description="Filter by priority level"),
    modality: Optional[str] = Query(None, description="Filter by modality"),
    search: Optional[str] = Query(None, description="Search term"),
    limit: int = Query(50, ge=1, le=100, description="Max number of studies to return"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    db: Session = Depends(get_db)
):
    """
    Retrieves the dynamic prioritized radiology reading queue.
    The worklist is sorted by the 6-tier clinical tie-breaker.
    Strictly isolated per user_id when provided.
    """
    return await queue_service.get_queue(
        db=db,
        limit=limit,
        offset=offset,
        user_id=user_id,
        priority=priority,
        modality=modality,
        search=search
    )


@router.post("/process", response_model=QueueProcessResponse, status_code=status.HTTP_200_OK)
def process_queue(db: Session = Depends(get_db)):
    """
    Triggers batch evaluation of active and pending studies.
    Refreshes waiting-time adjustments, recalculates priority scores,
    and returns a summary of processed studies by priority level.
    """
    return queue_service.process_all_pending(db=db)
