import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Zap,
  BarChart2,
  ShieldCheck,
  Users,
  Lock,
  Mail,
  User,
  ArrowRight,
  FileText,
  CheckCircle,
  KeyRound,
  ArrowLeft,
  Briefcase,
  AlertTriangle,
  Eye,
  EyeOff,
} from "lucide-react";
import { RadixDeltaA } from "../components/RadixLogo";
import { authService } from "../services/authService";
import "./Login.css";

const heroFeatureVariants = {
  hidden: { opacity: 0, x: -16 },
  visible: (i) => ({
    opacity: 1,
    x: 0,
    transition: { delay: 0.12 + i * 0.08, duration: 0.35, ease: "easeOut" },
  }),
};

const formSwitchVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: "easeOut" } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.16, ease: "easeIn" } },
};

export const RADIOLOGIST_ROLES = ["Radiologist"];



/* =========================
   LEFT SIDE BRAND DATA
========================= */
const features = [
  {
    icon: <Zap size={18} strokeWidth={2.2} />,
    title: "Intelligent Prioritization",
    text: "Detects time-sensitive cases early",
  },
  {
    icon: <BarChart2 size={18} strokeWidth={2.2} />,
    title: "Improved Efficiency",
    text: "Reduce backlog, optimize workflow",
  },
  {
    icon: <ShieldCheck size={18} strokeWidth={2.2} />,
    title: "Explainable Decisions",
    text: "See why a study is prioritized",
  },
  {
    icon: <Users size={18} strokeWidth={2.2} />,
    title: "Better Patient Outcomes",
    text: "Faster insights, more equitable care",
  },
];

const getModeFromPath = (pathname) => {
  if (pathname === "/register" || pathname === "/signup") return "register";
  if (pathname === "/forgot-password") return "forgot";
  if (pathname === "/reset-password") return "reset";
  return "login";
};

