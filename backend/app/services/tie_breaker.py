from datetime import datetime, timezone
from typing import Optional, List, Any, Tuple
from sqlalchemy import desc, asc, func, case, or_

# Configurable clinical urgency category rankings
URGENCY_RANKINGS = {
    "CRITICAL": 4,
    "STAT": 4,
    "HIGH": 3,
    "MEDIUM": 2,
    "STANDARD": 1,
    "LOW": 1,
}

# Configurable high-acuity radiological indicators
CRITICAL_FINDING_KEYWORDS = [
    "pneumothorax",
    "hemorrhage",
    "perforation",
    "tension",
    "stat",
    "acute",
    "urgent",
    "critical",
    "emergency"
]


def get_urgency_rank(manual_priority: Optional[str] = None, priority_level: Optional[str] = None) -> int:
    """
    Returns integer rank for clinical urgency.
    Radiologist manual override takes absolute precedence over initial AI category.
    """
    cat = (manual_priority or priority_level or "STANDARD").upper().strip()
    return URGENCY_RANKINGS.get(cat, 1)


def check_critical_finding(key_findings: Optional[str] = None, clinical_notes: Optional[str] = None) -> bool:
    """
    Inspects verified clinical fields for life-critical or acute urgent indicators.
    """
    combined_text = f"{key_findings or ''} {clinical_notes or ''}".lower()
    return any(keyword in combined_text for keyword in CRITICAL_FINDING_KEYWORDS)


def build_queue_order_by(model: Any) -> List[Any]:
    """
    Builds the 6-tier deterministic SQLAlchemy ORDER BY clause:
      1. Primary Priority Score DESC (highest first)
      2. Clinical Urgency Category DESC (manual override takes precedence)
      3. Critical / Urgent Finding Indicator DESC (1 if acute/critical finding present, else 0)
      4. Arrival Time ASC (Earlier arrival = longer waiting time in queue)
      5. Study ID ASC (Deterministic string tie-breaker)
      6. Primary Key ID ASC (Absolute final database tie-breaker)
    """
    # 2. Urgency category ranking
    urgency_col = func.coalesce(model.manual_priority, model.priority_level)
    urgency_rank = case(
        (func.upper(urgency_col).in_(["CRITICAL", "STAT"]), 4),
        (func.upper(urgency_col) == "HIGH", 3),
        (func.upper(urgency_col) == "MEDIUM", 2),
        (func.upper(urgency_col).in_(["STANDARD", "LOW"]), 1),
        else_=0
    )

    # 3. Critical / urgent finding indicator
    finding_checks = [
        func.lower(func.coalesce(model.key_findings, "")).like(f"%{kw}%")
        for kw in CRITICAL_FINDING_KEYWORDS
    ] + [
        func.lower(func.coalesce(model.clinical_notes, "")).like(f"%{kw}%")
        for kw in CRITICAL_FINDING_KEYWORDS
    ]
    critical_indicator = case(
        (or_(*finding_checks), 1),
        else_=0
    )

    return [
        desc(func.coalesce(model.priority_score, 0.0)),
        desc(urgency_rank),
        desc(critical_indicator),
        asc(model.arrival_time),
        asc(model.study_id),
        asc(model.id)
    ]


def resolve_tie_explanation(
    prev_study: Any,
    curr_study: Any,
    prev_wait_mins: float = 0.0,
    curr_wait_mins: float = 0.0
) -> Optional[str]:
    """
    Compares two studies that have identical primary priority scores and explains
    the exact clinical rule that broke the tie between them.
    """
    score_a = round(getattr(prev_study, "priority_score", 0.0) or 0.0, 2)
    score_b = round(getattr(curr_study, "priority_score", 0.0) or 0.0, 2)

    # If scores are different, there is no tie
    if abs(score_a - score_b) > 0.001:
        return None

    # Rule 2: Clinical Urgency Category
    rank_a = get_urgency_rank(getattr(prev_study, "manual_priority", None), getattr(prev_study, "priority_level", None))
    rank_b = get_urgency_rank(getattr(curr_study, "manual_priority", None), getattr(curr_study, "priority_level", None))
    if rank_a != rank_b:
        cat_a = (getattr(prev_study, "manual_priority", None) or getattr(prev_study, "priority_level", None) or "Standard").upper()
        cat_b = (getattr(curr_study, "manual_priority", None) or getattr(curr_study, "priority_level", None) or "Standard").upper()
        return f"Clinical Urgency ({cat_a} vs {cat_b})"

    # Rule 3: Critical / Urgent Finding Indicator
    crit_a = check_critical_finding(getattr(prev_study, "key_findings", None), getattr(prev_study, "clinical_notes", None))
    crit_b = check_critical_finding(getattr(curr_study, "key_findings", None), getattr(curr_study, "clinical_notes", None))
    if crit_a != crit_b:
        return "Critical/Urgent Finding Flag"

    # Rule 4: Waiting Time (patient waiting longer gets higher priority)
    diff_mins = round(prev_wait_mins - curr_wait_mins, 1)
    if abs(diff_mins) >= 1.0:
        return f"Waiting Time ({round(prev_wait_mins)}m vs {round(curr_wait_mins)}m)"

    # Rule 5: Arrival Timestamp (earlier arrival gets priority)
    arr_a = getattr(prev_study, "arrival_time", None)
    arr_b = getattr(curr_study, "arrival_time", None)
    if arr_a and arr_b and arr_a != arr_b:
        fmt_a = arr_a.strftime("%H:%M") if hasattr(arr_a, "strftime") else str(arr_a)
        fmt_b = arr_b.strftime("%H:%M") if hasattr(arr_b, "strftime") else str(arr_b)
        return f"Arrival Time ({fmt_a} vs {fmt_b})"

    # Rule 6: Unique ID
    id_a = getattr(prev_study, "study_id", "") or str(getattr(prev_study, "id", ""))
    id_b = getattr(curr_study, "study_id", "") or str(getattr(curr_study, "id", ""))
    return f"Unique ID ({id_a})"
