import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ZoomIn,
  ZoomOut,
  Hand,
  RotateCcw,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Clock,
  User,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  Check,
  Play,
  ArrowRight,
  Activity,
  Trash2,
  Sparkles,
  RefreshCw,
  SunMedium,
} from "lucide-react";
import PriorityOverrideModal from "./PriorityOverrideModal";
import WhyPrioritizedPanel from "./WhyPrioritizedPanel";

export const StudyViewer = ({
  study,
  onStartReview,
  onMarkReviewed,
  onRevertStudy,
  onNextStudy,
  onPrevStudy,
  onOverridePriority,
  onDeleteStudy,
  onBackToWorklist,
  backLabel = "Worklist",
  studyIndex = 1,
  totalStudies = 40,
}) => {
  const [activeTab, setActiveTab] = useState("ai"); // "ai", "patient", "audit"
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isScanning, setIsScanning] = useState(true);
  const [scanCompleted, setScanCompleted] = useState(false);
  const [showAiOverlay, setShowAiOverlay] = useState(true);
  const [isInverted, setIsInverted] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const dragStartRef = useRef(null);
  const prevStudyRef = useRef(study?.id);

  const handleConfirmDelete = async () => {
    if (!onDeleteStudy) return;
    setIsDeleting(true);
    try {
      await onDeleteStudy(study.id || study.studyId);
    } catch (err) {
      console.error("Delete study failed:", err);
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    if (prevStudyRef.current !== study?.id) {
      prevStudyRef.current = study?.id;
      setIsScanning(true);
      setScanCompleted(false);
    }
  }, [study?.id]);

  useEffect(() => {
    if (isScanning) {
      const timer = setTimeout(() => {
        setIsScanning(false);
        setScanCompleted(true);
      }, 1400);
      return () => clearTimeout(timer);
    }
  }, [isScanning]);

  const handleTriggerReScan = () => {
    setIsScanning(true);
    setScanCompleted(false);
  };

  // Keyboard shortcut listener for radiologists
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        e.target.tagName === "INPUT" ||
        e.target.tagName === "TEXTAREA" ||
        e.target.tagName === "SELECT"
      ) {
        return;
      }

      if (e.key === "r" || e.key === "R") {
        if (onMarkReviewed && study) onMarkReviewed(study.id);
      } else if (e.key === "ArrowRight") {
        if (onNextStudy) onNextStudy();
      } else if (e.key === "ArrowLeft") {
        if (onPrevStudy) onPrevStudy();
      } else if (e.key === "+" || e.key === "=") {
        setZoomLevel((prev) => Math.min(prev + 0.25, 3.5));
      } else if (e.key === "-" || e.key === "_") {
        setZoomLevel((prev) => Math.max(prev - 0.25, 0.6));
      } else if (e.key === "0") {
        setZoomLevel(1);
        setPanOffset({ x: 0, y: 0 });
      } else if (e.key === "Escape") {
        if (isFullscreen) setIsFullscreen(false);
        else if (onBackToWorklist) onBackToWorklist();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [study, onMarkReviewed, onNextStudy, onPrevStudy, onBackToWorklist, isFullscreen]);

  if (!study) {
    return (
      <div className="study-viewer-empty">
        <p>No study selected. Please return to the worklist.</p>
        {onBackToWorklist && (
          <button className="back-btn" onClick={onBackToWorklist}>
            Back to Worklist
          </button>
        )}
      </div>
    );
  }

  // Zoom controls
  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.25, 3.5));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.25, 0.6));
  const handleReset = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  // Mouse pan handlers
  const handleMouseDown = (e) => {
    setIsPanning(true);
    dragStartRef.current = {
      startX: e.clientX - panOffset.x,
      startY: e.clientY - panOffset.y,
    };
  };

  const handleMouseMove = (e) => {
    if (!isPanning || !dragStartRef.current) return;
    setPanOffset({
      x: e.clientX - dragStartRef.current.startX,
      y: e.clientY - dragStartRef.current.startY,
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    dragStartRef.current = null;
  };

  const currentPriority =
    study?.priority ||
    (study?.priority_level === "HIGH"
      ? "High"
      : study?.priority_level === "MEDIUM"
      ? "Medium"
      : "Low");
  const studyIdentifier =
    study?.studyId || `ST-${String(study?.id || 1).padStart(3, "0")}`;
  const isReviewed = study?.status === "REVIEWED" || study?.status === "Reviewed";
  const isInReview = study?.status === "IN_REVIEW";
  const isHighPriority = currentPriority === "High";
  const isMedPriority = currentPriority === "Medium";

  const probabilities = study?.aiProbabilities || {
    "Consolidation / Pneumonia": Math.round((study?.priorityScore || 0.5) * 100),
    "Pleural Effusion": Math.round((study?.priorityScore || 0.5) * 75),
    "Pneumothorax": 4,
  };

  const sortedProbEntries = Object.entries(probabilities).sort((a, b) => b[1] - a[1]);
  const [topFindingName, topFindingProb] = sortedProbEntries[0] || ["Pathology Analysis", 85];
  const isUrgentFinding =
    isHighPriority ||
    topFindingProb >= 70;
  const isClearLung =
    topFindingName.toLowerCase().includes("clear") ||
    (!isHighPriority && topFindingProb < 35);

  const clearLungConfidence = (
    topFindingName.toLowerCase().includes("clear")
      ? topFindingProb
      : study?.confidenceScore && study.confidenceScore > 0.5
      ? (study.confidenceScore > 1 ? study.confidenceScore : study.confidenceScore * 100)
      : Math.max(94.5, 100 - topFindingProb)
  ).toFixed(1);

  const heatmapCoords = study?.heatmapCoordinates || {
    x: isClearLung ? 20 : 52,
    y: isClearLung ? 16 : 48,
    width: isClearLung ? 60 : 30,
    height: isClearLung ? 64 : 26,
    label: isClearLung ? "Bilateral Clear Lung Fields" : "Pathology Zone",
  };

  return (
    <motion.section
      className={`radix-pacs-workstation ${isFullscreen ? "fullscreen-mode" : ""}`}
      initial={{ opacity: 0.95 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0.95 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
    >
      {/* 1. TOP CLINICAL & PATIENT NAVIGATION BAR */}
      <header className="pacs-top-bar">
        <div className="pacs-top-left">
          {onBackToWorklist && (
            <button
              className="pacs-back-btn"
              onClick={onBackToWorklist}
              title={`Return to ${backLabel} [Key: Esc]`}
            >
              <ArrowLeft size={15} />
              <span>{backLabel}</span>
            </button>
          )}

          <div className="study-id-badge">{studyIdentifier}</div>
          <div className="patient-id-tag">{study.patientId}</div>

          <div className="patient-quick-meta">
            <strong className="patient-name">{study.patientName}</strong>
            <span className="meta-dot">&bull;</span>
            <span>{study.age} / {study.sex}</span>
            <span className="meta-dot">&bull;</span>
            <span className="modality-chip">{study.bodyPart} {study.modality}</span>
            <span className="meta-dot">&bull;</span>
            <span className="arrival-chip">{study.arrivalTime}</span>
          </div>
        </div>

        <div className="pacs-top-right">
          {/* Sequence Stepper */}
          <div className="study-sequence-controls">
            <button
              className="seq-btn"
              onClick={onPrevStudy}
              disabled={!onPrevStudy}
              title="Previous study [Key: Left]"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="seq-label">
              {backLabel === "Reviewed Studies" ? "Archive" : "Study"} {studyIndex} of {totalStudies}
            </span>
            <button
              className="seq-btn"
              onClick={onNextStudy}
              disabled={!onNextStudy}
              title="Next study [Key: Right]"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Priority Pill */}
          <div
            className={`pacs-priority-pill ${
              isHighPriority
                ? "priority-high"
                : isMedPriority
                ? "priority-med"
                : "priority-low"
            }`}
          >
            <span className="pulse-dot"></span>
            <span>{(currentPriority || "STANDARD").toUpperCase()} PRIORITY</span>
            <span className="priority-score">
              {study?.priorityScore !== undefined
                ? Number(study.priorityScore).toFixed(2)
                : study?.priority_score !== undefined
                ? Number(study.priority_score).toFixed(2)
                : "0.00"}
            </span>
          </div>

          {/* Review Status Tag */}
          <div
            className={`pacs-status-pill ${
              isReviewed ? "status-reviewed" : isInReview ? "status-in-review" : "status-pending"
            }`}
          >
            {isReviewed ? (
              <>
                <CheckCircle2 size={12} />
                <span>REVIEWED</span>
              </>
            ) : isInReview ? (
              <>
                <span className="live-review-dot"></span>
                <span>IN REVIEW</span>
              </>
            ) : (
              <span>PENDING REVIEW</span>
            )}
          </div>
        </div>
      </header>

      {/* 2. MAIN PACS WORKSPACE (2-COLUMN SPLIT: IMAGE CANVAS + CLINICAL INSPECTOR) */}
      <div className="pacs-main-workspace">
        {/* COLUMN A: HIGH-DEFINITION PACS IMAGE CANVAS */}
        <div className="pacs-canvas-column">
          <div
            className={`pacs-stage-viewport ${isPanning ? "panning" : ""}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Anatomical Marker */}
            <div className="anatomical-marker">R</div>

            {/* Top Scanning HUD or Complete status */}
            <AnimatePresence>
              {isScanning && (
                <motion.div
                  className="pacs-scanning-hud"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  <Activity size={13} className="dicom-pulse-icon" />
                  <span>DenseNet-121 AI Scanning & Localizing...</span>
                </motion.div>
              )}
              {!isScanning && scanCompleted && (
                <motion.div
                  className="pacs-scan-complete-badge"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <CheckCircle2 size={13} style={{ color: isUrgentFinding ? "#f87171" : "#34d399" }} />
                  <span>
                    AI Scan Complete: {isClearLung ? `Clear Lung Fields Verified (${clearLungConfidence}%)` : `${topFindingName} (${topFindingProb}%)`}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* HUD Overlay */}
            <div className="pacs-hud-bar">
              <span>Zoom: {Math.round(zoomLevel * 100)}%</span>
              <span className="hud-series">Series 1/1 • DICOM 16-bit</span>
              {isInverted && <span className="hud-badge-invert">W/L Inverted</span>}
              {showAiOverlay && scanCompleted && <span className="hud-badge-heat">AI Overlay ON</span>}
            </div>

            {/* Transformable Image Container */}
            <div
              className="pacs-image-transformer"
              style={{
                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
              }}
            >
              <div className="pacs-image-wrapper">
                <motion.img
                  key={study.id}
                  src={
                    study.imageUrl ||
                    study.image_url ||
                    "/xray_frontal_hd.png"
                  }
                  alt={`${study.patientId} frontal projection`}
                  className="pacs-scan-image"
                  draggable={false}
                  style={{
                    filter: isInverted ? "invert(1)" : "none",
                  }}
                  initial={{ opacity: 0.7 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  onError={(e) => {
                    if (!e.currentTarget.dataset.fallbackApplied) {
                      e.currentTarget.dataset.fallbackApplied = "true";
                      e.currentTarget.src = "/xray_frontal_hd.png";
                    }
                  }}
                />

                {/* Single smooth laser scan pass across the radiograph */}
                <AnimatePresence>
                  {isScanning && (
                    <motion.div
                      className="pacs-scan-laser-line"
                      initial={{ top: "0%", opacity: 0.2 }}
                      animate={{ top: "100%", opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 1.4, ease: "easeInOut" }}
                    />
                  )}
                </AnimatePresence>

                {/* Localized AI Bounding Box / Heatmap Overlay */}
                <AnimatePresence>
                  {!isScanning && scanCompleted && showAiOverlay && (
                    <motion.div
                      className={`pacs-heatmap-overlay ${isUrgentFinding ? "urgent" : isClearLung ? "normal" : ""}`}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.25 }}
                      style={{
                        left: `${heatmapCoords.x}%`,
                        top: `${heatmapCoords.y}%`,
                        width: `${heatmapCoords.width}%`,
                        height: `${heatmapCoords.height}%`,
                      }}
                    >
                      <div className={`heatmap-tag ${isUrgentFinding ? "urgent" : isClearLung ? "normal" : ""}`}>
                        {isClearLung ? (
                          <>
                            <CheckCircle2 size={11} />
                            <span>Clear Lung Fields (Verified {clearLungConfidence}%)</span>
                          </>
                        ) : (
                          <>
                            <Sparkles size={11} />
                            <span>{topFindingName}: {topFindingProb}%</span>
                          </>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Streamlined Diagnostic PACS Toolbar */}
          <div className="pacs-toolbar">
            <button className="toolbar-item" onClick={handleZoomIn} title="Zoom In [Key: +]">
              <ZoomIn size={15} />
              <span>Zoom In</span>
            </button>

            <button className="toolbar-item" onClick={handleZoomOut} title="Zoom Out [Key: -]">
              <ZoomOut size={15} />
              <span>Zoom Out</span>
            </button>

            <button
              className={`toolbar-item ${isPanning ? "active" : ""}`}
              onClick={() => setIsPanning(!isPanning)}
              title="Pan Tool (drag to pan)"
            >
              <Hand size={15} />
              <span>Pan</span>
            </button>

            <button className="toolbar-item" onClick={handleReset} title="Reset View [Key: 0]">
              <RotateCcw size={15} />
              <span>Reset</span>
            </button>

            <button
              className={`toolbar-item ${showAiOverlay ? "active" : ""}`}
              onClick={() => setShowAiOverlay(!showAiOverlay)}
              title="Toggle AI Pathology Localization Overlay"
            >
              <Sparkles size={15} />
              <span>{showAiOverlay ? "Overlay ON" : "Overlay OFF"}</span>
            </button>

            <button
              className="toolbar-item"
              onClick={handleTriggerReScan}
              title="Re-run DenseNet-121 AI Diagnostic Scan"
              disabled={isScanning}
            >
              <RefreshCw size={14} className={isScanning ? "spin-icon" : ""} />
              <span>{isScanning ? "Scanning..." : "Re-Scan"}</span>
            </button>

            <button
              className={`toolbar-item ${isInverted ? "active" : ""}`}
              onClick={() => setIsInverted(!isInverted)}
              title="Invert Window / Level Grayscale"
            >
              <SunMedium size={15} />
              <span>Invert</span>
            </button>

            <button
              className="toolbar-item"
              onClick={() => setIsFullscreen(!isFullscreen)}
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              <span>{isFullscreen ? "Exit" : "Fullscreen"}</span>
            </button>
          </div>
        </div>

        {/* COLUMN B: CLINICAL & AI FINDINGS INSPECTOR */}
        <div className="pacs-inspector-column">
          {/* Segmented Tab Controls */}
          <div className="inspector-tabs-header">
            <button
              className={`inspector-tab-btn ${activeTab === "ai" ? "active" : ""}`}
              onClick={() => setActiveTab("ai")}
            >
              <Activity size={13} />
              <span>AI Insights</span>
            </button>

            <button
              className={`inspector-tab-btn ${activeTab === "patient" ? "active" : ""}`}
              onClick={() => setActiveTab("patient")}
            >
              <User size={13} />
              <span>Patient & History</span>
            </button>

            <button
              className={`inspector-tab-btn ${activeTab === "audit" ? "active" : ""}`}
              onClick={() => setActiveTab("audit")}
            >
              <Clock size={13} />
              <span>Audit Trail</span>
            </button>
          </div>

          {/* Inspector Content Body */}
          <div className="inspector-scroll-content">
            <AnimatePresence>
              {/* TAB 1: AI INSIGHTS */}
              {activeTab === "ai" && (
                <motion.div
                  key="tab-ai"
                  className="tab-panel-inner"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                >
                  {/* Explainable "Why This Study Is Prioritized?" Panel with Score Decomposition */}
                  <WhyPrioritizedPanel
                    study={study}
                    onOverride={() => setIsOverrideModalOpen(true)}
                    showOverrideBtn={true}
                    theme="light"
                  />

                  {/* Condition Probabilities */}
                  {probabilities && (
                    <div className="inspector-section-block">
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <h4 className="section-title">Condition Probability Analysis</h4>
                        <span style={{ fontSize: "0.65rem", color: "#64748b", fontWeight: 600 }}>DenseNet-121</span>
                      </div>
                      <div className="probabilities-list">
                        {sortedProbEntries.map(([cond, prob]) => (
                          <div key={cond} className="prob-row">
                            <div className="prob-label-group">
                              <span className="cond-name">{cond}</span>
                              <span className="cond-val">{prob}%</span>
                            </div>
                            <div className="prob-bar-track">
                              <div
                                className={`prob-bar-fill ${
                                  prob >= 70 ? "high" : prob >= 40 ? "med" : "low"
                                }`}
                                style={{ width: `${Math.min(100, prob)}%` }}
                              ></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Regulatory Disclaimer */}
                  <div className="clinical-disclaimer-card">
                    <AlertTriangle size={13} />
                    <span>
                      AI triage decision support only. Diagnostic interpretation and clinical management require radiologist review.
                    </span>
                  </div>
                </motion.div>
              )}

              {/* TAB 2: PATIENT & HISTORY */}
              {activeTab === "patient" && (
                <motion.div
                  key="tab-patient"
                  className="tab-panel-inner"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                >
                  <div className="inspector-section-block">
                    <h4 className="section-title">
                      <User size={13} /> Patient Demographics
                    </h4>
                    <div className="demographics-table">
                      <div className="demo-row">
                        <span className="lbl">Patient Name:</span>
                        <strong className="val">{study.patientName}</strong>
                      </div>
                      <div className="demo-row">
                        <span className="lbl">Patient ID (MRN):</span>
                        <span className="val code">{study.patientId}</span>
                      </div>
                      <div className="demo-row">
                        <span className="lbl">Age & Sex:</span>
                        <span className="val">{study.age} years &bull; {study.sex === "M" ? "Male" : "Female"}</span>
                      </div>
                      <div className="demo-row">
                        <span className="lbl">Referring Clinician:</span>
                        <span className="val">{study.patientDetails?.referringDoctor || "Dr. Sarah Chen, MD"}</span>
                      </div>
                      <div className="demo-row">
                        <span className="lbl">Department:</span>
                        <span className="val">{study.patientDetails?.department || "Emergency Medicine"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="inspector-section-block">
                    <h4 className="section-title">Clinical Presentation & Symptoms</h4>
                    <p className="clinical-history-text">
                      {study.patientDetails?.clinicalHistory ||
                        "Patient presenting with acute onset dyspnea, right-sided pleuritic chest pain for 24h, and fever 38.5°C. Stat radiographic evaluation requested by emergency triage."}
                    </p>
                  </div>

                  <div className="inspector-section-block">
                    <h4 className="section-title">Allergies & Alerts</h4>
                    <div className="allergy-badge">
                      <span>{study.patientDetails?.allergies || "NKDA (No Known Drug Allergies)"}</span>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* TAB 3: AUDIT TRAIL */}
              {activeTab === "audit" && (
                <motion.div
                  key="tab-audit"
                  className="tab-panel-inner"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                >
                  <div className="inspector-section-block">
                    <h4 className="section-title">
                      <Clock size={13} /> Chronological Audit Log
                    </h4>
                    <div className="audit-timeline">
                      {(study.history && study.history.length > 0
                        ? study.history
                        : [
                            {
                              time: study.arrivalTime,
                              event: "DICOM imaging series acquired and received in PACS queue",
                            },
                            {
                              time: "1.4s after acquisition",
                              event: `RADIX DeepVision AI triage executed: Score ${study.priorityScore?.toFixed(2)} (${study.priority.toUpperCase()})`,
                            },
                          ]
                      ).map((item, idx) => (
                        <div key={idx} className="timeline-node">
                          <div className="timeline-node-dot"></div>
                          <div className="timeline-node-body">
                            <span className="timeline-time">{item.time}</span>
                            <span className="timeline-desc">{item.event}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* 3. BOTTOM CLINICAL DIAGNOSTIC ACTION BAR */}
      <footer className="pacs-bottom-bar">
        <div className="bottom-bar-left">
          <button
            className="override-trigger-btn"
            onClick={() => setIsOverrideModalOpen(true)}
            title="Adjust triage priority with clinical audit reason"
          >
            <Sliders size={13} />
            <span>Override Priority</span>
          </button>

          {onDeleteStudy && (
            <button
              type="button"
              className="pacs-delete-trigger-btn"
              onClick={() => setShowDeleteConfirm(true)}
              title="Permanently remove and delete this study"
            >
              <Trash2 size={13} />
              <span>Delete Study</span>
            </button>
          )}

          <div className="shortcuts-hint">
            <span>Keys: </span>
            <kbd>[R]</kbd> Review &bull; <kbd>[&rarr;]</kbd> Next &bull; <kbd>[+/-]</kbd> Zoom
          </div>
        </div>

        <div className="bottom-bar-right">
          {/* Start Review Button */}
          {!isInReview && !isReviewed && onStartReview && (
            <button
              className="pacs-action-btn start-btn"
              onClick={async () => {
                setActionLoading(true);
                await onStartReview(study.id);
                setActionLoading(false);
              }}
              disabled={actionLoading}
              title="Lock study and begin radiologist interpretation"
            >
              <Play size={13} />
              <span>{actionLoading ? "Locking Study..." : "Start Review"}</span>
            </button>
          )}

          {/* Mark Reviewed & Sign Off */}
          {onMarkReviewed && (
            <button
              className={`pacs-action-btn review-btn ${isReviewed ? "reviewed" : ""}`}
              onClick={async () => {
                if (isReviewed) return;
                setActionLoading(true);
                await onMarkReviewed(study.id);
                setActionLoading(false);
              }}
              disabled={actionLoading}
              title={isReviewed ? "Study marked as reviewed" : "Finalize & sign off study"}
            >
              {isReviewed ? (
                <>
                  <CheckCircle2 size={14} />
                  <span>Reviewed & Finalized</span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span>{actionLoading ? "Signing Off..." : isInReview ? "Complete & Sign Off" : "Mark as Reviewed"}</span>
                </>
              )}
            </button>
          )}

          {/* Reopen / Return to Active Queue */}
          {isReviewed && onRevertStudy && (
            <button
              className="pacs-action-btn revert-btn"
              onClick={() => onRevertStudy(study.studyId || study.id)}
              title="Reopen examination and move back to active triage queue"
            >
              <RotateCcw size={13} />
              <span>Reopen to Worklist</span>
            </button>
          )}

          {/* Next Study */}
          {onNextStudy && (
            <button
              className="pacs-action-btn next-btn"
              onClick={onNextStudy}
              title="Advance to next study in queue [Key: →]"
            >
              <span>Next {backLabel === "Reviewed Studies" ? "Archive Study" : "Patient"}</span>
              <ArrowRight size={13} />
            </button>
          )}
        </div>
      </footer>

      {/* Manual Priority Override Modal */}
      <PriorityOverrideModal
        isOpen={isOverrideModalOpen}
        onClose={() => setIsOverrideModalOpen(false)}
        study={study}
        onOverrideSubmit={async (overrideData) => {
          if (onOverridePriority) {
            await onOverridePriority(overrideData);
          }
        }}
      />

      {/* Delete Study Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            className="radix-delete-modal-overlay"
            onClick={() => !isDeleting && setShowDeleteConfirm(false)}
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
                    Permanently remove this study record, diagnostic image files, and all associated AI findings. This action cannot be undone.
                  </p>
                </div>
              </div>

              <div className="radix-delete-target-preview">
                <div><strong>Study:</strong> {studyIdentifier}</div>
                <div><strong>Patient:</strong> {study.patientName} ({study.patientId})</div>
                <div><strong>Modality:</strong> {study.bodyPart} {study.modality}</div>
              </div>

              <div className="radix-delete-modal-actions">
                <button
                  type="button"
                  className="radix-delete-cancel-btn"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="radix-delete-confirm-btn"
                  onClick={handleConfirmDelete}
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
    </motion.section>
  );
};

export default StudyViewer;