import os
import json
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
import firebase_admin
from firebase_admin import credentials, firestore, storage
from app.core.config import settings
from app.core.logging import logger

_firebase_app = None


def get_firebase_app():
    global _firebase_app
    if _firebase_app is not None:
        return _firebase_app

    cred_path = settings.FIREBASE_CREDENTIALS_PATH
    if not os.path.isabs(cred_path):
        # Anchor relative to backend directory
        backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        cred_path = os.path.abspath(os.path.join(backend_dir, cred_path.lstrip("./\\")))

    if not os.path.exists(cred_path):
        logger.warning(f"[Firebase] Service account key not found at {cred_path}")
        return None

    try:
        cred = credentials.Certificate(cred_path)
        bucket_name = settings.FIREBASE_STORAGE_BUCKET or f"{settings.FIREBASE_PROJECT_ID}.firebasestorage.app"
        _firebase_app = firebase_admin.initialize_app(cred, {
            "storageBucket": bucket_name
        })
        logger.info(f"[Firebase] Initialized successfully with project {settings.FIREBASE_PROJECT_ID} (bucket: {bucket_name})")
        return _firebase_app
    except ValueError:
        # Already initialized
        _firebase_app = firebase_admin.get_app()
        return _firebase_app
    except Exception as e:
        logger.error(f"[Firebase] Initialization failed: {e}", exc_info=True)
        return None


def get_firestore_db():
    app = get_firebase_app()
    if not app:
        return None
    try:
        return firestore.client(app=app)
    except Exception as e:
        logger.warning(f"[Firebase] Firestore client unavailable: {e}")
        return None


