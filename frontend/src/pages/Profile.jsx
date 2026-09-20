import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Mail,
  Building2,
  Stethoscope,
  ShieldCheck,
  Camera,
  Trash2,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  Save,
  RotateCcw,
  Award,
  Activity,
  FileCheck,
  Clock,
  Sparkles,
} from "lucide-react";
import { authService } from "../services/authService";
import "./Profile.css";

// High-resolution animated clinical avatar presets
const PRESET_AVATARS = [
  {
    id: "avatar-female-1",
    label: "Dr. Sarah Chen, MD (Attending Radiologist)",
    url: "/avatars/radiologist-female-1.svg",
    badge: "Attending",
  },
  {
    id: "avatar-male-1",
    label: "Dr. Alex Vance, MD (Chief Radiologist)",
    url: "/avatars/radiologist-male-1.svg",
    badge: "Chief",
  },
  {
    id: "avatar-female-2",
    label: "Dr. Elena Rostova, MD (Neuro-Radiologist)",
    url: "/avatars/radiologist-female-2.svg",
    badge: "Neuro",
  },
  {
    id: "avatar-male-2",
    label: "Dr. Marcus Thorne, MD (Interventional Radiologist)",
    url: "/avatars/radiologist-male-2.svg",
    badge: "Interventional",
  },
  {
    id: "avatar-female-3",
    label: "Dr. Maya Patel, MD (Thoracic Specialist)",
    url: "/avatars/radiologist-female-3.svg",
    badge: "Thoracic",
  },
  {
    id: "avatar-cyber-ai",
    label: "RADIX AI Triage Assistant",
    url: "/avatars/radiologist-cyber-ai.svg",
    badge: "AI Copilot",
  },
];

export const RADIOLOGIST_ROLES = ["Radiologist"];

