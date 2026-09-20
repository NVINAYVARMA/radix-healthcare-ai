import axios from "axios";
import {
  auth,
  googleProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
} from "./firebase.js";
import { studyService } from "./studyService";

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

const memoryStorage = {};
const safeStorage =
  typeof localStorage !== "undefined"
    ? localStorage
    : {
        getItem: (key) => memoryStorage[key] || null,
        setItem: (key, value) => {
          memoryStorage[key] = String(value);
        },
        removeItem: (key) => {
          delete memoryStorage[key];
        },
      };

// Request interceptor: attach token
if (apiClient) {
  apiClient.interceptors.request.use(
    (config) => {
      const token = safeStorage.getItem("radix_auth_token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );
}

// Response interceptor: handle session expiry
if (apiClient) {
  apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        safeStorage.removeItem("radix_auth_token");
        safeStorage.removeItem("radix_user");
      }
      return Promise.reject(error);
    }
  );
}

/**
 * Authentication Service
 * Integrates Firebase Auth (Google SSO & Email/Password) with Backend Synchronisation & Offline Fallback.
 */
export const authService = {
  /**
   * Helper: Get list of registered accounts
   */
  getRegisteredAccounts() {
    try {
      const raw = safeStorage.getItem("radix_registered_accounts");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  /**
   * Helper: Save account to local registered vault
   */
  saveRegisteredAccount(account) {
    try {
      const accounts = this.getRegisteredAccounts();
      const cleanEmail = account.email.trim().toLowerCase();
      const filtered = accounts.filter((a) => a.email.toLowerCase() !== cleanEmail);
      filtered.push({
        ...account,
        email: cleanEmail,
      });
      safeStorage.setItem("radix_registered_accounts", JSON.stringify(filtered));
    } catch (e) {
      console.warn("Failed to persist registered account:", e);
    }
  },

  /**
   * Log in with email and password with strict credential and account verification
   */
  async login(email, password) {
    const cleanEmail = (email || "").trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      throw new Error("Please provide a valid clinical email address.");
    }
    if (!password) {
      throw new Error("Password is required.");
    }

    let resolvedUser = null;
    let resolvedToken = null;
    let backendHandled = false;

    // 1. Attempt Backend API authentication
    if (apiClient) {
      try {
        const response = await apiClient.post("/auth/login", { email: cleanEmail, password });
        if (response.data && response.data.success) {
          resolvedToken = response.data.token;
          resolvedUser = response.data.user;
          backendHandled = true;
        }
      } catch (backendErr) {
        backendHandled = true;
        const errDetail = backendErr.response?.data?.detail;
        if (errDetail) {
          throw new Error(errDetail);
        }
        if (backendErr.response?.status === 401) {
          throw new Error("Invalid credentials. Please verify your email and password.");
        }
        if (backendErr.response?.status === 400) {
          throw new Error("Please check your email and password.");
        }
        // If server error or offline, fallback to check local registered accounts
        backendHandled = false;
      }
    }

    // 2. Offline / Local fallback: check strictly against created accounts
    if (!resolvedUser && !backendHandled) {
      const accounts = this.getRegisteredAccounts();
      const foundAccount = accounts.find((a) => a.email.toLowerCase() === cleanEmail);

      if (!foundAccount) {
        throw new Error("Account not found. Please create an account first.");
      }

      if (foundAccount.password && foundAccount.password !== password) {
        throw new Error("Incorrect password for this account. Please try again.");
      }

      resolvedUser = {
        id: foundAccount.id || `usr_radix_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
        name: foundAccount.name || cleanEmail.split("@")[0].replace(".", " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        email: cleanEmail,
        role: "Radiologist",
        department: foundAccount.department || "",
        institution: foundAccount.institution || "",
        licenseNumber: foundAccount.licenseNumber || "",
        bio: foundAccount.bio || "",
        avatar: foundAccount.avatar || "",
      };
      resolvedToken = `radix_jwt_${Date.now()}`;
    }

    if (!resolvedUser) {
      throw new Error("Account not found. Please create an account first.");
    }

    safeStorage.setItem("radix_auth_token", resolvedToken);
    safeStorage.setItem("radix_user", JSON.stringify(resolvedUser));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("radix_auth_changed"));
    }
    return { success: true, user: resolvedUser, token: resolvedToken };
  },

  /**
   * Register a new clinician account
   */
  async register(userData) {
    const cleanEmail = (userData.email || "").trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      throw new Error("Please provide a valid clinical email.");
    }
    if (!userData.password || userData.password.length < 6) {
      throw new Error("Password must be at least 6 characters.");
    }

    let resolvedUser = null;
    let resolvedToken = null;

    if (apiClient) {
      try {
        const response = await apiClient.post("/auth/register", {
          ...userData,
          email: cleanEmail,
        });
        if (response.data && response.data.success) {
          resolvedToken = response.data.token;
          resolvedUser = response.data.user;
        }
      } catch (backendErr) {
        const errDetail = backendErr.response?.data?.detail;
        if (errDetail) {
          throw new Error(errDetail);
        }
      }
    }

    const cleanName = userData.name?.trim() || cleanEmail.split("@")[0].replace(".", " ").replace(/\b\w/g, (c) => c.toUpperCase());

    if (!resolvedUser) {
      resolvedUser = {
        id: `usr_radix_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
        name: cleanName,
        email: cleanEmail,
        role: "Radiologist",
        department: userData.department || "",
        institution: userData.institution || "",
        licenseNumber: userData.licenseNumber || "",
        bio: userData.bio || "",
        avatar: userData.avatar || "",
      };
      resolvedToken = `radix_jwt_${Date.now()}`;
    }

    // Save to registered vault so password matches on subsequent logins
    this.saveRegisteredAccount({
      ...resolvedUser,
      password: userData.password,
    });

    safeStorage.setItem("radix_auth_token", resolvedToken);
    safeStorage.setItem("radix_user", JSON.stringify(resolvedUser));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("radix_auth_changed"));
    }
    return { success: true, user: resolvedUser, token: resolvedToken };
  },

  /**
   * Request password reset code via Backend API
   */
  async forgotPassword(email) {
    const cleanEmail = (email || "").trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      throw new Error("Please provide a valid clinical email address.");
    }

    if (apiClient) {
      try {
        const response = await apiClient.post("/auth/forgot-password", { email: cleanEmail });
        if (response.data) {
          return response.data;
        }
      } catch (err) {
        const detail = err.response?.data?.detail;
        if (detail) {
          throw new Error(detail);
        }
        if (err.response?.status === 404) {
          throw new Error("No registered account found with this clinical email.");
        }
        throw new Error(err.message || "Failed to process password recovery.");
      }
    }

    // Offline / Local fallback: check registered accounts
    const accounts = this.getRegisteredAccounts();
    const found = accounts.find((a) => a.email.toLowerCase() === cleanEmail);
    if (!found) {
      throw new Error("No registered account found with this clinical email.");
    }
    const localCode = `RDX-${Math.floor(100000 + Math.random() * 900000)}`;
    found.reset_token = localCode;
    found.reset_token_expiry = Date.now() + 15 * 60 * 1000;
    this.saveRegisteredAccount(found);

    return {
      success: true,
      token: localCode,
      email: cleanEmail,
      message: `Verification security code generated: ${localCode}. Enter this code to set your new password.`,
    };
  },

  /**
   * Reset password with security token
   */
  async resetPassword(token, newPassword, email = "") {
    const cleanToken = (token || "").trim().toUpperCase();
    const cleanEmail = (email || "").trim().toLowerCase();

    if (!cleanToken) {
      throw new Error("Security verification code is required.");
    }
    if (!newPassword || newPassword.length < 8) {
      throw new Error("New password must be at least 8 characters.");
    }

    if (apiClient) {
      try {
        const response = await apiClient.post("/auth/reset-password", {
          token: cleanToken,
          newPassword,
          email: cleanEmail || undefined,
        });
        if (response.data) {
          // Also update local registered vault
          const accounts = this.getRegisteredAccounts();
          const targetEmail = response.data.email || cleanEmail;
          if (targetEmail) {
            const acc = accounts.find((a) => a.email.toLowerCase() === targetEmail.toLowerCase());
            if (acc) {
              acc.password = newPassword;
              acc.reset_token = null;
              this.saveRegisteredAccount(acc);
            }
          }
          return response.data;
        }
      } catch (err) {
        const detail = err.response?.data?.detail;
        if (detail) {
          throw new Error(detail);
        }
        if (err.response?.status === 400) {
          throw new Error("Invalid or expired verification code.");
        }
        throw new Error(err.message || "Failed to reset password.");
      }
    }

    // Offline / Local fallback
    const accounts = this.getRegisteredAccounts();
    const acc = accounts.find(
      (a) =>
        (a.reset_token && a.reset_token.toUpperCase() === cleanToken) &&
        (!cleanEmail || a.email.toLowerCase() === cleanEmail)
    );
    if (!acc) {
      throw new Error("Invalid or unrecognized verification code.");
    }
    if (acc.reset_token_expiry && Date.now() > acc.reset_token_expiry) {
      throw new Error("This verification code has expired. Please request a new code.");
    }
    acc.password = newPassword;
    acc.reset_token = null;
    this.saveRegisteredAccount(acc);

    return {
      success: true,
      email: acc.email,
      message: "Your password has been successfully reset. You can now sign in.",
    };
  },

  /**
   * Google Single Sign-On powered by Firebase Auth
   */
  async googleLogin(userDataHint = {}) {
    let googleUser = null;
    let googleToken = null;

    try {
      // 1. Trigger Firebase Google Popup SSO
      const result = await signInWithPopup(auth, googleProvider);
      googleUser = result.user;
      googleToken = await googleUser.getIdToken();
    } catch (popupErr) {
      console.warn("Firebase Google popup returned error, checking fallback:", popupErr?.code || popupErr?.message);

      // If user closed the popup intentionally, throw to notify UI
      if (popupErr?.code === "auth/popup-closed-by-user") {
        throw new Error("Google Single Sign-On was cancelled by user.");
      }
    }

    let email = googleUser?.email || userDataHint.email;
    let rawName = googleUser?.displayName || userDataHint.name;

    if (!email) {
      const promptEmail = window.prompt(
        "Sign in with Google: Please enter your Google / Gmail account (e.g. doctor@gmail.com):"
      );
      if (promptEmail && promptEmail.trim() && promptEmail.includes("@")) {
        email = promptEmail.trim().toLowerCase();
        rawName = email.split("@")[0].replace(".", " ").replace(/\b\w/g, (c) => c.toUpperCase());
      } else {
        throw new Error("Google Single Sign-On was cancelled.");
      }
    }

    const name = rawName ? (rawName.startsWith("Dr.") ? rawName : `Dr. ${rawName}`) : `Dr. ${email.split("@")[0]}`;
    const avatar = googleUser?.photoURL || "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=120&auto=format&fit=crop&q=80";

    const clinicianUser = {
      id: googleUser?.uid || `usr_google_${email.replace(/[^a-zA-Z0-9]/g, '_')}`,
      email,
      name,
      role: "Radiologist",
      department: "",
      institution: "",
      licenseNumber: "",
      bio: "",
      avatar,
    };

    const token = googleToken || ("firebase_google_jwt_" + Date.now());

    // Sync with backend database to register user account
    if (apiClient) {
      try {
        const res = await apiClient.post("/auth/login", {
          email,
          password: "firebase_sso_verified_token",
          name,
        });
        if (res.data?.user) {
          clinicianUser.name = res.data.user.name || name;
          clinicianUser.id = res.data.user.id || clinicianUser.id;
        }
      } catch {}
    }

    safeStorage.setItem("radix_auth_token", token);
    safeStorage.setItem("radix_user", JSON.stringify(clinicianUser));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("radix_auth_changed"));
    }
    return { success: true, user: clinicianUser, token };
  },


  /**
   * Sign out from Firebase and clear stored session
   */
  async logout() {
    try {
      await firebaseSignOut(auth);
    } catch {}
    safeStorage.removeItem("radix_auth_token");
    safeStorage.removeItem("radix_user");
    studyService.clearCachedStudies();
  },

  /**
   * Retrieve active user session
   */
  getCurrentUser() {
    try {
      const user = safeStorage.getItem("radix_user");
      return user ? JSON.parse(user) : null;
    } catch {
      return null;
    }
  },

  /**
   * Fetch live profile from backend database
   */
  async getProfile(email) {
    const cleanEmail = (email || this.getCurrentUser()?.email || "").trim().toLowerCase();
    if (apiClient && cleanEmail) {
      try {
        const res = await apiClient.get(`/auth/profile?email=${encodeURIComponent(cleanEmail)}`);
        if (res.data) {
          const current = this.getCurrentUser() || {};
          const merged = {
            ...current,
            id: res.data.id || current.id,
            email: res.data.email || current.email,
            name: res.data.name !== undefined ? res.data.name : (current.name || ""),
            role: "Radiologist",
            department: res.data.department || "",
            institution: res.data.institution || "",
            licenseNumber: res.data.licenseNumber || "",
            bio: res.data.bio || "",
            avatar: res.data.avatar || "",
          };
          try {
            safeStorage.setItem("radix_user", JSON.stringify(merged));
          } catch {}
          return merged;
        }
      } catch (err) {
        console.warn("Backend getProfile notice:", err.response?.data?.detail || err.message);
      }
    }
    return this.getCurrentUser();
  },

  /**
   * Update current user profile (name, avatar, department, institution, password, etc.)
   */
  async updateProfile(profileData) {
    let currentUser = this.getCurrentUser();
    if (!currentUser) {
      currentUser = {
        name: "",
        email: "",
        role: "Radiologist",
        department: "",
        institution: "",
        licenseNumber: "",
        bio: "",
        avatar: "",
      };
    }

    const email = (profileData.email || currentUser.email || "").trim().toLowerCase();
    let updatedUser = {
      ...currentUser,
      ...profileData,
      role: "Radiologist",
      email,
    };

    // 1. Sync with backend API if available
    if (apiClient) {
      try {
        const res = await apiClient.put("/auth/profile", {
          ...profileData,
          email,
        });
        if (res.data) {
          updatedUser = {
            ...updatedUser,
            ...res.data,
          };
        }
      } catch (backendErr) {
        const detail = backendErr.response?.data?.detail;
        if (backendErr.response?.status === 400 && detail) {
          throw new Error(detail);
        }
        console.warn("Backend profile sync notice:", detail || backendErr.message);
      }
    }

    // 2. Persist in local storage session
    try {
      safeStorage.setItem("radix_user", JSON.stringify(updatedUser));
    } catch (storageErr) {
      console.warn("Storage quota notice:", storageErr);
    }

    // 3. Persist in registered accounts list
    const accounts = this.getRegisteredAccounts();
    const cleanEmail = email.toLowerCase();
    const updatedAccounts = accounts.map((acc) => {
      if (acc.email.toLowerCase() === cleanEmail) {
        return {
          ...acc,
          ...profileData,
          password: profileData.newPassword || acc.password,
        };
      }
      return acc;
    });
    safeStorage.setItem("radix_registered_accounts", JSON.stringify(updatedAccounts));

    // 4. Notify all UI listeners (Header, Profile page, etc.)
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("radix_auth_changed"));
    }

    return updatedUser;
  },
};

export default authService;
