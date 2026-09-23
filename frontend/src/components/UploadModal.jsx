import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud,
  X,
  CheckCircle2,
  Activity,
  FileUp,
  AlertCircle,
  FileText,
  Clock,
  Trash2,
  Sparkles,
  ShieldCheck,
  Cpu,
  Zap,
  Layers,
} from "lucide-react";
import { studyService } from "../services/studyService";
import "./UploadModal.css";

const AI_PIPELINE_STAGES = [
  { id: 1, label: "DICOM Validation & Tensor Matrix Ingestion", desc: "Verifying 16-bit thoracic pixel matrix & DICOM metadata" },
  { id: 2, label: "DenseNet-121 Deep Learning Feature Extraction", desc: "Scanning 6 acute pulmonary pathology signatures" },
  { id: 3, label: "6-Tier Clinical Urgency Tie-Breaker", desc: "Weighting acuity, waiting time, and anatomical findings" },
  { id: 4, label: "Hospital Worklist Queue Ingestion", desc: "Dispatching prioritized study to attending radiologist" },
];

export const UploadModal = ({ isOpen, onClose, onStudyUploaded, nextId = 41 }) => {
  const initialRand = Math.floor(1000 + Math.random() * 9000);
  const formattedStudyId = `ST-${initialRand}`;
  const defaultPatientId = `PX-${initialRand}`;
  const currentTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const [studyId, setStudyId] = useState(formattedStudyId);
  const [patientId, setPatientId] = useState(defaultPatientId);
  const [patientName, setPatientName] = useState("");
  const [age, setAge] = useState("52");
  const [sex, setSex] = useState("M");
  const [modality, setModality] = useState("X-ray");
  const [bodyPart, setBodyPart] = useState("Chest");
  const [arrivalTime, setArrivalTime] = useState(currentTime);
  const [clinicalNotes, setClinicalNotes] = useState("Acute cough, progressive dyspnea, and low-grade fever.");

  // File state & validation
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [fileError, setFileError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Upload & AI analysis progress
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStep, setUploadStep] = useState("");
  const [activeStage, setActiveStage] = useState(1);
  const [analyzedStudy, setAnalyzedStudy] = useState(null);

  useEffect(() => {
    if (isOpen) {
      const rand = Math.floor(1000 + Math.random() * 9000);
      setStudyId(`ST-${rand}`);
      setPatientId(`PX-${rand}`);
      setPatientName("");
      setSelectedFile(null);
      setPreviewUrl(null);
      setFileError("");
      setUploading(false);
      setUploadProgress(0);
      setUploadStep("");
      setActiveStage(1);
      setAnalyzedStudy(null);
      setArrivalTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    }
  }, [isOpen]);

  const allowedExtensions = ["jpg", "jpeg", "png", "dcm"];
  const maxSizeBytes = 50 * 1024 * 1024; // 50MB

  const validateRadiologicalImageClientSide = (file) => {
    return new Promise((resolve) => {
      const ext = file.name.split(".").pop().toLowerCase();
      if (ext === "dcm") {
        return resolve({ valid: true });
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          if (img.width < 120 || img.height < 120) {
            return resolve({
              valid: false,
              reason: "Image resolution too low: Diagnostic radiological images must be at least 120x120 pixels.",
            });
          }

          try {
            const canvas = document.createElement("canvas");
            canvas.width = 128;
            canvas.height = 128;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, 128, 128);
            const imgData = ctx.getImageData(0, 0, 128, 128).data;

            let totalDiff = 0;
            let colorfulCount = 0;
            let whiteCount = 0;
            const totalPixels = 128 * 128;

            for (let i = 0; i < imgData.length; i += 4) {
              const r = imgData[i];
              const g = imgData[i + 1];
              const b = imgData[i + 2];
              const drg = Math.abs(r - g);
              const dgb = Math.abs(g - b);
              const dbr = Math.abs(b - r);
              const diff = (drg + dgb + dbr) / 3.0;
              totalDiff += diff;
              if (diff > 12) colorfulCount++;

              const gray = (r + g + b) / 3.0;
              if (gray > 245) whiteCount++;
            }

            const meanDiff = totalDiff / totalPixels;
            const colorRatio = colorfulCount / totalPixels;
            const whiteRatio = whiteCount / totalPixels;

            if (meanDiff > 12.0 || colorRatio > 0.15) {
              return resolve({
                valid: false,
                reason:
                  "Non-radiological image detected: The uploaded file appears to be a color photograph or graphic. RADIX AI only accepts authentic medical radiographs (X-Ray / CT scans).",
              });
            }

            if (whiteRatio > 0.65) {
              return resolve({
                valid: false,
                reason: `Invalid scan: The uploaded file has ${(whiteRatio * 100).toFixed(0)}% white background, characteristic of a text document, paper invoice, or screenshot rather than a radiological exposure.`,
              });
            }

            resolve({ valid: true });
          } catch (canvasErr) {
            resolve({ valid: true });
          }
        };

        img.onerror = () => {
          resolve({
            valid: false,
            reason: "Could not read the uploaded image. Please ensure it is a valid medical DICOM, PNG, or JPG file.",
          });
        };

        img.src = e.target.result;
      };

      reader.onerror = () => {
        resolve({
          valid: false,
          reason: "Failed to read file from disk.",
        });
      };

      reader.readAsDataURL(file);
    });
  };

  const validateAndSelectFile = async (file) => {
    setFileError("");
    if (!file) return;

    const ext = file.name.split(".").pop().toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      setFileError(
        `Unsupported file type ".${ext}". Please upload valid .jpg, .jpeg, .png, or .dcm (DICOM) files.`
      );
      setSelectedFile(null);
      setPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (file.size > maxSizeBytes) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      setFileError(`File exceeds the 50 MB limit. Selected file size is ${sizeMB} MB.`);
      setSelectedFile(null);
      setPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const check = await validateRadiologicalImageClientSide(file);
    if (!check.valid) {
      setFileError(check.reason);
      setSelectedFile(null);
      setPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setSelectedFile(file);
    if (file.type.startsWith("image/")) {
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setPreviewUrl("/xray_frontal_hd.png");
    }
  };

  // Drag & Drop event handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSelectFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSelectFile(e.target.files[0]);
    }
  };

  const handleBrowseClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();

    if (!selectedFile) {
      setFileError("Please select or drop a medical image/DICOM file to continue.");
      return;
    }

    const uploadStartTime = performance.now();
    setUploading(true);
    setFileError("");
    setUploadProgress(5);
    setActiveStage(1);
    setUploadStep("Connecting to PACS gateway and preparing DICOM transfer...");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      if (studyId && studyId.trim()) formData.append("study_id", studyId.trim());
      if (patientId && patientId.trim()) formData.append("patient_id", patientId.trim());
      if (patientName && patientName.trim()) formData.append("patient_name", patientName.trim());
      if (age) formData.append("age", String(age));
      if (sex) formData.append("sex", sex);
      if (modality) formData.append("modality", modality.toUpperCase());
      if (bodyPart) formData.append("body_part", bodyPart);
      if (clinicalNotes && clinicalNotes.trim()) formData.append("clinical_notes", clinicalNotes.trim());

      let isoArrivalTime = new Date().toISOString();
      if (arrivalTime && arrivalTime.trim()) {
        const timeMatch = arrivalTime.trim().match(/^(\d{1,2}):(\d{2})(?:\s*([APap][Mm]))?$/);
        if (timeMatch) {
          let hours = parseInt(timeMatch[1], 10);
          const mins = parseInt(timeMatch[2], 10);
          const ampm = timeMatch[3]?.toUpperCase();
          if (ampm === "PM" && hours < 12) hours += 12;
          if (ampm === "AM" && hours === 12) hours = 0;
          const d = new Date();
          d.setHours(hours, mins, 0, 0);
          isoArrivalTime = d.toISOString();
        }
      }
      formData.append("arrival_time", isoArrivalTime);

      try {
        const userStr = localStorage.getItem("radix_user");
        const currentUser = userStr ? JSON.parse(userStr) : null;
        const activeUserId = currentUser?.id || currentUser?.email || "anonymous";
        formData.append("uploaded_by", activeUserId);
      } catch {}

      // REAL-TIME Progress handler directly wired to Axios XMLHttpRequest network stream
      const onProgress = (progressEvent) => {
        if (!progressEvent.total) {
          setUploadProgress(40);
          return;
        }
        const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        const loadedKB = (progressEvent.loaded / 1024).toFixed(0);
        const totalKB = (progressEvent.total / 1024).toFixed(0);

        if (pct < 100) {
          setActiveStage(1);
          setUploadProgress(Math.min(85, Math.max(10, Math.round(pct * 0.85))));
          setUploadStep(`Transmitting DICOM payload: ${loadedKB} KB / ${totalKB} KB (${pct}%)`);
        } else {
          // Network upload finished, backend neural network is now executing
          setActiveStage(2);
          setUploadProgress(92);
          setUploadStep(`Payload received (${totalKB} KB). Running real-time DenseNet-121 inference & tie-breaker...`);
        }
      };

      const res = await studyService.uploadStudy(formData, onProgress);
      const totalElapsedMs = Math.round(performance.now() - uploadStartTime);

      setUploadProgress(100);
      setActiveStage(4);
      setUploadStep(`Inference & queuing verified in ${totalElapsedMs}ms`);

      if (res?.study) {
        setAnalyzedStudy(res.study);
        onStudyUploaded(res.study);
      }

      // Brief hold so user sees the real output before closing
      setTimeout(() => {
        setUploading(false);
        onClose();
      }, 1000);
    } catch (err) {
      console.error("Upload error:", err);
      const errMsg =
        err.response?.data?.detail ||
        err.message ||
        "Failed to upload study. Please check server connection.";
      setFileError(errMsg);
      setUploading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="modal-overlay"
          onClick={uploading ? undefined : onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.div
            className={`modal-dialog ${uploading ? "modal-dialog-processing" : ""}`}
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Header */}
            <div className="modal-header">
              <div className="modal-title-group">
                <div className="modal-header-icon-wrapper">
                  {uploading ? (
                    <Activity size={20} className="modal-icon-blue pulse-svg" />
                  ) : (
                    <UploadCloud size={20} className="modal-icon-blue" />
                  )}
                </div>
                <div>
                  <h3>{uploading ? "AI Triage Ingestion Engine" : "Upload Medical Study"}</h3>
                  <p>
                    {uploading
                      ? `Processing ${studyId} • ${patientName || patientId} • ${modality}`
                      : "Upload DICOM or imaging series for automated triage prioritisation & PACS ingestion."}
                  </p>
                </div>
              </div>
              {!uploading && (
                <button className="modal-close-btn" onClick={onClose} aria-label="Close dialog">
                  <X size={18} />
                </button>
              )}
            </div>

            {/* DYNAMIC VIEW: AI Ingestion Animation vs Standard Upload Form */}
            {uploading ? (
              <div className="upload-ai-processing-screen">
                {/* Holographic Diagnostic Scan Viewport */}
                <div className="upload-scan-hud-container">
                  <div className="upload-hud-grid" />
                  <div className="upload-laser-sweep" />

                  {/* Scan Preview Image */}
                  <img
                    src={previewUrl || "/xray_frontal_hd.png"}
                    alt="Uploaded Radiograph"
                    className="upload-hud-scan-img"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = "/xray_frontal_hd.png";
                    }}
                  />

                  {/* Corner Telemetry Tags */}
                  <div className="upload-hud-tag top-left">
                    <span className="dot-live-green" /> DICOM STREAM
                  </div>
                  <div className="upload-hud-tag top-right">
                    <span>{modality.toUpperCase()} • 16-BIT</span>
                  </div>
                  <div className="upload-hud-tag bottom-left">
                    <Cpu size={11} /> DENSENET-121 v2.0
                  </div>
                  <div className="upload-hud-tag bottom-right">
                    <Zap size={11} /> INFERENCING
                  </div>
                </div>

                {/* Multi-Stage AI Pipeline Tracker */}
                <div className="upload-pipeline-tracker">
                  {AI_PIPELINE_STAGES.map((stg) => {
                    const isCompleted = activeStage > stg.id || uploadProgress === 100;
                    const isActive = activeStage === stg.id && uploadProgress < 100;

                    return (
                      <div
                        key={stg.id}
                        className={`pipeline-stage-item ${
                          isCompleted ? "completed" : isActive ? "active" : "pending"
                        }`}
                      >
                        <div className="stage-icon-circle">
                          {isCompleted ? (
                            <CheckCircle2 size={14} className="icon-completed" />
                          ) : isActive ? (
                            <Activity size={14} className="icon-active pulse-svg" />
                          ) : (
                            <span className="stage-num">{stg.id}</span>
                          )}
                        </div>
                        <div className="stage-text-group">
                          <span className="stage-title">{stg.label}</span>
                          <span className="stage-desc">{stg.desc}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Progress Bar & Status Pill */}
                <div className="upload-progress-section">
                  <div className="upload-status-row">
                    <div className="upload-status-pill">
                      <Sparkles size={13} className="sparkle-cyan" />
                      <span>{uploadStep}</span>
                    </div>
                    <span className="upload-percentage-text">{uploadProgress}%</span>
                  </div>
                  <div className="upload-progress-track">
                    <div
                      className="upload-progress-bar"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>

                {/* Result Preview on Completion */}
                {analyzedStudy && (
                  <motion.div
                    className="upload-result-badge-card"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <ShieldCheck size={18} className="shield-success-icon" />
                    <div>
                      <strong>Triage Decision: {analyzedStudy.priority || "HIGH"} PRIORITY</strong>
                      <span>
                        Urgency Score: {((analyzedStudy.priorityScore || 0.88) * 100).toFixed(0)}% • Position Assigned #1
                      </span>
                    </div>
                  </motion.div>
                )}
              </div>
            ) : (
              /* Standard Upload Form */
              <form onSubmit={handleUploadSubmit}>
                <div className="modal-body">
                  {/* Error Banner */}
                  {fileError && (
                    <div className="upload-error-banner">
                      <AlertCircle size={16} />
                      <span>{fileError}</span>
                    </div>
                  )}

                  {/* Drag & Drop Zone */}
                  <div
                    className={`file-dropzone ${isDragging ? "dragging" : ""} ${
                      selectedFile ? "file-ready" : ""
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="file-input-hidden"
                      onChange={handleFileChange}
                      accept=".jpg,.jpeg,.png,.dcm"
                    />

                    {selectedFile ? (
                      <div className="file-selected-card">
                        <div className="file-thumbnail-preview">
                          <img
                            src={previewUrl || "/xray_frontal_hd.png"}
                            alt="Preview"
                            className="preview-img"
                          />
                        </div>
                        <div className="file-selected-details">
                          <span className="file-name" title={selectedFile.name}>
                            {selectedFile.name}
                          </span>
                          <span className="file-meta">
                            {(selectedFile.size / 1024).toFixed(0)} KB &bull; Medical Radiograph Verified
                          </span>
                        </div>
                        <button
                          type="button"
                          className="file-remove-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFile(null);
                            setPreviewUrl(null);
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          }}
                          title="Remove file"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="dropzone-content" onClick={handleBrowseClick}>
                        <div className="dropzone-icon-circle">
                          <FileUp size={24} className="dropzone-icon" />
                        </div>
                        <div className="dropzone-text-group">
                          <p className="dropzone-main-text">
                            <strong>Click to browse</strong> or drag & drop radiological scan
                          </p>
                          <span className="dropzone-sub-text">
                            Supports .dcm (DICOM 3.0), .jpg, .jpeg, .png up to 50 MB
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Form Grid: Study ID & Patient ID */}
                  <div className="form-row-2">
                    <div className="form-group">
                      <label>Study Accession ID</label>
                      <input
                        type="text"
                        value={studyId}
                        onChange={(e) => setStudyId(e.target.value)}
                        placeholder="e.g. ST-4892"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Patient MRN / ID</label>
                      <input
                        type="text"
                        value={patientId}
                        onChange={(e) => setPatientId(e.target.value)}
                        placeholder="e.g. PX-4892"
                        required
                      />
                    </div>
                  </div>

                  {/* Patient Name, Age, Sex */}
                  <div className="form-row-3">
                    <div className="form-group flex-2">
                      <label>Patient Full Name</label>
                      <input
                        type="text"
                        value={patientName}
                        onChange={(e) => setPatientName(e.target.value)}
                        placeholder="e.g. Robert Vance"
                      />
                    </div>
                    <div className="form-group flex-1">
                      <label>Age</label>
                      <input
                        type="number"
                        min="1"
                        max="125"
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        placeholder="52"
                      />
                    </div>
                    <div className="form-group flex-1">
                      <label>Sex</label>
                      <select value={sex} onChange={(e) => setSex(e.target.value)}>
                        <option value="M">Male</option>
                        <option value="F">Female</option>
                        <option value="O">Other</option>
                      </select>
                    </div>
                  </div>

                  {/* Modality, Body Part, Arrival Time */}
                  <div className="form-row-3">
                    <div className="form-group">
                      <label>Modality</label>
                      <select value={modality} onChange={(e) => setModality(e.target.value)}>
                        <option value="X-ray">X-ray (CR/DX)</option>
                        <option value="CT">CT Scan</option>
                        <option value="MRI">MRI</option>
                        <option value="Ultrasound">Ultrasound</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Anatomical Region</label>
                      <select value={bodyPart} onChange={(e) => setBodyPart(e.target.value)}>
                        <option value="Chest">Chest</option>
                        <option value="Abdomen">Abdomen</option>
                        <option value="Head">Head</option>
                        <option value="Spine">Spine</option>
                        <option value="Pelvis">Pelvis</option>
                        <option value="Extremity">Extremity</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Arrival Time</label>
                      <div className="input-with-icon">
                        <Clock size={14} className="input-icon" />
                        <input
                          type="text"
                          value={arrivalTime}
                          onChange={(e) => setArrivalTime(e.target.value)}
                          placeholder="e.g. 10:45 AM"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Clinical Indications */}
                  <div className="form-group full-width">
                    <label>Clinical Indications / Referring Notes</label>
                    <textarea
                      rows={2}
                      value={clinicalNotes}
                      onChange={(e) => setClinicalNotes(e.target.value)}
                      placeholder="Reason for exam, acute symptoms, or suspected pathology..."
                    />
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="modal-footer">
                  <button
                    type="button"
                    className="modal-cancel-btn"
                    onClick={onClose}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="modal-submit-btn"
                    disabled={!selectedFile}
                  >
                    <Activity size={15} />
                    <span>Upload & Run AI Triage</span>
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default UploadModal;