class FirebaseSyncService:
    """
    Syncs studies, AI scores, priority factors, model runs, and reviews
    to Cloud Firestore collections.
    """
    @staticmethod
    def sync_study(
        study_or_id: Optional[Any] = None,
        study_id: Optional[str] = None,
        patient_id: Optional[str] = None,
        patient_name: Optional[str] = None,
        age: Optional[int] = None,
        sex: Optional[str] = None,
        body_part: Optional[str] = None,
        clinical_notes: Optional[str] = None,
        key_findings: Optional[str] = None,
        uploaded_by: Optional[str] = None,
        modality: Optional[str] = None,
        image_path: Optional[str] = None,
        image_url: Optional[str] = None,
        status: Optional[str] = None,
        arrival_time: Optional[datetime] = None,
        ai_score: Optional[float] = None,
        ai_confidence: Optional[float] = None,
        priority_score: Optional[float] = None,
        priority_level: Optional[str] = None,
        image_quality_score: Optional[float] = None,
        manual_priority: Optional[str] = None,
        override_reason: Optional[str] = None,
        factors: Optional[List[Dict[str, Any]]] = None,
        model_runs: Optional[List[Dict[str, Any]]] = None,
        findings: Optional[Dict[str, float]] = None,
        **kwargs
    ):
        db = get_firestore_db()
        if not db:
            return

        target = study_or_id if study_or_id is not None else study_id
        if not target:
            logger.warning("[FirebaseSync] No study or study_id provided for sync.")
            return

        try:
            if hasattr(target, "study_id"):
                study = target
                s_id = study.study_id
                s_patient_id = patient_id or getattr(study, "patient_id", None)
                s_patient_name = patient_name or getattr(study, "patient_name", None)
                s_age = age if age is not None else getattr(study, "age", None)
                s_sex = sex or getattr(study, "sex", None)
                s_body_part = body_part or getattr(study, "body_part", "Chest")
                s_clinical_notes = clinical_notes or getattr(study, "clinical_notes", None)
                s_key_findings = key_findings or getattr(study, "key_findings", None)
                s_uploaded_by = uploaded_by or getattr(study, "uploaded_by", None)
                s_modality = modality or study.modality
                s_image_path = image_path or study.image_path
                s_image_url = image_url or f"/api/v1/storage/{study.image_path}"
                s_status = status or study.status
                s_arrival_time = arrival_time or study.arrival_time
                s_ai_score = ai_score if ai_score is not None else study.ai_score
                s_ai_confidence = ai_confidence if ai_confidence is not None else study.ai_confidence
                s_priority_score = priority_score if priority_score is not None else study.priority_score
                s_priority_level = priority_level or study.priority_level
                s_image_quality_score = image_quality_score if image_quality_score is not None else study.image_quality_score
                s_manual_priority = manual_priority or study.manual_priority
                s_override_reason = override_reason or study.override_reason
                if factors is None and hasattr(study, "factors") and study.factors:
                    factors = [
                        {
                            "factor_name": f.factor_name,
                            "factor_value": f.factor_value,
                            "weight": f.weight,
                            "contribution": f.contribution,
                            "description": f.description
                        } for f in study.factors
                    ]
                if model_runs is None and hasattr(study, "model_runs") and study.model_runs:
                    model_runs = [
                        {
                            "model_name": r.model_name,
                            "model_version": r.model_version,
                            "score": r.score,
                            "confidence": r.confidence,
                            "processing_time_ms": r.processing_time_ms
                        } for r in study.model_runs
                    ]
            else:
                s_id = str(target)
                s_patient_id = patient_id
                s_patient_name = patient_name
                s_age = age
                s_sex = sex
                s_body_part = body_part or "Chest"
                s_clinical_notes = clinical_notes
                s_key_findings = key_findings
                s_uploaded_by = uploaded_by
                s_modality = modality or "X-RAY"
                s_image_path = image_path or ""
                s_image_url = image_url or f"/api/v1/storage/{s_image_path}"
                s_status = status or "PENDING_REVIEW"
                s_arrival_time = arrival_time or datetime.now(timezone.utc)
                s_ai_score = ai_score
                s_ai_confidence = ai_confidence
                s_priority_score = priority_score
                s_priority_level = priority_level
                s_image_quality_score = image_quality_score
                s_manual_priority = manual_priority
                s_override_reason = override_reason

            doc_ref = db.collection("studies").document(s_id)
            doc_data = {
                "study_id": s_id,
                "patient_id": s_patient_id,
                "patient_name": s_patient_name,
                "age": s_age,
                "sex": s_sex,
                "body_part": s_body_part,
                "clinical_notes": s_clinical_notes,
                "key_findings": s_key_findings,
                "uploaded_by": s_uploaded_by,
                "modality": s_modality,
                "image_path": s_image_path,
                "image_url": s_image_url,
                "status": s_status,
                "arrival_time": s_arrival_time.isoformat() if s_arrival_time else datetime.now(timezone.utc).isoformat(),
                "ai_score": s_ai_score,
                "ai_confidence": s_ai_confidence,
                "priority_score": s_priority_score,
                "priority_level": s_priority_level,
                "image_quality_score": s_image_quality_score,
                "manual_priority": s_manual_priority,
                "override_reason": s_override_reason,
                "synced_at": firestore.SERVER_TIMESTAMP,
            }
            if findings:
                doc_data["findings"] = findings
            if factors:
                doc_data["factors"] = factors
            if model_runs:
                doc_data["model_runs"] = model_runs

            doc_ref.set(doc_data, merge=True)
            logger.info(f"[FirebaseSync] Synced study {s_id} ({s_patient_name}) to Firestore.")
        except Exception as e:
            logger.warning(f"[FirebaseSync] Could not sync study {study_or_id} to Firestore: {e}")

    @staticmethod
    def log_review(
        study_id: str,
        action: str,
        reviewer_id: Optional[str],
        review_status: Optional[str],
        notes: Optional[str]
    ):
        db = get_firestore_db()
        if not db:
            return

        try:
            log_ref = db.collection("studies").document(study_id).collection("review_logs").document()
            log_ref.set({
                "action": action,
                "reviewer_id": reviewer_id,
                "review_status": review_status,
                "notes": notes,
                "timestamp": firestore.SERVER_TIMESTAMP,
            })
            logger.info(f"[FirebaseSync] Synced review log for {study_id} ({action}) to Firestore.")
        except Exception as e:
            logger.warning(f"[FirebaseSync] Could not sync review log for {study_id}: {e}")

    @staticmethod
    def delete_study(study_id: str):
        db = get_firestore_db()
        if not db:
            return
        try:
            doc_ref = db.collection("studies").document(study_id)
            # Remove nested review_logs
            for log_doc in doc_ref.collection("review_logs").stream():
                log_doc.reference.delete()
            doc_ref.delete()
            logger.info(f"[FirebaseSync] Successfully removed study {study_id} from Firestore.")
        except Exception as e:
            logger.warning(f"[FirebaseSync] Could not delete study {study_id} from Firestore: {e}")
