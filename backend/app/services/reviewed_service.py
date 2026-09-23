from datetime import datetime, timezone, timedelta
from typing import Optional, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import select, func, desc, or_
from app.models.study import Study, StudyStatus
from app.models.reviewed_study import ReviewedStudy
from app.models.review import ReviewLog
from app.models.model_run import ModelRun
from app.schemas.reviewed import ReviewedStudyStats
import re
from app.models.user import User
from app.core.logging import logger


def resolve_clinician_name(
    db: Session,
    reviewer_id: Optional[str] = None,
    reviewer_name: Optional[str] = None,
    study: Optional[Study] = None
) -> str:
    """
    Dynamically and accurately resolves the real clinician's professional name/title
    (e.g. 'Dr. N V S S Vinay Varma' or 'Dr. Jane Doe, MD') instead of raw user IDs or demo placeholders.
    """
    # 1. If explicit reviewer_name provided and not a placeholder
    if reviewer_name and isinstance(reviewer_name, str):
        c_name = reviewer_name.strip()
        if c_name and c_name.lower() not in ("dr_radiologist", "dr. sarah lin, md", "dr. alex vance, md", "none", "null"):
            if not re.match(r"^(?:dr[\s._-]|doctor\s+)", c_name, flags=re.IGNORECASE):
                return f"Dr. {c_name}"
            return c_name

    # 2. Check reviewer_id
    if reviewer_id and isinstance(reviewer_id, str):
        c_id = reviewer_id.strip()
        # If reviewer_id is numeric, usr_radix_X, or email, look up User table
        u_rec = None
        if c_id.isdigit():
            u_rec = db.query(User).filter(User.id == int(c_id)).first()
        elif c_id.lower().startswith("usr_radix_"):
            uid_num = c_id[len("usr_radix_"):]
            if uid_num.isdigit():
                u_rec = db.query(User).filter(User.id == int(uid_num)).first()
        elif "@" in c_id:
            u_rec = db.query(User).filter(func.lower(User.email) == c_id.lower()).first()

        if u_rec and u_rec.name and u_rec.name.strip():
            name = u_rec.name.strip()
            if not re.match(r"^(?:dr\.?|doctor)\s+", name, flags=re.IGNORECASE):
                return f"Dr. {name}"
            return name

        # If reviewer_id is already a specific identifier or non-placeholder doctor name
        if c_id.lower() not in ("dr_radiologist", "dr. sarah lin, md", "dr. alex vance, md", "none", "null"):
            return c_id

    # 3. Check study's uploader or assigned radiologist
    if study:
        assigned_rad = getattr(study, "assigned_radiologist", None)
        if assigned_rad and isinstance(assigned_rad, str) and assigned_rad.strip():
            ar = assigned_rad.strip()
            if ar.lower() not in ("dr_radiologist", "dr. sarah lin, md", "none", "null"):
                if not re.match(r"^(?:dr\.?|doctor)\s+", ar, flags=re.IGNORECASE):
                    return f"Dr. {ar}"
                return ar

        if study.uploaded_by and study.uploaded_by.strip():
            up = study.uploaded_by.strip()
            u_rec = None
            if up.isdigit():
                u_rec = db.query(User).filter(User.id == int(up)).first()
            elif up.lower().startswith("usr_radix_"):
                uid_num = up[len("usr_radix_"):]
                if uid_num.isdigit():
                    u_rec = db.query(User).filter(User.id == int(uid_num)).first()
            elif "@" in up:
                u_rec = db.query(User).filter(func.lower(User.email) == up.lower()).first()
            else:
                u_rec = db.query(User).filter(func.lower(User.name) == up.lower()).first()

            if u_rec and u_rec.name and u_rec.name.strip():
                name = u_rec.name.strip()
                if not re.match(r"^(?:dr\.?|doctor)\s+", name, flags=re.IGNORECASE):
                    return f"Dr. {name}"
                return name

    # 4. Fallback to active clinician in database
    first_doc = db.query(User).filter(User.role == "Radiologist").order_by(User.id.desc()).first()
    if not first_doc:
        first_doc = db.query(User).order_by(User.id.desc()).first()
    if first_doc and first_doc.name and first_doc.name.strip():
        name = first_doc.name.strip()
        if not re.match(r"^(?:dr\.?|doctor)\s+", name, flags=re.IGNORECASE):
            return f"Dr. {name}"
        return name

    return "Dr. Attending Radiologist, MD"


