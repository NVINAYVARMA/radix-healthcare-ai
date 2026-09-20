import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sliders, X, AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";

export const PriorityOverrideModal = ({
  isOpen,
  onClose,
  study,
  onOverrideSubmit,
}) => {
  const [newPriority, setNewPriority] = useState(
    study?.priority === "High" ? "Medium" : "High"
  );
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const originalScore = study?.priorityScore !== undefined ? study.priorityScore.toFixed(2) : "N/A";
  const originalAiPriority = study?.priorityLevel || (study?.priority === "High" ? "HIGH" : study?.priority === "Medium" ? "MEDIUM" : "STANDARD");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError("Please provide a clinical rationale or indication for overriding the AI priority.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    await onOverrideSubmit({
      studyId: study.id,
      newPriority,
      reason: reason.trim(),
    });

    setIsSubmitting(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && study && (
        <motion.div
          className="modal-overlay"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.div
            className="modal-dialog override-modal-dialog"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <Sliders size={20} className="modal-icon-amber" />
            <div>
              <h3>Manual Priority Override</h3>
              <p>Adjust the triage priority for this study based on clinical judgment.</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} disabled={isSubmitting}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Study Overview & Original AI Record */}
            <div className="override-study-summary-card">
              <div className="summary-left">
                <span className="summary-study-id">{study.studyId || `ST-${study.id}`}</span>
                <strong className="summary-patient">{study.patientId} &bull; {study.patientName}</strong>
                <span className="summary-modality">{study.bodyPart} {study.modality}</span>
              </div>
              <div className="summary-right">
                <span className="summary-ai-label">Original AI Result</span>
                <div className="summary-ai-scores">
                  <span className="ai-score-badge">Score: {originalScore}</span>
                  <span className="ai-level-badge">{originalAiPriority}</span>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="upload-error-banner">
                <AlertTriangle size={15} />
                <span>{error}</span>
              </div>
            )}

            {/* Field 1: New Priority Selector */}
            <div className="form-group">
              <label>
                New Priority Level <span className="text-danger">*</span>
              </label>
              <div className="priority-select-radios">
                {[
                  { value: "High", label: "High (STAT)", desc: "Immediate evaluation required (< 30 min)", color: "high" },
                  { value: "Medium", label: "Medium (Urgent)", desc: "Expedited review (< 2 hours)", color: "med" },
                  { value: "Standard", label: "Standard (Routine)", desc: "Standard queue routine reading", color: "low" },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className={`priority-radio-option ${opt.color} ${
                      newPriority === opt.value ? "selected" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="priorityOption"
                      value={opt.value}
                      checked={newPriority === opt.value}
                      onChange={(e) => setNewPriority(e.target.value)}
                    />
                    <div className="radio-text">
                      <strong>{opt.label}</strong>
                      <small>{opt.desc}</small>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Field 2: Reason for Override */}
            <div className="form-group full-width">
              <label>
                Reason for Override <span className="text-danger">*</span>
              </label>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Document clinical rationale (e.g., attending clinician requested STAT escalation, acute oxygen desaturation observed at bedside, or subtle apical opacity missed by algorithmic triage)..."
                required
              />
            </div>

            {/* Important Rule Transparency Disclaimer */}
            <div className="override-disclaimer-box">
              <ShieldAlert size={16} className="disclaimer-icon" />
              <p>
                <strong>Audit Compliance:</strong> The original AI priority score ({originalScore}) and algorithmic triage level will be strictly preserved in the permanent PACS audit log. The study will clearly display that a manual override was applied by Dr. Alex Vance, MD.
              </p>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="modal-footer">
            <button
              type="button"
              className="modal-cancel-btn"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="modal-submit-btn amber"
              disabled={isSubmitting}
            >
              <CheckCircle2 size={15} />
              <span>{isSubmitting ? "Applying Override..." : "Apply Manual Override"}</span>
            </button>
          </div>
        </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PriorityOverrideModal;