export const Profile = () => {
  const fileInputRef = useRef(null);

  // Active user state
  const [currentUser, setCurrentUser] = useState(() => authService.getCurrentUser() || {});

  // Profile Form fields - strictly blank by default so the user fills them
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Radiologist");
  const [department, setDepartment] = useState("");
  const [institution, setInstitution] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState("");

  // Password management
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status & Feedback
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  // Load user data on mount with live SQLite backend hydration
  useEffect(() => {
    const cached = authService.getCurrentUser() || {};
    setCurrentUser(cached);
    setName(cached.name || "");
    setEmail(cached.email || "");
    setRole("Radiologist");
    setDepartment(cached.department || "");
    setInstitution(cached.institution || "");
    setAvatar(cached.avatar || "");
    setLicenseNumber(cached.licenseNumber || "");
    setBio(cached.bio || "");

    // Fetch real data stored in SQLite backend
    if (cached.email) {
      authService.getProfile(cached.email).then((realUser) => {
        if (realUser) {
          setCurrentUser(realUser);
          setName(realUser.name || "");
          setRole("Radiologist");
          setDepartment(realUser.department || "");
          setInstitution(realUser.institution || "");
          setAvatar(realUser.avatar || "");
          setLicenseNumber(realUser.licenseNumber || "");
          setBio(realUser.bio || "");
        }
      }).catch(() => {});
    }
  }, []);

  // Compute initials for avatar fallback
  const getInitials = (nameStr) => {
    if (!nameStr) return "RD";
    const parts = nameStr.replace(/^Dr\.\s*/i, "").trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return nameStr.slice(0, 2).toUpperCase();
  };

  // Helper to downsample and compress uploaded avatar to prevent storage quota issues
  const compressAvatarImage = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_SIZE = 320;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > MAX_SIZE) {
              height = Math.round((height * MAX_SIZE) / width);
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width = Math.round((width * MAX_SIZE) / height);
              height = MAX_SIZE;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.88));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Handle local image file upload with instant compression
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please select a valid image file (JPEG, PNG, WebP).");
      return;
    }

    try {
      const compressedDataUrl = await compressAvatarImage(file);
      setAvatar(compressedDataUrl);
      setIsDirty(true);
      setErrorMessage("");
    } catch (err) {
      setErrorMessage("Failed to process image. Please try another image.");
    }
  };

  // Remove photo and reset to initials
  const handleRemovePhoto = () => {
    setAvatar("");
    setIsDirty(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Select preset avatar
  const handleSelectPresetAvatar = (url) => {
    setAvatar(url);
    setIsDirty(true);
  };

  // Reset form to active user state
  const handleReset = () => {
    const user = authService.getCurrentUser() || {};
    setName(user.name || "");
    setRole("Radiologist");
    setDepartment(user.department || "");
    setInstitution(user.institution || "");
    setAvatar(user.avatar || "");
    setLicenseNumber(user.licenseNumber || "");
    setBio(user.bio || "");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setIsDirty(false);
    setErrorMessage("");
    setSuccessMessage("");
  };

  // Save changes
  const handleSaveProfile = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!name.trim()) {
      setErrorMessage("Please provide your full clinical name.");
      return;
    }

    // Password validation if modifying password
    if (newPassword || confirmPassword) {
      if (!currentPassword) {
        setErrorMessage("Please enter your current password to set a new password.");
        return;
      }
      if (newPassword.length < 8) {
        setErrorMessage("New password must be at least 8 characters long.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setErrorMessage("New password and confirm password do not match.");
        return;
      }
    }

    setIsLoading(true);

    try {
      const payload = {
        email: email.trim(),
        name: name.trim(),
        role: role.trim(),
        department: department.trim(),
        institution: institution.trim(),
        avatar: avatar || "",
        licenseNumber: licenseNumber.trim(),
        bio: bio.trim(),
      };

      if (newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }

      const updated = await authService.updateProfile(payload);
      setCurrentUser(updated);
      setIsLoading(false);
      setIsDirty(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccessMessage("Profile and clinical credentials updated successfully.");

      // Clear success banner after 4 seconds
      setTimeout(() => {
        setSuccessMessage("");
      }, 4000);
    } catch (err) {
      setIsLoading(false);
      setErrorMessage(err.message || "Failed to update profile. Please try again.");
    }
  };

  return (
    <div className="clinical-profile-container">
      <div className="clinical-profile-page">
      {/* Top Banner / Breadcrumb Bar */}
      <div className="profile-top-header">
        <div className="profile-header-title-area">
          <div className="profile-title-pill">
            <ShieldCheck size={14} />
            <span>RADIX CLINICAL ID</span>
          </div>
          <h1>Clinical Profile & Settings</h1>
          <p>
            Manage your radiologist identity, institutional affiliation, profile picture, and PACS security.
          </p>
        </div>

        <div className="profile-header-actions">
          <button
            type="button"
            className="profile-btn-secondary"
            onClick={handleReset}
            disabled={isLoading}
          >
            <RotateCcw size={15} />
            <span>Reset</span>
          </button>
          <button
            type="button"
            className="profile-btn-primary"
            onClick={handleSaveProfile}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="profile-btn-spinner" />
            ) : (
              <Save size={15} />
            )}
            <span>{isLoading ? "Saving Changes..." : "Save Profile"}</span>
          </button>
        </div>
      </div>

      {/* Global Alerts */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="profile-alert profile-alert-success"
          >
            <CheckCircle2 size={18} />
            <span>{successMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="profile-alert profile-alert-danger"
          >
            <AlertTriangle size={18} />
            <span>{errorMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Form & Content Grid */}
      <form onSubmit={handleSaveProfile} className="profile-main-grid">
        {/* =========================================================================
            LEFT COLUMN: AVATAR, VERIFICATION BADGE & QUICK STATS
            ========================================================================= */}
        <div className="profile-left-col">
          {/* Avatar & Photo Card */}
          <div className="profile-card profile-avatar-card">
            <div className="avatar-card-header">
              <h3>Profile Picture</h3>
              <span className="avatar-card-sub">Clinical Workstation Identity</span>
            </div>

            {/* Avatar Preview */}
            <div className="avatar-preview-container">
              <div className="avatar-preview-ring">
                {avatar ? (
                  <img
                    src={avatar}
                    alt={name || "Clinician"}
                    className="avatar-preview-img"
                  />
                ) : (
                  <div className="avatar-preview-fallback">
                    {getInitials(name)}
                  </div>
                )}
                <button
                  type="button"
                  className="avatar-camera-btn"
                  onClick={() => fileInputRef.current?.click()}
                  title="Upload profile picture"
                >
                  <Camera size={16} />
                </button>
              </div>

              {/* Hidden file input */}
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: "none" }}
                accept="image/png, image/jpeg, image/webp"
                onChange={handleFileChange}
              />
            </div>

            {/* Photo Action Buttons */}
            <div className="avatar-action-row">
              <button
                type="button"
                className="avatar-upload-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera size={14} />
                <span>Upload New Photo</span>
              </button>
              {avatar && (
                <button
                  type="button"
                  className="avatar-remove-btn"
                  onClick={handleRemovePhoto}
                  title="Remove picture and use initials"
                >
                  <Trash2 size={14} />
                  <span>Remove</span>
                </button>
              )}
            </div>
            <p className="avatar-hint-text">
              Supports high-res PNG, JPG, or WebP up to 5MB. Photo updates live across RADIX header and audit stamps.
            </p>

            {/* Clinical Preset Avatars Selector */}
            <div className="preset-avatars-section">
              <div className="preset-header-row">
                <span className="preset-label">Choose an Animated Clinical Avatar:</span>
                <span className="animated-sparkle-pill">
                  <Sparkles size={11} className="sparkle-svg" />
                  <span>Live Animated</span>
                </span>
              </div>
              <div className="preset-avatar-chips">
                {PRESET_AVATARS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={`preset-chip ${avatar === preset.url ? "active" : ""}`}
                    onClick={() => handleSelectPresetAvatar(preset.url)}
                    title={`${preset.label} (${preset.badge})`}
                  >
                    <img src={preset.url} alt={preset.label} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Clinician Accreditation Card */}
          <div className="profile-card profile-accreditation-card">
            <div className="accreditation-badge-row">
              <div className="badge-icon-wrap">
                <Award size={20} />
              </div>
              <div className="badge-text-wrap">
                <h4>Board Certified Radiologist</h4>
                <span>ABR Accreditation &middot; Active</span>
              </div>
            </div>

            <div className="accreditation-details-list">
              <div className="accred-row">
                <span className="accred-label">PACS Authorization:</span>
                <span className="accred-val tag-active">Full Tier-1 Access</span>
              </div>
              <div className="accred-row">
                <span className="accred-label">Clinical Role:</span>
                <span className="accred-val tag-active">Radiologist</span>
              </div>
              <div className="accred-row">
                <span className="accred-label">AI Secondary Reviewer:</span>
                <span className="accred-val tag-certified">RADIX Certified</span>
              </div>
            </div>
          </div>

          {/* Clinical Performance Badges */}
          <div className="profile-card profile-stats-card">
            <h3>Clinical Performance</h3>
            <div className="profile-stats-grid">
              <div className="stat-card-pill">
                <Activity size={16} className="stat-icon text-cyan" />
                <div className="stat-val">1,428</div>
                <div className="stat-lbl">Studies Interpreted</div>
              </div>
              <div className="stat-card-pill">
                <Sparkles size={16} className="stat-icon text-blue" />
                <div className="stat-val">98.4%</div>
                <div className="stat-lbl">AI Concordance</div>
              </div>
              <div className="stat-card-pill">
                <Clock size={16} className="stat-icon text-emerald" />
                <div className="stat-val">14.2m</div>
                <div className="stat-lbl">Mean Turnaround</div>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            RIGHT COLUMN: PERSONAL INFO & SECURITY SETTINGS
            ========================================================================= */}
        <div className="profile-right-col">
          {/* Card 1: Clinician Personal & Hospital Information */}
          <div className="profile-card">
            <div className="profile-card-title-row">
              <div className="title-icon-box">
                <Stethoscope size={18} />
              </div>
              <div>
                <h2>Clinician & Department Details</h2>
                <p>Personal identification used on radiological reports and AI audit logs.</p>
              </div>
            </div>

            <div className="profile-form-grid">
              {/* Full Name */}
              <div className="form-group span-2">
                <label>
                  Full Name & Honorific <span className="req">*</span>
                </label>
                <div className="input-with-icon">
                  <User size={16} className="input-icon" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setIsDirty(true);
                    }}
                    placeholder="e.g. Dr. Arthur Vance, MD"
                    required
                  />
                </div>
                <span className="input-help">
                  Include medical honorifics (e.g. Dr., MD, FRCR, DO) as you wish them to appear on clinical signatures.
                </span>
              </div>

              {/* Email Address (Read-only / Protected) */}
              <div className="form-group span-2">
                <label>
                  Clinical Email Address <span className="badge-locked">Institutional ID</span>
                </label>
                <div className="input-with-icon input-readonly has-verified-pill">
                  <Mail size={16} className="input-icon" />
                  <input
                    type="email"
                    value={email}
                    readOnly
                    disabled
                    title="Institutional clinical email address is tied to your hospital directory."
                  />
                  <div className="verified-pill">
                    <CheckCircle2 size={13} />
                    <span>Verified</span>
                  </div>
                </div>
                <span className="input-help">
                  Your clinical email is tied to hospital single sign-on and DICOM audit logs. Contact your PACS admin to transfer email.
                </span>
              </div>

              {/* Primary Clinical Role (Radiologist only) */}
              <div className="form-group">
                <label>Clinical Role</label>
                <div className="input-with-icon input-readonly">
                  <ShieldCheck size={16} className="input-icon text-primary" />
                  <input
                    type="text"
                    value="Radiologist"
                    readOnly
                    disabled
                    title="RADIX workstation platform is strictly restricted to verified Radiologists."
                    style={{ cursor: "not-allowed", fontWeight: 600, color: "#0f172a" }}
                  />
                  <div className="verified-pill">
                    <CheckCircle2 size={13} />
                    <span>Verified</span>
                  </div>
                </div>
                <span className="input-help">RADIX workstation platform is strictly restricted to Radiologists.</span>
              </div>

              {/* Medical License / NPI */}
              <div className="form-group">
                <label>Medical License / NPI Number</label>
                <div className="input-with-icon">
                  <FileCheck size={16} className="input-icon" />
                  <input
                    type="text"
                    value={licenseNumber}
                    onChange={(e) => {
                      setLicenseNumber(e.target.value);
                      setIsDirty(true);
                    }}
                    placeholder="Enter your medical license or NPI number"
                  />
                </div>
              </div>

              {/* Department */}
              <div className="form-group">
                <label>Department / Division</label>
                <div className="input-with-icon">
                  <Building2 size={16} className="input-icon" />
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => {
                      setDepartment(e.target.value);
                      setIsDirty(true);
                    }}
                    placeholder="Enter department or division (e.g. Thoracic Imaging)"
                  />
                </div>
              </div>

              {/* Institution */}
              <div className="form-group">
                <label>Healthcare Institution / Medical Center</label>
                <div className="input-with-icon">
                  <Building2 size={16} className="input-icon" />
                  <input
                    type="text"
                    value={institution}
                    onChange={(e) => {
                      setInstitution(e.target.value);
                      setIsDirty(true);
                    }}
                    placeholder="Enter healthcare institution or hospital name"
                  />
                </div>
              </div>

              {/* Bio & Subspecialty Focus */}
              <div className="form-group span-2">
                <label>Clinical Subspecialties & Clinical Notes</label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => {
                    setBio(e.target.value);
                    setIsDirty(true);
                  }}
                  placeholder="Describe your clinical focus, subspecialties, and background..."
                />
              </div>
            </div>
          </div>

          {/* Card 2: Security & Password Update */}
          <div className="profile-card">
            <div className="profile-card-title-row">
              <div className="title-icon-box">
                <Lock size={18} />
              </div>
              <div>
                <h2>Authentication & Security</h2>
                <p>Update your workstation password. Leave blank if you don't wish to change it.</p>
              </div>
            </div>

            <div className="profile-form-grid">
              {/* Current Password */}
              <div className="form-group span-2">
                <label>Current Password</label>
                <div className="input-with-icon has-trailing-btn">
                  <Lock size={16} className="input-icon" />
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter your current password"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="password-reveal-btn"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    tabIndex={-1}
                  >
                    {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div className="form-group">
                <label>New Password</label>
                <div className="input-with-icon has-trailing-btn">
                  <Lock size={16} className="input-icon" />
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="password-reveal-btn"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    tabIndex={-1}
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div className="form-group">
                <label>Confirm New Password</label>
                <div className="input-with-icon has-trailing-btn">
                  <Lock size={16} className="input-icon" />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="password-reveal-btn"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {newPassword && (
                <div className="password-requirements-pill span-2">
                  <div className={`req-item ${newPassword.length >= 8 ? "valid" : ""}`}>
                    <CheckCircle2 size={13} />
                    <span>8+ characters</span>
                  </div>
                  <div className={`req-item ${newPassword === confirmPassword && confirmPassword ? "valid" : ""}`}>
                    <CheckCircle2 size={13} />
                    <span>Passwords match</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Footer */}
          <div className="profile-footer-actions">
            <button
              type="button"
              className="profile-btn-secondary"
              onClick={handleReset}
              disabled={isLoading}
            >
              <RotateCcw size={15} />
              <span>Discard Changes</span>
            </button>
            <button
              type="submit"
              className="profile-btn-primary"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="profile-btn-spinner" />
              ) : (
                <Save size={15} />
              )}
              <span>{isLoading ? "Saving..." : "Save Changes"}</span>
            </button>
          </div>
        </div>
      </form>
      </div>
    </div>
  );
};

export default Profile;
