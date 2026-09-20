/**
 * RADIX Unified API Client Gateway
 */
import axios from "axios";
import { authService } from "./authService.js";
import { studyService } from "./studyService.js";
import { analyticsService } from "./analyticsService.js";

export const API_BASE_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
  (typeof window !== "undefined" &&
  (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1" || window.location.port === "5173")
    ? "/api/v1"
    : "http://127.0.0.1:8000/api/v1");

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 4000,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("radix_auth_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export { authService, studyService, analyticsService };
export default apiClient;
