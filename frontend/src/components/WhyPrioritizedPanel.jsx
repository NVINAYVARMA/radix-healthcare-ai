import React from "react";
import {
  Activity,
  Eye,
  Clock,
  Zap,
  TrendingUp,
  AlertTriangle,
  Sliders,
  Cpu,
  Info,
  Scale,
} from "lucide-react";
import { calculateScoreBreakdown } from "../data/mockStudies";
import "./WhyPrioritizedPanel.css";

export const WhyPrioritizedPanel = ({
  study,
  onOverride,
  showOverrideBtn = true,
  compact = false,
  theme = "light",
}) => {
  if (!study) return null;

  const breakdown = study.scoreBreakdown || calculateScoreBreakdown(study);
  const score = study.manualOverride?.originalScore !== undefined
    ? study.manualOverride.originalScore
    : study.priorityScore !== undefined
    ? study.priorityScore
    : 0.50;

  const isHigh = study.priority === "High";
  const isMed = study.priority === "Medium";
  const priorityClass = isHigh ? "high" : isMed ? "med" : "low";

  return (
    <div className={`why-prioritized-container ${theme === "dark" ? "dark-theme" : ""} ${compact ? "compact" : ""}`}>
      {/* 1. Header Banner */}
      <div className="why-header">
        <div className="why-header-left">
          <div className="why-title-row">
            <div className="why-icon-badge">
              <Activity size={16} />
            </div>
            <div>
              <h3 className="why-title">Triage Priority Rationale</h3>
              <p className="why-subtitle">
                Quantitative factor decomposition and clinical risk attribution
              </p>
            </div>
          </div>
        </div>

        <div className="model-version-tag">
          <Cpu size={12} />
          <span>DenseNet-121 / ResNet-50 Ensemble</span>
        </div>
      </div>

      {/* 2. Total Prioritization Score Hero Card */}
      <div className="why-score-hero-card">
        <div className="score-hero-left">
          <span className="score-hero-label">Total Priority Score</span>
          <div className="score-hero-number-wrap">
            <span className="score-hero-number">{score.toFixed(2)}</span>
            <span className="score-hero-max">/ 1.00</span>
          </div>
          <span className="score-hero-sub">
            Model Confidence: <strong>{Math.round((study.confidenceScore || 0.96) * 100)}%</strong>
          </span>
        </div>

        <div className="score-hero-right">
          <div className={`priority-rank-badge ${priorityClass}`}>
            <span className="pulse-indicator"></span>
            <span>{(study.priority || study.priorityLevel || "STANDARD").toUpperCase()} PRIORITY</span>
          </div>
          <span className="algorithm-confidence">
            Multi-factor clinical acuity weighting
          </span>
        </div>
      </div>

      {/* 3a. Natural Language Clinical Escalation Summary */}
      <div className="why-rationale-box">
        <div className="rationale-header">
          <TrendingUp size={14} className="rationale-icon" />
          <span className="rationale-title">Clinical Escalation Rationale</span>
        </div>
        <p className="rationale-text">{breakdown.rationale}</p>
      </div>

      {/* 3b. Deterministic Tie-Breaker Resolution Notice */}
      {study.tieResolution && (
        <div className="why-tie-resolution-box">
          <div className="tie-resolution-header">
            <Scale size={14} className="tie-resolution-icon" />
            <span className="tie-resolution-title">Deterministic Queue Tie-Breaker Applied</span>
          </div>
          <p className="tie-resolution-desc">
            This study shared an identical primary Priority Score with adjacent worklist items. The queue priority was deterministically resolved via: <strong>{study.tieResolution}</strong>.
          </p>
        </div>
      )}

      {/* 4. Itemized Score Breakdown Factors */}
      <div className="why-factors-list">
        {breakdown.factors.map((factor) => {
          const factorIcons = {
            imaging: Eye,
            clinical: Activity,
            waitTime: Clock,
            referral: Zap,
          };
          const FactorIcon = factorIcons[factor.key] || Info;

          return (
            <div key={factor.key} className="why-factor-card">
              <div className="factor-card-top">
                <div className="factor-title-group">
                  <div
                    className="factor-icon-wrapper"
                    style={{ color: factor.color, backgroundColor: `${factor.color}18` }}
                  >
                    <FactorIcon size={14} />
                  </div>
                  <div>
                    <span className="factor-name">{factor.name}</span>
                    <span className="factor-weight-tag">Weight: {factor.weight}</span>
                  </div>
                </div>

                <div className="factor-score-group">
                  <span className="factor-points" style={{ color: factor.color }}>
                    +{factor.score.toFixed(2)}
                  </span>
                  <span className="factor-max-points">/ {factor.maxScore.toFixed(2)}</span>
                  <span className="factor-status-badge">{factor.badge}</span>
                </div>
              </div>

              {/* Progress Bar Fill */}
              <div className="factor-progress-track">
                <div
                  className="factor-progress-bar"
                  style={{
                    width: `${factor.percentage}%`,
                    backgroundColor: factor.color,
                  }}
                ></div>
              </div>

              <div className="factor-detail-row">
                <span className="factor-detail-text">{factor.detail}</span>
                <span className="factor-percentage-text">{factor.percentage}% impact</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 6. Manual Override Audit Banner (if already overridden) */}
      {study.manualOverride && (
        <div className="why-override-banner">
          <div className="override-banner-title">
            <AlertTriangle size={14} />
            <strong>Clinical Priority Override Active</strong>
          </div>
          <p className="override-banner-desc">
            Originally scored as <strong>{study.manualOverride.originalPriority} ({study.manualOverride.originalScore?.toFixed(2)})</strong>. Manually changed to <strong>{study.manualOverride.newPriority}</strong> by {study.manualOverride.overriddenBy}.
          </p>
          <div className="override-reason-quote">
            &ldquo;{study.manualOverride.reason}&rdquo;
          </div>
        </div>
      )}

      {/* 7. Action Footer */}
      {showOverrideBtn && onOverride && (
        <div className="why-footer-action">
          <button
            type="button"
            className="why-override-btn"
            onClick={onOverride}
            title="Adjust clinical priority level"
          >
            <Sliders size={14} />
            <span>Override AI Priority Score</span>
          </button>
          <span className="regulatory-text">
            All overrides are immutably logged to audit trail.
          </span>
        </div>
      )}
    </div>
  );
};

export default WhyPrioritizedPanel;
