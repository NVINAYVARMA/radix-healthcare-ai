import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  Filter,
  ArrowUpDown,
  Download,
  RotateCcw,
  ExternalLink,
  FileText,
  User,
  ShieldCheck,
  RefreshCw,
  Eye,
  Check,
  X,
  ChevronRight,
  Sparkles,
  Trash2,
} from "lucide-react";
import { studyService, getCurrentUserId, matchesCurrentUser } from "../services/studyService";
import "./ReviewedStudies.css";

export const ReviewedStudies = () => {
  const navigate = useNavigate();

  const [studies, setStudies] = useState([]);
  const [stats, setStats] = useState({
    total_reviewed: 0,
    critical_count: 0,
    abnormal_count: 0,
    normal_count: 0,
    avg_turnaround_time_mins: 18.5,
    reviewed_today_count: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedStudyIds, setSelectedStudyIds] = useState(new Set());
  const [selectedReport, setSelectedReport] = useState(null);
  const [toastMessage, setToastMessage] = useState("");
  const [deleteTargetStudy, setDeleteTargetStudy] = useState(null);
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const activeUserId = getCurrentUserId();
      const res = await studyService.getReviewedStudies({
        user_id: activeUserId || undefined,
        search: searchQuery || undefined,
        priority: priorityFilter !== "ALL" ? priorityFilter : undefined,
        review_status: statusFilter !== "ALL" ? statusFilter : undefined,
      });
      if (res) {
        setStudies(res.items || []);
        if (res.stats) setStats(res.stats);
      }
    } catch (err) {
      console.error("Failed to load reviewed studies:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [priorityFilter, statusFilter]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  };

  // Filtered studies strictly isolated to current logged-in profile
  const filteredStudies = useMemo(() => {
    return studies.filter((item) => {
      if (item.uploaded_by && !matchesCurrentUser(item.uploaded_by)) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        item.patientName?.toLowerCase().includes(q) ||
        item.patientId?.toLowerCase().includes(q) ||
        item.studyId?.toLowerCase().includes(q) ||
        item.reviewNotes?.toLowerCase().includes(q) ||
        item.aiFindings?.toLowerCase().includes(q)
      );
    });
  }, [studies, searchQuery]);

  // Handle re-opening a study back to the queue
  const handleRevertStudy = async (studyId) => {
    try {
      await studyService.revertReviewedStudy(studyId);
      setStudies((prev) => prev.filter((s) => s.studyId !== studyId));
      setStats((prev) => ({
        ...prev,
        total_reviewed: Math.max(0, prev.total_reviewed - 1),
      }));
      showToast(`Study ${studyId} returned to active triage worklist.`);
      if (selectedReport?.studyId === studyId) {
        setSelectedReport(null);
      }
    } catch (err) {
      showToast(`Failed to revert study: ${err.message}`);
    }
  };

  const handleConfirmDeleteSingle = async () => {
    if (!deleteTargetStudy) return;
    setIsDeleting(true);
    const targetId = deleteTargetStudy.studyId || deleteTargetStudy.id;
    try {
      await studyService.deleteStudy(targetId);
      setStudies((prev) => prev.filter((s) => s.studyId !== targetId && s.id !== targetId));
      setStats((prev) => ({
        ...prev,
        total_reviewed: Math.max(0, prev.total_reviewed - 1),
      }));
      showToast(`Study ${targetId} permanently deleted.`);
      if (selectedReport?.studyId === targetId) setSelectedReport(null);
      setDeleteTargetStudy(null);
    } catch (err) {
      showToast(`Failed to delete study: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmDeleteBatch = async () => {
    if (selectedStudyIds.size === 0) return;
    setIsDeleting(true);
    const ids = Array.from(selectedStudyIds);
    try {
      await studyService.batchDeleteStudies(ids);
      const idSet = new Set(ids);
      setStudies((prev) => prev.filter((s) => !idSet.has(s.studyId) && !idSet.has(s.id)));
      setStats((prev) => ({
        ...prev,
        total_reviewed: Math.max(0, prev.total_reviewed - ids.length),
      }));
      setSelectedStudyIds(new Set());
      setShowBatchDeleteConfirm(false);
      showToast(`Successfully deleted ${ids.length} studies.`);
    } catch (err) {
      showToast(`Batch delete failed: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Multi-select helpers
  const handleToggleSelect = (id) => {
    setSelectedStudyIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    const myStudies = filteredStudies.filter((s) => matchesCurrentUser(s.uploaded_by || s.uploadedBy));
    if (selectedStudyIds.size === myStudies.length && myStudies.length > 0) {
      setSelectedStudyIds(new Set());
    } else {
      setSelectedStudyIds(new Set(myStudies.map((s) => s.studyId)));
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    if (filteredStudies.length === 0) return;
    const headers = [
      "Study ID",
      "Patient Name",
      "Patient ID",
      "Priority Level",
      "Review Status",
      "Reviewer",
      "Reviewed At",
      "Turnaround Time (Mins)",
      "Clinical Notes",
    ];
    const rows = filteredStudies.map((s) => [
      `"${s.studyId}"`,
      `"${s.patientName}"`,
      `"${s.patientId}"`,
      `"${s.priorityLevel}"`,
      `"${s.reviewStatus}"`,
      `"${s.reviewerId}"`,
      `"${s.reviewedAt}"`,
      s.turnaroundTimeMins || 15,
      `"${(s.reviewNotes || "").replace(/"/g, '""')}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `radix_reviewed_studies_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Exported reviewed studies to CSV");
  };

  return (
    <motion.div
      className="reviewed-page-wrapper"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            className="reviewed-toast-alert"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <CheckCircle2 size={16} />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page Header */}
      <div className="reviewed-page-header">
        <div className="header-left">
          <div className="header-breadcrumb">
            <button className="breadcrumb-link" onClick={() => navigate("/worklist")}>
              Triage Worklist
            </button>
            <ChevronRight size={14} className="breadcrumb-separator" />
            <span className="breadcrumb-current">Reviewed Studies</span>
          </div>
          <div className="header-title-row">
            <h1 className="header-page-title">Reviewed Studies Archive</h1>
            <span className="reviewed-count-badge">{stats.total_reviewed} finalized</span>
          </div>
          <p className="header-page-subtitle">
            Historical repository of clinically signed-off and finalized radiological examinations
          </p>
        </div>

        <div className="header-actions">
          <button className="reviewed-action-btn secondary" onClick={() => navigate("/worklist")}>
            <span>← Active Worklist</span>
          </button>
          <button className="reviewed-action-btn secondary" onClick={loadData} title="Refresh archive data">
            <RefreshCw size={14} className={isLoading ? "spin-icon" : ""} />
            <span>Refresh</span>
          </button>
          <button className="reviewed-action-btn primary" onClick={handleExportCSV}>
            <Download size={14} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Analytics KPI Stat Cards */}
      <div className="reviewed-stats-grid">
        <motion.div whileHover={{ y: -3, transition: { duration: 0.15 } }} className="reviewed-stat-card">
          <div className="stat-icon-box blue">
            <CheckCircle2 size={20} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Total Reviewed</span>
            <span className="stat-number">{stats.total_reviewed}</span>
            <span className="stat-subtext">Clinically finalized studies</span>
          </div>
        </motion.div>

        <motion.div whileHover={{ y: -3, transition: { duration: 0.15 } }} className="reviewed-stat-card">
          <div className="stat-icon-box red">
            <AlertTriangle size={20} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Critical / Urgent Signed Off</span>
            <span className="stat-number">{stats.critical_count}</span>
            <span className="stat-subtext">High priority cases resolved</span>
          </div>
        </motion.div>

        <motion.div whileHover={{ y: -3, transition: { duration: 0.15 } }} className="reviewed-stat-card">
          <div className="stat-icon-box green">
            <ShieldCheck size={20} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Normal Clearances</span>
            <span className="stat-number">{stats.normal_count}</span>
            <span className="stat-subtext">Unremarkable examinations</span>
          </div>
        </motion.div>

        <motion.div whileHover={{ y: -3, transition: { duration: 0.15 } }} className="reviewed-stat-card">
          <div className="stat-icon-box amber">
            <Clock size={20} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Avg Turnaround Time</span>
            <span className="stat-number">{stats.avg_turnaround_time_mins}m</span>
            <span className="stat-subtext">Arrival to radiologist sign-off</span>
          </div>
        </motion.div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="reviewed-toolbar-card">
        <div className="search-box-wrapper">
          <Search size={16} className="search-input-icon" />
          <input
            type="text"
            placeholder="Search by patient name, MRN, study ID, or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input-field"
          />
          {searchQuery && (
            <button className="search-clear-btn" onClick={() => setSearchQuery("")}>
              <X size={14} />
            </button>
          )}
        </div>

        <div className="filter-group-right">
          {/* Priority Filter */}
          <div className="filter-pill-selector">
            <span className="filter-group-label">Priority:</span>
            {["ALL", "HIGH", "MEDIUM", "STANDARD"].map((p) => (
              <button
                key={p}
                className={`filter-pill-btn ${priorityFilter === p ? "active" : ""}`}
                onClick={() => setPriorityFilter(p)}
              >
                {p.charAt(0) + p.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* Finding Status Filter */}
          <div className="filter-select-wrapper">
            <span className="filter-group-label">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="status-select-dropdown"
            >
              <option value="ALL">All Outcomes</option>
              <option value="NORMAL">Normal</option>
              <option value="ABNORMAL">Abnormal</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
        </div>
      </div>

      {/* Batch Selection Bar */}
      {selectedStudyIds.size > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#ffffff",
            border: "0.5px solid #0f172a",
            borderRadius: "8px",
            padding: "8px 16px",
            marginBottom: "12px",
            boxShadow: "0 2px 4px rgba(15, 23, 42, 0.05)",
          }}
        >
          <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#0f172a" }}>
            {selectedStudyIds.size} studies selected
          </span>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              type="button"
              onClick={handleExportCSV}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "#ffffff",
                border: "0.5px solid #0f172a",
                borderRadius: "6px",
                padding: "5px 12px",
                fontSize: "0.78rem",
                fontWeight: 600,
                color: "#0f172a",
                cursor: "pointer",
              }}
            >
              <Download size={13} />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={() => setShowBatchDeleteConfirm(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "#dc2626",
                border: "0.5px solid #0f172a",
                borderRadius: "6px",
                padding: "5px 12px",
                fontSize: "0.78rem",
                fontWeight: 600,
                color: "#ffffff",
                cursor: "pointer",
              }}
            >
              <Trash2 size={13} />
              <span>Delete Selected</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedStudyIds(new Set())}
              style={{
                display: "inline-flex",
                alignItems: "center",
                background: "transparent",
                border: "none",
                padding: "5px 8px",
                fontSize: "0.78rem",
                color: "#64748b",
                cursor: "pointer",
              }}
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Main Studies Table Card */}
      <div className="reviewed-table-container">
        <table className="reviewed-data-table">
          <thead>
            <tr>
              <th className="th-checkbox">
                <input
                  type="checkbox"
                  checked={
                    filteredStudies.filter((s) => matchesCurrentUser(s.uploaded_by || s.uploadedBy)).length > 0 &&
                    selectedStudyIds.size === filteredStudies.filter((s) => matchesCurrentUser(s.uploaded_by || s.uploadedBy)).length
                  }
                  onChange={handleSelectAll}
                  aria-label="Select all my studies"
                />
              </th>
              <th>Patient Information</th>
              <th>Study ID & Modality</th>
              <th>Priority Level</th>
              <th>Sign-off Status</th>
              <th>Reviewer Clinician</th>
              <th>Sign-off Time & Turnaround</th>
              <th>Radiologist Impression</th>
              <th className="th-actions text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan="9" className="table-state-cell">
                  <div className="loading-spinner-box">
                    <RefreshCw size={24} className="spin-icon" />
                    <span>Loading reviewed examinations...</span>
                  </div>
                </td>
              </tr>
            ) : filteredStudies.length === 0 ? (
              <tr>
                <td colSpan="9" className="table-state-cell">
                  <div className="empty-state-box">
                    <CheckCircle2 size={38} className="empty-state-icon" />
                    <h3>No Reviewed Studies Found</h3>
                    <p>
                      {searchQuery || priorityFilter !== "ALL" || statusFilter !== "ALL"
                        ? "No studies match the active filter criteria. Try clearing filters."
                        : "When studies are reviewed and signed off in the worklist or diagnostic viewer, they will appear here in the permanent archive."}
                    </p>
                    <button
                      className="reviewed-action-btn primary"
                      onClick={() => navigate("/worklist")}
                      style={{ marginTop: 12 }}
                    >
                      Go to Active Worklist
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              filteredStudies.map((study) => {
                const isSelected = selectedStudyIds.has(study.studyId);
                const priorityClass =
                  study.priorityLevel === "HIGH"
                    ? "priority-high"
                    : study.priorityLevel === "MEDIUM"
                    ? "priority-medium"
                    : "priority-standard";

                const reviewStatusClass =
                  study.reviewStatus === "CRITICAL"
                    ? "status-critical"
                    : study.reviewStatus === "ABNORMAL"
                    ? "status-abnormal"
                    : "status-normal";

                const canDelete = matchesCurrentUser(study.uploaded_by || study.uploadedBy);

                return (
                  <tr key={study.studyId} className={`reviewed-table-row ${isSelected ? "row-selected" : ""}`}>
                    <td className="td-checkbox">
                      {canDelete ? (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(study.studyId)}
                          aria-label={`Select study ${study.studyId}`}
                        />
                      ) : (
                        <input
                          type="checkbox"
                          disabled
                          title="Protected: Sent by another clinician"
                          style={{ opacity: 0.25, cursor: "not-allowed" }}
                        />
                      )}
                    </td>

                    {/* Patient Information */}
                    <td className="td-patient">
                      <div className="patient-cell-flex">
                        <div
                          className="patient-avatar-circle"
                          style={{
                            overflow: "hidden",
                            width: "36px",
                            height: "36px",
                            borderRadius: "6px",
                            border: "0.5px solid #0f172a",
                            background: "#020617",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                          onClick={() => navigate(`/study/${study.studyId || study.id}?from=reviewed`, { state: { from: "reviewed" } })}
                          title="Open diagnostic examination"
                        >
                          <img
                            src={study.imageUrl || "/xray_frontal_hd.png"}
                            alt={study.studyId}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = "/xray_frontal_hd.png";
                            }}
                          />
                        </div>
                        <div className="patient-cell-info">
                          <span
                            className="patient-name-text"
                            style={{ cursor: "pointer" }}
                            onClick={() => navigate(`/study/${study.studyId || study.id}?from=reviewed`, { state: { from: "reviewed" } })}
                          >
                            {study.patientName}
                          </span>
                          <span className="patient-mrn-text">
                            {study.patientId} &bull; {study.age || 54}y &bull; {study.sex || "M"}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Study ID & Modality */}
                    <td className="td-study">
                      <div
                        className="study-id-text"
                        style={{ cursor: "pointer" }}
                        onClick={() => navigate(`/study/${study.studyId || study.id}?from=reviewed`, { state: { from: "reviewed" } })}
                      >
                        {study.studyId}
                      </div>
                      <div className="study-modality-badge">
                        {study.modality || "X-RAY"} &bull; {study.bodyPart || "Chest"}
                      </div>
                    </td>

                    {/* Priority */}
                    <td className="td-priority">
                      <span className={`priority-indicator-pill ${priorityClass}`}>
                        {study.priorityLevel || "STANDARD"}
                      </span>
                    </td>

                    {/* Sign-off Status */}
                    <td className="td-status">
                      <span className={`signoff-status-badge ${reviewStatusClass}`}>
                        <Check size={12} strokeWidth={2.5} />
                        <span>{study.reviewStatus || "NORMAL"}</span>
                      </span>
                    </td>

                    {/* Reviewer */}
                    <td className="td-reviewer">
                      <span className="reviewer-name-text">{study.reviewerId || "Dr. Sarah Lin, MD"}</span>
                    </td>

                    {/* Sign-off Time & Turnaround */}
                    <td className="td-time">
                      <div className="time-primary-text">{study.reviewedAt}</div>
                      <div className="turnaround-subtext">
                        <Clock size={11} />
                        <span>{study.turnaroundTimeMins || 14}m turnaround</span>
                      </div>
                    </td>

                    {/* Radiologist Impression */}
                    <td className="td-impression">
                      <p className="impression-snippet-text" title={study.reviewNotes}>
                        {study.reviewNotes || "Normal examination. Sign-off recorded."}
                      </p>
                    </td>

                    {/* Actions */}
                    <td className="td-actions text-right">
                      <div className="actions-cluster">
                        <button
                          className="row-action-icon-btn"
                          title="View Diagnostic Scan"
                          onClick={() => navigate(`/study/${study.studyId || study.id}?from=reviewed`, { state: { from: "reviewed" } })}
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          className="row-action-icon-btn"
                          title="View Report Details"
                          onClick={() => setSelectedReport(study)}
                        >
                          <FileText size={15} />
                        </button>
                        <button
                          className="row-action-icon-btn revert-btn"
                          title="Reopen / Return to Active Worklist"
                          onClick={() => handleRevertStudy(study.studyId)}
                        >
                          <RotateCcw size={14} />
                        </button>
                        {canDelete ? (
                          <button
                            className="row-action-icon-btn delete-btn"
                            title="Permanently Delete Study (My Upload)"
                            onClick={() => setDeleteTargetStudy(study)}
                          >
                            <Trash2 size={14} />
                          </button>
                        ) : (
                          <span
                            className="row-action-icon-btn disabled-btn"
                            title="Protected: Only the clinician who uploaded this study can delete it"
                            style={{
                              opacity: 0.25,
                              cursor: "not-allowed",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              padding: "4px",
                            }}
                          >
                            <Trash2 size={14} />
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Report Modal */}
      <AnimatePresence>
        {selectedReport && (
          <motion.div
            className="report-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setSelectedReport(null)}
          >
            <motion.div
              className="report-modal-card"
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="report-modal-header">
                <div className="modal-header-info">
                  <div className="modal-tag">FINAL RADIOLOGY REPORT</div>
                  <h2>{selectedReport.patientName}</h2>
                  <div className="modal-submeta">
                    <span>MRN: {selectedReport.patientId}</span>
                    <span>&bull;</span>
                    <span>Study ID: {selectedReport.studyId}</span>
                    <span>&bull;</span>
                    <span>Modality: {selectedReport.modality} ({selectedReport.bodyPart})</span>
                  </div>
                </div>
                <button className="modal-close-btn" onClick={() => setSelectedReport(null)}>
                  <X size={18} />
                </button>
              </div>

              <div className="report-modal-body">
                <div className="report-meta-grid">
                  <div className="meta-box">
                    <span className="meta-lbl">Reviewing Radiologist</span>
                    <strong className="meta-val">{selectedReport.reviewerId}</strong>
                  </div>
                  <div className="meta-box">
                    <span className="meta-lbl">Final Clinical Status</span>
                    <span className={`signoff-status-badge status-${(selectedReport.reviewStatus || "normal").toLowerCase()}`}>
                      {selectedReport.reviewStatus}
                    </span>
                  </div>
                  <div className="meta-box">
                    <span className="meta-lbl">Signed-off At</span>
                    <strong className="meta-val">{selectedReport.reviewedAt}</strong>
                  </div>
                  <div className="meta-box">
                    <span className="meta-lbl">Turnaround Time</span>
                    <strong className="meta-val">{selectedReport.turnaroundTimeMins} minutes</strong>
                  </div>
                </div>

                <div className="report-section-block">
                  <h4>AI Pre-Read Findings</h4>
                  <div className="report-ai-badge">
                    <Sparkles size={14} />
                    <span>{selectedReport.aiFindings || "Standard triage protocol - no acute critical findings"}</span>
                  </div>
                </div>

                <div className="report-section-block" style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                  <div
                    style={{
                      width: "130px",
                      height: "130px",
                      borderRadius: "8px",
                      border: "0.5px solid #0f172a",
                      overflow: "hidden",
                      background: "#020617",
                      flexShrink: 0,
                      cursor: "pointer",
                    }}
                    onClick={() => navigate(`/study/${selectedReport.studyId}?from=reviewed`, { state: { from: "reviewed" } })}
                    title="Click to open scan in PACS viewer"
                  >
                    <img
                      src={selectedReport.imageUrl || selectedReport.image_url || "/xray_frontal_hd.png"}
                      alt={selectedReport.studyId}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = "/xray_frontal_hd.png";
                      }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ marginTop: 0 }}>Radiologist Impression & Diagnostic Notes</h4>
                    <div className="report-clinical-text">
                      {selectedReport.reviewNotes || "Normal anatomical structures. Diagnostic sign-off completed."}
                    </div>
                  </div>
                </div>
              </div>

              <div className="report-modal-footer">
                <button
                  className="reviewed-action-btn secondary"
                  onClick={() => handleRevertStudy(selectedReport.studyId)}
                >
                  <RotateCcw size={14} />
                  <span>Reopen to Queue</span>
                </button>
                <div className="footer-right-buttons">
                  <button className="reviewed-action-btn secondary" onClick={() => setSelectedReport(null)}>
                    Close
                  </button>
                  <button
                    className="reviewed-action-btn primary"
                    onClick={() => navigate(`/study/${selectedReport.studyId}?from=reviewed`, { state: { from: "reviewed" } })}
                  >
                    <ExternalLink size={14} />
                    <span>Open in Diagnostic Viewer</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Single Study Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteTargetStudy && (
          <motion.div
            className="radix-delete-modal-overlay"
            onClick={() => !isDeleting && setDeleteTargetStudy(null)}
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
                  <h4>Delete Reviewed Study?</h4>
                  <p>
                    Permanently delete this reviewed study record and all stored PACS scan assets. This action cannot be reversed.
                  </p>
                </div>
              </div>

              <div className="radix-delete-target-preview">
                <div><strong>Study:</strong> {deleteTargetStudy.studyId}</div>
                <div><strong>Patient:</strong> {deleteTargetStudy.patientName} ({deleteTargetStudy.patientId})</div>
                <div><strong>Review Status:</strong> {deleteTargetStudy.reviewStatus}</div>
              </div>

              <div className="radix-delete-modal-actions">
                <button
                  type="button"
                  className="radix-delete-cancel-btn"
                  onClick={() => setDeleteTargetStudy(null)}
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
        {showBatchDeleteConfirm && (
          <motion.div
            className="radix-delete-modal-overlay"
            onClick={() => !isDeleting && setShowBatchDeleteConfirm(false)}
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
                  <h4>Delete {selectedStudyIds.size} Selected Studies?</h4>
                  <p>
                    Permanently remove {selectedStudyIds.size} finalized studies and all diagnostic images from the archive.
                  </p>
                </div>
              </div>

              <div className="radix-delete-modal-actions">
                <button
                  type="button"
                  className="radix-delete-cancel-btn"
                  onClick={() => setShowBatchDeleteConfirm(false)}
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
                  <span>{isDeleting ? "Deleting..." : `Delete ${selectedStudyIds.size} Studies`}</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ReviewedStudies;
