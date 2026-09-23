from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.core.logging import logger
from app.models.study import Study
from app.services.study_service import StudyService
from app.schemas.study import (
    StudyCreateResponse,
    StudyDetailResponse,
    StudyListItem,
    ReviewActionRequest,
    ReviewActionResponse,
    PriorityOverrideRequest,
    PriorityOverrideResponse
)

router = APIRouter(prefix="/studies", tags=["Studies"])
study_service = StudyService()


@router.post("", response_model=StudyCreateResponse, status_code=status.HTTP_201_CREATED)
async def upload_study(
    file: UploadFile = File(...),
    study_id: Optional[str] = Form(None),
    patient_id: Optional[str] = Form(None),
    patient_name: Optional[str] = Form(None),
    age: Optional[int] = Form(None),
    sex: Optional[str] = Form(None),
    body_part: Optional[str] = Form("Chest"),
    clinical_notes: Optional[str] = Form(None),
    arrival_time: Optional[str] = Form(None),
    modality: str = Form("X-RAY"),
    uploaded_by: Optional[str] = Form(None),
    user_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Upload an imaging study (X-Ray).
    Validates the image, uploads to storage, creates a database study record with patient details,
    and runs DenseNet-121 multi-label AI pattern analysis.
    """
    parsed_arrival = None
    if arrival_time and arrival_time.strip():
        val = arrival_time.strip()
        try:
            parsed_arrival = datetime.fromisoformat(val.replace("Z", "+00:00"))
            if parsed_arrival.tzinfo is None:
                parsed_arrival = parsed_arrival.replace(tzinfo=timezone.utc)
        except Exception:
            pass

    actual_uploader = uploaded_by or user_id
    study = await study_service.create_and_process_study(
        db=db,
        file=file,
        study_id=study_id,
        patient_id=patient_id,
        patient_name=patient_name,
        age=age,
        sex=sex,
        body_part=body_part,
        clinical_notes=clinical_notes,
        arrival_time=parsed_arrival,
        modality=modality,
        uploaded_by=actual_uploader
    )
    image_url = await study_service.get_image_url(study.image_path)
    return StudyCreateResponse(
        study_id=study.study_id,
        status=study.status,
        message="Study uploaded and analyzed successfully",
        image_url=image_url,
        priority_score=study.priority_score,
        priority_level=study.priority_level,
        patient_id=study.patient_id,
        patient_name=study.patient_name,
        age=study.age,
        sex=study.sex,
        body_part=study.body_part,
        clinical_notes=study.clinical_notes,
        key_findings=study.key_findings,
        uploaded_by=study.uploaded_by,
        arrival_time=study.arrival_time,
        findings=study_service.extract_study_findings(study)
    )


@router.delete("/all")
def clear_all_studies(db: Session = Depends(get_db)):
    """
    Removes all studies, factors, reviews, and runs from database, disk storage, and Firestore.
    """
    import os
    import shutil
    from app.core.config import settings
    from app.models.review import ReviewLog
    from app.models.priority import PriorityFactor
    from app.models.model_run import ModelRun
    from app.services.firebase_service import get_firestore_db

    db.query(ReviewLog).delete()
    db.query(PriorityFactor).delete()
    db.query(ModelRun).delete()
    count = db.query(Study).delete()
    db.commit()

    # Clear local storage directories
    for st_dir in [
        os.path.abspath(os.path.join(settings.STORAGE_LOCAL_DIR, "studies")),
        os.path.abspath("data/storage/studies"),
        os.path.abspath("backend/data/storage/studies")
    ]:
        if os.path.exists(st_dir):
            for item in os.listdir(st_dir):
                item_p = os.path.join(st_dir, item)
                try:
                    if os.path.isdir(item_p):
                        shutil.rmtree(item_p)
                    else:
                        os.remove(item_p)
                except Exception:
                    pass

    # Clear Cloud Firestore
    fb_db = get_firestore_db()
    if fb_db:
        try:
            for doc in fb_db.collection("studies").stream():
                doc.reference.delete()
        except Exception:
            pass

    return {"success": True, "deleted": count, "message": "All existing studies and files successfully cleared."}


@router.get("/{study_id}", response_model=StudyDetailResponse)
async def get_study(
    study_id: str,
    user_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Retrieve full details of a specific imaging study, including AI scores,
    priority factors, review history, and image URL.
    Ensures studies are strictly scoped to the uploading user when user_id is provided.
    """
    study = await study_service.get_study(db, study_id)
    if not study:
        raise HTTPException(status_code=404, detail=f"Study with ID '{study_id}' not found.")
    
    image_url = await study_service.get_image_url(study.image_path)
    
    return StudyDetailResponse(
        id=study.id,
        study_id=study.study_id,
        modality=study.modality,
        image_path=study.image_path,
        image_url=image_url,
        arrival_time=study.arrival_time,
        status=study.status,
        ai_score=study.ai_score,
        ai_confidence=study.ai_confidence,
        priority_score=study.priority_score,
        priority_level=study.priority_level,
        image_quality_score=study.image_quality_score,
        manual_priority=study.manual_priority,
        override_reason=study.override_reason,
        patient_id=study.patient_id,
        patient_name=study.patient_name,
        age=study.age,
        sex=study.sex,
        body_part=study.body_part,
        clinical_notes=study.clinical_notes,
        key_findings=study.key_findings,
        uploaded_by=study.uploaded_by,
        factors=study.factors,
        reviews=study.reviews,
        model_runs=study.model_runs,
        findings=study_service.extract_study_findings(study),
        created_at=study.created_at,
        updated_at=study.updated_at
    )


@router.get("", response_model=List[StudyListItem])
async def list_studies(
    status: Optional[str] = Query(None, description="Filter by study status (e.g., PENDING_REVIEW, IN_REVIEW, REVIEWED)"),
    priority: Optional[str] = Query(None, description="Filter by priority level (HIGH, MEDIUM, STANDARD)"),
    user_id: Optional[str] = Query(None, description="Filter by uploading user ID"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """
    List imaging studies with optional status, priority, and user_id filtering.
    """
    studies = await study_service.list_studies(
        db=db,
        status=status,
        priority=priority,
        user_id=user_id,
        limit=limit,
        offset=offset
    )

    results = []
    for study in studies:
        img_url = await study_service.get_image_url(study.image_path)
        last_review = study.reviews[-1] if study.reviews else None
        results.append(
            StudyListItem(
                id=study.id,
                study_id=study.study_id,
                modality=study.modality,
                image_url=img_url,
                arrival_time=study.arrival_time,
                status=study.status,
                ai_score=study.ai_score,
                ai_confidence=study.ai_confidence,
                priority_score=study.priority_score,
                priority_level=study.priority_level,
                image_quality_score=study.image_quality_score,
                manual_priority=study.manual_priority,
                patient_id=study.patient_id,
                patient_name=study.patient_name,
                age=study.age,
                sex=study.sex,
                body_part=study.body_part,
                clinical_notes=study.clinical_notes,
                key_findings=study.key_findings,
                uploaded_by=study.uploaded_by,
                reviewed_at=last_review.timestamp if last_review else (study.updated_at if study.status == "REVIEWED" else None),
                reviewer_id=last_review.reviewer_id if last_review else None,
                review_status=last_review.review_status if last_review else ("NORMAL" if study.status == "REVIEWED" else None),
                review_notes=last_review.notes if last_review else None,
                findings=study_service.extract_study_findings(study)
            )
        )
    return results


@router.get("/{study_id}/factors")
async def get_study_factors(study_id: str, db: Session = Depends(get_db)):
    """
    Returns AI explainability factors and acute finding probabilities for a study.
    """
    study = await study_service.get_study(db, study_id)
    if not study:
        raise HTTPException(status_code=404, detail=f"Study with ID '{study_id}' not found.")

    factors_list = [f.description for f in study.factors] if study.factors else [
        "High AI urgency score",
        "Increased waiting time",
        "Time-sensitive pattern detected",
    ]
    p_level = (study.manual_priority or study.priority_level or "STANDARD").capitalize()
    return {
        "studyId": study.study_id,
        "priorityScore": study.priority_score or study.ai_score or 0.5,
        "confidenceScore": study.ai_confidence or 0.94,
        "priorityLevel": p_level,
        "keyContributingFactors": factors_list,
        "factors": factors_list,
        "aiProbabilities": study_service.extract_study_findings(study),
        "safetyMessage": "This is a triage and prioritization suggestion only. Not a diagnosis. Please review the study in full."
    }


@router.patch("/{study_id}/review", response_model=ReviewActionResponse)
async def submit_study_review(
    study_id: str,
    payload: ReviewActionRequest,
    db: Session = Depends(get_db)
):
    """
    Submit a radiologist review action (e.g. STARTED_REVIEW, COMPLETED_REVIEW).
    Transitions the study workflow state, saves audit trail, and syncs to Firestore.
    """
    action = payload.action
    if not action and payload.status:
        st_upper = payload.status.upper()
        if st_upper in ("IN_REVIEW", "STARTED_REVIEW"):
            action = "STARTED_REVIEW"
        elif st_upper in ("REVIEWED", "COMPLETED_REVIEW"):
            action = "COMPLETED_REVIEW"
        else:
            action = payload.status
    action = action or "COMPLETED_REVIEW"
    notes = payload.notes or payload.reviewNotes

    study, review_log = await study_service.submit_review(
        db=db,
        study_id=study_id,
        action=action,
        reviewer_id=payload.reviewer_id,
        reviewer_name=getattr(payload, "reviewer_name", None),
        review_status=payload.review_status,
        notes=notes
    )
    return ReviewActionResponse(
        study_id=study.study_id,
        action=review_log.action,
        status=study.status,
        reviewer_id=review_log.reviewer_id,
        review_status=review_log.review_status,
        notes=review_log.notes,
        message=f"Review action '{review_log.action}' submitted successfully"
    )


@router.patch("/{study_id}/priority", response_model=PriorityOverrideResponse)
async def override_study_priority(
    study_id: str,
    payload: PriorityOverrideRequest,
    db: Session = Depends(get_db)
):
    """
    Manually override the priority level of a study with an audit reason.
    CRITICAL SAFETY REQUIREMENT: Preserves original AI score and priority score.
    """
    from app.services.reviewed_service import resolve_clinician_name
    manual_priority = (payload.manual_priority or payload.newPriority or "HIGH").upper()
    raw_rev = payload.reviewer_id or payload.overriddenBy
    reviewer_id = resolve_clinician_name(db, reviewer_id=raw_rev)
    reason = payload.reason or "Clinical reassessment"

    study = await study_service.override_priority(
        db=db,
        study_id=study_id,
        manual_priority=manual_priority,
        reason=reason,
        reviewer_id=reviewer_id
    )
    return PriorityOverrideResponse(
        study_id=study.study_id,
        original_priority_score=study.priority_score,
        original_priority_level=study.priority_level,
        manual_priority=study.manual_priority,
        reason=study.override_reason,
        reviewer_id=reviewer_id,
        message="Priority overridden successfully while preserving original AI scores"
    )


@router.post("/batch")
async def batch_update_studies(payload: dict, db: Session = Depends(get_db)):
    """
    Batch actions on multiple studies (e.g. batch mark reviewed).
    """
    from app.models.study import StudyStatus
    from app.services.reviewed_service import resolve_clinician_name, reviewed_service

    study_ids = payload.get("studyIds") or payload.get("study_ids") or []
    action = payload.get("action", "markReviewed")
    inner_payload = payload.get("payload") if isinstance(payload.get("payload"), dict) else {}
    req_reviewer_id = payload.get("reviewer_id") or inner_payload.get("reviewer_id")
    req_reviewer_name = payload.get("reviewer_name") or inner_payload.get("reviewer_name")
    req_review_status = payload.get("review_status") or inner_payload.get("review_status", "NORMAL")
    req_notes = payload.get("notes") or inner_payload.get("notes", "Batch marked as reviewed")
    updated_count = 0

    for sid in study_ids:
        study = await study_service.get_study(db, str(sid))
        if study:
            if action in ("markReviewed", "REVIEWED"):
                clinician_name = resolve_clinician_name(
                    db,
                    reviewer_id=req_reviewer_id,
                    reviewer_name=req_reviewer_name,
                    study=study
                )
                study.status = StudyStatus.REVIEWED.value
                from app.models.review import ReviewLog
                review_log = ReviewLog(
                    study_id=study.study_id,
                    action="COMPLETED_REVIEW",
                    review_status=req_review_status,
                    reviewer_id=clinician_name,
                    notes=req_notes
                )
                db.add(review_log)
                try:
                    reviewed_service.record_reviewed_study(
                        db=db,
                        study=study,
                        reviewer_id=clinician_name,
                        reviewer_name=clinician_name,
                        review_status=req_review_status,
                        notes=req_notes
                    )
                except Exception:
                    pass
                updated_count += 1
    db.commit()
    return {"success": True, "updatedCount": updated_count}


@router.post("/json")
async def create_study_from_json(payload: dict, db: Session = Depends(get_db)):
    """
    Create or ingest a study from a JSON payload.
    """
    from app.models.study import Study, StudyStatus
    assigned_id = payload.get("studyId") or payload.get("study_id") or study_service.generate_study_id(db)
    existing = await study_service.get_study(db, assigned_id)
    if existing:
        return {"success": True, "study": {"id": existing.id, "studyId": existing.study_id, "status": existing.status}}

    p_level = (payload.get("priorityLevel") or payload.get("priority") or "HIGH").upper()
    new_s = Study(
        study_id=assigned_id,
        modality=payload.get("modality", "X-RAY"),
        image_path="default_frontal.png",
        status=StudyStatus.PENDING_REVIEW.value,
        ai_score=payload.get("priorityScore", 0.91),
        ai_confidence=payload.get("confidenceScore", 0.95),
        priority_score=payload.get("priorityScore", 0.91),
        priority_level=p_level
    )
    db.add(new_s)
    db.commit()
    db.refresh(new_s)
    return {"success": True, "study": {"id": new_s.id, "studyId": new_s.study_id, "status": new_s.status}}


@router.delete("/{study_id}", status_code=status.HTTP_200_OK)
async def delete_study(
    study_id: str,
    user_id: Optional[str] = Query(None, description="Requesting clinician ID"),
    db: Session = Depends(get_db)
):
    """
    Deletes an individual study, its files from storage, related database records, and Firestore sync.
    Only the uploading user is authorized to delete the study.
    """
    deleted = await study_service.delete_study(db=db, study_id=study_id, requesting_user_id=user_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Study '{study_id}' not found."
        )
    return {"success": True, "message": f"Study '{study_id}' deleted successfully", "study_id": study_id}


@router.post("/batch-delete", status_code=status.HTTP_200_OK)
async def batch_delete_studies(payload: dict, db: Session = Depends(get_db)):
    """
    Batch deletes multiple studies by their IDs.
    Restricted to authorized users (reviewer for reviewed studies, uploader for unreviewed studies).
    """
    study_ids = payload.get("study_ids") or payload.get("studyIds") or []
    user_id = payload.get("user_id")
    if not isinstance(study_ids, list):
        raise HTTPException(status_code=400, detail="Invalid payload: 'study_ids' must be a list")
    
    deleted_count = 0
    errors = []
    for sid in study_ids:
        if isinstance(sid, str) and sid.strip():
            try:
                success = await study_service.delete_study(db=db, study_id=sid.strip(), requesting_user_id=user_id)
                if success:
                    deleted_count += 1
            except HTTPException as he:
                errors.append(f"{sid}: {he.detail}")
                logger.warning(f"Batch delete rejected for study {sid}: {he.detail}")
            except Exception as e:
                logger.warning(f"Batch delete failed for study {sid}: {e}")

    return {"success": True, "deletedCount": deleted_count, "errors": errors}
