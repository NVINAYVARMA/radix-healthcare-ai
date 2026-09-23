import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Activity, ShieldCheck, Zap, Sparkles } from "lucide-react";
import "./PacsLoader.css";

const PACS_STEPS = [
  "Connecting to PACS DICOM Node...",
  "Acquiring High-Resolution Thoracic Series...",
  "Synthesizing DenseNet-121 Pathology Matrix...",
  "Calibrating Hounsfield Presets & Urgency Vector...",
];

export const PacsLoader = ({
  title = "Acquiring DICOM Series",
  subtitle = "Streaming PACS diagnostic series & AI urgency factors...",
  compact = false,
}) => {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setStepIndex((prev) => (prev + 1) % PACS_STEPS.length);
    }, 1800);
    return () => clearInterval(timer);
  }, []);

  if (compact) {
    return (
      <div className="pacs-loader-compact">
        <div className="pacs-scanner-hud-mini">
          <div className="pacs-hud-ring-mini" />
          <Activity size={18} className="pacs-pulse-icon-mini" />
        </div>
        <span className="pacs-compact-text">{PACS_STEPS[stepIndex]}</span>
      </div>
    );
  }

  return (
    <div className="pacs-loader-fullscreen">
      <div className="pacs-scanner-card">
        {/* Holographic Diagnostic Scanner HUD */}
        <div className="pacs-scanner-viewport">
          {/* Animated Hologram Grid */}
          <div className="pacs-grid-overlay" />

          {/* Sweeping Laser Bar */}
          <div className="pacs-laser-scanline" />

          {/* Stylized Chest X-Ray Holographic Silhouette */}
          <svg
            className="pacs-hologram-chest"
            viewBox="0 0 200 200"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Spine & Ribcage Paths */}
            <path
              d="M100 20 V180 M85 45 C70 55 55 75 55 105 C55 135 70 155 85 165 M115 45 C130 55 145 75 145 105 C145 135 130 155 115 165"
              stroke="#0284c7"
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity="0.4"
            />
            {/* Clavicles */}
            <path
              d="M60 40 Q100 50 140 40"
              stroke="#38bdf8"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.6"
            />
            {/* Rib Arcs */}
            <path d="M75 65 C60 72 60 90 75 95" stroke="#38bdf8" strokeWidth="1.8" opacity="0.5" />
            <path d="M125 65 C140 72 140 90 125 95" stroke="#38bdf8" strokeWidth="1.8" opacity="0.5" />
            <path d="M78 105 C62 112 62 130 78 135" stroke="#38bdf8" strokeWidth="1.8" opacity="0.5" />
            <path d="M122 105 C138 112 138 130 122 135" stroke="#38bdf8" strokeWidth="1.8" opacity="0.5" />
            {/* Cardiac Silhouette Outline */}
            <path
              d="M92 95 C85 110 88 130 105 138 C115 130 115 110 108 95 Z"
              stroke="#38bdf8"
              strokeWidth="2"
              fill="rgba(2, 132, 199, 0.15)"
              className="pacs-cardiac-glow"
            />
          </svg>

          {/* Central Rotating Target Reticle */}
          <div className="pacs-reticle-outer" />
          <div className="pacs-reticle-inner" />

          {/* Pulsing ECG Vitals Waveform */}
          <div className="pacs-ecg-container">
            <svg className="pacs-ecg-svg" viewBox="0 0 300 40">
              <path
                className="pacs-ecg-path"
                d="M0,20 L60,20 L70,12 L75,28 L80,5 L86,35 L92,20 L100,20 L160,20 L170,12 L175,28 L180,5 L186,35 L192,20 L200,20 L260,20 L270,12 L275,28 L280,5 L286,35 L292,20 L300,20"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          {/* Live Scanner Telemetry Badges */}
          <div className="pacs-hud-badge top-left">
            <span className="dot-live" /> PACS FEED
          </div>
          <div className="pacs-hud-badge top-right">
            <span>224×224 DICOM</span>
          </div>
          <div className="pacs-hud-badge bottom-left">
            <span>DENSENET-121</span>
          </div>
          <div className="pacs-hud-badge bottom-right">
            <Zap size={11} /> 100 FPS
          </div>
        </div>

        {/* Dynamic Status Header */}
        <div className="pacs-loader-info">
          <div className="pacs-loader-title-row">
            <div className="pacs-spinner-ring" />
            <h3 className="pacs-loader-title">{title}</h3>
          </div>
          <p className="pacs-loader-subtitle">{subtitle}</p>

          {/* Animated Telemetry Step Rotator */}
          <div className="pacs-telemetry-step-box">
            <motion.div
              key={stepIndex}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="pacs-telemetry-step"
            >
              <Sparkles size={13} className="step-sparkle-icon" />
              <span>{PACS_STEPS[stepIndex]}</span>
            </motion.div>
          </div>

          {/* Holographic Glowing Progress Track */}
          <div className="pacs-loader-progress-track">
            <div className="pacs-loader-progress-fill" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PacsLoader;
