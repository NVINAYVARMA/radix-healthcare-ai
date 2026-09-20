import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud,
  X,
  CheckCircle,
  Activity,
  FileUp,
  AlertCircle,
  FileText,
  Clock,
  Trash2,
} from "lucide-react";
import { studyService } from "../services/studyService";
import "./UploadModal.css";

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
  const [fileError, setFileError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Upload & AI analysis progress
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStep, setUploadStep] = useState("");

  useEffect(() => {
    if (isOpen) {
      const rand = Math.floor(1000 + Math.random() * 9000);
      setStudyId(`ST-${rand}`);
      setPatientId(`PX-${rand}`);
      setPatientName("");
      setSelectedFile(null);
      setFileError("");
      setUploading(false);
      setUploadProgress(0);
      setUploadStep("");
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
              reason: `Image resolution too low (${img.width}x${img.height}). Diagnostic radiographs require at least 120x120 pixels.`,
            });
          }

          const aspect = img.width / img.height;
          if (aspect < 0.35 || aspect > 2.8) {
            return resolve({
              valid: false,
              reason: `Abnormal aspect ratio (${aspect.toFixed(2)}). Medical radiographs must adhere to standard diagnostic proportions.`,
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
            // If canvas context fails for any reason, let backend perform the definitive check
            resolve({ valid: true });
          }
        };

        img.onerror = () => {
          resolve({ valid: false, reason: "Corrupted image file. Could not read pixel data." });
        };

        img.src = e.target.result;
      };

      reader.onerror = () => {
        resolve({ valid: false, reason: "Failed to read uploaded file." });
      };

      reader.readAsDataURL(file);
    });
  };

  const validateAndSelectFile = async (file) => {
    setFileError("");
    if (!file) return;

    // Check file extension
    const ext = file.name.split(".").pop().toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      setFileError(
        `Unsupported file type ".${ext}". Please upload valid .jpg, .jpeg, .png, or .dcm (DICOM) files.`
      );
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Check file size
    if (file.size > maxSizeBytes) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      setFileError(`File exceeds the 50 MB limit. Selected file size is ${sizeMB} MB.`);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Pre-validate image on client side
    const check = await validateRadiologicalImageClientSide(file);
    if (!check.valid) {
      setFileError(check.reason);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setSelectedFile(file);
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

    setUploading(true);
    setFileError("");
    setUploadProgress(35);
    setUploadStep("Streaming medical scan & parsing DICOM headers...");

    try {
      const progressTimer1 = setTimeout(() => {
        setUploadProgress(70);
        setUploadStep("Running multi-label AI triage analysis...");
      }, 150);

      // Build real FormData with user entered patient details and image bytes
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

      // Pass ISO arrival timestamp based on user's entered arrival time
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

      // Account-specific isolation: record uploading user ID
      try {
        const userStr = localStorage.getItem("radix_user");
        const currentUser = userStr ? JSON.parse(userStr) : null;
        const activeUserId = currentUser?.id || currentUser?.email || "anonymous";
        formData.append("uploaded_by", activeUserId);
      } catch {}

      const res = await studyService.uploadStudy(formData);
      clearTimeout(progressTimer1);

      setUploadProgress(100);
      setUploadStep("Triage inference complete! Study prioritized & saved.");

      if (res?.study) {
        onStudyUploaded(res.study);
      }
      setTimeout(() => {
        setUploading(false);
        onClose();
      }, 120);
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
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.div
            className="modal-dialog"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <UploadCloud size={22} className="modal-icon-blue" />
            <div>
              <h3>Upload Medical Study</h3>
              <p>Upload DICOM or imaging series for automated triage prioritisation & PACS ingestion.</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} disabled={uploading}>
            <X size={18} />
          </button>
        </div>

        {/* Body Form */}
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
                type="file"
                ref={fileInputRef}
                style={{ display: "none" }}
                accept=".jpg,.jpeg,.png,.dcm"
                onChange={handleFileChange}
              />

              <div className="dropzone-icon-circle">
                {selectedFile ? (
                  <CheckCircle size={28} className="text-emerald" />
                ) : (
                  <FileUp size={28} className="dropzone-icon" />
                )}
              </div>

              <div className="dropzone-text">
                {selectedFile ? (
                  <>
                    <strong className="file-name-text">{selectedFile.name}</strong>
                    <span className="file-size-text">
                      Size: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB &bull; Ready for AI Triage
                    </span>
                  </>
                ) : (
                  <>
                    <strong>Drag and drop medical scans here</strong>
                    <span>Supports .dcm (DICOM), .jpg, .jpeg, .png up to 50 MB</span>
                  </>
                )}
              </div>

              <div className="dropzone-action-buttons">
                <button
                  type="button"
                  className="browse-files-btn"
                  onClick={handleBrowseClick}
                  disabled={uploading}
                >
                  <FileText size={14} />
                  <span>{selectedFile ? "Change File" : "Browse Files"}</span>
                </button>
                {selectedFile && (
                  <button
                    type="button"
                    className="remove-file-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                      setFileError("");
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    disabled={uploading}
                    title="Remove selected file"
                  >
                    <Trash2 size={14} />
                    <span>Remove File</span>
                  </button>
                )}
              </div>
            </div>

            {/* Metadata Fields Form */}
            <div className="metadata-section-header">
              <span className="metadata-label">Clinical & Study Metadata</span>
            </div>

            <div className="modal-form-grid">
              {/* Study ID */}
              <div className="form-group">
                <label>Study ID</label>
                <input
                  type="text"
                  value={studyId}
                  onChange={(e) => setStudyId(e.target.value)}
                  placeholder="e.g. ST-041"
                  required
                />
              </div>

              {/* Patient ID */}
              <div className="form-group">
                <label>Patient ID</label>
                <input
                  type="text"
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                  placeholder="e.g. PX041"
                  required
                />
              </div>

              {/* Patient Name */}
              <div className="form-group">
                <label>Patient Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Eleanor Vance"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                />
              </div>

              {/* Age & Sex */}
              <div className="form-row-duo">
                <div className="form-group flex-1">
                  <label>Age</label>
                  <input
                    type="number"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    min="1"
                    max="120"
                  />
                </div>
                <div className="form-group flex-1">
                  <label>Sex</label>
                  <select value={sex} onChange={(e) => setSex(e.target.value)}>
                    <option value="M">Male (M)</option>
                    <option value="F">Female (F)</option>
                  </select>
                </div>
              </div>

              {/* Modality */}
              <div className="form-group">
                <label>Modality</label>
                <select value={modality} onChange={(e) => setModality(e.target.value)}>
                  <option value="X-ray">X-ray (Radiograph)</option>
                  <option value="CT">CT Scan (Computed Tomography)</option>
                  <option value="MRI">MRI (Magnetic Resonance)</option>
                </select>
              </div>

              {/* Body Part */}
              <div className="form-group">
                <label>Body Part</label>
                <select value={bodyPart} onChange={(e) => setBodyPart(e.target.value)}>
                  <option value="Chest">Chest</option>
                  <option value="Abdomen">Abdomen</option>
                  <option value="Head">Head</option>
                  <option value="Spine">Spine</option>
                  <option value="Pelvis">Pelvis</option>
                  <option value="Extremity">Extremity</option>
                </select>
              </div>

              {/* Arrival Time */}
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

            {/* Clinical Notes */}
            <div className="form-group full-width">
              <label>Clinical Indications / Referring Notes</label>
              <textarea
                rows={2}
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                placeholder="Reason for exam, relevant symptoms, or known pathology..."
              />
            </div>

            {/* Upload Progress Indicator */}
            {uploading && (
              <div className="analysis-progress-card">
                <div className="progress-status-row">
                  <div className="pulse-spinner">
                    <Activity size={15} />
                  </div>
                  <span className="step-text">{uploadStep}</span>
                  <strong className="pct-text">{uploadProgress}%</strong>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="modal-footer">
            <button
              type="button"
              className="modal-cancel-btn"
              onClick={onClose}
              disabled={uploading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="modal-submit-btn"
              disabled={uploading || !selectedFile}
            >
              <Activity size={15} />
              <span>{uploading ? "Ingesting & Prioritizing..." : "Upload & Run AI Triage"}</span>
            </button>
          </div>
        </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default UploadModal;
