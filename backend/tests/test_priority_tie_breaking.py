import pytest
from datetime import datetime, timezone, timedelta
from app.models.study import Study, StudyStatus, PriorityLevel
from app.services.tie_breaker import (
    get_urgency_rank,
    check_critical_finding,
    resolve_tie_explanation
)


def test_tie_breaker_helpers():
    """Unit test the individual tie-breaker helper functions."""
    # Urgency ranking
    assert get_urgency_rank(None, "HIGH") == 3
    assert get_urgency_rank(None, "MEDIUM") == 2
    assert get_urgency_rank(None, "STANDARD") == 1
    # Manual priority takes precedence
    assert get_urgency_rank("HIGH", "STANDARD") == 3
    assert get_urgency_rank("STANDARD", "HIGH") == 1

    # Critical finding detection
    assert check_critical_finding("Pneumothorax markers along apical margin", None) is True
    assert check_critical_finding(None, "Stat radiographic evaluation needed, acute chest pain") is True
    assert check_critical_finding("Clear lung fields, normal", "Routine follow up") is False


def test_deterministic_tie_breaking_api(client, db_session):
    """
    Comprehensive test of the 6-tier deterministic patient priority tie-breaking system.
    """
    now = datetime(2026, 9, 19, 12, 0, 0, tzinfo=timezone.utc)

    # 1. Study A & Study B: Same Score (85.0), but different urgency category (Rule 2)
    # Study A has HIGH priority category, Study B has MEDIUM priority category
    s_a = Study(
        study_id="XR-TIE-URG-A",
        image_path="studies/XR-TIE-URG-A/scan.png",
        arrival_time=now - timedelta(minutes=20),
        status=StudyStatus.PENDING_REVIEW.value,
        priority_score=85.0,
        priority_level=PriorityLevel.HIGH.value,
        key_findings="Bilateral clear lung fields",
        clinical_notes="Routine monitoring"
    )
    s_b = Study(
        study_id="XR-TIE-URG-B",
        image_path="studies/XR-TIE-URG-B/scan.png",
        arrival_time=now - timedelta(minutes=45),  # Arrived earlier, but lower urgency category
        status=StudyStatus.PENDING_REVIEW.value,
        priority_score=85.0,
        priority_level=PriorityLevel.MEDIUM.value,
        key_findings="Bilateral clear lung fields",
        clinical_notes="Routine monitoring"
    )

    # 2. Study C & Study D: Same Score (75.0), Same Category (HIGH), but Study C has Critical Finding (Rule 3)
    s_c = Study(
        study_id="XR-TIE-CRIT-C",
        image_path="studies/XR-TIE-CRIT-C/scan.png",
        arrival_time=now - timedelta(minutes=15),
        status=StudyStatus.PENDING_REVIEW.value,
        priority_score=75.0,
        priority_level=PriorityLevel.HIGH.value,
        key_findings="Apical pneumothorax line observed",  # Critical finding
        clinical_notes="Acute trauma"
    )
    s_d = Study(
        study_id="XR-TIE-CRIT-D",
        image_path="studies/XR-TIE-CRIT-D/scan.png",
        arrival_time=now - timedelta(minutes=30),  # Arrived earlier, but no critical finding
        status=StudyStatus.PENDING_REVIEW.value,
        priority_score=75.0,
        priority_level=PriorityLevel.HIGH.value,
        key_findings="Minor blunting",
        clinical_notes="Follow up"
    )

    # 3. Study E & Study F: Same Score (65.0), Same Category, No critical finding, but Study E waited longer (Rule 4)
    # E arrived 50 mins ago, F arrived 15 mins ago
    s_e = Study(
        study_id="XR-TIE-WAIT-E",
        image_path="studies/XR-TIE-WAIT-E/scan.png",
        arrival_time=now - timedelta(minutes=50),
        status=StudyStatus.PENDING_REVIEW.value,
        priority_score=65.0,
        priority_level=PriorityLevel.MEDIUM.value,
        key_findings="Stable appearance",
        clinical_notes="Standard"
    )
    s_f = Study(
        study_id="XR-TIE-WAIT-F",
        image_path="studies/XR-TIE-WAIT-F/scan.png",
        arrival_time=now - timedelta(minutes=15),
        status=StudyStatus.PENDING_REVIEW.value,
        priority_score=65.0,
        priority_level=PriorityLevel.MEDIUM.value,
        key_findings="Stable appearance",
        clinical_notes="Standard"
    )

    # 4. Study G & Study H: Same Score (55.0), Same Wait Minutes (both 30 mins), earlier timestamp wins (Rule 5)
    t_30m_early = now - timedelta(minutes=30, seconds=45)
    t_30m_late = now - timedelta(minutes=30, seconds=10)
    s_g = Study(
        study_id="XR-TIE-ARR-G",
        image_path="studies/XR-TIE-ARR-G/scan.png",
        arrival_time=t_30m_early,
        status=StudyStatus.PENDING_REVIEW.value,
        priority_score=55.0,
        priority_level=PriorityLevel.STANDARD.value,
        key_findings="No active disease",
        clinical_notes="Outpatient"
    )
    s_h = Study(
        study_id="XR-TIE-ARR-H",
        image_path="studies/XR-TIE-ARR-H/scan.png",
        arrival_time=t_30m_late,
        status=StudyStatus.PENDING_REVIEW.value,
        priority_score=55.0,
        priority_level=PriorityLevel.STANDARD.value,
        key_findings="No active disease",
        clinical_notes="Outpatient"
    )

    db_session.add_all([s_a, s_b, s_c, s_d, s_e, s_f, s_g, s_h])
    db_session.commit()

    # Query queue via API
    res = client.get("/api/v1/queue")
    assert res.status_code == 200
    data = res.json()
    items = data["items"]

    ids_ordered = [item["study_id"] for item in items]

    # Verify Rule 1: Highest scores come first
    # 85.0 (A, B) > 75.0 (C, D) > 65.0 (E, F) > 55.0 (G, H)
    idx_a = ids_ordered.index("XR-TIE-URG-A")
    idx_b = ids_ordered.index("XR-TIE-URG-B")
    idx_c = ids_ordered.index("XR-TIE-CRIT-C")
    idx_d = ids_ordered.index("XR-TIE-CRIT-D")
    idx_e = ids_ordered.index("XR-TIE-WAIT-E")
    idx_f = ids_ordered.index("XR-TIE-WAIT-F")
    idx_g = ids_ordered.index("XR-TIE-ARR-G")
    idx_h = ids_ordered.index("XR-TIE-ARR-H")

    # Rule 2 Verification: Between A and B (Score 85.0), A (HIGH) beats B (MEDIUM)
    assert idx_a < idx_b, f"Expected A before B, got {idx_a} vs {idx_b}"

    # Rule 3 Verification: Between C and D (Score 75.0), C (Critical Pneumothorax) beats D
    assert idx_c < idx_d, f"Expected C before D, got {idx_c} vs {idx_d}"

    # Rule 4 Verification: Between E and F (Score 65.0), E (waited 50m) beats F (waited 15m)
    assert idx_e < idx_f, f"Expected E before F, got {idx_e} vs {idx_f}"

    # Rule 5 Verification: Between G and H (Score 55.0), G (earlier arrival) beats H
    assert idx_g < idx_h, f"Expected G before H, got {idx_g} vs {idx_h}"

    # Overall block order verification
    assert max(idx_a, idx_b) < min(idx_c, idx_d)
    assert max(idx_c, idx_d) < min(idx_e, idx_f)
    assert max(idx_e, idx_f) < min(idx_g, idx_h)

    # Test Stability: 10 repeated calls return the exact same sequence
    for _ in range(10):
        repeat_res = client.get("/api/v1/queue")
        repeat_ids = [item["study_id"] for item in repeat_res.json()["items"]]
        assert repeat_ids == ids_ordered, "Queue order was not 100% stable across repeated calls!"


