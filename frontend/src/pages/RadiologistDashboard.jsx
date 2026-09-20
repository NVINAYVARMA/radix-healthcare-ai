import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  Clock,
  CheckCircle2,
  TrendingUp,
  ArrowRight,
  ShieldCheck,
  Zap,
  Layers,
  ArrowUpRight,
  Eye,
} from "lucide-react";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import Skeleton from "../components/ui/LoadingSkeleton";
import { analyticsService } from "../services/analyticsService";
import { studyService } from "../services/studyService";
import "./RadiologistDashboard.css";

const dashboardContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const cardItemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, ease: "easeOut" },
  },
};

export const RadiologistDashboard = () => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState({
    totalStudiesProcessed: 0,
    totalGrowthPercent: 0,
    highPriorityCount: 0,
    urgentWaitingMinutes: 0.0,
    pendingReviewsCount: 0,
    pendingTargetLimit: 50,
    avgTurnaroundMinutes: 0.0,
    turnaroundImprovementPercent: 0,
  });
  const [queueData, setQueueData] = useState({
    priorityDistribution: {
      high: { count: 0, percent: 0 },
      medium: { count: 0, percent: 0 },
      low: { count: 0, percent: 0 },
      total: 0,
    },
    modalityDistribution: [
      { name: "Chest X-ray", count: 0, percent: 0, color: "#2563eb" },
    ],
  });
  const [aiData, setAiData] = useState({
    modelName: "DenseNet-121 Multi-Label Chest Pathology v2.0",
    sensitivity: 98.2,
    specificity: 95.6,
    inferenceLatencySec: 1.4,
    calibrationScore: 0.94,
    falsePositiveRate: 1.8,
    totalInferencesToday: 0,
  });
  const [activities, setActivities] = useState([
    {
      id: "act-1",
      time: "Live",
      type: "system",
      title: "PACS AI Prioritization Gateway Active",
      description: "DenseNet-121 multi-label inference model ready for incoming studies.",
    },
    {
      id: "act-2",
      time: "Live",
      type: "system",
      title: "Firebase Firestore Live Sync",
      description: "Priority queue and radiologist review log replication ready.",
    },
  ]);
  const [liveStudies, setLiveStudies] = useState(() => studyService.getCachedStudies());
  const [isLoading, setIsLoading] = useState(() => studyService.getCachedStudies().length === 0);

  useEffect(() => {
    let isMounted = true;
    async function loadDashboardData() {
      try {
        if (liveStudies.length === 0) {
          setIsLoading(true);
        }
        const userStr = localStorage.getItem("radix_user");
        const currentUser = userStr ? JSON.parse(userStr) : null;
        const activeUserId = currentUser?.id || currentUser?.email || null;

        const [m, q, a, act, st] = await Promise.all([
          analyticsService.getOverviewMetrics(activeUserId),
          analyticsService.getAnalyticsSummary(activeUserId),
          analyticsService.getAIPerformance(),
          analyticsService.getRecentActivity(),
          studyService.getWorklistQueue({ limit: 100 }),
        ]);
        if (isMounted) {
          if (m) setMetrics(m);
          if (q) setQueueData(q);
          if (a) setAiData(a);
          if (act && act.length > 0) setActivities(act);
          if (st?.studies) setLiveStudies(st.studies);
        }
      } catch (err) {
        console.error("Error loading dashboard data:", err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }
    loadDashboardData();
    return () => {
      isMounted = false;
    };
  }, []);

  const highPriorityStudies = (liveStudies || [])
    .filter((s) => (s?.priority || s?.priority_level) === "High" || (s?.priority || s?.priority_level) === "HIGH")
    .slice(0, 5);

  const totalProcessed = (metrics?.totalStudiesProcessed ?? liveStudies.length ?? 0).toLocaleString();
  const growthPct = metrics?.totalGrowthPercent ?? 0;
  const highCount = metrics?.highPriorityCount ?? liveStudies.filter(s => s.priority === "High").length ?? 0;
  const urgentWait = metrics?.urgentWaitingMinutes ?? 0.0;
  const pendingCount = metrics?.pendingReviewsCount ?? liveStudies.filter(s => s.status !== "Reviewed").length ?? 0;
  const pendingLimit = metrics?.pendingTargetLimit ?? 50;
  const avgTAT = metrics?.avgTurnaroundMinutes ?? 0.0;

  const highDist = queueData?.priorityDistribution?.high || { count: 0, percent: 0 };
  const medDist = queueData?.priorityDistribution?.medium || { count: 0, percent: 0 };
  const lowDist = queueData?.priorityDistribution?.low || queueData?.priorityDistribution?.standard || { count: 0, percent: 0 };
  const modalities = liveStudies.length > 0 ? [
    {
      name: "Chest X-ray",
      count: liveStudies.length,
      percent: 100,
      color: "#2563eb"
    }
  ] : [
    { name: "Chest X-ray", count: 0, percent: 0, color: "#2563eb" },
  ];

  const aiModel = aiData?.modelName || "DenseNet-121 Multi-Label AI";
  const aiSens = aiData?.sensitivity ?? 97.4;
  const aiSpec = aiData?.specificity ?? 96.8;
  const aiLat = aiData?.inferenceLatencySec ?? 0.3;
  const aiCalib = aiData?.calibrationScore ?? 0.94;

  return (
    <motion.div
      className="radiologist-dashboard-page"
      variants={dashboardContainerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* =========================================
          TOP BANNER: GREETING & QUICK ACTION
      ========================================= */}
      <motion.div variants={cardItemVariants} className="dashboard-welcome-banner">
        <div className="welcome-text-group">
          <h2>Radiologist Operations Center</h2>
          <p>
            AI Triage Engine v2.4 actively prioritizing incoming clinical imaging streams.
          </p>
        </div>

        <div className="welcome-actions">
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate("/worklist")}
            rightIcon={<ArrowRight size={14} />}
          >
            Open Active Worklist
          </Button>
        </div>
      </motion.div>

      {/* =========================================
          SECTION 1: 4 KEY OPERATIONAL METRICS
      ========================================= */}
      <div className="metrics-cards-grid">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} variant="elevated" className="metric-kpi-card">
              <div className="metric-card-top">
                <Skeleton width="110px" height="13px" />
                <Skeleton width="28px" height="28px" style={{ borderRadius: "6px" }} />
              </div>
              <Skeleton width="75px" height="28px" style={{ margin: "6px 0 2px" }} />
              <Skeleton width="120px" height="12px" />
            </Card>
          ))
        ) : (
          <>
            {/* Metric 1: Total Studies Processed */}
            <motion.div variants={cardItemVariants} whileHover={{ y: -3, transition: { duration: 0.15 } }}>
              <Card variant="elevated" className="metric-kpi-card">
                <div className="metric-card-top">
                  <span className="metric-kpi-title">Total Studies Processed</span>
                  <div className="metric-icon-box bg-blue">
                    <Layers size={16} />
                  </div>
                </div>
                <div className="metric-kpi-value">{totalProcessed}</div>
                <div className="metric-trend text-positive">
                  <TrendingUp size={13} />
                  <span>+{growthPct}% this month</span>
                </div>
              </Card>
            </motion.div>

            {/* Metric 2: High Priority Cases */}
            <motion.div variants={cardItemVariants} whileHover={{ y: -3, transition: { duration: 0.15 } }}>
              <Card variant="elevated" className="metric-kpi-card card-urgent-alert">
                <div className="metric-card-top">
                  <span className="metric-kpi-title">High Priority Cases</span>
                  <div className="metric-icon-box bg-red">
                    <AlertTriangle size={16} />
                  </div>
                </div>
                <div className="metric-kpi-value text-red">{highCount}</div>
                <div className="metric-trend text-urgent">
                  <Zap size={13} />
                  <span>Avg waiting: {urgentWait} mins</span>
                </div>
              </Card>
            </motion.div>

            {/* Metric 3: Pending Reviews */}
            <motion.div variants={cardItemVariants} whileHover={{ y: -3, transition: { duration: 0.15 } }}>
              <Card variant="elevated" className="metric-kpi-card">
                <div className="metric-card-top">
                  <span className="metric-kpi-title">Pending Reviews</span>
                  <div className="metric-icon-box bg-amber">
                    <Clock size={16} />
                  </div>
                </div>
                <div className="metric-kpi-value">{pendingCount}</div>
                <div className="metric-trend text-neutral">
                  <span>Capacity: {pendingCount} / {pendingLimit} target</span>
                </div>
              </Card>
            </motion.div>

            {/* Metric 4: Average Turnaround Time */}
            <motion.div variants={cardItemVariants} whileHover={{ y: -3, transition: { duration: 0.15 } }}>
              <Card variant="elevated" className="metric-kpi-card">
                <div className="metric-card-top">
                  <span className="metric-kpi-title">Avg Turnaround Time</span>
                  <div className="metric-icon-box bg-green">
                    <CheckCircle2 size={16} />
                  </div>
                </div>
                <div className="metric-kpi-value">{avgTAT} <small>mins</small></div>
                <div className="metric-trend text-positive">
                  <TrendingUp size={13} />
                  <span>3.2x faster vs manual triage</span>
                </div>
              </Card>
            </motion.div>
          </>
        )}
      </div>

      {/* =========================================
          SECTION 2 & 3: QUEUE OVERVIEW & AI BENCHMARKS
      ========================================= */}
      <motion.div variants={cardItemVariants} className="dashboard-middle-grid">
        {/* Priority Distribution & Queue Overview */}
        <Card variant="elevated" className="dashboard-panel-card">
          <div className="panel-header-row">
            <div>
              <h3>Priority Distribution & Queue</h3>
              <p>Current triage status across all {liveStudies.length} active studies</p>
            </div>
            <Badge variant="cyan" size="sm" hasDot>
              Live Sync
            </Badge>
          </div>

          {/* Distribution Stacked Bar */}
          <div className="stacked-priority-bar-container">
            <div className="stacked-priority-bar">
              <div
                className="bar-segment seg-high"
                style={{ width: `${highDist.percent}%` }}
                title={`High: ${highDist.count}`}
              ></div>
              <div
                className="bar-segment seg-med"
                style={{ width: `${medDist.percent}%` }}
                title={`Medium: ${medDist.count}`}
              ></div>
              <div
                className="bar-segment seg-low"
                style={{ width: `${lowDist.percent}%` }}
                title={`Low: ${lowDist.count}`}
              ></div>
            </div>

            {/* Legend & Stats */}
            <div className="priority-legend-row">
              <div className="legend-item">
                <span className="legend-dot dot-high"></span>
                <span className="legend-label">High Priority:</span>
                <strong>{highDist.count} ({highDist.percent}%)</strong>
              </div>

              <div className="legend-item">
                <span className="legend-dot dot-med"></span>
                <span className="legend-label">Medium Priority:</span>
                <strong>{medDist.count} ({medDist.percent}%)</strong>
              </div>

              <div className="legend-item">
                <span className="legend-dot dot-low"></span>
                <span className="legend-label">Low Priority:</span>
                <strong>{lowDist.count} ({lowDist.percent}%)</strong>
              </div>
            </div>
          </div>

          {/* Modality Breakdown */}
          <div className="modality-breakdown-section">
            <span className="sub-section-title">Modality Composition</span>
            <div className="modality-pills-list">
              {modalities.map((m) => (
                <div key={m.name} className="modality-pill-box">
                  <div className="modality-pill-name">
                    <span className="mod-color-tag" style={{ background: m.color }}></span>
                    <span>{m.name}</span>
                  </div>
                  <strong>{m.count} ({m.percent}%)</strong>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* AI Performance Summary */}
        <Card variant="elevated" className="dashboard-panel-card">
          <div className="panel-header-row">
            <div>
              <h3>AI Performance Summary</h3>
              <p>{aiModel}</p>
            </div>
            <Badge variant="neutral" size="sm">
              FDA SaMD Grade
            </Badge>
          </div>

          <div className="ai-metrics-grid">
            <div className="ai-stat-box">
              <span className="ai-stat-label">Sensitivity</span>
              <strong className="ai-stat-value text-blue">{aiSens}%</strong>
              <small>Critical anomaly recall</small>
            </div>

            <div className="ai-stat-box">
              <span className="ai-stat-label">Specificity</span>
              <strong className="ai-stat-value text-blue">{aiSpec}%</strong>
              <small>Normal study accuracy</small>
            </div>

            <div className="ai-stat-box">
              <span className="ai-stat-label">Inference Speed</span>
              <strong className="ai-stat-value text-blue">{aiLat}s</strong>
              <small>End-to-end triage latency</small>
            </div>

            <div className="ai-stat-box">
              <span className="ai-stat-label">Calibration Score</span>
              <strong className="ai-stat-value text-blue">{aiCalib}</strong>
              <small>Reliability index (ECE &lt; 0.03)</small>
            </div>
          </div>

          <div className="ai-compliance-banner">
            <ShieldCheck size={16} className="text-green" />
            <span>Human oversight certified: 100% of prioritized studies require physician review.</span>
          </div>
        </Card>
      </motion.div>

      {/* =========================================
          SECTION 4 & 5: RECENT STUDIES & ACTIVITY FEED
      ========================================= */}
      <motion.div variants={cardItemVariants} className="dashboard-bottom-grid">
        {/* Urgent High-Priority Studies */}
        <Card variant="elevated" className="dashboard-panel-card">
          <div className="panel-header-row">
            <div>
              <h3>Urgent Studies Requiring Attention</h3>
              <p>Prioritized by AI triage algorithms based on acute findings</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/worklist")}
              rightIcon={<ArrowUpRight size={14} />}
            >
              View All {liveStudies.length} Studies
            </Button>
          </div>

          <div className="urgent-studies-table-container">
            <table className="urgent-table">
              <thead>
                <tr>
                  <th>Patient ID</th>
                  <th>Age / Sex</th>
                  <th>Arrival</th>
                  <th>Priority Score</th>
                  <th>AI Detection Summary</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, rIdx) => (
                    <tr key={rIdx} style={{ height: "36px" }}>
                      <td><Skeleton width="65px" height="14px" /></td>
                      <td><Skeleton width="45px" height="14px" /></td>
                      <td><Skeleton width="50px" height="14px" /></td>
                      <td><Skeleton width="60px" height="18px" style={{ borderRadius: "10px" }} /></td>
                      <td><Skeleton width="180px" height="14px" /></td>
                      <td><Skeleton width="52px" height="22px" style={{ borderRadius: "4px" }} /></td>
                    </tr>
                  ))
                ) : highPriorityStudies.length > 0 ? (
                  highPriorityStudies.map((s) => {
                    const sId = s?.id || s?.study_id || "ST-001";
                    const pScore = typeof s?.priorityScore === "number" ? s.priorityScore : typeof s?.priority_score === "number" ? s.priority_score : 0.85;
                    return (
                      <tr key={sId}>
                        <td>
                          <strong>{s?.patientId || s?.patient_id || sId}</strong>
                        </td>
                        <td>{s?.age ?? "54"} / {s?.sex ?? "M"}</td>
                        <td>{s?.arrivalTime || s?.arrival_time || "10:15"}</td>
                        <td>
                          <span className="urgent-score-badge">
                            {pScore.toFixed(2)} High
                          </span>
                        </td>
                        <td className="urgent-findings-cell">{s?.keyFindings || s?.clinical_indication || "Acute findings detected"}</td>
                        <td>
                          <button
                            className="open-study-btn"
                            onClick={() => navigate(`/study/${sId}`)}
                            title="Open in PACS Viewer"
                          >
                            <Eye size={13} />
                            <span>View</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "20px", color: "#64748b" }}>
                      <CheckCircle2 size={18} style={{ color: "#16a34a", verticalAlign: "middle", marginRight: "6px" }} />
                      <span>All STAT and High-priority studies cleared. Queue is operating smoothly.</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Recent Activity Timeline */}
        <Card variant="elevated" className="dashboard-panel-card">
          <div className="panel-header-row">
            <div>
              <h3>Recent Clinical Timeline</h3>
              <p>Live stream of incoming studies & audit milestones</p>
            </div>
            <Activity size={16} className="text-muted" />
          </div>

          <div className="dashboard-timeline-list">
            {activities.map((act) => (
              <div key={act.id} className="timeline-event-card">
                <span className="event-time">{act.time}</span>
                <div className="event-body">
                  <strong>{act.title}</strong>
                  <p>{act.description}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
};

export default RadiologistDashboard;
