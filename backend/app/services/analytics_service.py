from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.study import Study, StudyStatus, PriorityLevel
from app.models.model_run import ModelRun
from app.schemas.analytics import (
    AnalyticsOverviewResponse,
    StatusCountBreakdown,
    PriorityCountBreakdown,
    QueueComparisonResponse,
    QueueComparisonItem
)


class AnalyticsService:
    def get_overview(self, db: Session, user_id: Optional[str] = None) -> AnalyticsOverviewResponse:
        query = db.query(Study)
        if user_id:
            query = query.filter(Study.uploaded_by == user_id)
        studies = query.all()
        total = len(studies)

        status_counts = StatusCountBreakdown()
        priority_counts = PriorityCountBreakdown()

        ai_scores = []
        priority_scores = []
        waiting_times = []
        now = datetime.now(timezone.utc)

        for s in studies:
            # Status
            st = (s.status or "").upper()
            if st == StudyStatus.PENDING_REVIEW.value:
                status_counts.pending_review += 1
            elif st == StudyStatus.IN_REVIEW.value:
                status_counts.in_review += 1
            elif st == StudyStatus.REVIEWED.value:
                status_counts.reviewed += 1
            elif st == StudyStatus.FAILED.value:
                status_counts.failed += 1

            # Priority (check manual override first, then algorithmic)
            p_level = (s.manual_priority or s.priority_level or "").upper()
            if p_level == PriorityLevel.HIGH.value:
                priority_counts.high += 1
            elif p_level == PriorityLevel.MEDIUM.value:
                priority_counts.medium += 1
            elif p_level == PriorityLevel.STANDARD.value:
                priority_counts.standard += 1

            if s.ai_score is not None:
                ai_scores.append(s.ai_score)
            if s.priority_score is not None:
                priority_scores.append(s.priority_score)

            if st in (StudyStatus.PENDING_REVIEW.value, StudyStatus.IN_REVIEW.value) and s.arrival_time:
                arr = s.arrival_time
                if arr.tzinfo is None:
                    arr = arr.replace(tzinfo=timezone.utc)
                mins = max(0.0, (now - arr).total_seconds() / 60.0)
                waiting_times.append(mins)

        # Average model run latency
        avg_latency = db.query(func.avg(ModelRun.processing_time_ms)).scalar() or 0.0

        avg_ai = round(sum(ai_scores) / len(ai_scores), 2) if ai_scores else 0.0
        avg_pri = round(sum(priority_scores) / len(priority_scores), 2) if priority_scores else 0.0
        avg_wait = round(sum(waiting_times) / len(waiting_times), 1) if waiting_times else 0.0
        high_pct = round((priority_counts.high / total * 100.0), 1) if total > 0 else 0.0

        return AnalyticsOverviewResponse(
            total_studies=total,
            status_counts=status_counts,
            priority_counts=priority_counts,
            average_ai_score=avg_ai,
            average_priority_score=avg_pri,
            average_latency_ms=round(float(avg_latency), 2),
            average_waiting_minutes=avg_wait,
            high_priority_percentage=high_pct
        )

    def get_queue_comparison(self, db: Session, minutes_per_study: float = 8.0, user_id: Optional[str] = None) -> QueueComparisonResponse:
        """
        Compares naive FIFO arrival ordering against RadiX AI clinical priority ordering.
        Computes exact rank improvements and simulated patient triage time saved.
        """
        query = db.query(Study).filter(
            Study.status.in_([StudyStatus.PENDING_REVIEW.value, StudyStatus.IN_REVIEW.value])
        )
        if user_id:
            query = query.filter(Study.uploaded_by == user_id)
        active_studies = query.all()

        if not active_studies:
            return QueueComparisonResponse(
                total_queued=0,
                high_priority_count=0,
                avg_rank_improvement_high_priority=0.0,
                max_rank_improvement=0,
                estimated_time_saved_minutes_critical=0.0,
                items=[]
            )

        # 1. FIFO ranking (arrival_time ASC)
        fifo_sorted = sorted(
            active_studies,
            key=lambda s: s.arrival_time.replace(tzinfo=timezone.utc) if s.arrival_time and s.arrival_time.tzinfo is None else (s.arrival_time or datetime.min.replace(tzinfo=timezone.utc))
        )
        fifo_rank_map = {s.study_id: idx + 1 for idx, s in enumerate(fifo_sorted)}

        # 2. RadiX AI priority ranking (priority_score DESC, arrival_time ASC)
        priority_sorted = sorted(
            active_studies,
            key=lambda s: (
                -(s.priority_score if s.priority_score is not None else -1.0),
                s.arrival_time.replace(tzinfo=timezone.utc) if s.arrival_time and s.arrival_time.tzinfo is None else (s.arrival_time or datetime.min.replace(tzinfo=timezone.utc))
            )
        )

        items: List[QueueComparisonItem] = []
        high_priority_improvements = []
        all_improvements = []

        for p_idx, s in enumerate(priority_sorted):
            p_rank = p_idx + 1
            f_rank = fifo_rank_map[s.study_id]
            delta = f_rank - p_rank  # Positive = moved earlier/up in queue
            all_improvements.append(delta)

            level = (s.manual_priority or s.priority_level or "STANDARD").upper()
            if level == PriorityLevel.HIGH.value:
                high_priority_improvements.append(delta)

            items.append(QueueComparisonItem(
                study_id=s.study_id,
                priority_level=level,
                ai_score=s.ai_score,
                priority_score=s.priority_score,
                fifo_rank=f_rank,
                priority_rank=p_rank,
                rank_delta=delta
            ))

        high_count = len(high_priority_improvements)
        avg_high_gain = round(sum(high_priority_improvements) / high_count, 2) if high_count > 0 else 0.0
        max_gain = max(all_improvements) if all_improvements else 0
        time_saved = round(avg_high_gain * minutes_per_study, 1)

        return QueueComparisonResponse(
            total_queued=len(active_studies),
            high_priority_count=high_count,
            avg_rank_improvement_high_priority=avg_high_gain,
            max_rank_improvement=max_gain,
            estimated_time_saved_minutes_critical=max(0.0, time_saved),
            items=items
        )
