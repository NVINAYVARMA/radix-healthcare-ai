from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.schemas.reviewed import ReviewedStudyListResponse, ReviewedStudyItem
from app.services.reviewed_service import reviewed_service

router = APIRouter(prefix="/reviewed-studies", tags=["Reviewed Studies"])


@router.get("", response_model=ReviewedStudyListResponse)
async def list_reviewed_studies(
    search: Optional[str] = Query(None, description="Search by study ID, patient name, MRN, or findings"),
    priority: Optional[str] = Query(None, description="Filter by priority level (HIGH, MEDIUM, STANDARD)"),
    review_status: Optional[str] = Query(None, description="Filter by review status (NORMAL, ABNORMAL, CRITICAL)"),
    user_id: Optional[str] = Query(None, description="Scope archive to studies belonging to specific user"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """
    Retrieve paginated archive of all finalized and reviewed studies with summary statistics.
    """
    items, total, stats = reviewed_service.get_reviewed_studies(
        db=db,
        search=search,
        priority=priority,
        review_status=review_status,
        user_id=user_id,
        limit=limit,
        offset=offset
    )
    return ReviewedStudyListResponse(
        items=[ReviewedStudyItem.model_validate(it) for it in items],
        total=total,
        stats=stats
    )


@router.get("/{study_id}", response_model=ReviewedStudyItem)
async def get_reviewed_study(
    study_id: str,
    db: Session = Depends(get_db)
):
    """
    Get detailed archived sign-off record for a specific reviewed study.
    """
    from app.models.reviewed_study import ReviewedStudy
    from sqlalchemy import select

    record = db.scalars(
        select(ReviewedStudy).where(ReviewedStudy.study_id == study_id)
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail=f"Reviewed study '{study_id}' not found in archive")
    return ReviewedStudyItem.model_validate(record)


@router.post("/{study_id}/revert")
async def revert_study_to_queue(
    study_id: str,
    db: Session = Depends(get_db)
):
    """
    Reverts a reviewed study back to the active triage queue (PENDING_REVIEW),
    removing it from the reviewed_studies archive.
    """
    success = reviewed_service.revert_reviewed_study(db, study_id)
    return {
        "success": success,
        "message": f"Study '{study_id}' successfully reopened and returned to active worklist queue."
    }


@router.delete("/{study_id}")
async def delete_reviewed_study(
    study_id: str,
    user_id: Optional[str] = Query(None, description="Requesting clinician ID"),
    db: Session = Depends(get_db)
):
    """
    Permanently deletes a reviewed study from the archive and all underlying database/storage systems.
    Only the uploading user can delete the study.
    """
    from app.services.study_service import StudyService
    study_svc = StudyService()
    success = await study_svc.delete_study(db, study_id, requesting_user_id=user_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Study '{study_id}' not found.")
    return {
        "success": True,
        "message": f"Study '{study_id}' permanently deleted from archive."
    }
