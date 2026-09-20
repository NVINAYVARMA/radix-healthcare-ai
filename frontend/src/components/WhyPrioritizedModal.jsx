import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink, Sliders } from "lucide-react";
import WhyPrioritizedPanel from "./WhyPrioritizedPanel";
import "./WhyPrioritizedModal.css";

export const WhyPrioritizedModal = ({
  isOpen,
  onClose,
  study,
  onOpenViewer,
  onOpenOverride,
}) => {
  return (
    <AnimatePresence>
      {isOpen && study && (
        <motion.div
          className="why-modal-overlay"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.div
            className="why-modal-dialog"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Modal Topbar */}
            <div className="why-modal-header">
              <div className="why-modal-patient-info">
                <span className="patient-id-badge">{study.patientId}</span>
                <span className="study-id-text">{study.studyId || `ST-${study.id}`}</span>
                <span className="patient-name-title">{study.patientName}</span>
                <span className="patient-modality-pill">
                  {study.bodyPart} {study.modality}
                </span>
              </div>

              <button
                type="button"
                className="why-modal-close-btn"
                onClick={onClose}
                title="Close dialog [Esc]"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="why-modal-body">
              <WhyPrioritizedPanel
                study={study}
                onOverride={() => {
                  onClose();
                  if (onOpenOverride) onOpenOverride(study);
                }}
                showOverrideBtn={true}
              />
            </div>

            {/* Modal Footer Controls */}
            <div className="why-modal-footer">
              <button
                type="button"
                className="why-footer-close-btn"
                onClick={onClose}
              >
                Close
              </button>

              <div className="why-footer-right-actions">
                {onOpenOverride && (
                  <button
                    type="button"
                    className="why-footer-override-btn"
                    onClick={() => {
                      onClose();
                      onOpenOverride(study);
                    }}
                  >
                    <Sliders size={13} />
                    <span>Override Priority</span>
                  </button>
                )}

                {onOpenViewer && (
                  <button
                    type="button"
                    className="why-footer-pacs-btn"
                    onClick={() => {
                      onClose();
                      onOpenViewer(study);
                    }}
                  >
                    <span>Open PACS Workstation</span>
                    <ExternalLink size={13} />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default WhyPrioritizedModal;
