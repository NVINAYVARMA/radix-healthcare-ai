import axios from "axios";
import { mockStudies } from "../data/mockStudies";

const API_BASE_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
  (typeof window !== "undefined" &&
  (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1" || window.location.port === "5173")
    ? "/api/v1"
    : "http://127.0.0.1:8000/api/v1");

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
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

/**
 * Retrieve active user object from local session
 */
export function getCurrentUserObj() {
  try {
    const userStr = localStorage.getItem("radix_user");
    if (userStr) {
      return JSON.parse(userStr);
    }
  } catch {}
  return null;
}

/**
 * Retrieve active user identifier from local session
 */
export function getCurrentUserId() {
  const u = getCurrentUserObj();
  return u?.id != null ? u.id : (u?.email || null);
}

/**
 * Robustly matches study uploader against current session user
 */
export function matchesCurrentUser(uploadedBy) {
  if (!uploadedBy) return true;
  const u = getCurrentUserObj();
  if (!u) return true;
  const rawUid = String(u.id ?? "").toLowerCase();
  const cleanUid = rawUid.replace(/^usr_radix_/, "");
  const email = String(u.email ?? "").toLowerCase();
  const username = String(u.username ?? "").toLowerCase();
  const up = String(uploadedBy).trim().toLowerCase();
  const cleanUp = up.replace(/^usr_radix_/, "");

  if (
    up === rawUid ||
    cleanUp === cleanUid ||
    up === email ||
    cleanUp === email ||
    up === `usr_radix_${cleanUid}` ||
    (username && up === username) ||
    up === "system" ||
    up === "clinic" ||
    up === "hospital"
  ) {
    return true;
  }

  // Name matching with titles stripped
  const normalize = (s) =>
    s
      .toLowerCase()
      .replace(/^(?:dr\.?|doctor)\s+/i, "")
      .replace(/,?\s*(?:md|do|phd|mbbs)$/i, "")
      .replace(/[^a-z0-9]/g, "")
      .trim();

  const userNames = [u.name, u.full_name, u.displayName, email ? email.split("@")[0] : null].filter(Boolean);
  const normUp = normalize(up);
  for (const un of userNames) {
    const normUn = normalize(un);
    if (normUp === normUn) return true;
    if (normUp.length > 3 && normUn.length > 3 && (normUp.includes(normUn) || normUn.includes(normUp))) {
      return true;
    }
  }

  return false;
}

/**
 * Robustly constructs full image URL from relative storage path or absolute URL
 */
export function getFullImageUrl(rawPath) {
  if (!rawPath) return "/xray_frontal_hd.png";
  if (rawPath.startsWith("http://") || rawPath.startsWith("https://")) return rawPath;
  let clean = rawPath.replace(/^\/+/, "");
  if (clean.startsWith("api/v1/storage/")) {
    clean = clean.replace(/^api\/v1\/storage\//, "");
  }
  const prefix = API_BASE_URL.replace(/\/api\/v1\/?$/, "");
  return `${prefix}/api/v1/storage/${clean}`;
}

/**
 * Format any arrival time value (ISO string, raw timestamp, or formatted time)
 * into localized, human-friendly 12-hour format e.g. "10:34 AM".
 * Correctly accounts for UTC ISO strings stored without 'Z' in SQLite.
 */
export function formatArrivalTime(raw) {
  if (!raw) return "Just now";
  const str = String(raw).trim();
  
  // If it's already a formatted time like "10:34 AM" or "02:15 PM"
  if (/^\d{1,2}:\d{2}(?:\s*[APap][Mm])?$/.test(str)) {
    return str;
  }

  try {
    let dateStr = str;
    // If ISO timestamp without timezone designator, treat as UTC
    if (!dateStr.endsWith("Z") && !dateStr.includes("+") && !/-\d{2}:\d{2}$/.test(dateStr)) {
      dateStr = dateStr.replace(" ", "T") + "Z";
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  } catch {}

  return "Just now";
}

/**
 * Parses raw arrival date/time into absolute epoch milliseconds.
 * Ensures consistent ordering and comparison across all time representations.
 */
export function parseArrivalToTimestamp(raw) {
  if (!raw) return 0;
  if (typeof raw === "number") return raw;

  const str = String(raw).trim();
  
  // Match "10:34 AM" or "02:15 PM"
  const timeMatch = str.match(/^(\d{1,2}):(\d{2})(?:\s*([APap][Mm]))?$/);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const mins = parseInt(timeMatch[2], 10);
    const ampm = timeMatch[3]?.toUpperCase();
    if (ampm === "PM" && hours < 12) hours += 12;
    if (ampm === "AM" && hours === 12) hours = 0;
    const now = new Date();
    now.setHours(hours, mins, 0, 0);
    return now.getTime();
  }

  try {
    let dateStr = str;
    if (!dateStr.endsWith("Z") && !dateStr.includes("+") && !/-\d{2}:\d{2}$/.test(dateStr)) {
      dateStr = dateStr.replace(" ", "T") + "Z";
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.getTime();
    }
  } catch {}

  return 0;
}

export function getStudyArrivalTimestamp(s) {
  if (!s) return 0;
  if (s.arrival_time_raw) {
    const t = parseArrivalToTimestamp(s.arrival_time_raw);
    if (t > 0) return t;
  }
  if (s.arrival_time) {
    const t = parseArrivalToTimestamp(s.arrival_time);
    if (t > 0) return t;
  }
  if (s.arrivalTime) {
    const t = parseArrivalToTimestamp(s.arrivalTime);
    if (t > 0) return t;
  }
  return 0;
}

export function getStudyWaitingTime(s) {
  if (!s) return 0;
  if (s.waitingMinutes != null) return Number(s.waitingMinutes);
  if (s.waiting_minutes != null) return Number(s.waiting_minutes);
  if (s.arrivalHoursAgo != null) return Number(s.arrivalHoursAgo) * 60;
  return 0;
}

export function computeTieExplanation(a, b) {
  if (!a || !b) return null;

  // 1. Primary Priority Score
  const scoreA = Number(a.priorityScore ?? a.priority_score ?? 0);
  const scoreB = Number(b.priorityScore ?? b.priority_score ?? 0);
  if (Math.abs(scoreA - scoreB) > 0.001) {
    return null;
  }

  // 2. Clinical Urgency
  const rankMap = { CRITICAL: 4, STAT: 4, HIGH: 3, MEDIUM: 2, STANDARD: 1, LOW: 1 };
  const catA = (a.manualOverride?.newPriority || a.priorityLevel || a.priority || "STANDARD").toUpperCase();
  const catB = (b.manualOverride?.newPriority || b.priorityLevel || b.priority || "STANDARD").toUpperCase();
  const rankA = rankMap[catA] || 1;
  const rankB = rankMap[catB] || 1;
  if (rankA !== rankB) {
    return `Clinical Urgency (${catA} vs ${catB})`;
  }

  // 3. Critical Findings
  const critKeywords = ["pneumothorax", "hemorrhage", "perforation", "tension", "stat", "acute", "urgent", "critical", "emergency"];
  const textA = `${a.keyFindings || ""} ${a.clinicalNotes || ""}`.toLowerCase();
  const textB = `${b.keyFindings || ""} ${b.clinicalNotes || ""}`.toLowerCase();
  const critA = Boolean(a.hasCriticalFinding) || critKeywords.some((k) => textA.includes(k));
  const critB = Boolean(b.hasCriticalFinding) || critKeywords.some((k) => textB.includes(k));
  if (critA !== critB) {
    return `Critical Findings (${critA ? "Acute finding" : "Standard"})`;
  }

  // 4. Waiting Time (longer wait wins)
  const waitA = getStudyWaitingTime(a);
  const waitB = getStudyWaitingTime(b);
  if (Math.abs(waitA - waitB) >= 0.5) {
    return `Waiting Time (${Math.round(waitA)}m vs ${Math.round(waitB)}m)`;
  }

  // 5. Arrival Timestamp (earlier arrival wins)
  const timeA = getStudyArrivalTimestamp(a);
  const timeB = getStudyArrivalTimestamp(b);
  if (timeA !== timeB) {
    const dispA = formatArrivalTime(a.arrival_time || a.arrival_time_raw || a.arrivalTime);
    const dispB = formatArrivalTime(b.arrival_time || b.arrival_time_raw || b.arrivalTime);
    return `Arrival Time (${dispA} vs ${dispB})`;
  }

  // 6. Stable UID
  const idA = a.studyId || a.id || "";
  const idB = b.studyId || b.id || "";
  return `Deterministic ID (${idA} vs ${idB})`;
}

export function deterministicCompareStudies(a, b, primarySort = "priorityScore", sortDir = "desc") {
  // If explicitly sorting by a non-priority column
  if (primarySort && primarySort !== "priorityScore" && primarySort !== "score" && primarySort !== "priority" && primarySort !== "queue") {
    let valA = a[primarySort];
    let valB = b[primarySort];
    if (primarySort === "age") {
      valA = a.age || 0;
      valB = b.age || 0;
    } else if (primarySort === "studyId") {
      valA = a.studyId || "";
      valB = b.studyId || "";
    } else if (primarySort === "patientId") {
      valA = a.patientId || "";
      valB = b.patientId || "";
    } else if (primarySort === "arrivalTime" || primarySort === "arrival") {
      valA = getStudyArrivalTimestamp(a);
      valB = getStudyArrivalTimestamp(b);
    }
    if (valA !== valB) {
      if (valA < valB) return sortDir === "asc" ? -1 : 1;
      if (valA > valB) return sortDir === "asc" ? 1 : -1;
    }
  }

  // Explicit priority category sort
  if (primarySort === "priority") {
    const rankMap = { CRITICAL: 4, STAT: 4, HIGH: 3, MEDIUM: 2, STANDARD: 1, LOW: 1 };
    const catA = (a.manualOverride?.newPriority || a.priorityLevel || a.priority || "STANDARD").toUpperCase();
    const catB = (b.manualOverride?.newPriority || b.priorityLevel || b.priority || "STANDARD").toUpperCase();
    const rankA = rankMap[catA] || 1;
    const rankB = rankMap[catB] || 1;
    if (rankA !== rankB) {
      return sortDir === "asc" ? rankA - rankB : rankB - rankA;
    }
  }

  // 1. Primary Priority Score — highest first
  const scoreA = Number(a.priorityScore ?? a.priority_score ?? 0);
  const scoreB = Number(b.priorityScore ?? b.priority_score ?? 0);
  if (Math.abs(scoreA - scoreB) > 0.001) {
    return sortDir === "asc" && primarySort === "priorityScore" ? scoreA - scoreB : scoreB - scoreA;
  }

  // 2. Clinical Urgency Category DESC
  const rankMap = { CRITICAL: 4, STAT: 4, HIGH: 3, MEDIUM: 2, STANDARD: 1, LOW: 1 };
  const catA = (a.manualOverride?.newPriority || a.priorityLevel || a.priority || "STANDARD").toUpperCase();
  const catB = (b.manualOverride?.newPriority || b.priorityLevel || b.priority || "STANDARD").toUpperCase();
  const rankA = rankMap[catA] || 1;
  const rankB = rankMap[catB] || 1;
  if (rankA !== rankB) {
    return rankB - rankA;
  }

  // 3. Critical / Urgent Finding Indicator DESC
  const critKeywords = ["pneumothorax", "hemorrhage", "perforation", "tension", "stat", "acute", "urgent", "critical", "emergency"];
  const textA = `${a.keyFindings || ""} ${a.clinicalNotes || ""}`.toLowerCase();
  const textB = `${b.keyFindings || ""} ${b.clinicalNotes || ""}`.toLowerCase();
  const critA = Boolean(a.hasCriticalFinding) || critKeywords.some((k) => textA.includes(k)) ? 1 : 0;
  const critB = Boolean(b.hasCriticalFinding) || critKeywords.some((k) => textB.includes(k)) ? 1 : 0;
  if (critA !== critB) {
    return critB - critA;
  }

  // 4. Waiting time — patient waiting longer gets higher queue priority
  const waitA = getStudyWaitingTime(a);
  const waitB = getStudyWaitingTime(b);
  if (Math.abs(waitA - waitB) >= 0.5) {
    return waitB - waitA;
  }

  // 5. Study/arrival timestamp — earlier study gets priority
  const timeA = getStudyArrivalTimestamp(a);
  const timeB = getStudyArrivalTimestamp(b);
  if (timeA !== timeB) {
    return timeA - timeB;
  }

  // 6. Stable Unique ID ASC
  const idA = String(a.studyId || a.id || "");
  const idB = String(b.studyId || b.id || "");
  return idA.localeCompare(idB);
}

export function getAnatomicalCoordinatesForFinding(keyFindings = "", priority = "Low") {
  const kf = String(keyFindings).toLowerCase();
  if (kf.includes("pneumothorax")) {
    return { x: 58, y: 14, width: 28, height: 28, label: "Apical Pneumothorax Line" };
  }
  if (kf.includes("effusion")) {
    return { x: 54, y: 58, width: 30, height: 26, label: "Costophrenic Angle Blunting" };
  }
  if (kf.includes("pneumonia") || kf.includes("consolidation")) {
    return { x: 48, y: 44, width: 32, height: 28, label: "Airspace Opacity / Consolidation" };
  }
  if (kf.includes("atelectasis")) {
    return { x: 28, y: 54, width: 30, height: 24, label: "Basilar Linear Opacity (Atelectasis)" };
  }
  if (kf.includes("edema")) {
    return { x: 34, y: 38, width: 38, height: 28, label: "Perihilar Vascular Infiltrates" };
  }
  if (kf.includes("cardiomegaly")) {
    return { x: 36, y: 50, width: 36, height: 30, label: "Cardiothoracic Ratio > 0.50" };
  }
  if (kf.includes("clear") || kf.includes("baseline") || (!priority?.toLowerCase().includes("high") && !kf.includes("effusion") && !kf.includes("pneumo"))) {
    return { x: 20, y: 16, width: 60, height: 64, label: "Bilateral Clear Lung Fields" };
  }
  if (priority === "High") {
    return { x: 52, y: 46, width: 32, height: 28, label: "Acute Pathology Zone" };
  }
  return { x: 20, y: 16, width: 60, height: 64, label: "Bilateral Clear Lung Fields" };
}

export function normalizeAiProbabilities(item) {
  if (item?.findings && typeof item.findings === "object" && Object.keys(item.findings).length > 0) {
    return item.findings;
  }
  const kf = String(item?.key_findings || item?.keyFindings || "").toLowerCase();
  const rawScore = Number(item?.priority_score ?? item?.priorityScore ?? item?.ai_score ?? 50);
  const score = rawScore > 1 ? rawScore : rawScore * 100;

  const match = kf.match(/(\d+(?:\.\d+)?)%/);
  const topPct = match ? parseFloat(match[1]) : Math.round(Math.min(98.5, Math.max(15, score)));

  if (kf.includes("effusion")) {
    return {
      "Pleural Effusion": topPct,
      "Consolidation / Pneumonia": Math.round(Math.max(6, topPct * 0.35)),
      "Atelectasis": Math.round(Math.max(4, topPct * 0.25)),
      "Pneumothorax": 4,
      "Cardiomegaly": 14,
    };
  }
  if (kf.includes("pneumonia") || kf.includes("consolidation")) {
    return {
      "Consolidation / Pneumonia": topPct,
      "Pleural Effusion": Math.round(Math.max(6, topPct * 0.45)),
      "Atelectasis": Math.round(Math.max(4, topPct * 0.30)),
      "Pulmonary Edema": Math.round(Math.max(4, topPct * 0.20)),
      "Pneumothorax": 3,
    };
  }
  if (kf.includes("pneumothorax")) {
    return {
      "Pneumothorax": topPct,
      "Consolidation / Pneumonia": Math.round(Math.max(4, topPct * 0.25)),
      "Pleural Effusion": Math.round(Math.max(4, topPct * 0.30)),
      "Atelectasis": 8,
    };
  }
  if (kf.includes("edema")) {
    return {
      "Pulmonary Edema": topPct,
      "Cardiomegaly": Math.round(Math.max(15, topPct * 0.60)),
      "Pleural Effusion": Math.round(Math.max(6, topPct * 0.40)),
      "Consolidation / Pneumonia": 12,
    };
  }
  if (kf.includes("cardiomegaly")) {
    return {
      "Cardiomegaly": topPct,
      "Pulmonary Edema": Math.round(Math.max(6, topPct * 0.35)),
      "Pleural Effusion": 8,
      "Consolidation / Pneumonia": 10,
    };
  }
  if (kf.includes("clear") || kf.includes("baseline") || score < 45) {
    return {
      "Clear Lung Fields": 96.5,
      "Consolidation / Pneumonia": Math.min(topPct, 28.8),
      "Pleural Effusion": 7.5,
      "Atelectasis": 9.2,
      "Pneumothorax": 2.1,
    };
  }
  return {
    "Consolidation / Pneumonia": Math.round(score * 0.85),
    "Pleural Effusion": Math.round(score * 0.65),
    "Atelectasis": Math.round(score * 0.35),
    "Pneumothorax": 4,
  };
}

// Local state cache in memory and localStorage for real-time persisted state
let activeStudiesCache = [];
try {
  if (typeof localStorage !== "undefined") {
    const saved = localStorage.getItem("radix_cached_studies");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        activeStudiesCache = parsed;
      }
    }
  }
} catch {}

