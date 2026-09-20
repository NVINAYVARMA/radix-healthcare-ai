import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Upload,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  ClipboardCheck,
  FileSpreadsheet,
  X,
  Eye,
  Info,
  Scale,
  Trash2,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import EmptyState from "./ui/EmptyState";
import { Button } from "./ui/Button";
import WhyPrioritizedModal from "./WhyPrioritizedModal";
import PriorityOverrideModal from "./PriorityOverrideModal";
import studyService, { getCurrentUserId, matchesCurrentUser, deterministicCompareStudies, computeTieExplanation } from "../services/studyService";

export const WorklistTable = ({
  studies,
  selectedStudyId,
  onSelectStudy,
  onOpenUploadModal,
  onBatchReviewed,
  onOverridePriority,
  onStudyDeleted,
  onBatchDeleted,
  initialSearchQuery = "",
  isLoading = false,
}) => {
  const navigate = useNavigate();
  const [activePriorityFilter, setActivePriorityFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [selectedModality, setSelectedModality] = useState("All");
  const [selectedBodyPart, setSelectedBodyPart] = useState("All");
  const [selectedTimeFilter, setSelectedTimeFilter] = useState("All");
  const [sortColumn, setSortColumn] = useState("priorityScore");
  const [sortDirection, setSortDirection] = useState("desc"); // 'asc' or 'desc'
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // State for Explainability Modal and Override Modal directly from table
  const [explainingStudy, setExplainingStudy] = useState(null);
  const [overridingStudy, setOverridingStudy] = useState(null);

  // Deletion modals state
  const [studyToDelete, setStudyToDelete] = useState(null);
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [prevInitialQuery, setPrevInitialQuery] = useState(initialSearchQuery);
  if (initialSearchQuery !== prevInitialQuery) {
    setPrevInitialQuery(initialSearchQuery);
    setSearchQuery(initialSearchQuery);
    setCurrentPage(1);
  }

  // Selected checkbox state for batch actions
  const [checkedIds, setCheckedIds] = useState(() => (selectedStudyId ? new Set([selectedStudyId]) : new Set()));

  const currentUserId = getCurrentUserId();

  const scopedStudies = useMemo(() => {
    return studies.filter((s) => {
      const uploader = s.uploaded_by || s.uploadedBy;
      if (uploader) {
        return matchesCurrentUser(uploader);
      }
      return true;
    });
  }, [studies]);

  // Dynamic priority counts
  const counts = useMemo(() => {
    let high = 0;
    let medium = 0;
    let low = 0;
    scopedStudies.forEach((s) => {
      if (s.priority === "High") high++;
      else if (s.priority === "Medium") medium++;
      else if (s.priority === "Low" || s.priority === "Standard") low++;
    });
    return { all: scopedStudies.length, high, medium, low };
  }, [scopedStudies]);

  // Handle column header sort toggle
  const handleSort = (columnKey) => {
    if (sortColumn === columnKey) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(columnKey);
      setSortDirection(
        columnKey === "priority" || columnKey === "priorityScore" ? "desc" : "asc"
      );
    }
  };

  // Filter and sort studies
  const filteredStudies = useMemo(() => {
    const list = scopedStudies
      .filter((study) => {
        // Priority filter
        if (activePriorityFilter !== "All") {
          const p = study.priority;
          if (activePriorityFilter === "Standard") {
            if (p !== "Low" && p !== "Standard") return false;
          } else if (p !== activePriorityFilter) {
            return false;
          }
        }

        // Modality filter
        if (selectedModality !== "All" && study.modality !== selectedModality) {
          return false;
        }

        // Body part filter
        if (selectedBodyPart !== "All" && study.bodyPart !== selectedBodyPart) {
          return false;
        }

        // Arrival time filter
        if (selectedTimeFilter !== "All") {
          const hours = study.arrivalHoursAgo ?? 0;
          if (selectedTimeFilter === "Today" && hours > 8) return false;
          if (selectedTimeFilter === "Last24h" && hours > 24) return false;
          if (selectedTimeFilter === "Older" && hours <= 24) return false;
        }

        // Search query: Patient ID, Study ID, Patient Name, Modality, Body Part, Key Findings
        if (searchQuery.trim() !== "") {
          const q = searchQuery.toLowerCase().trim();
          const matchPatientId = study.patientId?.toLowerCase().includes(q);
          const matchStudyId = study.studyId?.toLowerCase().includes(q);
          const matchName = study.patientName?.toLowerCase().includes(q);
          const matchModality = study.modality?.toLowerCase().includes(q);
          const matchBodyPart = study.bodyPart?.toLowerCase().includes(q);
          const matchFindings = study.keyFindings?.toLowerCase().includes(q);

          if (
            !matchPatientId &&
            !matchStudyId &&
            !matchName &&
            !matchModality &&
            !matchBodyPart &&
            !matchFindings
          ) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => deterministicCompareStudies(a, b, sortColumn, sortDirection));

    // Ensure explainable tie resolution indicator is populated for tied adjacent studies
    for (let i = 0; i < list.length; i++) {
      const curr = list[i];
      if (i > 0 && Math.abs((list[i - 1].priorityScore || 0) - (curr.priorityScore || 0)) < 0.001) {
        if (!curr.tieResolution) {
          curr.tieResolution = computeTieExplanation(list[i - 1], curr);
        }
      } else if (i < list.length - 1 && Math.abs((list[i + 1].priorityScore || 0) - (curr.priorityScore || 0)) < 0.001) {
        if (!curr.tieResolution) {
          curr.tieResolution = computeTieExplanation(curr, list[i + 1]);
        }
      }
    }

    return list;
  }, [
    scopedStudies,
    activePriorityFilter,
    selectedModality,
    selectedBodyPart,
    selectedTimeFilter,
    searchQuery,
    sortColumn,
    sortDirection,
  ]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredStudies.length / pageSize));
  const currentStudies = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStudies.slice(start, start + pageSize);
  }, [filteredStudies, currentPage]);

  const handlePageChange = (p) => {
    if (p >= 1 && p <= totalPages) {
      setCurrentPage(p);
    }
  };

  const handleRowClick = (study) => {
    onSelectStudy(study);
  };

  const handleCheckboxToggle = (e, studyId) => {
    e.stopPropagation();
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(studyId)) {
        next.delete(studyId);
      } else {
        next.add(studyId);
      }
      return next;
    });
  };

  const handleSelectAllOnPage = () => {
    const allCurrentSelected = currentStudies.every((s) => checkedIds.has(s.id));
    if (allCurrentSelected) {
      setCheckedIds((prev) => {
        const next = new Set(prev);
        currentStudies.forEach((s) => next.delete(s.id));
        return next;
      });
    } else {
      setCheckedIds((prev) => {
        const next = new Set(prev);
        currentStudies.forEach((s) => next.add(s.id));
        return next;
      });
    }
  };

  // Batch actions
  const handleBatchMarkReviewed = () => {
    if (onBatchReviewed) {
      onBatchReviewed(Array.from(checkedIds));
    }
    setCheckedIds(new Set());
  };

  const handleBatchExport = () => {
    const selectedList = studies.filter((s) => checkedIds.has(s.id));
    const csvContent =
      "data:text/csv;charset=utf-8," +
      ["Study ID,Patient ID,Modality,Body Part,Priority,AI Score,Arrival Time"]
        .concat(
          selectedList.map(
            (s) =>
              `${s.studyId || s.id},${s.patientId},${s.modality},${s.bodyPart},${s.priority},${s.priorityScore},${s.arrivalTime}`
          )
        )
        .join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `radix_worklist_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleConfirmDeleteSingle = async () => {
    if (!studyToDelete) return;
    setIsDeleting(true);
    const targetKey = studyToDelete.studyId || studyToDelete.id;
    try {
      await studyService.deleteStudy(targetKey);
      if (onStudyDeleted) {
        onStudyDeleted(studyToDelete.id || studyToDelete.studyId);
      }
      setCheckedIds((prev) => {
        const next = new Set(prev);
        next.delete(studyToDelete.id);
        return next;
      });
      setStudyToDelete(null);
    } catch (err) {
      console.error("Failed to delete study:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmDeleteBatch = async () => {
    if (checkedIds.size === 0) return;
    setIsDeleting(true);
    const ids = Array.from(checkedIds);
    const studyKeys = ids.map((id) => {
      const s = studies.find((item) => item.id === id);
      return s?.studyId || s?.id || id;
    });
    try {
      await studyService.batchDeleteStudies(studyKeys);
      if (onBatchDeleted) {
        onBatchDeleted(ids);
      }
      setCheckedIds(new Set());
      setShowBatchDeleteModal(false);
    } catch (err) {
      console.error("Batch delete failed:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Render sorting indicator arrow
  const renderSortIndicator = (columnKey) => {
    if (sortColumn !== columnKey) {
      return <ArrowUpDown size={11} className="sort-icon-inactive" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp size={11} className="sort-icon-active" />
    ) : (
      <ArrowDown size={11} className="sort-icon-active" />
    );
  };

  return (
    <section className="radix-worklist-panel">
      {/* =========================================
          WORKLIST HEADER
      ========================================= */}
      <div className="worklist-header">
        <div className="worklist-title-block">
          <div className="title-row">
            <div className="pulse-icon-container">
              <Activity size={22} className="pulse-svg" />
            </div>
            <h2>Radiology Worklist</h2>
          </div>
          <p className="worklist-subtitle">
            Clinical imaging queue prioritized by AI-detected urgency and pathology risk.
          </p>
        </div>

        <div className="worklist-header-actions" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* Worklist Isolation Pill */}
          <div
            className="worklist-scope-badge"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: "#f1f5f9",
              border: "0.5px solid #0f172a",
              borderRadius: "8px",
              padding: "5px 12px",
              fontSize: "0.78rem",
              fontWeight: 700,
              color: "#0f172a",
            }}
          >
            <Sparkles size={13} style={{ color: "#2563eb" }} />
            <span>My Scanned Worklist ({scopedStudies.length})</span>
          </div>

          <button
            type="button"
            className="reviewed-archive-nav-btn"
            onClick={() => navigate("/reviewed")}
            title="View clinically finalized and reviewed studies archive"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              height: "36px",
              padding: "0 14px",
              background: "#ffffff",
              border: "0.5px solid #0f172a",
              borderRadius: "8px",
              color: "#334155",
              fontSize: "0.82rem",
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <ClipboardCheck size={15} color="#0284c7" />
            <span>Reviewed Archive</span>
          </button>

          <button className="upload-scans-btn" onClick={onOpenUploadModal}>
            <Upload size={15} className="btn-icon" />
            <span>Upload New Scans</span>
          </button>
        </div>
      </div>

      {/* =========================================
          SEARCH & FILTER BAR
      ========================================= */}
      <div className="worklist-search-bar">
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search by Patient ID, Study ID, Modality or Findings..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
          />
          {searchQuery && (
            <button
              className="clear-search-btn"
              onClick={() => setSearchQuery("")}
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* =========================================
          FILTER PILLS & DROPDOWNS ROW
      ========================================= */}
      <div className="filter-pills-row">
        <div className="priority-pills-group">
          {/* All */}
          <button
            className={`pill-badge pill-all ${activePriorityFilter === "All" ? "active" : ""}`}
            onClick={() => {
              setActivePriorityFilter("All");
              setCurrentPage(1);
            }}
          >
            All ({counts.all})
          </button>

          {/* High */}
          <button
            className={`pill-badge pill-high ${activePriorityFilter === "High" ? "active" : ""}`}
            onClick={() => {
              setActivePriorityFilter("High");
              setCurrentPage(1);
            }}
          >
            High ({counts.high})
          </button>

          {/* Medium */}
          <button
            className={`pill-badge pill-medium ${activePriorityFilter === "Medium" ? "active" : ""}`}
            onClick={() => {
              setActivePriorityFilter("Medium");
              setCurrentPage(1);
            }}
          >
            Medium ({counts.medium})
          </button>

          {/* Standard / Low */}
          <button
            className={`pill-badge pill-low ${
              activePriorityFilter === "Standard" || activePriorityFilter === "Low" ? "active" : ""
            }`}
            onClick={() => {
              setActivePriorityFilter("Standard");
              setCurrentPage(1);
            }}
          >
            Standard ({counts.low})
          </button>
        </div>

        {/* Dropdowns Group */}
        <div className="filter-dropdowns-group">
          {/* Modality Filter */}
          <div className="dropdown-select-wrapper">
            <select
              value={selectedModality}
              onChange={(e) => {
                setSelectedModality(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="All">Modality: All</option>
              <option value="X-ray">X-ray</option>
              <option value="CT">CT Scan</option>
              <option value="MRI">MRI</option>
            </select>
            <ChevronDown size={13} className="dropdown-chevron" />
          </div>

          {/* Body Part Filter */}
          <div className="dropdown-select-wrapper">
            <select
              value={selectedBodyPart}
              onChange={(e) => {
                setSelectedBodyPart(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="All">Body Part: All</option>
              <option value="Chest">Chest</option>
              <option value="Abdomen">Abdomen</option>
              <option value="Head">Head</option>
              <option value="Spine">Spine</option>
              <option value="Pelvis">Pelvis</option>
              <option value="Extremity">Extremity</option>
            </select>
            <ChevronDown size={13} className="dropdown-chevron" />
          </div>

          {/* Arrival Time Filter */}
          <div className="dropdown-select-wrapper">
            <select
              value={selectedTimeFilter}
              onChange={(e) => {
                setSelectedTimeFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="All">Arrival: All Times</option>
              <option value="Today">Today (&lt; 8h)</option>
              <option value="Last24h">Last 24 Hours</option>
              <option value="Older">Older (&gt; 24h)</option>
            </select>
            <ChevronDown size={13} className="dropdown-chevron" />
          </div>

          {/* Dynamic Sorting Order Selector */}
          <div className="dropdown-select-wrapper sort-dropdown-wrapper">
            <select
              value={`${sortColumn}-${sortDirection}`}
              onChange={(e) => {
                const [col, dir] = e.target.value.split("-");
                setSortColumn(col);
                setSortDirection(dir);
                setCurrentPage(1);
              }}
              title="Change sort order"
            >
              <option value="priorityScore-desc">Sort: Priority Score (Highest)</option>
              <option value="priorityScore-asc">Sort: Priority Score (Lowest)</option>
              <option value="priority-desc">Sort: Priority Level (High → Low)</option>
              <option value="priority-asc">Sort: Priority Level (Low → High)</option>
              <option value="arrivalTime-asc">Sort: Arrival Time (FIFO)</option>
              <option value="arrivalTime-desc">Sort: Arrival Time (Recent)</option>
              <option value="age-desc">Sort: Age (Oldest)</option>
              <option value="age-asc">Sort: Age (Youngest)</option>
            </select>
            <ChevronDown size={13} className="dropdown-chevron" />
          </div>
        </div>
      </div>

      {/* =========================================
          BATCH ACTIONS FLOATING TOOLBAR
      ========================================= */}
      <AnimatePresence>
        {checkedIds.size > 0 && (
          <motion.div
            className="batch-actions-bar"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <div className="batch-left">
              <span className="batch-count-badge">{checkedIds.size}</span>
              <span className="batch-label">studies selected</span>
            </div>
            <div className="batch-right">
              <button
                className="batch-action-btn primary"
                onClick={handleBatchMarkReviewed}
                title="Mark all selected studies as reviewed"
              >
                <CheckCircle2 size={14} />
                <span>Mark Reviewed</span>
              </button>
              <button
                className="batch-action-btn secondary"
                onClick={handleBatchExport}
                title="Export selected studies to CSV"
              >
                <FileSpreadsheet size={14} />
                <span>Export CSV</span>
              </button>
              <button
                className="batch-action-btn danger"
                onClick={() => setShowBatchDeleteModal(true)}
                title="Permanently delete selected studies"
              >
                <Trash2 size={14} />
                <span>Delete Selected</span>
              </button>
              <button
                className="batch-action-btn text"
                onClick={() => setCheckedIds(new Set())}
                title="Deselect all"
              >
                <X size={14} />
                <span>Clear</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =========================================
          10-COLUMN DATA TABLE
      ========================================= */}
      <div className="worklist-table-container">
        {isLoading && (
          <div className="table-loading-bar" role="progressbar" aria-label="Loading studies">
            <div className="table-loading-fill" />
          </div>
        )}
        <table className="worklist-table">
          <thead>
            <tr>
              <th className="th-checkbox">
                <input
                  type="checkbox"
                  checked={
                    currentStudies.length > 0 &&
                    currentStudies.every((s) => checkedIds.has(s.id))
                  }
                  onChange={handleSelectAllOnPage}
                  title="Select all on current page"
                />
              </th>

              {/* Study ID */}
              <th
                className="th-sortable th-study-id"
                onClick={() => handleSort("studyId")}
              >
                <div className="th-header-content">
                  <span>Study ID</span>
                  {renderSortIndicator("studyId")}
                </div>
              </th>

              {/* Patient ID */}
              <th
                className="th-sortable th-patient-id"
                onClick={() => handleSort("patientId")}
              >
                <div className="th-header-content">
                  <span>Patient ID</span>
                  {renderSortIndicator("patientId")}
                </div>
              </th>

              {/* Age / Sex */}
              <th
                className="th-sortable th-age-sex"
                onClick={() => handleSort("age")}
              >
                <div className="th-header-content">
                  <span>Age / Sex</span>
                  {renderSortIndicator("age")}
                </div>
              </th>

              {/* Modality */}
              <th
                className="th-sortable th-modality"
                onClick={() => handleSort("modality")}
              >
                <div className="th-header-content">
                  <span>Modality</span>
                  {renderSortIndicator("modality")}
                </div>
              </th>

              {/* Body Part */}
              <th
                className="th-sortable th-body-part"
                onClick={() => handleSort("bodyPart")}
              >
                <div className="th-header-content">
                  <span>Body Part</span>
                  {renderSortIndicator("bodyPart")}
                </div>
              </th>

              {/* Arrival Time */}
              <th
                className="th-sortable th-arrival"
                onClick={() => handleSort("arrivalTime")}
              >
                <div className="th-header-content">
                  <span>Arrival Time</span>
                  {renderSortIndicator("arrivalTime")}
                </div>
              </th>

              {/* Priority */}
              <th
                className="th-sortable th-priority"
                onClick={() => handleSort("priority")}
              >
                <div className="th-header-content">
                  <span>Priority</span>
                  {renderSortIndicator("priority")}
                </div>
              </th>

              {/* AI Score */}
              <th
                className="th-sortable th-ai-score"
                onClick={() => handleSort("priorityScore")}
              >
                <div className="th-header-content">
                  <span>AI Score</span>
                  {renderSortIndicator("priorityScore")}
                </div>
              </th>

              {/* Key Findings */}
              <th className="th-findings">
                <span>Key Findings (AI)</span>
              </th>

              {/* Action */}
              <th className="th-action">
                <span>Action</span>
              </th>
            </tr>
          </thead>

          <tbody>
            {isLoading ? (
              Array.from({ length: 10 }).map((_, rIdx) => (
                <tr key={rIdx} className="worklist-skeleton-row" style={{ height: "40px" }}>
                  <td className="td-checkbox"><Skeleton width="15px" height="15px" /></td>
                  <td className="td-study-id"><Skeleton width="62px" height="18px" style={{ borderRadius: "4px" }} /></td>
                  <td className="td-patient-id"><Skeleton width="75px" height="14px" /></td>
                  <td className="td-age-sex"><Skeleton width="45px" height="14px" /></td>
                  <td className="td-modality"><Skeleton width="50px" height="18px" style={{ borderRadius: "10px" }} /></td>
                  <td className="td-body-part"><Skeleton width="55px" height="14px" /></td>
                  <td className="td-arrival"><Skeleton width="60px" height="14px" /></td>
                  <td className="td-priority"><Skeleton width="68px" height="20px" style={{ borderRadius: "10px" }} /></td>
                  <td className="td-ai-score"><Skeleton width="36px" height="18px" style={{ borderRadius: "10px" }} /></td>
                  <td className="td-findings"><Skeleton width="85%" height="13px" /></td>
                  <td className="td-action"><Skeleton width="72px" height="24px" style={{ borderRadius: "4px" }} /></td>
                </tr>
              ))
            ) : currentStudies.length > 0 ? (
              currentStudies.map((study, rowIdx) => {
                const isSelected = study.id === selectedStudyId;
                const isChecked = checkedIds.has(study.id);
                const score = study.priorityScore?.toFixed(2) || "0.00";

                const priorityClass =
                  study.priority === "High"
                    ? "priority-pill-high"
                    : study.priority === "Medium"
                    ? "priority-pill-medium"
                    : "priority-pill-low";

                const scoreClass =
                  study.priorityScore >= 0.8
                    ? "score-badge-high"
                    : study.priorityScore >= 0.45
                    ? "score-badge-medium"
                    : "score-badge-low";

                const modalityBadgeClass =
                  study.modality === "CT"
                    ? "modality-ct"
                    : study.modality === "MRI"
                    ? "modality-mri"
                    : "modality-xray";

                return (
                  <motion.tr
                    key={study.id}
                    className={`worklist-row ${isSelected ? "selected-row" : ""} ${
                      study.status === "Reviewed" ? "reviewed-row" : ""
                    }`}
                    onClick={() => handleRowClick(study)}
                    title="Click to view PACS diagnostic image and AI insights"
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15, delay: Math.min(rowIdx * 0.02, 0.2) }}
                  >
                    {/* Checkbox */}
                    <td
                      className="td-checkbox"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => handleCheckboxToggle(e, study.id)}
                      />
                    </td>

                    {/* Study ID */}
                    <td className="td-study-id">
                      <span className="study-id-chip">{study.studyId || `ST-${String(study.id).padStart(3, "0")}`}</span>
                    </td>

                    {/* Patient ID */}
                    <td className="td-patient-id">
                      <strong>{study.patientId}</strong>
                      {(study.status === "Reviewed" || study.status === "REVIEWED") && (
                        <span className="reviewed-check" title="Study Reviewed">
                          ✓
                        </span>
                      )}
                      {study.status === "IN_REVIEW" && (
                        <span className="in-review-dot-tag" title="Review in Progress">
                          reading
                        </span>
                      )}
                    </td>

                    {/* Age / Sex */}
                    <td className="td-age-sex">
                      {study.age} / {study.sex}
                    </td>

                    {/* Modality */}
                    <td className="td-modality">
                      <span className={`modality-badge ${modalityBadgeClass}`}>
                        {study.modality}
                      </span>
                    </td>

                    {/* Body Part */}
                    <td className="td-body-part">{study.bodyPart}</td>

                    {/* Arrival Time */}
                    <td className="td-arrival">{study.arrivalTime}</td>

                    {/* Priority (with Manual Override and Deterministic Tie-Resolution distinction) */}
                    <td className="td-priority">
                      <div className="table-priority-cell">
                        <span className={`table-priority-badge ${priorityClass}`}>
                          {study.priority}
                        </span>
                        {study.manualOverride && (
                          <span
                            className="table-override-tag"
                            title={`Manually overridden by ${study.manualOverride.overriddenBy}: "${study.manualOverride.reason}" (Original AI: ${study.manualOverride.originalPriority})`}
                          >
                            OVERRIDE
                          </span>
                        )}
                        {study.tieResolution && (
                          <span
                            className="tie-resolution-badge"
                            title={`Priority Tie Resolved: ${study.tieResolution}`}
                          >
                            <Scale size={10} className="tie-badge-icon" />
                            <span className="tie-badge-text">Tie: {study.tieResolution}</span>
                          </span>
                        )}
                      </div>
                    </td>

                    {/* AI Score (Interactive with Explainability Modal trigger) */}
                    <td className="td-ai-score" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className={`table-score-badge ${scoreClass} clickable-score-pill`}
                        onClick={() => setExplainingStudy(study)}
                        title="Click to view AI triage priority score breakdown"
                      >
                        <span className="score-num">
                          {study.manualOverride?.originalScore !== undefined
                            ? study.manualOverride.originalScore.toFixed(2)
                            : score}
                        </span>
                      </button>
                    </td>

                    {/* Key Findings */}
                    <td className="td-findings" title={study.keyFindings}>
                      <span className="finding-text">{study.keyFindings}</span>
                    </td>

                    {/* Action Column */}
                    <td className="td-action" onClick={(e) => e.stopPropagation()}>
                      <div className="table-action-btns-group">
                        <button
                          className="table-view-btn"
                          onClick={() => handleRowClick(study)}
                          title="Open study in PACS workstation"
                        >
                          <Eye size={13} />
                          <span>PACS</span>
                        </button>
                        <button
                          type="button"
                          className="table-why-btn"
                          onClick={() => setExplainingStudy(study)}
                          title="Inspect AI triage priority rationale"
                        >
                          <Info size={12} />
                          <span>Why?</span>
                        </button>
                        <button
                          type="button"
                          className="table-delete-btn"
                          onClick={() => setStudyToDelete(study)}
                          title="Delete study"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="11" style={{ padding: 0 }}>
                  <EmptyState
                    icon={Activity}
                    title="No radiology studies match your filter"
                    description="Try resetting your modality, priority, or search parameters to view all queued DICOM studies."
                    action={
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setActivePriorityFilter("All");
                          setSelectedModality("All");
                          setSelectedBodyPart("All");
                          setSelectedTimeFilter("All");
                          setSearchQuery("");
                        }}
                      >
                        Reset All Filters
                      </Button>
                    }
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* =========================================
          TABLE FOOTER & PAGINATION
      ========================================= */}
      <div className="worklist-footer">
        <div className="footer-summary">
          Showing {filteredStudies.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}-
          {Math.min(currentPage * pageSize, filteredStudies.length)} of{" "}
          <strong>{filteredStudies.length}</strong> studies
          {filteredStudies.length < studies.length && (
            <span className="footer-filter-note"> (filtered from {studies.length} total)</span>
          )}
        </div>

        <div className="pagination-controls">
          <button
            className="page-nav-btn"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            title="Previous page"
          >
            <ChevronLeft size={15} />
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              className={`page-num-btn ${currentPage === p ? "active" : ""}`}
              onClick={() => handlePageChange(p)}
            >
              {p}
            </button>
          ))}

          <button
            className="page-nav-btn"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            title="Next page"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* Why Prioritized Explainability Modal */}
      <WhyPrioritizedModal
        isOpen={Boolean(explainingStudy)}
        onClose={() => setExplainingStudy(null)}
        study={explainingStudy}
        onOpenViewer={(s) => {
          setExplainingStudy(null);
          handleRowClick(s);
        }}
        onOpenOverride={(s) => {
          setExplainingStudy(null);
          setOverridingStudy(s);
        }}
      />

      {/* Manual Priority Override Modal */}
      <PriorityOverrideModal
        isOpen={Boolean(overridingStudy)}
        onClose={() => setOverridingStudy(null)}
        study={overridingStudy}
        onOverrideSubmit={async (overrideData) => {
          if (onOverridePriority) {
            await onOverridePriority(overrideData);
          }
          setOverridingStudy(null);
        }}
      />

      {/* Single Study Delete Confirmation Modal */}
      <AnimatePresence>
        {studyToDelete && (
          <motion.div
            className="radix-delete-modal-overlay"
            onClick={() => !isDeleting && setStudyToDelete(null)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="radix-delete-modal-box"
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <div className="radix-delete-modal-header">
                <div className="radix-delete-icon-circle">
                  <Trash2 size={20} />
                </div>
                <div>
                  <h4>Delete Radiology Study?</h4>
                  <p>
                    This will permanently remove this study record, diagnostic image files, and all associated AI findings. This action cannot be undone.
                  </p>
                </div>
              </div>

              <div className="radix-delete-target-preview">
                <div><strong>Study:</strong> {studyToDelete.studyId || `ST-${studyToDelete.id}`}</div>
                <div><strong>Patient:</strong> {studyToDelete.patientName || studyToDelete.patientId} ({studyToDelete.patientId})</div>
                <div><strong>Modality:</strong> {studyToDelete.bodyPart} {studyToDelete.modality}</div>
              </div>

              <div className="radix-delete-modal-actions">
                <button
                  type="button"
                  className="radix-delete-cancel-btn"
                  onClick={() => setStudyToDelete(null)}
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="radix-delete-confirm-btn"
                  onClick={handleConfirmDeleteSingle}
                  disabled={isDeleting}
                >
                  <Trash2 size={14} />
                  <span>{isDeleting ? "Deleting..." : "Permanently Delete"}</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Batch Delete Confirmation Modal */}
      <AnimatePresence>
        {showBatchDeleteModal && (
          <motion.div
            className="radix-delete-modal-overlay"
            onClick={() => !isDeleting && setShowBatchDeleteModal(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="radix-delete-modal-box"
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <div className="radix-delete-modal-header">
                <div className="radix-delete-icon-circle">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h4>Delete {checkedIds.size} Selected Studies?</h4>
                  <p>
                    You are about to permanently delete {checkedIds.size} studies from the triage queue.
                    All PACS imagery and AI priority metrics will be removed.
                  </p>
                </div>
              </div>

              <div className="radix-delete-modal-actions">
                <button
                  type="button"
                  className="radix-delete-cancel-btn"
                  onClick={() => setShowBatchDeleteModal(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="radix-delete-confirm-btn"
                  onClick={handleConfirmDeleteBatch}
                  disabled={isDeleting}
                >
                  <Trash2 size={14} />
                  <span>{isDeleting ? "Deleting..." : `Delete ${checkedIds.size} Studies`}</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default WorklistTable;
