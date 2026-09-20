import React, { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight,
  LogOut,
  User,
  Sliders,
  Menu,
} from "lucide-react";
import { authService } from "../../services/authService";
import "./layout.css";

export const Header = ({ onToggleMobileMenu }) => {
  const location = useLocation();
  const navigate = useNavigate();

  // Dropdown states
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [user, setUser] = useState(() => authService.getCurrentUser() || {
    name: "Radiologist",
    role: "Radiologist",
    email: "",
    department: "",
  });

  const profileRef = useRef(null);

  // Sync user profile state
  useEffect(() => {
    const updateUser = () => {
      const current = authService.getCurrentUser();
      if (current) {
        setUser(current);
      }
    };
    updateUser();
    window.addEventListener("radix_auth_changed", updateUser);
    window.addEventListener("storage", updateUser);
    return () => {
      window.removeEventListener("radix_auth_changed", updateUser);
      window.removeEventListener("storage", updateUser);
    };
  }, []);

  const handleLogout = async () => {
    setShowProfileMenu(false);
    await authService.logout();
    navigate("/login");
  };

  const getInitials = (nameStr) => {
    if (!nameStr) return "RD";
    const parts = nameStr.replace(/^Dr\.\s*/i, "").trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return nameStr.slice(0, 2).toUpperCase();
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Compute breadcrumbs from current pathname
  const getBreadcrumbs = () => {
    const path = location.pathname;
    const crumbs = [{ label: "Home", to: "/dashboard" }];

    if (path.startsWith("/dashboard")) {
      crumbs.push({ label: "Radiologist Dashboard", to: "/dashboard" });
    } else if (path.startsWith("/worklist")) {
      crumbs.push({ label: "Radiology Worklist", to: "/worklist" });
    } else if (path.startsWith("/study/")) {
      const id = path.split("/")[2];
      crumbs.push({ label: "Worklist", to: "/worklist" });
      crumbs.push({ label: `Study PX00${id}`, to: path });
    } else if (path.startsWith("/analytics")) {
      crumbs.push({ label: "AI Analytics & Benchmarks", to: "/analytics" });
    } else if (path.startsWith("/settings")) {
      crumbs.push({ label: "Clinical & PACS Settings", to: "/settings" });
    } else if (path.startsWith("/profile")) {
      crumbs.push({ label: "Clinical Profile", to: "/profile" });
    }
    return crumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <header className="radix-app-header">
      {/* Left: Mobile Toggle & Dynamic Breadcrumbs */}
      <div className="header-left">
        <button
          className="header-mobile-toggle"
          onClick={onToggleMobileMenu}
          aria-label="Toggle navigation menu"
        >
          <Menu size={20} />
        </button>

        <nav className="header-breadcrumbs" aria-label="Breadcrumb">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.to + idx}>
              {idx > 0 && <ChevronRight size={14} className="breadcrumb-separator" />}
              <Link
                to={crumb.to}
                className={`breadcrumb-item ${
                  idx === breadcrumbs.length - 1 ? "active" : ""
                }`}
              >
                {crumb.label}
              </Link>
            </React.Fragment>
          ))}
        </nav>
      </div>

      {/* Right: Profile */}
      <div className="header-right">
        {/* User Profile Menu Dropdown */}
        <div className="header-profile-container" ref={profileRef}>
          <button
            className={`header-profile-btn ${showProfileMenu ? "active" : ""}`}
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            aria-label="User profile menu"
          >
            <div className="header-avatar">
              {user?.avatar ? (
                <img src={user.avatar} alt={user?.name || "Avatar"} />
              ) : (
                getInitials(user?.name)
              )}
            </div>
            <div className="header-profile-text">
              <span className="profile-name">{user?.name || "Radiologist"}</span>
              <span className="profile-role">Radiologist</span>
            </div>
          </button>

          <AnimatePresence>
            {showProfileMenu && (
              <motion.div
                className="profile-dropdown-menu"
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.96 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
              >
                <div className="profile-menu-header">
                  <strong>{user?.name || "Radiologist"}</strong>
                  {user?.email && <span>{user.email}</span>}
                  {user?.department && <span className="profile-dept">{user.department}</span>}
                </div>

                <div className="profile-menu-divider"></div>

                <div className="profile-menu-items">
                  <button
                    className="profile-menu-item"
                    onClick={() => {
                      setShowProfileMenu(false);
                      navigate("/profile");
                    }}
                  >
                    <User size={15} />
                    <span>Clinical Profile</span>
                  </button>

                  <button
                    className="profile-menu-item"
                    onClick={() => {
                      setShowProfileMenu(false);
                      navigate("/settings");
                    }}
                  >
                    <Sliders size={15} />
                    <span>PACS & AI Preferences</span>
                  </button>

                  <div className="profile-menu-divider"></div>

                  <button
                    className="profile-menu-item item-danger"
                    onClick={handleLogout}
                  >
                    <LogOut size={15} />
                    <span>Sign Out</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};

export default Header;
