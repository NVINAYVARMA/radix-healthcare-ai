import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import WorklistTable from "../components/WorklistTable";
import UploadModal from "../components/UploadModal";
import { studyService, getCurrentUserId } from "../services/studyService";
import "./Dashboard.css";

export const Worklist = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryParam = searchParams.get("q") || "";
  const [studies, setStudies] = useState(() => studyService.getCachedStudies());
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(() => studyService.getCachedStudies().length === 0);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const currentUserId = getCurrentUserId();
        const data = await studyService.getWorklistQueue({ limit: 100, user_id: currentUserId });
        if (isMounted && data?.studies) {
          setStudies(data.studies);
        }
      } catch (err) {
        console.error("Failed to load worklist studies:", err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  // On click of ANY study, seamlessly navigate to the diagnostic image view!
  const handleSelectStudy = (study) => {
    navigate(`/study/${study.studyId || study.id}`);
  };

  // Batch mark studies as reviewed
  const handleBatchReviewed = async (ids) => {
    await studyService.batchUpdateStudies(ids, "markReviewed");
    const idSet = new Set(ids);
    setStudies((prev) =>
      prev.map((s) => (idSet.has(s.id) ? { ...s, status: "REVIEWED" } : s))
    );
  };

  // Upload new scan handler
  const handleStudyUploaded = (newStudy) => {
    setStudies((prev) => [newStudy, ...prev.filter((s) => s.id !== newStudy.id && s.studyId !== newStudy.studyId)]);
  };

  // Manual priority override handler
  const handleOverridePriority = async (overrideData) => {
    const { studyId, newPriority, reason } = overrideData;
    await studyService.overrideStudyPriority(studyId, {
      newPriority,
      reason,
      overriddenBy: "Dr. Alex Vance, MD",
    });
    setStudies((prev) =>
      prev.map((s) => {
        if (s.id === studyId || s.studyId === studyId) {
          return {
            ...s,
            priority: newPriority,
            priorityLevel: newPriority.toUpperCase(),
            manualOverride: {
              originalPriority: s.priority,
              originalScore: s.priorityScore,
              newPriority,
              reason,
              overriddenBy: "Dr. Alex Vance, MD",
              overriddenAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          };
        }
        return s;
      })
    );
  };

  const handleStudyDeleted = (deletedId) => {
    setStudies((prev) =>
      prev.filter((s) => s.id !== deletedId && s.studyId !== deletedId && s.study_id !== deletedId)
    );
  };

  const handleBatchDeleted = (deletedIds) => {
    const idSet = new Set(deletedIds);
    setStudies((prev) =>
      prev.filter((s) => !idSet.has(s.id) && !idSet.has(s.studyId) && !idSet.has(s.study_id))
    );
  };

  return (
    <motion.div
      className="radix-worklist-fullpage"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <div className="worklist-fullpage-inner">
        <WorklistTable
          studies={studies}
          selectedStudyId={null}
          onSelectStudy={handleSelectStudy}
          onOpenUploadModal={() => setIsUploadModalOpen(true)}
          onBatchReviewed={handleBatchReviewed}
          onOverridePriority={handleOverridePriority}
          onStudyDeleted={handleStudyDeleted}
          onBatchDeleted={handleBatchDeleted}
          initialSearchQuery={queryParam}
          isLoading={isLoading}
        />
      </div>

      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onStudyUploaded={handleStudyUploaded}
        nextId={studies.length + 1}
      />
    </motion.div>
  );
};

export default Worklist;