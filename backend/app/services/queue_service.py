from datetime import datetime, timezone
from typing import Optional, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc, func
from app.models.study import Study, StudyStatus, PriorityLevel
from app.services.priority_service import PriorityService
from app.services.storage_service import StorageProvider, get_storage_provider
from app.schemas.queue import QueueItem, QueueListResponse, QueueProcessResponse
from app.services.tie_breaker import (
    build_queue_order_by,
    resolve_tie_explanation,
    check_critical_finding,
    get_urgency_rank
)
from app.core.logging import logger
from app.services.study_service import StudyService

ACTIVE_STATUSES = [
    StudyStatus.PRIORITIZED.value,
    StudyStatus.PENDING_REVIEW.value,
    StudyStatus.IN_REVIEW.value
]


class QueueService:
    def __init__(
        self,
        priority_service: Optional[PriorityService] = None,
        storage_provider: Optional[StorageProvider] = None
    ):
        self.priority_service = priority_service or PriorityService()
        self.storage_provider = storage_provider or get_storage_provider()

    async def get_queue(
        self,
        db: Session,
        limit: int = 50,
        offset: int = 0,
        user_id: Optional[str] = None,
        priority: Optional[str] = None,
        modality: Optional[str] = None,
        search: Optional[str] = None
    ) -> QueueListResponse:
        """
        Retrieves active studies sorted deterministically by the 6-tier clinical tie-breaker.
        Supports filtering by priority, modality, and search while preserving deterministic order and pagination.
        Strictly isolated by user_id when provided.
        """
        base_query = db.query(Study).filter(Study.status.in_(ACTIVE_STATUSES))
        if user_id:
            from app.models.user import User
            possible_ids = {user_id}
            if "@" in user_id:
                u_rec = db.query(User).filter(func.lower(User.email) == user_id.lower()).first()
                if u_rec:
                    possible_ids.add(f"usr_radix_{u_rec.id}")
                    possible_ids.add(str(u_rec.id))
            elif user_id.isdigit():
                possible_ids.add(f"usr_radix_{user_id}")
            elif user_id.startswith("usr_radix_"):
                suffix = user_id.replace("usr_radix_", "")
                if suffix.isdigit():
                    possible_ids.add(suffix)
                    u_rec = db.query(User).filter(User.id == int(suffix)).first()
                    if u_rec:
                        possible_ids.add(u_rec.email)
            user_specific_count = base_query.filter(Study.uploaded_by.in_(list(possible_ids))).count()
            if user_specific_count > 0:
                base_query = base_query.filter(
                    (Study.uploaded_by.in_(list(possible_ids))) | (Study.uploaded_by == None) | (Study.uploaded_by == "system")
                )

        # Query total active counts by priority level
        high_count = base_query.filter(
            Study.priority_level == PriorityLevel.HIGH.value
        ).count()

        medium_count = base_query.filter(
            Study.priority_level == PriorityLevel.MEDIUM.value
        ).count()

        standard_count = base_query.filter(
            Study.priority_level == PriorityLevel.STANDARD.value
        ).count()

        total_active = high_count + medium_count + standard_count

        filtered_query = base_query
        if priority and priority.upper() != "ALL":
            p_upper = priority.upper()
            if p_upper in ("STANDARD", "LOW"):
                filtered_query = filtered_query.filter(
                    func.coalesce(Study.manual_priority, Study.priority_level).in_(["STANDARD", "LOW"])
                )
            else:
                filtered_query = filtered_query.filter(
                    func.coalesce(Study.manual_priority, Study.priority_level) == p_upper
                )

        if modality and modality.upper() != "ALL":
            filtered_query = filtered_query.filter(func.upper(Study.modality) == modality.upper())

        if search and search.strip():
            from sqlalchemy import or_
            term = f"%{search.strip().lower()}%"
            filtered_query = filtered_query.filter(
                or_(
                    func.lower(Study.study_id).like(term),
                    func.lower(Study.patient_id).like(term),
                    func.lower(Study.patient_name).like(term),
                    func.lower(Study.key_findings).like(term),
                    func.lower(Study.clinical_notes).like(term),
                    func.lower(Study.body_part).like(term),
                )
            )

        total_count = filtered_query.count()

        # Order dynamically with 6-tier deterministic clinical tie-breaking
        studies: List[Study] = (
            filtered_query
            .order_by(*build_queue_order_by(Study))
            .offset(offset)
            .limit(limit)
            .all()
        )

        now = datetime.now(timezone.utc)
        items: List[QueueItem] = []

        # First calculate waiting times and findings
        study_wait_times = []
        for study in studies:
            _, elapsed_mins = self.priority_service.calculate_waiting_score(study.arrival_time, now)
            study_wait_times.append(elapsed_mins)

        for idx, study in enumerate(studies):
            rank = offset + idx + 1
            elapsed_mins = study_wait_times[idx]
            image_url = await self.storage_provider.get_file_url(study.image_path)

            has_crit = check_critical_finding(study.key_findings, study.clinical_notes)
            u_rank = get_urgency_rank(study.manual_priority, study.priority_level)

            # Determine tie resolution if tied with adjacent study
            tie_res = None
            curr_score = round(study.priority_score or 0.0, 2)
            if idx > 0 and abs(round(studies[idx - 1].priority_score or 0.0, 2) - curr_score) < 0.001:
                prev_s = studies[idx - 1]
                prev_wait = study_wait_times[idx - 1]
                tie_res = resolve_tie_explanation(prev_s, study, prev_wait, elapsed_mins)
            elif idx < len(studies) - 1 and abs(round(studies[idx + 1].priority_score or 0.0, 2) - curr_score) < 0.001:
                next_s = studies[idx + 1]
                next_wait = study_wait_times[idx + 1]
                tie_res = resolve_tie_explanation(study, next_s, elapsed_mins, next_wait)

            findings_desc = study.key_findings or (study.factors[0].description if study.factors else "Diagnostic review indicated")
            items.append(
                QueueItem(
                    rank=rank,
                    id=study.id,
                    study_id=study.study_id,
                    patient_id=study.patient_id or f"PX{study.id:03d}",
                    patient_name=study.patient_name or f"Patient {study.study_id}",
                    age=study.age if study.age is not None else 50,
                    sex=study.sex or "M",
                    body_part=study.body_part or "Chest",
                    modality=study.modality,
                    image_url=image_url,
                    arrival_time=study.arrival_time.replace(tzinfo=timezone.utc) if (study.arrival_time and study.arrival_time.tzinfo is None) else study.arrival_time,
                    waiting_minutes=elapsed_mins,
                    status=study.status,
                    ai_score=study.ai_score,
                    ai_confidence=study.ai_confidence,
                    priority_score=study.priority_score or 0.0,
                    priority_level=study.priority_level or PriorityLevel.STANDARD.value,
                    manual_priority=study.manual_priority,
                    override_reason=study.override_reason,
                    key_findings=findings_desc,
                    uploaded_by=study.uploaded_by,
                    tie_resolution=tie_res,
                    has_critical_finding=has_crit,
                    urgency_rank=u_rank,
                    factors=study.factors,
                    findings=StudyService.extract_study_findings(study)
                )
            )

        return QueueListResponse(
            total=total_active,
            high_count=high_count,
            medium_count=medium_count,
            standard_count=standard_count,
            items=items,
            studies=items
        )

    def process_all_pending(self, db: Session) -> QueueProcessResponse:
        """
        Batch processes all unreviewed studies, updating waiting-time bonuses,
        recalculating priority scores, and refreshing priority factors.
        """
        # Fetch studies that are active or in processing
        studies_to_process = (
            db.query(Study)
            .filter(Study.status.in_(ACTIVE_STATUSES + [StudyStatus.PROCESSING.value, StudyStatus.UPLOADED.value]))
            .all()
        )

        high = 0
        medium = 0
        standard = 0

        for study in studies_to_process:
            updated_study = self.priority_service.calculate_and_save_priority(db, study)
            level = updated_study.priority_level
            if level == PriorityLevel.HIGH.value:
                high += 1
            elif level == PriorityLevel.MEDIUM.value:
                medium += 1
            else:
                standard += 1

        logger.info(
            f"[QueueService] Processed {len(studies_to_process)} studies: "
            f"HIGH={high}, MEDIUM={medium}, STANDARD={standard}"
        )

        return QueueProcessResponse(
            processed=len(studies_to_process),
            high=high,
            medium=medium,
            standard=standard
        )