export const studyService = {
  /**
   * Return synchronous cached studies for instant render scoped to current user
   */
  getCachedStudies() {
    return activeStudiesCache;
  },

  /**
   * Clear synchronous cached studies on logout or account switch
   */
  clearCachedStudies() {
    activeStudiesCache = [];
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem("radix_cached_studies");
      }
    } catch {}
  },

  /**
   * Upload study scan image and metadata to backend
   * Connects to POST /api/v1/studies
   */
  async uploadStudy(formData, onProgress) {
    if (apiClient) {
      try {
        let response;
        const uploadConfig = {
          timeout: 90000,
          onUploadProgress: (progressEvent) => {
            if (typeof onProgress === "function") {
              onProgress(progressEvent);
            }
          },
        };
        if (formData instanceof FormData) {
          response = await apiClient.post("/studies", formData, {
            ...uploadConfig,
            headers: { "Content-Type": "multipart/form-data" },
          });
        } else if (formData?.file instanceof File) {
          const fd = new FormData();
          fd.append("file", formData.file);
          if (formData.studyId) fd.append("study_id", formData.studyId);
          if (formData.patientId) fd.append("patient_id", formData.patientId);
          if (formData.patientName) fd.append("patient_name", formData.patientName);
          if (formData.modality) fd.append("modality", formData.modality);
          if (formData.bodyPart) fd.append("body_part", formData.bodyPart);
          if (formData.arrival_time || formData.arrivalTime) {
            fd.append("arrival_time", formData.arrival_time || formData.arrivalTime);
          }
          response = await apiClient.post("/studies", fd, {
            ...uploadConfig,
            headers: { "Content-Type": "multipart/form-data" },
          });
        } else {
          response = await apiClient.post("/studies/json", formData, uploadConfig);
        }
        const data = response.data;
        const assignedStudyId = data.study_id || data.studyId || (data.study && data.study.studyId);
        if (assignedStudyId) {
          try {
            const newStudy = await this.getStudyById(assignedStudyId);
            if (newStudy) {
              activeStudiesCache = [newStudy, ...activeStudiesCache.filter((s) => s.studyId !== assignedStudyId)];
              return { success: true, study: newStudy, data };
            }
          } catch {}
        }
        return { success: true, study: data.study || data, data };
      } catch (err) {
        console.error("Backend uploadStudy failed:", err);
        throw err;
      }
    }
    throw new Error("API client is unavailable.");
  },

  /**
   * Clear all studies from cache and backend
   */
  async clearAllStudies() {
    activeStudiesCache = [];
    if (apiClient) {
      try {
        await apiClient.delete("/studies/all");
      } catch (err) {
        console.warn("Failed to clear backend studies:", err);
      }
    }
    return { success: true };
  },

  /**
   * Fetch prioritized radiology queue
   * Connects to GET /api/v1/queue with fallback to client-side filtering & sorting
   */
  async getWorklistQueue(params = {}) {
    const {
      search = "",
      priority = "All",
      modality = "All",
      bodyPart = "All",
      timeFilter = "All",
      sortBy = "arrival",
      sortOrder = "asc",
      page = 1,
      limit = 10,
    } = params;

    const queryParams = { ...params };
    const activeUserId = getCurrentUserId();
    if (params.user_id && params.user_id !== "all") {
      queryParams.user_id = params.user_id;
    } else if (activeUserId) {
      queryParams.user_id = activeUserId;
    }

    if (apiClient) {
      try {
        const response = await apiClient.get("/queue", { params: queryParams });
        const data = response.data;
        if (data && (data.items !== undefined || data.studies !== undefined || data.total !== undefined)) {
          const rawList = data.studies || data.items || [];
          if (rawList.length === 0) {
            activeStudiesCache = [];
            return {
              studies: [],
              items: [],
              total: 0,
              totalStudies: 0,
              page,
              limit,
              totalPages: 1,
              counts: {
                all: 0,
                high: 0,
                medium: 0,
                low: 0,
              },
            };
          }
          const studies = rawList.map((item, idx) => {
            const pLevel = item.manual_priority || item.priority_level || "STANDARD";
            const pStr = pLevel.charAt(0).toUpperCase() + pLevel.slice(1).toLowerCase();
            const fullImgUrl = getFullImageUrl(item.image_url || item.image_path);

              const rawScore = item.priority_score ?? item.ai_score ?? 50.0;
              const normScore = rawScore > 1 ? Number((rawScore / 100.0).toFixed(2)) : Number(rawScore.toFixed(2));
              const rawConf = item.ai_confidence ?? 94.0;
              const normConf = rawConf > 1 ? Number((rawConf / 100.0).toFixed(2)) : Number(rawConf.toFixed(2));

              return {
                id: item.id || idx + 1,
                studyId: item.study_id || `ST-${String(idx + 1).padStart(3, "0")}`,
                patientId: item.patient_id || `PX${String(idx + 1).padStart(3, "0")}`,
                patientName: item.patient_name || `Patient ${item.study_id || idx + 1}`,
                age: item.age || 52,
                sex: item.sex || "M",
                modality: item.modality || "X-ray",
                bodyPart: item.body_part || "Chest",
                uploaded_by: item.uploaded_by || item.uploadedBy || activeUserId,
                uploadedBy: item.uploaded_by || item.uploadedBy || activeUserId,
                arrival_time: item.arrival_time || null,
                arrival_time_raw: item.arrival_time || null,
                arrivalTime: formatArrivalTime(item.arrival_time),
                waiting_minutes: item.waiting_minutes != null ? item.waiting_minutes : 30,
                waitingMinutes: item.waiting_minutes != null ? item.waiting_minutes : 30,
                arrivalHoursAgo: item.waiting_minutes ? item.waiting_minutes / 60 : 0.5,
                priority: pStr === "Standard" ? "Low" : pStr,
                priorityLevel: pLevel,
                priorityScore: normScore,
                confidenceScore: normConf,
              status:
                item.status === "REVIEWED"
                  ? "Reviewed"
                  : item.status === "IN_REVIEW"
                  ? "In Review"
                  : "Pending",
              keyFindings:
                item.key_findings ||
                (item.factors && item.factors[0]?.description) ||
                "Diagnostic evaluation pending",
              keyContributingFactors: item.factors
                ? item.factors.map((f) => f.description)
                : ["High urgency clinical pattern"],
              manualOverride: item.manual_priority
                ? {
                    originalPriority: item.priority_level,
                    newPriority: item.manual_priority,
                    reason: item.override_reason,
                  }
                : null,
              tieResolution: item.tie_resolution || null,
              hasCriticalFinding: Boolean(item.has_critical_finding),
              urgencyRank: item.urgency_rank || 1,
              imageUrl: fullImgUrl,
              image_url: fullImgUrl,
              aiProbabilities: normalizeAiProbabilities(item),
              heatmapCoordinates: getAnatomicalCoordinatesForFinding(
                item.key_findings || (item.factors && item.factors[0]?.description),
                pStr
              ),
              views: [
                { id: "frontal", name: "View 1 (Frontal)", type: "PA Frontal" },
                { id: "lateral", name: "View 2 (Lateral)", type: "Lateral Projection" },
              ],
            };
          });
          activeStudiesCache = [...studies];
          try {
            if (typeof localStorage !== "undefined") {
              localStorage.setItem("radix_cached_studies", JSON.stringify(studies));
            }
          } catch {}
          return {
            studies,
            items: studies,
            total: data.total ?? studies.length,
            totalStudies: data.total ?? studies.length,
            page,
            limit,
            totalPages: Math.max(1, Math.ceil((data.total ?? studies.length) / limit)),
            counts: {
              all: data.total ?? studies.length,
              high: data.high_count ?? studies.filter((s) => s.priority === "High").length,
              medium: data.medium_count ?? studies.filter((s) => s.priority === "Medium").length,
              low:
                data.standard_count ??
                studies.filter((s) => s.priority === "Low" || s.priority === "Standard").length,
            },
          };
        }
      } catch (err) {
        console.warn("Backend queue fetch failed, using local fallback:", err);
      }
    }

    let result = [...activeStudiesCache];

      // Priority filter
      if (priority && priority !== "All") {
        result = result.filter((s) => s.priority === priority);
      }

      // Modality filter
      if (modality && modality !== "All") {
        result = result.filter((s) => s.modality === modality);
      }

      // Body part filter
      if (bodyPart && bodyPart !== "All") {
        result = result.filter((s) => s.bodyPart === bodyPart);
      }

      // Arrival time filter
      if (timeFilter && timeFilter !== "All") {
        if (timeFilter === "Today") {
          result = result.filter((s) => s.arrivalHoursAgo <= 8);
        } else if (timeFilter === "Last24h") {
          result = result.filter((s) => s.arrivalHoursAgo <= 24);
        } else if (timeFilter === "Older") {
          result = result.filter((s) => s.arrivalHoursAgo > 24);
        }
      }

      // Search query
      if (search && search.trim() !== "") {
        const q = search.trim().toLowerCase();
        result = result.filter((s) => {
          return (
            s.patientId?.toLowerCase().includes(q) ||
            s.studyId?.toLowerCase().includes(q) ||
            s.patientName?.toLowerCase().includes(q) ||
            s.modality?.toLowerCase().includes(q) ||
            s.bodyPart?.toLowerCase().includes(q) ||
            s.keyFindings?.toLowerCase().includes(q)
          );
        });
      }

      // Sorting using deterministic clinical tie-breaking
      result.sort((a, b) => deterministicCompareStudies(a, b, sortBy, sortOrder));

      // Annotate adjacent tied studies with explainable tie resolution
      for (let i = 0; i < result.length; i++) {
        const curr = result[i];
        if (i > 0 && Math.abs((result[i - 1].priorityScore || 0) - (curr.priorityScore || 0)) < 0.001) {
          curr.tieResolution = computeTieExplanation(result[i - 1], curr);
        } else if (i < result.length - 1 && Math.abs((result[i + 1].priorityScore || 0) - (curr.priorityScore || 0)) < 0.001) {
          curr.tieResolution = computeTieExplanation(curr, result[i + 1]);
        }
      }

      // Pagination
      const total = result.length;
      const startIndex = (page - 1) * limit;
      const paginatedStudies = result.slice(startIndex, startIndex + limit);

      return {
        studies: paginatedStudies,
        total,
        totalStudies: total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        counts: {
          all: activeStudiesCache.length,
          high: activeStudiesCache.filter((s) => s.priority === "High").length,
          medium: activeStudiesCache.filter((s) => s.priority === "Medium").length,
          low: activeStudiesCache.filter((s) => s.priority === "Low").length,
        },
      };
  },

  /**
   * Fetch single study details
   * Connects to GET /api/v1/studies/{study_id}
   */
  async getStudyById(studyId) {
    const activeUserId = getCurrentUserId();
    if (apiClient) {
      try {
        const response = await apiClient.get(`/studies/${studyId}`, {
          params: activeUserId ? { user_id: activeUserId } : {}
        });
        if (response?.data) {
          const item = response.data;
          const rawScore = item.priority_score ?? item.ai_score ?? 50.0;
          const normScore = rawScore > 1 ? Number((rawScore / 100.0).toFixed(2)) : Number(rawScore.toFixed(2));
          const rawConf = item.ai_confidence ?? 95.0;
          const normConf = rawConf > 1 ? Number((rawConf / 100.0).toFixed(2)) : Number(rawConf.toFixed(2));

          const fullImgUrl = getFullImageUrl(item.image_url || item.image_path);

          const pLevel = (
            item.manual_priority ||
            item.priority_level ||
            "STANDARD"
          ).toUpperCase();
          const pStr =
            pLevel === "HIGH" ? "High" : pLevel === "MEDIUM" ? "Medium" : "Low";

          const pName = item.patient_name || `Patient ${item.study_id || item.id}`;
          const pId = item.patient_id || `PX${String(item.id || 1).padStart(3, "0")}`;
          const pAge = item.age !== undefined && item.age !== null ? item.age : 52;
          const pSex = item.sex || "M";
          const pBodyPart = item.body_part || "Chest";
          const pFindings = item.key_findings || (item.factors && item.factors[0]?.description) || "Diagnostic evaluation in progress";

          return {
            id: item.id || 1,
            studyId: item.study_id || `ST-${String(item.id || 1).padStart(3, "0")}`,
            patientId: pId,
            patientName: pName,
            age: pAge,
            sex: pSex,
            modality: item.modality || "X-ray",
            bodyPart: pBodyPart,
            uploaded_by: item.uploaded_by || activeUserId,
            uploadedBy: item.uploaded_by || activeUserId,
            arrivalTime: formatArrivalTime(item.arrival_time),
            priority: pStr,
            priorityLevel: pLevel,
            priorityScore: normScore,
            confidenceScore: normConf,
            status:
              item.status === "REVIEWED"
                ? "Reviewed"
                : item.status === "IN_REVIEW"
                ? "In Review"
                : "Pending",
            imageUrl: fullImgUrl,
            image_url: fullImgUrl,
            keyFindings: pFindings,
            keyContributingFactors:
              item.factors && item.factors.length > 0
                ? item.factors.map((f) => f.description)
                : [pFindings],
            factors:
              item.factors && item.factors.length > 0
                ? item.factors.map((f) => f.description)
                : [pFindings],
            aiProbabilities: normalizeAiProbabilities(item),
            heatmapCoordinates: getAnatomicalCoordinatesForFinding(pFindings, pStr),
            patientDetails: {
              dob: `19${Math.max(40, 95 - pAge)}-05-14`,
              mrn: `MRN-${pId.replace(/\D/g, "") || item.id || 1001}`,
              referringDoctor: "Dr. Alex Vance, MD",
              department: "Emergency Medicine",
              clinicalHistory: item.clinical_notes || "Acute respiratory distress presented for urgent imaging.",
              vitals: "SpO2: 94% | HR: 90 bpm | BP: 128/82 mmHg",
              allergies: "None reported",
            },
            views: [
              { id: "frontal", name: "View 1 (Frontal)", type: "PA Frontal" },
            ],
            manualOverride: item.manual_priority
              ? {
                  originalPriority: item.priority_level,
                  newPriority: item.manual_priority,
                  reason: item.override_reason,
                }
              : null,
          };
        }
      } catch (err) {
        console.warn("Backend getStudyById failed, using cached:", err);
      }
    }
    const parsedId = parseInt(studyId, 10);
    const strId = String(studyId).trim().toLowerCase();
    const found =
      activeStudiesCache.find(
        (s) =>
          s.id === parsedId ||
          String(s.studyId || "").toLowerCase() === strId ||
          String(s.id).toLowerCase() === strId ||
          String(s.patientId || "").toLowerCase() === strId
      ) ||
      (Array.isArray(mockStudies)
        ? mockStudies.find(
            (s) =>
              s.id === parsedId ||
              String(s.studyId || "").toLowerCase() === strId ||
              String(s.id).toLowerCase() === strId ||
              String(s.patientId || "").toLowerCase() === strId
          )
        : null);
    return found || null;
  },

  /**
   * Fetch AI explainability factors
   * Connects to GET /api/v1/studies/{study_id}/factors
   */
  async getStudyFactors(studyId) {
    if (apiClient) {
      try {
        const response = await apiClient.get(`/studies/${studyId}/factors`);
        if (response?.data) return response.data;
      } catch {}
    }
    const study = await this.getStudyById(studyId);
    return {
      studyId: study.studyId,
      priorityScore: study.priorityScore,
      confidenceScore: study.confidenceScore,
      priorityLevel: study.priorityLevel,
      keyContributingFactors: study.keyContributingFactors,
      factors: study.keyContributingFactors,
      aiProbabilities: study.aiProbabilities,
      safetyMessage:
        "This is a triage and prioritization suggestion only. Not a diagnosis. Please review the study in full.",
    };
  },

  /**
   * Mark study reviewed
   * Connects to POST /api/v1/studies/{study_id}/review
   */
  async updateStudyReview(studyId, reviewData = {}) {
    if (apiClient) {
      try {
        const response = await apiClient.post(`/studies/${studyId}/review`, reviewData);
        return response.data;
      } catch {}
    }
    const parsedId = parseInt(studyId, 10);
    activeStudiesCache = activeStudiesCache.map((s) => {
      if (s.id === parsedId || s.studyId === studyId) {
        return {
          ...s,
          status: "Reviewed",
          reviewedAt: new Date().toLocaleTimeString(),
          reviewedBy: "Dr. Alex Vance, MD",
          reviewNotes: reviewData.notes || "Reviewed and approved by attending radiologist.",
        };
      }
      return s;
    });
    return { success: true, studyId, status: "Reviewed" };
  },

  /**
   * Update study priority triage level
   * Connects to POST /api/v1/studies/{study_id}/triage
   */
  async updateStudyPriority(studyId, newPriority) {
    if (apiClient) {
      try {
        const response = await apiClient.post(`/studies/${studyId}/triage`, { priority: newPriority });
        return response.data;
      } catch {}
    }
    const parsedId = parseInt(studyId, 10);
    activeStudiesCache = activeStudiesCache.map((s) => {
      if (s.id === parsedId || s.studyId === studyId) {
        return { ...s, priority: newPriority };
      }
      return s;
    });
    return { success: true, studyId, priority: newPriority };
  },



  /**
   * Update review status (lifecycle progression: PENDING_REVIEW -> IN_REVIEW -> REVIEWED)
   * Connects to PATCH /api/v1/studies/{study_id}/review
   */
  async updateReviewStatus(studyId, status, reviewNotes = "") {
    const activeUser = getCurrentUserObj();
    const activeDoctorName =
      activeUser?.name ||
      activeUser?.full_name ||
      (activeUser?.email ? `Dr. ${activeUser.email.split("@")[0].toUpperCase()}, MD` : "Dr. Alex Vance, MD");
    const activeDoctorId = activeUser?.id != null ? String(activeUser.id) : (activeUser?.email || "dr_alex_vance");

    if (apiClient) {
      try {
        const action = status === "IN_REVIEW" ? "STARTED_REVIEW" : "COMPLETED_REVIEW";
        const response = await apiClient.patch(`/studies/${studyId}/review`, {
          action,
          status,
          reviewNotes,
          notes: reviewNotes,
          reviewer_id: activeDoctorId,
          reviewer_name: activeDoctorName,
        });
        if (response?.data) return response.data;
      } catch (err) {
        console.warn("Backend review update failed, using local simulation:", err);
      }
    }
    const parsedId = parseInt(studyId, 10);
    activeStudiesCache = activeStudiesCache.map((s) => {
      if (s.id === parsedId || s.studyId === studyId) {
        return {
          ...s,
          status,
          reviewedAt: status === "REVIEWED" ? new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : s.reviewedAt,
          reviewedBy: status === "REVIEWED" ? activeDoctorName : s.reviewedBy,
          reviewerId: status === "REVIEWED" ? activeDoctorId : s.reviewerId,
          reviewNotes: reviewNotes || s.reviewNotes,
          history: [
            ...(s.history || []),
            {
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              event:
                status === "IN_REVIEW"
                  ? `Review initiated by ${activeDoctorName}`
                  : `Study marked as REVIEWED and finalized by ${activeDoctorName}`,
            },
          ],
        };
      }
      return s;
    });
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("radix_cached_studies", JSON.stringify(activeStudiesCache));
      }
    } catch {}
    return { success: true, studyId, status };
  },

  /**
   * Manual Priority Override
   * Connects to PATCH /api/v1/studies/{study_id}/priority
   */
  async overrideStudyPriority(studyId, overrideData) {
    const { newPriority, reason, overriddenBy = "Dr. Alex Vance, MD" } = overrideData;
    if (apiClient) {
      try {
        const response = await apiClient.patch(`/studies/${studyId}/priority`, {
          manual_priority: (newPriority || "HIGH").toUpperCase(),
          newPriority,
          reason: reason || "Manual radiologist adjustment",
          reviewer_id: overriddenBy,
          overriddenBy,
        });
        if (response?.data) return response.data;
      } catch (err) {
        console.warn("Backend priority override failed, using local simulation:", err);
      }
    }
    const parsedId = parseInt(studyId, 10);
    const overriddenAt = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    activeStudiesCache = activeStudiesCache.map((s) => {
      if (s.id === parsedId || s.studyId === studyId) {
        return {
          ...s,
          priority: newPriority,
          priorityLevel: newPriority.toUpperCase(),
          manualOverride: {
            originalPriority: s.priority,
            originalScore: s.priorityScore,
            newPriority,
            reason,
            overriddenBy,
            overriddenAt,
          },
          history: [
            ...(s.history || []),
            {
              time: overriddenAt,
              event: `MANUAL PRIORITY OVERRIDE to ${newPriority.toUpperCase()} by ${overriddenBy} (Reason: "${reason}")`,
            },
          ],
        };
      }
      return s;
    });
    return { success: true, studyId, newPriority, reason, overriddenAt };
  },

  /**
   * Batch update studies
   * Connects to POST /api/v1/studies/batch
   */
  async batchUpdateStudies(studyIds, action, payload = {}) {
    if (apiClient) {
      try {
        const response = await apiClient.post("/studies/batch", { studyIds, action, payload });
        return response.data;
      } catch {}
    }
    const idsSet = new Set(studyIds.map(Number));
    if (action === "markReviewed") {
      activeStudiesCache = activeStudiesCache.map((s) => {
        if (idsSet.has(s.id)) {
          return { ...s, status: "REVIEWED", reviewedAt: new Date().toLocaleTimeString() };
        }
        return s;
      });
    }
    return { success: true, updatedCount: studyIds.length };
  },

  /**
   * Fetch archive of reviewed studies from backend /api/v1/reviewed-studies
   */
  async getReviewedStudies(params = {}) {
    const queryParams = { ...params };
    if (apiClient) {
      try {
        const response = await apiClient.get("/reviewed-studies", { params: queryParams });
        if (response?.data) {
          const items = (response.data.items || []).map((item) => {
            const fullImgUrl = getFullImageUrl(item.image_path || item.image_url);

            const pAge = item.age || 52;
            const pFindings = item.ai_findings || "Diagnostic examination sign-off completed.";
            const pLevel = item.priority_level || "STANDARD";
            const pStr = pLevel.charAt(0).toUpperCase() + pLevel.slice(1).toLowerCase();
            const rawScore = item.priority_score ?? 50;
            const normScore = rawScore > 1 ? Number((rawScore / 100.0).toFixed(2)) : Number(rawScore.toFixed(2));
            const rawConf = item.ai_confidence ?? 88;
            const normConf = rawConf > 1 ? Number((rawConf / 100.0).toFixed(2)) : Number(rawConf.toFixed(2));

            return {
              ...item,
              id: item.study_id || item.id,
              studyId: item.study_id,
              patientName: item.patient_name || "Unknown Patient",
              patientId: item.patient_id || item.study_id,
              age: pAge,
              sex: item.sex || "M",
              modality: item.modality || "X-RAY",
              bodyPart: item.body_part || "Chest",
              priority: pStr === "Standard" ? "Low" : pStr,
              priorityLevel: pLevel,
              priorityScore: normScore,
              confidenceScore: normConf,
              aiScore: item.ai_score ?? normScore,
              aiConfidence: normConf,
              aiFindings: pFindings,
              keyFindings: pFindings,
              keyContributingFactors: [pFindings],
              factors: [{ description: pFindings, contribution: 0.9 }],
              status: "Reviewed",
              reviewStatus: item.review_status || "NORMAL",
              reviewerId: item.reviewer_id || "Dr. Sarah Lin, MD",
              reviewNotes: item.review_notes || "Clinical sign-off recorded.",
              turnaroundTimeMins: item.turnaround_time_mins != null ? Number(item.turnaround_time_mins.toFixed(1)) : null,
              arrivalTime: formatArrivalTime(item.arrival_time),
              rawArrivalTime: item.arrival_time,
              reviewedAt: formatArrivalTime(item.reviewed_at),
              rawReviewedAt: item.reviewed_at,
              imageUrl: fullImgUrl,
              image_url: fullImgUrl,
              aiProbabilities: normalizeAiProbabilities(item),
              heatmapCoordinates: getAnatomicalCoordinatesForFinding(pFindings, pStr),
              patientDetails: {
                dob: `19${Math.max(40, 95 - pAge)}-05-14`,
                mrn: `MRN-${String(item.patient_id || "").replace(/\D/g, "") || item.id || 1001}`,
                referringDoctor: item.reviewer_id || "Dr. Sarah Lin, MD",
                department: "Emergency Medicine",
                clinicalHistory: item.clinical_notes || pFindings,
                vitals: "SpO2: 98% | HR: 74 bpm | BP: 120/80 mmHg",
                allergies: "None reported",
              },
              views: [
                { id: "frontal", name: "View 1 (Frontal)", type: "PA Frontal" },
              ],
            };
          });
          return {
            items,
            total: response.data.total || items.length,
            stats: response.data.stats || {
              total_reviewed: items.length,
              critical_count: items.filter((i) => i.priorityLevel === "HIGH" || i.reviewStatus === "CRITICAL").length,
              abnormal_count: items.filter((i) => i.reviewStatus === "ABNORMAL").length,
              normal_count: items.filter((i) => i.reviewStatus === "NORMAL").length,
              avg_turnaround_time_mins: 0.0,
              reviewed_today_count: items.length,
            },
          };
        }
      } catch (err) {
        console.warn("Backend reviewed studies fetch failed, using fallback:", err);
      }
    }
    let reviewed = activeStudiesCache.filter((s) => s.status === "REVIEWED" || s.status === "Reviewed");
    return {
      items: reviewed,
      total: reviewed.length,
      stats: {
        total_reviewed: reviewed.length,
        critical_count: reviewed.filter((i) => i.priority === "High" || i.priorityLevel === "HIGH").length,
        abnormal_count: reviewed.filter((i) => i.priority === "Medium").length,
        normal_count: reviewed.filter((i) => i.priority === "Low" || i.priority === "Standard").length,
        avg_turnaround_time_mins: 0.0,
        reviewed_today_count: reviewed.length,
      },
    };
  },

  /**
   * Reopen a reviewed study and return it to the active worklist queue
   */
  async revertReviewedStudy(studyId) {
    if (apiClient) {
      try {
        const response = await apiClient.post(`/reviewed-studies/${studyId}/revert`);
        return response.data;
      } catch (err) {
        console.warn("Backend revert failed:", err);
      }
    }
    return { success: true, message: `Reverted study ${studyId}` };
  },

  /**
   * Permanently delete a study by ID from both backend and local cache
   */
  async deleteStudy(studyId) {
    let success = false;
    let errorMsg = null;
    const activeUserId = getCurrentUserId();
    if (apiClient) {
      try {
        const response = await apiClient.delete(`/studies/${studyId}`, {
          params: activeUserId ? { user_id: activeUserId } : {},
        });
        success = response.data?.success ?? true;
      } catch (err) {
        console.warn(`Backend delete failed for study ${studyId}:`, err);
        errorMsg = err.response?.data?.detail || err.message;
        return { success: false, error: errorMsg };
      }
    }
    // Update local cache ONLY if deletion succeeded
    activeStudiesCache = activeStudiesCache.filter(
      (s) => s.id !== studyId && s.studyId !== studyId && s.study_id !== studyId
    );
    return { success: true, error: null };
  },

  /**
   * Batch delete multiple studies
   */
  async batchDeleteStudies(studyIds) {
    if (!studyIds || !studyIds.length) return { success: true, deletedCount: 0 };
    const activeUserId = getCurrentUserId();
    if (apiClient) {
      try {
        const response = await apiClient.post(`/studies/batch-delete`, {
          study_ids: studyIds,
          user_id: activeUserId,
        });
        activeStudiesCache = activeStudiesCache.filter(
          (s) => !studyIds.includes(s.id) && !studyIds.includes(s.studyId) && !studyIds.includes(s.study_id)
        );
        return response.data;
      } catch (err) {
        console.warn("Backend batch delete failed:", err);
        const errDetail = err.response?.data?.detail || err.message;
        return { success: false, deletedCount: 0, errors: [errDetail] };
      }
    }
    activeStudiesCache = activeStudiesCache.filter(
      (s) => !studyIds.includes(s.id) && !studyIds.includes(s.studyId) && !studyIds.includes(s.study_id)
    );
    return { success: true, deletedCount: studyIds.length };
  },

  /**
   * Reset all cached studies to empty initial state
   */
  resetStudies() {
    activeStudiesCache = [];
    return activeStudiesCache;
  },
};

export default studyService;