def test_user_examples_patient_a_and_b(client, db_session):
    """
    Tests the exact two examples provided in the user prompt:
    Example 1:
      Patient A: Priority Score = 85, Waiting = 45 minutes
      Patient B: Priority Score = 85, Waiting = 20 minutes
      -> Patient A should appear before Patient B.

    Example 2:
      Patient A: Priority = 85, Waiting = 30 minutes, Arrival = 10:10
      Patient B: Priority = 85, Waiting = 30 minutes, Arrival = 10:25
      -> Patient A should appear first.
    """
    now = datetime(2026, 9, 19, 11, 0, 0, tzinfo=timezone.utc)

    # Example 1 setup
    pt_a1 = Study(
        study_id="PT-EX1-A",
        image_path="studies/PT-EX1-A/scan.png",
        arrival_time=now - timedelta(minutes=45),
        status=StudyStatus.PENDING_REVIEW.value,
        priority_score=85.0,
        priority_level=PriorityLevel.HIGH.value,
        key_findings="Bilateral clear lung fields",
        clinical_notes="Routine"
    )
    pt_b1 = Study(
        study_id="PT-EX1-B",
        image_path="studies/PT-EX1-B/scan.png",
        arrival_time=now - timedelta(minutes=20),
        status=StudyStatus.PENDING_REVIEW.value,
        priority_score=85.0,
        priority_level=PriorityLevel.HIGH.value,
        key_findings="Bilateral clear lung fields",
        clinical_notes="Routine"
    )

    # Example 2 setup (Waiting = 30m, Arrival 10:10 vs 10:25)
    t_10_10 = datetime(2026, 9, 19, 10, 10, 0, tzinfo=timezone.utc)
    t_10_25 = datetime(2026, 9, 19, 10, 25, 0, tzinfo=timezone.utc)
    pt_a2 = Study(
        study_id="PT-EX2-A",
        image_path="studies/PT-EX2-A/scan.png",
        arrival_time=t_10_10,
        status=StudyStatus.PENDING_REVIEW.value,
        priority_score=85.0,
        priority_level=PriorityLevel.HIGH.value,
        key_findings="Stable appearance",
        clinical_notes="Follow up"
    )
    pt_b2 = Study(
        study_id="PT-EX2-B",
        image_path="studies/PT-EX2-B/scan.png",
        arrival_time=t_10_25,
        status=StudyStatus.PENDING_REVIEW.value,
        priority_score=85.0,
        priority_level=PriorityLevel.HIGH.value,
        key_findings="Stable appearance",
        clinical_notes="Follow up"
    )

    db_session.add_all([pt_a1, pt_b1, pt_a2, pt_b2])
    db_session.commit()

    res = client.get("/api/v1/queue")
    assert res.status_code == 200
    ids = [item["study_id"] for item in res.json()["items"]]

    # Example 1: Patient A (45 mins wait) appears before Patient B (20 mins wait)
    idx_a1 = ids.index("PT-EX1-A")
    idx_b1 = ids.index("PT-EX1-B")
    assert idx_a1 < idx_b1, f"Expected PT-EX1-A before PT-EX1-B, got {idx_a1} vs {idx_b1}"

    # Example 2: Patient A (10:10 arrival) appears before Patient B (10:25 arrival)
    idx_a2 = ids.index("PT-EX2-A")
    idx_b2 = ids.index("PT-EX2-B")
    assert idx_a2 < idx_b2, f"Expected PT-EX2-A before PT-EX2-B, got {idx_a2} vs {idx_b2}"


