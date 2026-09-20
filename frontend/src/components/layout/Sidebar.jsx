import React from "react";
import { NavLink, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Activity,
  ClipboardCheck,
  BarChart3,
  SlidersHorizontal,
  User,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { RadixDeltaA } from "../RadixLogo";
import "./layout.css";

export const Sidebar = ({ isCollapsed, onToggleCollapse, onItemClick, onCloseMobile }) => {
  const navSections = [
    {
      group: "CLINICAL WORKFLOW",
      items: [
        {
          to: "/dashboard",
          label: "Dashboard",
          icon: <LayoutDashboard size={17} strokeWidth={1.8} />,
        },
        {
          to: "/worklist",
          label: "Triage Worklist",
          icon: <Activity size={17} strokeWidth={1.8} />,
        },
        {
          to: "/reviewed",
          label: "Reviewed Studies",
          icon: <ClipboardCheck size={17} strokeWidth={1.8} />,
        },
      ],
    },
    {
      group: "INTELLIGENCE & ACCOUNT",
      items: [
        {
          to: "/analytics",
          label: "Performance & ROI",
          icon: <BarChart3 size={17} strokeWidth={1.8} />,
        },
        {
          to: "/settings",
          label: "PACS & Protocols",
          icon: <SlidersHorizontal size={17} strokeWidth={1.8} />,
        },
        {
          to: "/profile",
          label: "Clinical Profile",
          icon: <User size={17} strokeWidth={1.8} />,
        },
      ],
    },
  ];

  return (
    <aside className={`radix-sidebar ${isCollapsed ? "sidebar-collapsed" : ""}`}>
      {/* Sidebar Header / Brand */}
      <div className="sidebar-brand-wrapper">
        <Link
          to="/dashboard"
          className="sidebar-brand-link"
          title="RADIX Diagnostic AI"
          onClick={onItemClick}
        >
          <div className="sidebar-logo">
            <span>R</span>
            <RadixDeltaA size={isCollapsed ? 18 : 20} color="#0284c7" strokeWidth={2.6} />
            {!isCollapsed && <span>DIX</span>}
          </div>
          {!isCollapsed && <span className="sidebar-tagline">Triage OS</span>}
        </Link>
        {onCloseMobile && (
          <button
            className="sidebar-mobile-close-btn"
            onClick={onCloseMobile}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Navigation List */}
      <nav className="sidebar-nav">
        {navSections.map((section, sIdx) => (
          <div key={section.group} className="sidebar-nav-group">
            {!isCollapsed && <div className="nav-section-label">{section.group}</div>}
            {isCollapsed && sIdx > 0 && <div className="nav-section-divider" />}
            <ul className="nav-list">
              {section.items.map((item) => (
                <motion.li
                  key={item.to}
                  className="nav-item"
                  whileHover={{ x: 3, transition: { duration: 0.12 } }}
                >
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      `nav-link ${isActive ? "active" : ""}`
                    }
                    title={isCollapsed ? item.label : undefined}
                    onClick={onItemClick}
                  >
                    <span className="nav-icon">{item.icon}</span>
                    {!isCollapsed && <span className="nav-label">{item.label}</span>}
                    {!isCollapsed && item.badge && (
                      <span className={`nav-badge badge-${item.badgeType}`}>
                        {item.badge}
                      </span>
                    )}
                    {isCollapsed && item.badge && (
                      <span className="nav-dot-indicator"></span>
                    )}
                  </NavLink>
                </motion.li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Sidebar Footer / Collapse Toggle */}
      <div className="sidebar-footer">
        <motion.button
          className="sidebar-collapse-btn"
          onClick={onToggleCollapse}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          {!isCollapsed && <span>Collapse Sidebar</span>}
        </motion.button>
      </div>
    </aside>
  );
};

export default Sidebar;