export const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const routeMode = getModeFromPath(location.pathname);
  const [internalMode, setInternalMode] = useState(null);
  const mode = internalMode || routeMode;

  const setMode = (newMode, preserveMessage = false) => {
    setInternalMode(newMode);
    setGlobalError("");
    if (!preserveMessage) {
      setSuccessMessage("");
    }
    setErrors({});
  };

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("Radiologist");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [resetToken, setResetToken] = useState("");
  const [generatedToken, setGeneratedToken] = useState("");

  // Validation & feedback states
  const [errors, setErrors] = useState({});
  const [globalError, setGlobalError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    const activeUser = authService.getCurrentUser();
    if (activeUser) {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const isValidEmail = (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);

  const getPasswordStrength = (pass) => {
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    return score;
  };

  const passwordStrength = getPasswordStrength(password);

  // 1. Handle Login
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setGlobalError("");
    const newErrors = {};

    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!isValidEmail(email)) {
      newErrors.email = "Please enter a valid clinical email";
    }

    if (!password) {
      newErrors.password = "Password is required";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setIsLoading(true);

    try {
      await authService.login(email, password);
      setIsLoading(false);
      navigate("/dashboard");
    } catch (err) {
      setIsLoading(false);
      setGlobalError(err.message || "Invalid clinical credentials. Please try again.");
    }
  };

  // 2. Handle Register
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setGlobalError("");
    const newErrors = {};

    if (!name.trim()) newErrors.name = "Full name is required";
    if (!email.trim() || !isValidEmail(email)) {
      newErrors.email = "Valid clinical email is required";
    }
    if (password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    }
    if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }
    if (!agreeTerms) {
      newErrors.terms = "You must agree to the clinical terms";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setIsLoading(true);

    try {
      await authService.register({ name, email, role, password });
      setIsLoading(false);
      navigate("/dashboard");
    } catch (err) {
      setIsLoading(false);
      setGlobalError(err.message || "Failed to create account. Try a different email.");
    }
  };

  // 3. Handle Forgot Password
  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setGlobalError("");
    setSuccessMessage("");

    if (!email.trim() || !isValidEmail(email)) {
      setErrors({ email: "Please provide a valid clinical email" });
      return;
    }

    setErrors({});
    setIsLoading(true);

    try {
      const res = await authService.forgotPassword(email);
      setIsLoading(false);
      if (res.token) {
        setGeneratedToken(res.token);
        setResetToken(res.token);
      }
      setSuccessMessage(res.message || `Verification security code generated for ${email}`);
      setCountdown(60);
    } catch (err) {
      setIsLoading(false);
      setGlobalError(err.message || "Unable to send reset instructions.");
    }
  };

  // 4. Handle Reset Password
  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setGlobalError("");
    setSuccessMessage("");
    const newErrors = {};

    if (!email.trim() || !isValidEmail(email)) {
      newErrors.email = "Valid clinical email is required";
    }
    if (!resetToken.trim()) {
      newErrors.token = "Verification security code is required";
    }
    if (password.length < 8) {
      newErrors.password = "New password must be at least 8 characters";
    }
    if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setIsLoading(true);

    try {
      const res = await authService.resetPassword(resetToken, password, email);
      setIsLoading(false);
      setSuccessMessage(res.message || "Password updated successfully! Please enter your new password to sign in.");
      setPassword("");
      setConfirmPassword("");
      setGeneratedToken("");
      setResetToken("");
      setTimeout(() => {
        setMode("login", true);
      }, 1200);
    } catch (err) {
      setIsLoading(false);
      setGlobalError(err.message || "Invalid or expired verification token.");
    }
  };



  return (
    <div className="radix-login-viewport">
      {/* ======================================================================
          LEFT PANEL: DARK RADIOLOGY WORKSTATION HERO
          ====================================================================== */}
      <section className="login-hero-left">
        <div className="hero-left-overlay"></div>

        <div className="hero-left-content">
          {/* Top Accreditation Pill */}
          <div className="hero-accreditation-pill">
            <ShieldCheck size={14} className="text-cyan-accent" />
            <span>FDA 510(k) Cleared &middot; CE Marked Class IIa &middot; HIPAA Verified</span>
          </div>

          {/* Top Brand Block */}
          <div className="hero-brand-block">
            <div className="hero-logo-row">
              <span className="logo-letter">R</span>
              <RadixDeltaA size={28} color="#00a3ff" strokeWidth={2.8} />
              <span className="logo-letter">DIX</span>
              <span className="trademark-tag">&reg;</span>
            </div>
            <div className="hero-tagline">DIAGNOSTIC IMAGING INTELLIGENCE FOR BETTER CARE</div>
            <div className="hero-cyan-bar"></div>
            <div className="hero-submotto">IMAGES &nbsp;&bull;&nbsp; INSIGHTS &nbsp;&bull;&nbsp; IMPACT</div>
          </div>

          {/* Center 4 Feature Items */}
          <div className="hero-features-list">
            {features.map((item, idx) => (
              <motion.div
                key={idx}
                custom={idx}
                variants={heroFeatureVariants}
                initial="hidden"
                animate="visible"
                whileHover={{ x: 5, transition: { duration: 0.15 } }}
                className="hero-feature-item"
              >
                <div className="feature-circle-icon">{item.icon}</div>
                <div className="feature-text-block">
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Live Clinical Performance Stats Banner */}
          <div className="hero-stats-banner">
            <div className="hero-stat-col">
              <strong>0.85s</strong>
              <span>STAT Triage</span>
            </div>
            <div className="hero-stat-divider"></div>
            <div className="hero-stat-col">
              <strong>99.4%</strong>
              <span>Concordance</span>
            </div>
            <div className="hero-stat-divider"></div>
            <div className="hero-stat-col">
              <strong>TLS 1.3</strong>
              <span>DICOM Encryption</span>
            </div>
          </div>

          {/* Bottom Kicker */}
          <div className="hero-footer-block">
            <div className="hero-cyan-bar"></div>
            <div className="hero-footer-text">FOR A HEALTHIER TOMORROW &middot; RADIOLOGY OS</div>
          </div>
        </div>
      </section>

      {/* ======================================================================
          RIGHT PANEL: CLEAN HOSPITAL SaaS AUTH SUITE
          ====================================================================== */}
      <section className="login-form-right">
        {/* Faint Concentric Circular Rings in Top-Right Corner */}
        <svg
          className="right-contour-lines"
          viewBox="0 0 400 400"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <circle cx="400" cy="0" r="140" stroke="#e2e8f0" strokeWidth="1.2" opacity="0.75" />
          <circle cx="400" cy="0" r="220" stroke="#e2e8f0" strokeWidth="1.2" opacity="0.6" />
          <circle cx="400" cy="0" r="300" stroke="#e2e8f0" strokeWidth="1.2" opacity="0.45" />
          <circle cx="400" cy="0" r="380" stroke="#e2e8f0" strokeWidth="1.2" opacity="0.3" />
        </svg>

        <div className="login-form-inner-wrapper">
          {/* Header Brand Above Card */}
          <motion.div
            className="card-brand-header"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <span className="welcome-to-kicker">Hospital Diagnostic Portal</span>
            <div className="brand-logo-row">
              <span className="brand-title-letter">R</span>
              <RadixDeltaA size={28} color="#0088cc" strokeWidth={2.8} />
              <span className="brand-title-letter">DIX</span>
            </div>
            <span className="brand-sub-tagline">AI-POWERED CLINICAL TRIAGE SUITE</span>
          </motion.div>

          {/* Elevated Auth Card */}
          <motion.div
            className="auth-main-card"
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            {/* Top Card Tabs (Sign In / Create Account) */}
            {(mode === "login" || mode === "register") && (
              <div className="card-tab-nav">
                <button
                  type="button"
                  className={`card-tab-btn ${mode === "login" ? "active" : ""}`}
                  onClick={() => setMode("login")}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  className={`card-tab-btn ${mode === "register" ? "active" : ""}`}
                  onClick={() => setMode("register")}
                >
                  Create Account
                </button>
              </div>
            )}

            <div className="card-content-area">
              {/* Alert Feedback Banners */}
              <AnimatePresence>
                {globalError && (
                  <motion.div
                    key="global-error"
                    initial={{ opacity: 0, y: -8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.98 }}
                    transition={{ duration: 0.2 }}
                    className="card-alert-banner error"
                  >
                    <AlertTriangle size={15} />
                    <span>{globalError}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {successMessage && (
                  <motion.div
                    key="success-message"
                    initial={{ opacity: 0, y: -8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.98 }}
                    transition={{ duration: 0.2 }}
                    className="card-alert-banner success"
                  >
                    <CheckCircle size={15} />
                    <span>{successMessage}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Animated Form Modes Transition Container */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={mode}
                  variants={formSwitchVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >

              {/* =========================================
                  TAB 1: SIGN IN MODE
                  ========================================= */}
              {mode === "login" && (
                <>
                  <div className="card-heading-block">
                    <div className="card-brand-pill">
                      <span>RADIX</span> WORKSTATION
                    </div>
                    <h2>Welcome Back</h2>
                    <p>Sign in to continue your RADIX journey</p>
                  </div>

                  <form onSubmit={handleLoginSubmit} className="card-auth-form">
                    {/* Email Field */}
                    <div className="card-form-group">
                      <label>Email address</label>
                      <div className={`card-input-box ${errors.email ? "has-error" : ""}`}>
                        <Mail size={16} className="card-input-icon" />
                        <input
                          type="email"
                          placeholder="name@hospital.org"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </div>
                      {errors.email && <span className="field-error-text">{errors.email}</span>}
                    </div>

                    {/* Password Field */}
                    <div className="card-form-group">
                      <label>Password</label>
                      <div className={`card-input-box ${errors.password ? "has-error" : ""}`}>
                        <Lock size={16} className="card-input-icon" />
                        <input
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter your password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                        />
                        <button
                          type="button"
                          className="password-toggle-btn"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label="Toggle password visibility"
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {errors.password && <span className="field-error-text">{errors.password}</span>}
                    </div>

                    {/* Options Row (Remember Me & Forgot Password) */}
                    <div className="card-options-row">
                      <label className="remember-me-checkbox">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                        />
                        <span>Remember me</span>
                      </label>

                      <button
                        type="button"
                        className="forgot-password-link"
                        onClick={() => setMode("forgot")}
                      >
                        Forgot password?
                      </button>
                    </div>

                    {/* Primary Sign In Button */}
                    <motion.button
                      type="submit"
                      className="card-submit-btn"
                      whileHover={!isLoading ? { scale: 1.01 } : {}}
                      whileTap={!isLoading ? { scale: 0.985 } : {}}
                      disabled={isLoading}
                    >
                      <span>{isLoading ? "Signing in..." : "Sign In"}</span>
                      {!isLoading && <ArrowRight size={16} />}
                    </motion.button>


                  </form>
                </>
              )}

              {/* =========================================
                  TAB 2: CREATE ACCOUNT MODE
                  ========================================= */}
              {mode === "register" && (
                <>
                  <div className="card-heading-block">
                    <div className="card-brand-pill">
                      <span>RADIX</span> MEDICAL AI
                    </div>
                    <h2>Create RADIX Account</h2>
                    <p>Register as an authorized clinician on RADIX</p>
                  </div>

                  <form onSubmit={handleRegisterSubmit} className="card-auth-form">
                    {/* Full Name */}
                    <div className="card-form-group">
                      <label>Full Name</label>
                      <div className={`card-input-box ${errors.name ? "has-error" : ""}`}>
                        <User size={16} className="card-input-icon" />
                        <input
                          type="text"
                          placeholder="e.g. Dr. Arthur Vance"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          required
                        />
                      </div>
                      {errors.name && <span className="field-error-text">{errors.name}</span>}
                    </div>

                    {/* Email */}
                    <div className="card-form-group">
                      <label>Clinical Email</label>
                      <div className={`card-input-box ${errors.email ? "has-error" : ""}`}>
                        <Mail size={16} className="card-input-icon" />
                        <input
                          type="email"
                          placeholder="name@hospital.org"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </div>
                      {errors.email && <span className="field-error-text">{errors.email}</span>}
                    </div>

                    {/* Clinical Role (Radiologist only) */}
                    <div className="card-form-group">
                      <label>Clinical Role</label>
                      <div className="card-input-box" style={{ background: "#f8fafc" }}>
                        <Briefcase size={16} className="card-input-icon text-primary" />
                        <input
                          type="text"
                          value="Radiologist"
                          readOnly
                          disabled
                          style={{
                            cursor: "not-allowed",
                            fontWeight: 600,
                            color: "#0f172a",
                            background: "transparent",
                          }}
                        />
                        <span
                          style={{
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            background: "#e0f2fe",
                            color: "#0369a1",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            marginRight: "8px",
                            flexShrink: 0,
                          }}
                        >
                          Radiologist
                        </span>
                      </div>
                      <span className="field-hint-text" style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "4px" }}>
                        RADIX platform access is strictly restricted to Radiologists.
                      </span>
                    </div>

                    {/* Password */}
                    <div className="card-form-group">
                      <label>Password</label>
                      <div className={`card-input-box ${errors.password ? "has-error" : ""}`}>
                        <Lock size={16} className="card-input-icon" />
                        <input
                          type={showPassword ? "text" : "password"}
                          placeholder="At least 8 characters"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                        />
                        <button
                          type="button"
                          className="password-toggle-btn"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {password && (
                        <div className="card-strength-meter">
                          <div className="meter-bars">
                            <span className={`bar ${passwordStrength >= 1 ? "active lvl-1" : ""}`}></span>
                            <span className={`bar ${passwordStrength >= 2 ? "active lvl-2" : ""}`}></span>
                            <span className={`bar ${passwordStrength >= 3 ? "active lvl-3" : ""}`}></span>
                            <span className={`bar ${passwordStrength >= 4 ? "active lvl-4" : ""}`}></span>
                          </div>
                          <span className="meter-label">
                            {passwordStrength <= 1
                              ? "Weak"
                              : passwordStrength === 2
                              ? "Fair"
                              : passwordStrength === 3
                              ? "Good"
                              : "Strong"}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Confirm Password */}
                    <div className="card-form-group">
                      <label>Confirm Password</label>
                      <div className={`card-input-box ${errors.confirmPassword ? "has-error" : ""}`}>
                        <Lock size={16} className="card-input-icon" />
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Re-enter password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                        />
                        <button
                          type="button"
                          className="password-toggle-btn"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        >
                          {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {errors.confirmPassword && (
                        <span className="field-error-text">{errors.confirmPassword}</span>
                      )}
                    </div>

                    {/* Healthcare Certification Checkbox */}
                    <label className="remember-me-checkbox cert-agree">
                      <input
                        type="checkbox"
                        checked={agreeTerms}
                        onChange={(e) => setAgreeTerms(e.target.checked)}
                      />
                      <span>I certify I am an authorized radiologist / radiology physician.</span>
                    </label>
                    {errors.terms && <span className="field-error-text">{errors.terms}</span>}

                    {/* Primary Button */}
                    <motion.button
                      type="submit"
                      className="card-submit-btn"
                      whileHover={!isLoading ? { scale: 1.01 } : {}}
                      whileTap={!isLoading ? { scale: 0.985 } : {}}
                      disabled={isLoading}
                    >
                      <span>{isLoading ? "Creating account..." : "Create Account"}</span>
                      {!isLoading && <ArrowRight size={16} />}
                    </motion.button>


                  </form>
                </>
              )}

              {/* =========================================
                  TAB 3: FORGOT PASSWORD MODE
                  ========================================= */}
              {mode === "forgot" && (
                <>
                  <div className="card-heading-block">
                    <h2>Forgot Password</h2>
                    <p>Enter your clinical email to receive a recovery code</p>
                  </div>

                  <form onSubmit={handleForgotSubmit} className="card-auth-form">
                    <div className="card-form-group">
                      <label>Clinical Email</label>
                      <div className={`card-input-box ${errors.email ? "has-error" : ""}`}>
                        <Mail size={16} className="card-input-icon" />
                        <input
                          type="email"
                          placeholder="name@hospital.org"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </div>
                      {errors.email && <span className="field-error-text">{errors.email}</span>}
                    </div>

                    <motion.button
                      type="submit"
                      className="card-submit-btn"
                      whileHover={!isLoading && countdown === 0 ? { scale: 1.01 } : {}}
                      whileTap={!isLoading && countdown === 0 ? { scale: 0.985 } : {}}
                      disabled={isLoading || countdown > 0}
                    >
                      <span>
                        {countdown > 0
                          ? `Resend available in ${countdown}s`
                          : isLoading
                          ? "Generating Code..."
                          : "Send Verification Code"}
                      </span>
                      {countdown === 0 && !isLoading && <ArrowRight size={16} />}
                    </motion.button>

                    {generatedToken && (
                      <motion.div
                        className="recovery-code-callout"
                        initial={{ opacity: 0, scale: 0.92, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ type: "spring", stiffness: 350, damping: 25 }}
                      >
                        <div className="recovery-code-label">Verification Code Sent to Email</div>
                        <div className="recovery-code-value">{generatedToken}</div>
                        <div style={{ fontSize: "0.75rem", color: "#64748b", margin: "6px 0 10px 0" }}>
                          Dispatched to {email}. You can copy this code or proceed below.
                        </div>
                        <motion.button
                          type="button"
                          className="card-submit-btn"
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.985 }}
                          style={{ marginTop: 6, height: 38, fontSize: "0.82rem" }}
                          onClick={() => {
                            setResetToken(generatedToken);
                            setMode("reset", true);
                          }}
                        >
                          <span>Proceed to Set New Password</span>
                          <ArrowRight size={15} />
                        </motion.button>
                      </motion.div>
                    )}

                    <div className="card-back-action">
                      <button
                        type="button"
                        className="back-to-sign-btn"
                        onClick={() => setMode("login")}
                      >
                        <ArrowLeft size={14} />
                        <span>Back to Sign In</span>
                      </button>

                      <button
                        type="button"
                        className="enter-token-btn"
                        onClick={() => setMode("reset")}
                      >
                        Have a code? Enter here
                      </button>
                    </div>
                  </form>
                </>
              )}

              {/* =========================================
                  TAB 4: RESET PASSWORD MODE
                  ========================================= */}
              {mode === "reset" && (
                <>
                  <div className="card-heading-block">
                    <h2>Reset Password</h2>
                    <p>Enter your verification code and set a new password</p>
                  </div>

                  <form onSubmit={handleResetSubmit} className="card-auth-form">
                    <div className="card-form-group">
                      <label>Clinical Email</label>
                      <div className={`card-input-box ${errors.email ? "has-error" : ""}`}>
                        <Mail size={16} className="card-input-icon" />
                        <input
                          type="email"
                          placeholder="name@hospital.org"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </div>
                      {errors.email && <span className="field-error-text">{errors.email}</span>}
                    </div>

                    <div className="card-form-group">
                      <label>Verification Security Code</label>
                      <div className={`card-input-box ${errors.token ? "has-error" : ""}`}>
                        <KeyRound size={16} className="card-input-icon" />
                        <input
                          type="text"
                          placeholder="e.g. RDX-482910"
                          value={resetToken}
                          onChange={(e) => setResetToken(e.target.value)}
                          required
                        />
                      </div>
                      {errors.token && <span className="field-error-text">{errors.token}</span>}
                    </div>

                    <div className="card-form-group">
                      <label>New Password</label>
                      <div className={`card-input-box ${errors.password ? "has-error" : ""}`}>
                        <Lock size={16} className="card-input-icon" />
                        <input
                          type={showPassword ? "text" : "password"}
                          placeholder="At least 8 characters"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                        />
                        <button
                          type="button"
                          className="password-toggle-btn"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {password && (
                        <div className="card-strength-meter">
                          <div className="meter-bars">
                            <span className={`bar ${passwordStrength >= 1 ? "active lvl-1" : ""}`}></span>
                            <span className={`bar ${passwordStrength >= 2 ? "active lvl-2" : ""}`}></span>
                            <span className={`bar ${passwordStrength >= 3 ? "active lvl-3" : ""}`}></span>
                            <span className={`bar ${passwordStrength >= 4 ? "active lvl-4" : ""}`}></span>
                          </div>
                          <span className="meter-label">
                            {passwordStrength <= 1
                              ? "Weak"
                              : passwordStrength === 2
                              ? "Fair"
                              : passwordStrength === 3
                              ? "Good"
                              : "Strong"}
                          </span>
                        </div>
                      )}
                      {errors.password && <span className="field-error-text">{errors.password}</span>}
                    </div>

                    <div className="card-form-group">
                      <label>Confirm New Password</label>
                      <div className={`card-input-box ${errors.confirmPassword ? "has-error" : ""}`}>
                        <Lock size={16} className="card-input-icon" />
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Confirm new password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                        />
                        <button
                          type="button"
                          className="password-toggle-btn"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        >
                          {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {errors.confirmPassword && (
                        <span className="field-error-text">{errors.confirmPassword}</span>
                      )}
                    </div>

                    <motion.button
                      type="submit"
                      className="card-submit-btn"
                      whileHover={!isLoading ? { scale: 1.01 } : {}}
                      whileTap={!isLoading ? { scale: 0.985 } : {}}
                      disabled={isLoading}
                    >
                      <span>{isLoading ? "Updating Password..." : "Update Password & Sign In"}</span>
                      {!isLoading && <ArrowRight size={16} />}
                    </motion.button>

                    <div className="card-back-action">
                      <button
                        type="button"
                        className="back-to-sign-btn"
                        onClick={() => setMode("login")}
                      >
                        <ArrowLeft size={14} />
                        <span>Back to Sign In</span>
                      </button>
                    </div>
                  </form>
                </>
              )}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>

          {/* 3 Trust Badges Below Card */}
          <motion.div
            className="card-trust-badges-row"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.35 }}
          >
            <div className="trust-badge-item">
              <div className="trust-badge-icon">
                <Lock size={16} strokeWidth={1.8} />
              </div>
              <strong className="badge-title">Secure & Compliant</strong>
              <span className="badge-subtitle">End-to-end protection</span>
            </div>

            <div className="trust-badge-item">
              <div className="trust-badge-icon">
                <FileText size={16} strokeWidth={1.8} />
              </div>
              <strong className="badge-title">HIPAA-Minded</strong>
              <span className="badge-subtitle">Privacy-first design</span>
            </div>

            <div className="trust-badge-item">
              <div className="trust-badge-icon">
                <ShieldCheck size={16} strokeWidth={1.8} />
              </div>
              <strong className="badge-title">Responsible AI</strong>
              <span className="badge-subtitle">Human oversight always</span>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Login;