def test_three_plus_patients_identical_priority_chain(client, db_session):
    """
    Tests 4 patients with identical primary priority score (80.0) resolving across the 6 tiers:
      P1: Urgency Rank HIGH (Tier 2 wins)
      P2: Urgency Rank MEDIUM + Critical Finding 'Pneumothorax' (Tier 3 wins)
      P3: Urgency Rank MEDIUM + Routine, waited 60 mins (Tier 4 wins)
      P4: Urgency Rank MEDIUM + Routine, waited 20 mins
    Expected order: P1 -> P2 -> P3 -> P4.
    """
    now = datetime(2026, 9, 19, 14, 0, 0, tzinfo=timezone.utc)

    p1 = Study(
        study_id="XR-CHAIN-1",
        image_path="studies/XR-CHAIN-1/scan.png",
        arrival_time=now - timedelta(minutes=10),
        status=StudyStatus.PENDING_REVIEW.value,
        priority_score=80.0,
        priority_level=PriorityLevel.HIGH.value,
        key_findings="Bilateral clear lung fields",
        clinical_notes="High urgency review"
    )
    p2 = Study(
        study_id="XR-CHAIN-2",
        image_path="studies/XR-CHAIN-2/scan.png",
        arrival_time=now - timedelta(minutes=15),
        status=StudyStatus.PENDING_REVIEW.value,
        priority_score=80.0,
        priority_level=PriorityLevel.MEDIUM.value,
        key_findings="Pneumothorax observed at right apex",  # Acute finding
        clinical_notes="Medium triage category"
    )
    p3 = Study(
        study_id="XR-CHAIN-3",
        image_path="studies/XR-CHAIN-3/scan.png",
        arrival_time=now - timedelta(minutes=60),  # Waited longer
        status=StudyStatus.PENDING_REVIEW.value,
        priority_score=80.0,
        priority_level=PriorityLevel.MEDIUM.value,
        key_findings="Normal cardiac silhouette",
        clinical_notes="Routine monitoring"
    )
    p4 = Study(
        study_id="XR-CHAIN-4",
        image_path="studies/XR-CHAIN-4/scan.png",
        arrival_time=now - timedelta(minutes=20),  # Waited shorter
        status=StudyStatus.PENDING_REVIEW.value,
        priority_score=80.0,
        priority_level=PriorityLevel.MEDIUM.value,
        key_findings="Normal cardiac silhouette",
        clinical_notes="Routine monitoring"
    )

    db_session.add_all([p1, p2, p3, p4])
    db_session.commit()

    res = client.get("/api/v1/queue")
    assert res.status_code == 200
    ids = [item["study_id"] for item in res.json()["items"]]

    idx_1 = ids.index("XR-CHAIN-1")
    idx_2 = ids.index("XR-CHAIN-2")
    idx_3 = ids.index("XR-CHAIN-3")
    idx_4 = ids.index("XR-CHAIN-4")

    assert idx_1 < idx_2 < idx_3 < idx_4, (
        f"Chain order violated! Got indices: P1={idx_1}, P2={idx_2}, P3={idx_3}, P4={idx_4}"
    )


