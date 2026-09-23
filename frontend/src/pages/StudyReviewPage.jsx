import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { Activity } from "lucide-react";
import StudyViewer from "../components/StudyViewer";
import PacsLoader from "../components/ui/PacsLoader";
import { studyService, getCurrentUserObj } from "../services/studyService";
import "./StudyReviewPage.css";

export const StudyReviewPage = () => {
  const { studyId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const isExplicitFromReviewed =
    searchParams.get("from") === "reviewed" || location.state?.from === "reviewed";

  const findStudy = (list, id) => {
    if (!list || list.length === 0) return null;
    if (!id) return list[0];
    const strId = String(id).trim().toLowerCase();
    const numId = parseInt(id, 10);
    return (
      list.find(
        (s) =>
          String(s.studyId || "").toLowerCase() === strId ||
          String(s.id) === strId ||
          (!isNaN(numId) && s.id === numId)
      ) || null
    );
  };

  const [allStudies, setAllStudies] = useState(() => studyService.getCachedStudies());

  // Initialize study immediately from cached data for zero-latency switching
  const [study, setStudy] = useState(() => {
    const cached = studyService.getCachedStudies();
    return findStudy(cached, studyId);
  });

  const [prevStudyId, setPrevStudyId] = useState(studyId);

  // Synchronize immediately if studyId changes during navigation
  if (studyId !== prevStudyId) {
    setPrevStudyId(studyId);
    const found = findStudy(allStudies, studyId);
    if (found) setStudy(found);
  }

  const isReviewedMode = useMemo(() => {
    if (isExplicitFromReviewed) return true;
    if (study?.status === "REVIEWED" || study?.status === "Reviewed") return true;
    return false;
  }, [isExplicitFromReviewed, study?.status]);

  useEffect(() => {
    let isMounted = true;

    async function fetchStudyData() {
      try {
        let loadedStudy = null;
        if (studyId) {
          loadedStudy = await studyService.getStudyById(studyId);
          if (isMounted && loadedStudy) {
            setStudy(loadedStudy);
          }
        }

        const isReviewed =
          isExplicitFromReviewed ||
          loadedStudy?.status === "REVIEWED" ||
          loadedStudy?.status === "Reviewed" ||
          study?.status === "REVIEWED" ||
          study?.status === "Reviewed";

        if (isReviewed) {
          // In Reviewed Archive context: Fetch exclusively the reviewed studies list
          const reviewedRes = await studyService.getReviewedStudies({ limit: 100 });
          if (isMounted && reviewedRes?.items && reviewedRes.items.length > 0) {
            setAllStudies(reviewedRes.items);
            if (!loadedStudy) {
              const matched = findStudy(reviewedRes.items, studyId);
              if (matched) setStudy(matched);
            }
          }
        } else {
          // In Active Triage Queue context: Fetch active worklist
          const queue = await studyService.getWorklistQueue({ limit: 100 });
          if (isMounted && queue?.studies && queue.studies.length > 0) {
            setAllStudies(queue.studies);
            if (!loadedStudy) {
              const matched = findStudy(queue.studies, studyId);
              if (matched) setStudy(matched);
            }
          }
        }
      } catch (err) {
        console.warn("StudyReviewPage fetch error:", err);
      }
    }

    fetchStudyData();
    return () => {
      isMounted = false;
    };
  }, [studyId, isExplicitFromReviewed]);

  const handleStartReview = async (id) => {
    await studyService.updateReviewStatus(id, "IN_REVIEW");
    setStudy((prev) => (prev ? { ...prev, status: "IN_REVIEW" } : prev));
    setAllStudies((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: "IN_REVIEW" } : s))
    );
  };

  const handleMarkReviewed = async (id) => {
    await studyService.updateReviewStatus(id, "REVIEWED");
    setStudy((prev) => (prev ? { ...prev, status: "Reviewed" } : prev));
    setAllStudies((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: "Reviewed" } : s))
    );
  };

  const handleRevertStudy = async (targetId) => {
    try {
      const res = await studyService.revertReviewedStudy(targetId);
      if (res && res.success === false) {
        alert(res.error || "Permission denied: Only the reviewing physician can reopen this study.");
        return;
      }
      navigate("/worklist");
    } catch (err) {
      console.error("Failed to revert study:", err);
      alert(err.response?.data?.detail || err.message || "Failed to revert study.");
    }
  };

  const handleOverridePriority = async (overrideData) => {
    const { studyId: sId, newPriority, reason } = overrideData;
    const activeUser = getCurrentUserObj();
    const activeDoctorName = activeUser?.name
      ? (activeUser.name.startsWith("Dr.") ? activeUser.name : `Dr. ${activeUser.name}`)
      : "Dr. Attending Radiologist, MD";
    await studyService.overrideStudyPriority(sId, { ...overrideData, overriddenBy: activeDoctorName });
    const overriddenAt = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const overrideObj = {
      originalPriority: study.priority,
      originalScore: study.priorityScore,
      newPriority,
      reason,
      overriddenBy: activeDoctorName,
      overriddenAt,
    };

    setStudy((prev) => (prev ? { ...prev, priority: newPriority, priorityLevel: newPriority.toUpperCase(), manualOverride: overrideObj } : prev));
    setAllStudies((prev) =>
      prev.map((s) =>
        s.id === sId
          ? { ...s, priority: newPriority, priorityLevel: newPriority.toUpperCase(), manualOverride: overrideObj }
          : s
      )
    );
  };

  const handleNextStudy = () => {
    if (!study || allStudies.length === 0) return;
    const currentIndex = allStudies.findIndex(
      (s) =>
        String(s?.studyId || s?.id).toLowerCase() === String(study?.studyId || study?.id).toLowerCase()
    );
    const nextIndex = (currentIndex + 1) % allStudies.length;
    const nextStudy = allStudies[nextIndex];
    const nextKey = nextStudy.studyId || nextStudy.id;
    navigate(`/study/${nextKey}${isReviewedMode ? "?from=reviewed" : ""}`, {
      state: isReviewedMode ? { from: "reviewed" } : undefined,
    });
  };

  const handlePrevStudy = () => {
    if (!study || allStudies.length === 0) return;
    const currentIndex = allStudies.findIndex(
      (s) =>
        String(s?.studyId || s?.id).toLowerCase() === String(study?.studyId || study?.id).toLowerCase()
    );
    const prevIndex = (currentIndex - 1 + allStudies.length) % allStudies.length;
    const prevStudy = allStudies[prevIndex];
    const prevKey = prevStudy.studyId || prevStudy.id;
    navigate(`/study/${prevKey}${isReviewedMode ? "?from=reviewed" : ""}`, {
      state: isReviewedMode ? { from: "reviewed" } : undefined,
    });
  };

  const handleDeleteStudy = async () => {
    if (!study) return;
    const targetKey = study.studyId || study.id;
    try {
      const res = await studyService.deleteStudy(targetKey);
      if (res && res.error) {
        alert(`Deletion denied: ${res.error}`);
        return;
      }
      if (isReviewedMode) {
        navigate("/reviewed");
      } else {
        navigate("/worklist");
      }
    } catch (err) {
      console.error("Failed to delete study:", err);
      alert(err.message || "Failed to delete study");
    }
  };

  const handleBackNavigation = () => {
    if (isReviewedMode) {
      navigate("/reviewed");
    } else {
      navigate("/worklist");
    }
  };

  if (!study) {
    return (
      <PacsLoader
        title="Acquiring DICOM Diagnostic Series"
        subtitle="Streaming 16-bit PACS series & synthesizing AI priority vectors..."
      />
    );
  }

  const currentStudyIndex =
    allStudies.findIndex(
      (s) =>
        String(s?.studyId || s?.id).toLowerCase() === String(study?.studyId || study?.id).toLowerCase()
    ) + 1;

  return (
    <div className="study-review-page-container">
      <StudyViewer
        study={study}
        onStartReview={handleStartReview}
        onMarkReviewed={handleMarkReviewed}
        onRevertStudy={isReviewedMode ? handleRevertStudy : null}
        onNextStudy={allStudies.length > 1 ? handleNextStudy : null}
        onPrevStudy={allStudies.length > 1 ? handlePrevStudy : null}
        onOverridePriority={handleOverridePriority}
        onDeleteStudy={handleDeleteStudy}
        onBackToWorklist={handleBackNavigation}
        backLabel={isReviewedMode ? "Reviewed Studies" : "Worklist"}
        studyIndex={currentStudyIndex > 0 ? currentStudyIndex : 1}
        totalStudies={allStudies.length > 0 ? allStudies.length : 1}
      />
    </div>
  );
};

export default StudyReviewPage;