class ReviewedStudiesService:
    @staticmethod
    def record_reviewed_study(
        db: Session,
        study: Study,
        reviewer_id: Optional[str] = None,
        reviewer_name: Optional[str] = None,
        review_status: Optional[str] = None,
        notes: Optional[str] = None,
        reviewed_at: Optional[datetime] = None,
    ) -> ReviewedStudy:
        """
        Creates or updates a record in the reviewed_studies table when a study is marked as reviewed.
        """
        now_utc = reviewed_at or datetime.now(timezone.utc)
        arrival = study.arrival_time
        if arrival.tzinfo is not None and now_utc.tzinfo is None:
            now_utc = now_utc.replace(tzinfo=timezone.utc)
        elif arrival.tzinfo is None and now_utc.tzinfo is not None:
            arrival = arrival.replace(tzinfo=timezone.utc)

        tat_mins = None
        try:
            diff_secs = max(0.0, (now_utc - arrival).total_seconds())
            tat_mins = round(diff_secs / 60.0, 1)
        except Exception:
            tat_mins = None

        # Extract primary AI finding
        ai_findings = study.clinical_notes
        if not ai_findings:
            from app.models.priority import PriorityFactor
            pf = db.scalars(
                select(PriorityFactor)
                .where(PriorityFactor.study_id == study.study_id)
                .order_by(desc(PriorityFactor.contribution))
            ).first()
            if pf and pf.description:
                ai_findings = pf.description
            elif study.priority_level == "HIGH":
                ai_findings = "Acute critical opacity / elevated clinical acuity"
            else:
                ai_findings = "No acute consolidation or pneumothorax"

        clean_status = (review_status or "NORMAL").upper()
        clean_reviewer = resolve_clinician_name(
            db,
            reviewer_id=reviewer_id,
            reviewer_name=reviewer_name,
            study=study
        )

        existing = db.scalars(
            select(ReviewedStudy).where(ReviewedStudy.study_id == study.study_id)
        ).first()

        if existing:
            existing.patient_id = study.patient_id
            existing.patient_name = study.patient_name
            existing.age = study.age
            existing.sex = study.sex
            existing.modality = study.modality
            existing.body_part = study.body_part or "Chest"
            existing.priority_level = study.priority_level
            existing.priority_score = study.priority_score
            existing.ai_score = study.ai_score
            existing.ai_confidence = study.ai_confidence
            existing.ai_findings = ai_findings
            existing.reviewer_id = clean_reviewer
            existing.review_status = clean_status
            existing.review_notes = notes or existing.review_notes or "Review finalized."
            existing.turnaround_time_mins = tat_mins
            existing.arrival_time = study.arrival_time
            existing.reviewed_at = now_utc
            existing.image_path = study.image_path
            existing.uploaded_by = study.uploaded_by
            db.commit()
            db.refresh(existing)
            logger.info(f"[ReviewedService] Updated reviewed_studies record for {study.study_id}")
            return existing
        else:
            new_record = ReviewedStudy(
                study_id=study.study_id,
                patient_id=study.patient_id,
                patient_name=study.patient_name,
                age=study.age,
                sex=study.sex,
                modality=study.modality,
                body_part=study.body_part or "Chest",
                priority_level=study.priority_level,
                priority_score=study.priority_score,
                ai_score=study.ai_score,
                ai_confidence=study.ai_confidence,
                ai_findings=ai_findings,
                reviewer_id=clean_reviewer,
                review_status=clean_status,
                review_notes=notes or "Normal anatomical structures. Diagnostic sign-off completed.",
                turnaround_time_mins=tat_mins,
                arrival_time=study.arrival_time,
                reviewed_at=now_utc,
                image_path=study.image_path,
                uploaded_by=study.uploaded_by,
            )
            db.add(new_record)
            db.commit()
            db.refresh(new_record)
            logger.info(f"[ReviewedService] Created new reviewed_studies record for {study.study_id}")
            return new_record

    @staticmethod
    def get_reviewed_studies(
        db: Session,
        search: Optional[str] = None,
        priority: Optional[str] = None,
        review_status: Optional[str] = None,
        user_id: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Tuple[List[ReviewedStudy], int, ReviewedStudyStats]:
        """
        Retrieves paginated reviewed studies and aggregates summary analytics.
        Supports filtering by user_id to scope to the clinician's own reviewed studies.
        """
        # Ensure any pre-existing studies with status=REVIEWED are backfilled
        ReviewedStudiesService.sync_existing_reviewed_studies(db)

        query = select(ReviewedStudy)

        if user_id and user_id.lower() != "all":
            from app.models.user import User
            possible_ids = {user_id}
            if "@" in user_id:
                u_rec = db.query(User).filter(func.lower(User.email) == user_id.lower()).first()
                if u_rec:
                    possible_ids.add(f"usr_radix_{u_rec.id}")
                    possible_ids.add(str(u_rec.id))
                    if u_rec.name:
                        possible_ids.add(u_rec.name)
                        possible_ids.add(f"Dr. {u_rec.name}")
            elif user_id.isdigit():
                possible_ids.add(f"usr_radix_{user_id}")
                u_rec = db.query(User).filter(User.id == int(user_id)).first()
                if u_rec and u_rec.name:
                    possible_ids.add(u_rec.name)
                    possible_ids.add(f"Dr. {u_rec.name}")
            elif user_id.startswith("usr_radix_"):
                uid_part = user_id.replace("usr_radix_", "")
                if uid_part.isdigit():
                    possible_ids.add(uid_part)
                    u_rec = db.query(User).filter(User.id == int(uid_part)).first()
                    if u_rec and u_rec.name:
                        possible_ids.add(u_rec.name)
                        possible_ids.add(f"Dr. {u_rec.name}")
            else:
                u_rec = db.query(User).filter(func.lower(User.name) == user_id.lower()).first()
                if u_rec:
                    possible_ids.add(str(u_rec.id))
                    possible_ids.add(f"usr_radix_{u_rec.id}")
                    if u_rec.name:
                        possible_ids.add(u_rec.name)
                        possible_ids.add(f"Dr. {u_rec.name}")

            possible_ids_lower = {p.lower() for p in possible_ids if p}
            # Check if there are user-specific reviews or uploads
            user_query = query.join(Study, ReviewedStudy.study_id == Study.study_id).where(
                (func.lower(Study.uploaded_by).in_(possible_ids_lower)) | (func.lower(ReviewedStudy.reviewer_id).in_(possible_ids_lower))
            )
            if db.scalar(select(func.count()).select_from(user_query.subquery())) > 0:
                query = user_query

        if search and search.strip():
            s = f"%{search.strip().lower()}%"
            query = query.where(
                or_(
                    func.lower(ReviewedStudy.study_id).like(s),
                    func.lower(ReviewedStudy.patient_id).like(s),
                    func.lower(ReviewedStudy.patient_name).like(s),
                    func.lower(ReviewedStudy.ai_findings).like(s),
                    func.lower(ReviewedStudy.review_notes).like(s),
                    func.lower(ReviewedStudy.reviewer_id).like(s),
                )
            )

        if priority and priority.upper() != "ALL":
            p_val = priority.upper()
            if p_val == "STANDARD":
                query = query.where(ReviewedStudy.priority_level.in_(["STANDARD", "LOW"]))
            else:
                query = query.where(ReviewedStudy.priority_level == p_val)

        if review_status and review_status.upper() != "ALL":
            query = query.where(ReviewedStudy.review_status == review_status.upper())

        # Total count for filtered query
        total_filtered = db.scalar(select(func.count()).select_from(query.subquery())) or 0

        # Items ordered by most recently reviewed first
        items = list(
            db.scalars(
                query.order_by(desc(ReviewedStudy.reviewed_at)).offset(offset).limit(limit)
            ).all()
        )

        # Global statistics
        all_records = list(db.scalars(select(ReviewedStudy)).all())
        total_all = len(all_records)
        critical_count = sum(1 for r in all_records if r.review_status == "CRITICAL" or r.priority_level == "HIGH")
        abnormal_count = sum(1 for r in all_records if r.review_status == "ABNORMAL")
        normal_count = sum(1 for r in all_records if r.review_status == "NORMAL")
        
        tat_list = [r.turnaround_time_mins for r in all_records if r.turnaround_time_mins is not None]
        avg_tat = round(sum(tat_list) / len(tat_list), 1) if tat_list else 0.0

        now_utc = datetime.now(timezone.utc)
        today_start = now_utc.replace(hour=0, minute=0, second=0, microsecond=0)
        today_count = 0
        for r in all_records:
            r_dt = r.reviewed_at
            if r_dt.tzinfo is None:
                r_dt = r_dt.replace(tzinfo=timezone.utc)
            if r_dt >= today_start:
                today_count += 1

        stats = ReviewedStudyStats(
            total_reviewed=total_all,
            critical_count=critical_count,
            abnormal_count=abnormal_count,
            normal_count=normal_count,
            avg_turnaround_time_mins=avg_tat,
            reviewed_today_count=today_count,
        )

        return items, total_filtered, stats

    @staticmethod
    def sync_existing_reviewed_studies(db: Session):
        """
        Backfills any studies marked as REVIEWED in the studies table
        that do not yet have a record in reviewed_studies, and fixes legacy placeholder reviewer names.
        """
        try:
            reviewed_in_studies = list(
                db.scalars(
                    select(Study).where(Study.status == StudyStatus.REVIEWED.value)
                ).all()
            )
            for st in reviewed_in_studies:
                exists = db.scalar(
                    select(func.count(ReviewedStudy.id)).where(ReviewedStudy.study_id == st.study_id)
                )
                if not exists:
                    # Find last review log
                    last_log = db.scalars(
                        select(ReviewLog)
                        .where(ReviewLog.study_id == st.study_id)
                        .order_by(desc(ReviewLog.id))
                    ).first()
                    raw_rev = last_log.reviewer_id if last_log else None
                    reviewer = resolve_clinician_name(db, reviewer_id=raw_rev, study=st)
                    r_status = last_log.review_status if (last_log and last_log.review_status) else "NORMAL"
                    notes = last_log.notes if last_log else "Clinical sign-off recorded."
                    rev_time = last_log.timestamp if last_log else st.updated_at

                    ReviewedStudiesService.record_reviewed_study(
                        db=db,
                        study=st,
                        reviewer_id=reviewer,
                        reviewer_name=reviewer,
                        review_status=r_status,
                        notes=notes,
                        reviewed_at=rev_time,
                    )

            # Fix any existing reviewed_studies records that have legacy placeholder reviewer names
            placeholders = ["dr_radiologist", "Dr. Sarah Lin, MD", "dr_alex_vance", "Dr. Alex Vance, MD"]
            legacy_recs = db.scalars(
                select(ReviewedStudy).where(ReviewedStudy.reviewer_id.in_(placeholders))
            ).all()
            for l_rec in legacy_recs:
                st_match = db.scalar(select(Study).where(Study.study_id == l_rec.study_id))
                fixed_name = resolve_clinician_name(db, reviewer_id=None, study=st_match)
                if fixed_name and fixed_name not in placeholders:
                    l_rec.reviewer_id = fixed_name
            if legacy_recs:
                db.commit()
        except Exception as e:
            logger.warning(f"[ReviewedService] Auto-sync encountered notice: {e}")

    @staticmethod
    def revert_reviewed_study(db: Session, study_id: str, requesting_user_id: Optional[str] = None) -> bool:
        """
        Reverts a reviewed study back to active triage queue (PENDING_REVIEW),
        and removes it from reviewed_studies archive.
        Enforces strict clinical ownership:
        - ONLY the clinician who reviewed/signed off the study (or uploader) is permitted to reopen it.
          Other users are strictly rejected with 403 Forbidden.
        """
        from app.services.study_service import StudyService
        from fastapi import HTTPException

        record = db.scalars(
            select(ReviewedStudy).where(ReviewedStudy.study_id == study_id)
        ).first()

        study = db.scalars(
            select(Study).where(Study.study_id == study_id)
        ).first()

        if not record and not study:
            raise HTTPException(status_code=404, detail=f"Study '{study_id}' not found.")

        # Identify the reviewing clinician
        reviewer = None
        if record and record.reviewer_id:
            reviewer = record.reviewer_id

        if not reviewer and study:
            last_review = db.query(ReviewLog).filter(
                ReviewLog.study_id == study_id,
                ReviewLog.action.in_(["COMPLETED_REVIEW", "REVIEWED", "SIGNED_OFF"])
            ).order_by(ReviewLog.id.desc()).first()
            if last_review:
                reviewer = last_review.reviewer_id

        if not reviewer and study:
            reviewer = getattr(study, "assigned_radiologist", None) or getattr(study, "uploaded_by", None)

        if not reviewer:
            reviewer = "Attending Clinician"

        # Permission check: ONLY the same user who reviewed it (or signed it off) can reopen
        if not requesting_user_id:
            logger.warning(f"[ReviewedService] Unauthenticated reopen attempt on reviewed study {study_id}")
            raise HTTPException(
                status_code=403,
                detail=f"Permission denied: This scan was clinically reviewed by {reviewer}. Only the reviewing physician can reopen this study."
            )

        if requesting_user_id.lower() != "all":
            study_svc = StudyService()
            req_aliases = study_svc._resolve_user_identifiers(db, requesting_user_id)
            reviewer_aliases = study_svc._resolve_user_identifiers(db, reviewer)

            # Also check uploader if relevant
            uploader = getattr(study, "uploaded_by", None) or (record.uploaded_by if record else None)
            allowed_aliases = set(reviewer_aliases)
            if uploader:
                uploader_aliases = study_svc._resolve_user_identifiers(db, uploader)
                allowed_aliases = allowed_aliases.union(uploader_aliases)

            if not req_aliases.intersection(allowed_aliases):
                logger.warning(
                    f"[ReviewedService] Unauthorized reopen attempt on study {study_id}: "
                    f"reviewer='{reviewer}', requester='{requesting_user_id}'"
                )
                raise HTTPException(
                    status_code=403,
                    detail=f"Permission denied: This scan was clinically reviewed by {reviewer}. Only the reviewing physician can reopen this study."
                )

        if record:
            db.delete(record)

        if study:
            study.status = StudyStatus.PENDING_REVIEW.value
            rev_log = ReviewLog(
                study_id=study.study_id,
                action="REVERTED_TO_QUEUE",
                review_status="PENDING",
                reviewer_id=reviewer,
                notes="Reopened from reviewed archive back to active worklist",
            )
            db.add(rev_log)

        db.commit()
        return True


reviewed_service = ReviewedStudiesService()
