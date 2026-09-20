from datetime import datetime, timezone
from typing import Dict, List, Tuple
from sqlalchemy.orm import Session
from app.models.study import Study, PriorityLevel, StudyStatus
from app.models.priority import PriorityFactor
from app.core.logging import logger

# Configurable prototype weights
WEIGHT_AI = 0.70
WEIGHT_CONFIDENCE = 0.10
WEIGHT_WAITING = 0.10
WEIGHT_QUALITY = 0.10

# Thresholds
THRESHOLD_HIGH = 80.0
THRESHOLD_MEDIUM = 50.0

# Max waiting window in hours before waiting_score caps at 100.0
MAX_WAIT_HOURS = 10.0


class PriorityService:
    @staticmethod
    def calculate_waiting_score(arrival_time: datetime, current_time: datetime = None) -> Tuple[float, float]:
        """
        Calculates waiting score (0-100) and elapsed minutes based on time elapsed since study arrival.
        Waiting score is strictly capped at 100.0.
        """
        now = current_time or datetime.now(timezone.utc)
        
        # Ensure timezone compatibility
        if arrival_time.tzinfo is None and now.tzinfo is not None:
            arrival_time = arrival_time.replace(tzinfo=timezone.utc)
        elif arrival_time.tzinfo is not None and now.tzinfo is None:
            now = now.replace(tzinfo=timezone.utc)

        elapsed_seconds = max(0.0, (now - arrival_time).total_seconds())
        elapsed_minutes = elapsed_seconds / 60.0
        elapsed_hours = elapsed_seconds / 3600.0

        # Linear progression up to MAX_WAIT_HOURS, strictly capped at 100.0
        waiting_score = min(100.0, (elapsed_hours / MAX_WAIT_HOURS) * 100.0)
        return round(waiting_score, 1), round(elapsed_minutes, 1)

    @staticmethod
    def classify_priority_level(score: float) -> str:
        """Converts a numerical priority score (0-100) into clinical urgency categories."""
        if score >= THRESHOLD_HIGH:
            return PriorityLevel.HIGH.value
        elif score >= THRESHOLD_MEDIUM:
            return PriorityLevel.MEDIUM.value
        else:
            return PriorityLevel.STANDARD.value

    def compute_priority(
        self,
        ai_score: float,
        confidence: float,
        waiting_score: float,
        quality_score: float
    ) -> Tuple[float, str, List[Dict]]:
        """
        Computes the composite priority score, priority level, and detailed factor contributions.
        Formula:
            priority_score = (ai_score * 0.70) + (confidence * 0.10) + (waiting_score * 0.10) + (quality_score * 0.10)
        """
        # Clamp inputs to 0.0 - 100.0 range
        ai = max(0.0, min(100.0, ai_score))
        conf = max(0.0, min(100.0, confidence))
        wait = max(0.0, min(100.0, waiting_score))
        qual = max(0.0, min(100.0, quality_score))

        c_ai = round(ai * WEIGHT_AI, 2)
        c_conf = round(conf * WEIGHT_CONFIDENCE, 2)
        c_wait = round(wait * WEIGHT_WAITING, 2)
        c_qual = round(qual * WEIGHT_QUALITY, 2)

        total_score = round(c_ai + c_conf + c_wait + c_qual, 1)
        priority_level = self.classify_priority_level(total_score)

        factors = [
            {
                "factor_name": "AI_SIGNAL",
                "factor_value": ai,
                "weight": WEIGHT_AI,
                "contribution": c_ai,
                "description": f"AI pattern analysis urgency signal (detected priority: {ai}/100)"
            },
            {
                "factor_name": "CONFIDENCE",
                "factor_value": conf,
                "weight": WEIGHT_CONFIDENCE,
                "contribution": c_conf,
                "description": f"Model inference certainty metric ({conf}%)"
            },
            {
                "factor_name": "WAITING_TIME",
                "factor_value": wait,
                "weight": WEIGHT_WAITING,
                "contribution": c_wait,
                "description": f"Waiting-time fairness adjustment (capped bonus: {c_wait} pts)"
            },
            {
                "factor_name": "IMAGE_QUALITY",
                "factor_value": qual,
                "weight": WEIGHT_QUALITY,
                "contribution": c_qual,
                "description": f"Technical diagnostic quality and clarity rating ({qual}/100)"
            }
        ]

        return total_score, priority_level, factors

    def calculate_and_save_priority(self, db: Session, study: Study, current_time: datetime = None) -> Study:
        """
        Calculates the priority score, updates the study record,
        and regenerates explainability factors in the priority_factors table.
        """
        ai_score = study.ai_score or 0.0
        confidence = study.ai_confidence or 0.0
        quality_score = study.image_quality_score or 95.0

        waiting_score, elapsed_minutes = self.calculate_waiting_score(study.arrival_time, current_time)

        total_score, priority_level, factors_data = self.compute_priority(
            ai_score=ai_score,
            confidence=confidence,
            waiting_score=waiting_score,
            quality_score=quality_score
        )

        # Update study attributes
        study.priority_score = total_score
        study.priority_level = priority_level
        if study.status in (StudyStatus.PROCESSING.value, StudyStatus.UPLOADED.value):
            study.status = StudyStatus.PENDING_REVIEW.value

        # Clear existing factors for this study to keep idempotent
        db.query(PriorityFactor).filter_by(study_id=study.study_id).delete()

        # Insert updated factors
        for f in factors_data:
            factor = PriorityFactor(
                study_id=study.study_id,
                factor_name=f["factor_name"],
                factor_value=f["factor_value"],
                weight=f["weight"],
                contribution=f["contribution"],
                description=f["description"]
            )
            db.add(factor)

        db.commit()
        db.refresh(study)
        logger.info(
            f"[PriorityService] Calculated priority for {study.study_id}: "
            f"score={total_score} ({priority_level}), wait={elapsed_minutes}m"
        )
        return study
