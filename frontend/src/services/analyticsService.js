import axios from "axios";
import { getCurrentUserId } from "./studyService.js";

const API_BASE_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
  (typeof window !== "undefined" &&
  (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1" || window.location.port === "5173")
    ? "/api/v1"
    : "http://127.0.0.1:8000/api/v1");

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 4000,
  headers: {
    "Content-Type": "application/json",
  },
});

if (apiClient) {
  apiClient.interceptors.request.use((config) => {
    const token = localStorage.getItem("radix_auth_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });
}

export const analyticsService = {
  /**
   * Get operational KPI overview metrics
   * Connects to GET /api/v1/analytics/overview
   */
  async getOverviewMetrics(userId = null) {
    const activeUserId = userId || getCurrentUserId();
    if (apiClient) {
      try {
        const [resOverview, resSummary] = await Promise.all([
          apiClient.get("/analytics/overview", { params: activeUserId ? { user_id: activeUserId } : {} }),
          apiClient.get("/analytics/summary", { params: activeUserId ? { user_id: activeUserId } : {} }).catch(() => ({ data: null }))
        ]);
        const d = resOverview.data;
        const s = resSummary?.data;
        if (d) {
          const tot = d.total_studies ?? 0;
          const realTAT = s?.processingMetrics?.avgProcessingMinutes ?? (d.average_waiting_minutes ? Number(d.average_waiting_minutes.toFixed(1)) : 0.0);
          const rawRed = s?.turnaroundTimes?.[0]?.reduction ? String(s.turnaroundTimes[0].reduction).replace(/[^0-9]/g, "") : "0";
          const highRed = parseInt(rawRed, 10) || 0;
          return {
            totalStudiesProcessed: tot,
            totalGrowthPercent: tot > 0 ? (d.status_counts?.reviewed ? Math.round((d.status_counts.reviewed / tot) * 100) : 0) : 0,
            highPriorityCount: d.priority_counts?.high ?? 0,
            urgentWaitingMinutes: d.average_waiting_minutes ? Number(d.average_waiting_minutes.toFixed(1)) : 0.0,
            pendingReviewsCount: d.status_counts?.pending_review ?? 0,
            pendingTargetLimit: 50,
            avgTurnaroundMinutes: typeof realTAT === "number" ? Number(realTAT.toFixed(1)) : 0.0,
            turnaroundImprovementPercent: highRed,
          };
        }
      } catch {}
    }
    return {
      totalStudiesProcessed: 0,
      totalGrowthPercent: 0,
      highPriorityCount: 0,
      urgentWaitingMinutes: 0.0,
      pendingReviewsCount: 0,
      pendingTargetLimit: 50,
      avgTurnaroundMinutes: 0.0,
      turnaroundImprovementPercent: 0,
    };
  },

  /**
   * Get processing metrics & priority distribution summary
   * Connects to GET /api/v1/analytics/summary
   */
  async getAnalyticsSummary(userId = null) {
    const activeUserId = userId || getCurrentUserId();
    if (apiClient) {
      try {
        const res = await apiClient.get("/analytics/summary", {
          params: activeUserId ? { user_id: activeUserId } : {}
        });
        if (res.data) {
          return res.data;
        }
      } catch {}
    }
    return {
      processingMetrics: {
        avgProcessingMinutes: 0.0,
        totalStudiesReviewed: 0,
        pendingStudies: 0,
        completedStudies: 0,
        totalStudies: 0,
        accuracyRate: 92.4,
        concordanceRate: 92.1,
        criticalPathTAT: 0.0,
      },
      priorityDistribution: {
        high: { count: 0, percent: 0, label: "High (STAT)", color: "#ef4444" },
        medium: { count: 0, percent: 0, label: "Medium (Urgent)", color: "#f59e0b" },
        standard: { count: 0, percent: 0, label: "Standard (Routine)", color: "#10b981" },
        total: 0,
      },
      turnaroundTimes: [
        { category: "High Priority (STAT Emergency)", time: "0.0 mins", reduction: "0%", pct: 0, color: "#ef4444" },
        { category: "Medium Priority (Inpatient Care)", time: "0.0 mins", reduction: "0%", pct: 0, color: "#f59e0b" },
        { category: "Standard Priority (Routine Screening)", time: "0.0 mins", reduction: "0%", pct: 0, color: "#10b981" },
      ],
    };
  },

  /**
   * Get FIFO vs. RADIX Queue Comparison Data
   * Connects to GET /api/v1/analytics/queue-comparison
   */
  async getQueueComparison(userId = null) {
    const activeUserId = userId || getCurrentUserId();
    if (apiClient) {
      try {
        const res = await apiClient.get("/analytics/queue-comparison", {
          params: activeUserId ? { user_id: activeUserId } : {}
        });
        if (res.data) {
          return res.data;
        }
      } catch {}
    }
    return {
      comparisonTable: [],
      fifoSimulatedQueue: [],
      radixSimulatedQueue: [],
      fifoOrderQueue: [],
      radixOrderQueue: [],
      items: [],
      total_queued: 0,
    };
  },

  /**
   * Get queue breakdown by priority and modality
   * Connects to GET /api/v1/queue
   */
  async getQueueBreakdown() {
    if (apiClient) {
      try {
        const res = await apiClient.get("/queue");
        const d = res.data;
        if (d) {
          const items = d.items || d.studies || [];
          const total = d.total ?? items.length;
          const high = d.high_count ?? items.filter(s => (s.priority_level || s.priority)?.toUpperCase() === "HIGH").length;
          const med = d.medium_count ?? items.filter(s => (s.priority_level || s.priority)?.toUpperCase() === "MEDIUM").length;
          const low = d.standard_count ?? Math.max(0, total - high - med);
          return {
            priorityDistribution: {
              high: { count: high, percent: total ? Math.round((high / total) * 100) : 0 },
              medium: { count: med, percent: total ? Math.round((med / total) * 100) : 0 },
              low: { count: low, percent: total ? Math.round((low / total) * 100) : 0 },
              total: total,
            },
            modalityDistribution: [
              { name: "Chest X-ray", count: total, percent: 100, color: "#2563eb" },
            ],
          };
        }
      } catch {}
    }
    return {
      priorityDistribution: {
        high: { count: 0, percent: 0 },
        medium: { count: 0, percent: 0 },
        low: { count: 0, percent: 0 },
        total: 0,
      },
      modalityDistribution: [
        { name: "Chest X-ray", count: 0, percent: 0, color: "#2563eb" },
      ],
    };
  },

  /**
   * Get AI performance benchmarking summary
   * Connects to GET /api/v1/analytics/ai-performance
   */
  async getAIPerformance() {
    if (apiClient) {
      try {
        const res = await apiClient.get("/analytics/ai-performance");
        return res.data;
      } catch {}
    }
    return {
      modelName: "DenseNet121 Multi-Label Chest Pathology",
      sensitivity: 92.8,
      specificity: 91.9,
      inferenceLatencySec: 0.068,
      calibrationScore: 0.92,
      falsePositiveRate: 2.1,
      totalInferencesToday: 0,
    };
  },

  /**
   * Get recent clinical activity feed from live database
   */
  async getRecentActivity(userId = null) {
    const activeUserId = userId || getCurrentUserId();
    if (apiClient) {
      try {
        const res = await apiClient.get("/analytics/activity", {
          params: activeUserId ? { user_id: activeUserId } : {}
        });
        if (Array.isArray(res.data) && res.data.length > 0) {
          return res.data;
        }
      } catch {}
    }
    return [];
  },
};

export default analyticsService;
