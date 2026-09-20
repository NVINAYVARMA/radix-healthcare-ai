import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Server,
  SlidersHorizontal,
  Settings as SettingsIcon,
  CheckCircle2,
  Lock,
  HelpCircle,
  Lightbulb,
  FileText,
  Bell,
  Volume2,
  Activity,
  Smartphone,
  RotateCcw,
  Save,
  Zap,
} from "lucide-react";
import "./Settings.css";

export const Settings = () => {
  // 1. PACS Gateway Form State
  const [aeTitle, setAeTitle] = useState("RADIX_PACS_01");
  const [port, setPort] = useState("11112");
  const [callingAeTitle, setCallingAeTitle] = useState("RADIX_SC");
  const [tlsEnabled, setTlsEnabled] = useState(true);

  // 2. AI Priority Cutoff Sliders
  const [highThreshold, setHighThreshold] = useState(0.85);
  const [medThreshold, setMedThreshold] = useState(0.50);

  // 3. Ping Handshake State
  const [isTestingPing, setIsTestingPing] = useState(false);
  const [lastVerifiedTime, setLastVerifiedTime] = useState("Sep 18, 2026, 04:28 PM");

  // 4. Clinical Protocol Toggles
  const [protocols, setProtocols] = useState([
    {
      id: "PR-01",
      modality: "X-Ray",
      bodyPart: "Chest",
      title: "Chest XR Acute Emergency Protocol",
      indications: "Pneumothorax, Dense Consolidation, Pleural Effusion",
      escalation: "45 min",
      enabled: true,
    },
    {
      id: "PR-02",
      modality: "CT",
      bodyPart: "Head",
      title: "Non-Contrast Head CT STAT Bleed Protocol",
      indications: "Intracranial Hemorrhage, Midline Shift, Acute Infarct",
      escalation: "20 min",
      enabled: true,
    },
    {
      id: "PR-03",
      modality: "CT / XR",
      bodyPart: "Torso",
      title: "Trauma Whole-Body Screening Protocol",
      indications: "Hemoperitoneum, Flail Chest, Displaced Fractures",
      escalation: "30 min",
      enabled: true,
    },
    {
      id: "PR-04",
      modality: "X-Ray",
      bodyPart: "All",
      title: "Outpatient Routine Radiography",
      indications: "Baseline surveillance, pre-operative clearance",
      escalation: "Off",
      enabled: true,
    },
  ]);

  // 5. Radiologist Notification Toggles
  const [notifications, setNotifications] = useState({
    audibleChime: true,
    visualFlash: true,
    smsRelay: true,
  });

  // 6. Save State
  const [isSaved, setIsSaved] = useState(false);

  // Test Ping Handler
  const handleTestPing = () => {
    setIsTestingPing(true);
    setTimeout(() => {
      setIsTestingPing(false);
      setLastVerifiedTime(
        new Date().toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }) +
          ", " +
          new Date().toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          })
      );
    }, 500);
  };

  // Toggle protocol
  const handleToggleProtocol = (id) => {
    setProtocols((prev) =>
      prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p))
    );
  };

  // Reset defaults
  const handleReset = () => {
    setAeTitle("RADIX_PACS_01");
    setPort("11112");
    setCallingAeTitle("RADIX_SC");
    setTlsEnabled(true);
    setHighThreshold(0.85);
    setMedThreshold(0.50);
    setNotifications({
      audibleChime: true,
      visualFlash: true,
      smsRelay: true,
    });
  };

  // Save Preferences
  const handleSave = (e) => {
    if (e) e.preventDefault();
    setIsSaved(true);
    try {
      localStorage.setItem(
        "radix_clinical_pacs_config",
        JSON.stringify({
          aeTitle,
          port,
          callingAeTitle,
          tlsEnabled,
          highThreshold,
          medThreshold,
          notifications,
        })
      );
    } catch {
      // Local storage fallback
    }
    setTimeout(() => setIsSaved(false), 2400);
  };

  return (
    <motion.div
      className="pacs-settings-container"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <div className="pacs-settings-content">
        {/* ====================================================================
            1. PAGE HEADER & SEAMLESS INTEGRATION CALLOUT
            ==================================================================== */}
        <header className="pacs-header-section">
          <div className="pacs-header-left">
            <h1 className="pacs-page-title">Clinical & PACS Integration Settings</h1>
            <p className="pacs-page-subtitle">
              Configure hospital PACS nodes, AI triage thresholds, and radiologist notification rules.
            </p>
          </div>

          <aside className="seamless-callout-card" aria-label="Integration Overview">
            <div className="seamless-icon-box">
              <SettingsIcon size={20} />
            </div>
            <div className="seamless-text">
              <h4>Seamless Integration for Smarter Triage</h4>
              <p>
                Connect your PACS system and fine-tune AI thresholds to match your hospital workflow.
              </p>
            </div>
          </aside>
        </header>

        {/* ====================================================================
            2. PRIMARY CONFIGURATION GRID (2 BALANCED COLUMNS)
            ==================================================================== */}
        <div className="pacs-config-grid">
          {/* CARD A: PACS / DICOM GATEWAY */}
          <section className="pacs-card" aria-labelledby="pacs-gateway-heading">
            <div className="pacs-card-header">
              <div className="pacs-card-title-group">
                <div className="card-icon-badge">
                  <Server size={18} />
                </div>
                <div className="card-title-text">
                  <h3 id="pacs-gateway-heading">PACS / DICOM Gateway</h3>
                  <p>Connect and configure your hospital's PACS system</p>
                </div>
              </div>
              <span className="badge-connected">
                <span className="dot-connected"></span>
                <span>Connected</span>
              </span>
            </div>

            {/* Field: Application Entity (AE) Title */}
            <div className="pacs-field-group">
              <label className="field-label" htmlFor="ae-title-input">
                <span>Application Entity (AE) Title</span>
                <span
                  className="info-tooltip-btn"
                  title="Unique DICOM Application Entity title assigned to this RADIX ingestion gateway"
                >
                  <HelpCircle size={13} />
                </span>
              </label>
              <input
                id="ae-title-input"
                type="text"
                className="pacs-text-input code-style"
                value={aeTitle}
                onChange={(e) => setAeTitle(e.target.value)}
                placeholder="RADIX_PACS_01"
              />
              <p className="field-helper">PACS node identification</p>
            </div>

            {/* Two-Column Inputs: DICOM Port & Calling AE Title */}
            <div className="pacs-two-col-fields">
              <div className="pacs-field-group">
                <label className="field-label" htmlFor="port-input">
                  <span>DICOM Port</span>
                  <span
                    className="info-tooltip-btn"
                    title="TCP/IP listening port for incoming DICOM C-STORE image push transfers"
                  >
                    <HelpCircle size={13} />
                  </span>
                </label>
                <input
                  id="port-input"
                  type="text"
                  className="pacs-text-input code-style"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  placeholder="11112"
                />
                <p className="field-helper">Default DICOM TLS port: 11112</p>
              </div>

              <div className="pacs-field-group">
                <label className="field-label" htmlFor="calling-ae-input">
                  <span>Calling AE Title (Optional)</span>
                  <span
                    className="info-tooltip-btn"
                    title="Originating AE Title used when RADIX initiates C-FIND or C-MOVE queries to PACS archive"
                  >
                    <HelpCircle size={13} />
                  </span>
                </label>
                <input
                  id="calling-ae-input"
                  type="text"
                  className="pacs-text-input code-style"
                  value={callingAeTitle}
                  onChange={(e) => setCallingAeTitle(e.target.value)}
                  placeholder="RADIX_SC"
                />
                <p className="field-helper">Used when RADIX initiates requests</p>
              </div>
            </div>

            {/* TLS 1.3 Security Row */}
            <div className="tls-security-row">
              <label className="tls-checkbox-label" htmlFor="tls-enforce-check">
                <input
                  type="checkbox"
                  id="tls-enforce-check"
                  checked={tlsEnabled}
                  onChange={(e) => setTlsEnabled(e.target.checked)}
                />
                <div className="tls-text-group">
                  <strong>Enforce TLS 1.3 encryption for DICOM transfers</strong>
                  <span>Recommended for secure and compliant communication</span>
                </div>
              </label>

              {tlsEnabled && (
                <span className="tls-badge">
                  <Lock size={12} />
                  <span>TLS 1.3 Enabled</span>
                </span>
              )}
            </div>

            {/* Connection Active Status Banner */}
            <div className="connection-active-banner">
              <div className="connection-banner-left">
                <CheckCircle2 size={22} className="connection-check-icon" />
                <div className="connection-banner-text">
                  <strong>Connection Active</strong>
                  <p>
                    Successfully connected to <strong>{aeTitle}</strong> on port{" "}
                    <strong>{port}</strong>
                  </p>
                </div>
              </div>

              <div className="connection-banner-right">
                <span className="connection-last-verified">
                  Last verified: {lastVerifiedTime}
                </span>
                <button
                  type="button"
                  className="connection-ping-btn"
                  onClick={handleTestPing}
                  disabled={isTestingPing}
                  title="Run instantaneous DICOM C-ECHO verification ping"
                >
                  {isTestingPing ? "Testing Ping..." : "Verify Connection"}
                </button>
              </div>
            </div>
          </section>

          {/* CARD B: AI SENSITIVITY & THRESHOLDS */}
          <section className="pacs-card" aria-labelledby="ai-sensitivity-heading">
            <div className="pacs-card-header">
              <div className="pacs-card-title-group">
                <div className="card-icon-badge amber">
                  <SlidersHorizontal size={18} />
                </div>
                <div className="card-title-text">
                  <h3 id="ai-sensitivity-heading">AI Sensitivity & Thresholds</h3>
                  <p>Adjust triage cutoff points for queue escalation</p>
                </div>
              </div>
              <span className="badge-auto-triage">
                <Zap size={12} />
                <span>Auto-Triage</span>
              </span>
            </div>

            {/* High Priority Threshold Slider */}
            <div className="threshold-slider-group">
              <div className="slider-top-row">
                <div className="slider-label-block">
                  <strong>High Priority Threshold</strong>
                  <p>
                    Studies scoring above this threshold will be marked as High Priority (Top 20%)
                  </p>
                </div>
                <div className="slider-value-display high-score">
                  {Number(highThreshold).toFixed(2)}
                </div>
              </div>

              <div className="slider-control-wrap">
                <input
                  type="range"
                  min="0.70"
                  max="0.98"
                  step="0.01"
                  value={highThreshold}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setHighThreshold(val);
                    if (val <= medThreshold) setMedThreshold(Number((val - 0.1).toFixed(2)));
                  }}
                  className="slider-range-input high"
                  style={{
                    background: `linear-gradient(to right, #ef4444 0%, #ef4444 ${
                      ((highThreshold - 0.7) / (0.98 - 0.7)) * 100
                    }%, #e2e8f0 ${((highThreshold - 0.7) / (0.98 - 0.7)) * 100}%, #e2e8f0 100%)`,
                  }}
                  aria-label="High Priority Threshold Slider"
                />
                <div className="slider-scale-numbers">
                  <span>0.0</span>
                  <span>0.2</span>
                  <span>0.4</span>
                  <span>0.6</span>
                  <span>0.8</span>
                  <span>1.0</span>
                </div>
              </div>
            </div>

            {/* Medium Priority Threshold Slider */}
            <div className="threshold-slider-group">
              <div className="slider-top-row">
                <div className="slider-label-block">
                  <strong>Medium Priority Threshold</strong>
                  <p>
                    Studies scoring above this threshold will be marked as Medium Priority
                  </p>
                </div>
                <div className="slider-value-display med-score">
                  {Number(medThreshold).toFixed(2)}
                </div>
              </div>

              <div className="slider-control-wrap">
                <input
                  type="range"
                  min="0.30"
                  max="0.75"
                  step="0.01"
                  value={medThreshold}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setMedThreshold(val);
                    if (val >= highThreshold) setHighThreshold(Number((val + 0.1).toFixed(2)));
                  }}
                  className="slider-range-input med"
                  style={{
                    background: `linear-gradient(to right, #f59e0b 0%, #f59e0b ${
                      ((medThreshold - 0.3) / (0.75 - 0.3)) * 100
                    }%, #e2e8f0 ${((medThreshold - 0.3) / (0.75 - 0.3)) * 100}%, #e2e8f0 100%)`,
                  }}
                  aria-label="Medium Priority Threshold Slider"
                />
                <div className="slider-scale-numbers">
                  <span>0.0</span>
                  <span>0.2</span>
                  <span>0.4</span>
                  <span>0.6</span>
                  <span>0.8</span>
                  <span>1.0</span>
                </div>
              </div>
            </div>

            {/* How It Works Explainer Box */}
            <div className="how-it-works-card">
              <Lightbulb size={16} className="how-it-works-icon" />
              <div className="how-it-works-content">
                <strong>How it works?</strong>
                <p>
                  Studies with AI scores above <strong>{Number(highThreshold).toFixed(2)}</strong> will trigger immediate acoustic and visual alerts for attending radiologist review. Thresholds can be adjusted based on your institution's workflow and risk tolerance.
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* ====================================================================
            3. SECONDARY CLINICAL SECTION: PROTOCOLS & ALERT DISPATCH
            ==================================================================== */}
        <div className="pacs-secondary-grid">
          {/* PROTOCOLS MATRIX CARD */}
          <section className="pacs-card" aria-labelledby="protocols-heading">
            <div className="pacs-card-header">
              <div className="pacs-card-title-group">
                <div className="card-icon-badge">
                  <FileText size={18} />
                </div>
                <div className="card-title-text">
                  <h3 id="protocols-heading">Clinical Modality Protocols</h3>
                  <p>Auto-triage escalation rules by anatomical modality</p>
                </div>
              </div>
              <span className="badge-connected">
                <span>{protocols.filter((p) => p.enabled).length} Active</span>
              </span>
            </div>

            <table className="protocols-compact-table">
              <thead>
                <tr>
                  <th>Modality & Protocol</th>
                  <th>Target Findings</th>
                  <th>Aging Escalation</th>
                  <th>Active</th>
                </tr>
              </thead>
              <tbody>
                {protocols.map((p) => (
                  <tr key={p.id}>
                    <td className="protocol-title-cell">
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span className="modality-tag">{p.modality}</span>
                        <strong>{p.title}</strong>
                      </div>
                      <span>{p.bodyPart} study</span>
                    </td>
                    <td style={{ fontSize: "0.7rem", color: "#475569", maxWidth: "220px" }}>
                      {p.indications}
                    </td>
                    <td>
                      <span className={`aging-tag ${p.escalation === "Off" ? "off" : ""}`}>
                        {p.escalation}
                      </span>
                    </td>
                    <td>
                      <label className="pacs-switch">
                        <input
                          type="checkbox"
                          checked={p.enabled}
                          onChange={() => handleToggleProtocol(p.id)}
                          aria-label={`Toggle protocol ${p.title}`}
                        />
                        <span className="pacs-switch-slider"></span>
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* RADIOLOGIST NOTIFICATION & DISPATCH RULES */}
          <section className="pacs-card" aria-labelledby="notification-heading">
            <div className="pacs-card-header">
              <div className="pacs-card-title-group">
                <div className="card-icon-badge">
                  <Bell size={18} />
                </div>
                <div className="card-title-text">
                  <h3 id="notification-heading">Radiologist Notification Rules</h3>
                  <p>Reading room alerts for prioritized emergent studies</p>
                </div>
              </div>
            </div>

            <div className="notification-rules-list">
              {/* Rule 1: Audible STAT Chime */}
              <div className="notification-rule-item">
                <div className="rule-left">
                  <div className="rule-icon-box">
                    <Volume2 size={15} />
                  </div>
                  <div className="rule-text">
                    <strong>Audible Acoustic Alarm for STAT Cases</strong>
                    <span>Plays distinctive chime when studies score &ge; {Number(highThreshold).toFixed(2)}</span>
                  </div>
                </div>
                <label className="pacs-switch">
                  <input
                    type="checkbox"
                    checked={notifications.audibleChime}
                    onChange={(e) =>
                      setNotifications((prev) => ({ ...prev, audibleChime: e.target.checked }))
                    }
                    aria-label="Toggle Audible Alarm"
                  />
                  <span className="pacs-switch-slider"></span>
                </label>
              </div>

              {/* Rule 2: Visual Screen Flash */}
              <div className="notification-rule-item">
                <div className="rule-left">
                  <div className="rule-icon-box crimson">
                    <Activity size={15} />
                  </div>
                  <div className="rule-text">
                    <strong>Visual Ambient Screen Pulse</strong>
                    <span>Pulses top banner on pneumothorax or acute hemorrhage detection</span>
                  </div>
                </div>
                <label className="pacs-switch">
                  <input
                    type="checkbox"
                    checked={notifications.visualFlash}
                    onChange={(e) =>
                      setNotifications((prev) => ({ ...prev, visualFlash: e.target.checked }))
                    }
                    aria-label="Toggle Visual Screen Pulse"
                  />
                  <span className="pacs-switch-slider"></span>
                </label>
              </div>

              {/* Rule 3: On-Call SMS Relay */}
              <div className="notification-rule-item">
                <div className="rule-left">
                  <div className="rule-icon-box amber">
                    <Smartphone size={15} />
                  </div>
                  <div className="rule-text">
                    <strong>On-Call Radiologist Pager / SMS Relay</strong>
                    <span>Dispatches emergency SMS alert if STAT cases remain unreviewed &gt;15 min</span>
                  </div>
                </div>
                <label className="pacs-switch">
                  <input
                    type="checkbox"
                    checked={notifications.smsRelay}
                    onChange={(e) =>
                      setNotifications((prev) => ({ ...prev, smsRelay: e.target.checked }))
                    }
                    aria-label="Toggle On-Call Pager Relay"
                  />
                  <span className="pacs-switch-slider"></span>
                </label>
              </div>
            </div>
          </section>
        </div>

        {/* ====================================================================
            4. BOTTOM PERSISTENT ACTION & STATUS BAR
            ==================================================================== */}
        <footer className="pacs-settings-footer">
          <div className="footer-status-info">
            <span className="dot-online"></span>
            <span>
              PACS Ingestion Gateway Online &bull; DICOM C-STORE Ready &bull; Enforcing TLS 1.3
            </span>
          </div>

          <div className="footer-actions-group">
            <button
              type="button"
              className="btn-ghost-reset"
              onClick={handleReset}
              title="Reset parameters to standard clinical hospital defaults"
            >
              <RotateCcw size={13} />
              <span>Reset Defaults</span>
            </button>

            <motion.button
              type="button"
              className={`btn-primary-save ${isSaved ? "saved-active" : ""}`}
              onClick={handleSave}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {isSaved ? (
                <>
                  <CheckCircle2 size={14} />
                  <span>Preferences Saved ✓</span>
                </>
              ) : (
                <>
                  <Save size={14} />
                  <span>Save Preferences</span>
                </>
              )}
            </motion.button>
          </div>
        </footer>
      </div>
    </motion.div>
  );
};

export default Settings;