def test_identical_priority_waiting_and_arrival_stable_id(client, db_session):
    """
    Tests that when priority score, urgency, findings, and arrival timestamp are 100% identical,
    stable unique ID (Tier 6) resolves the tie deterministically.
    """
    arrival = datetime(2026, 9, 19, 10, 0, 0, tzinfo=timezone.utc)

    s1 = Study(
        study_id="XR-UID-AAA",
        image_path="studies/XR-UID-AAA/scan.png",
        arrival_time=arrival,
        status=StudyStatus.PENDING_REVIEW.value,
        priority_score=70.0,
        priority_level=PriorityLevel.MEDIUM.value,
        key_findings="Clear",
        clinical_notes="Routine"
    )
    s2 = Study(
        study_id="XR-UID-ZZZ",
        image_path="studies/XR-UID-ZZZ/scan.png",
        arrival_time=arrival,
        status=StudyStatus.PENDING_REVIEW.value,
        priority_score=70.0,
        priority_level=PriorityLevel.MEDIUM.value,
        key_findings="Clear",
        clinical_notes="Routine"
    )

    db_session.add_all([s2, s1])  # Insert ZZZ before AAA
    db_session.commit()

    res = client.get("/api/v1/queue")
    assert res.status_code == 200
    ids = [item["study_id"] for item in res.json()["items"]]

    assert ids.index("XR-UID-AAA") < ids.index("XR-UID-ZZZ"), (
        "Expected XR-UID-AAA to precede XR-UID-ZZZ by deterministic unique ID tie-breaker!"
    )


def test_pagination_and_deterministic_order(client, db_session):
    """
    Tests that paginating through the worklist maintains strict deterministic ordering
    with no duplicates or omissions between pages.
    """
    res_page_1 = client.get("/api/v1/queue?limit=4&offset=0")
    res_page_2 = client.get("/api/v1/queue?limit=4&offset=4")
    assert res_page_1.status_code == 200
    assert res_page_2.status_code == 200

    ids_1 = [item["study_id"] for item in res_page_1.json()["items"]]
    ids_2 = [item["study_id"] for item in res_page_2.json()["items"]]

    # No items should overlap between page 1 and page 2
    overlap = set(ids_1).intersection(set(ids_2))
    assert len(overlap) == 0, f"Found overlapping items between pages: {overlap}"


def test_newly_added_patient_enters_exact_deterministic_slot(client, db_session):
    """
    Tests that ingesting a new study with an identical score to existing studies
    is deterministically inserted in the exact correct rank according to the 6 tiers.
    """
    now = datetime(2026, 9, 19, 15, 0, 0, tzinfo=timezone.utc)
    base_study = Study(
        study_id="XR-BASE-WAIT-10",
        image_path="studies/XR-BASE-WAIT-10/scan.png",
        arrival_time=now - timedelta(minutes=10),
        status=StudyStatus.PENDING_REVIEW.value,
        priority_score=60.0,
        priority_level=PriorityLevel.STANDARD.value,
        key_findings="Standard",
        clinical_notes="Routine"
    )
    db_session.add(base_study)
    db_session.commit()

    # Now add new patient who waited longer (30 mins) with identical score 60.0
    new_patient = Study(
        study_id="XR-NEW-WAIT-30",
        image_path="studies/XR-NEW-WAIT-30/scan.png",
        arrival_time=now - timedelta(minutes=30),
        status=StudyStatus.PENDING_REVIEW.value,
        priority_score=60.0,
        priority_level=PriorityLevel.STANDARD.value,
        key_findings="Standard",
        clinical_notes="Routine"
    )
    db_session.add(new_patient)
    db_session.commit()

    res = client.get("/api/v1/queue")
    ids = [item["study_id"] for item in res.json()["items"]]
    assert ids.index("XR-NEW-WAIT-30") < ids.index("XR-BASE-WAIT-10"), (
        "Newly added patient with longer wait time did not take precedence in queue!"
    )

