import React from "react";

export const RadixDeltaA = ({ size = 20, color = "currentColor", strokeWidth = 2.4 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    style={{ display: "inline-block", verticalAlign: "middle", margin: "0 1px" }}
  >
    <path
      d="M3 21L12 3L21 21"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const RadixLogo = ({ theme = "dark", size = "normal" }) => {
  const isLight = theme === "light";
  const textColor = isLight ? "#0f172a" : "#ffffff";
  const deltaColor = isLight ? "#2563eb" : "#38bdf8";

  const fontSize = size === "small" ? "1.25rem" : size === "large" ? "2.2rem" : "1.75rem";
  const letterSpacing = size === "small" ? "3px" : "5px";

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-start" }}>
      <div
        style={{
          fontFamily: "'Inter', sans-serif",
          fontWeight: 800,
          fontSize,
          letterSpacing,
          color: textColor,
          display: "flex",
          alignItems: "center",
          lineHeight: 1,
        }}
      >
        <span>R</span>
        <RadixDeltaA size={size === "small" ? 16 : size === "large" ? 28 : 22} color={deltaColor} strokeWidth={2.8} />
        <span>DIX</span>
      </div>
      <div
        style={{
          fontSize: size === "small" ? "0.6rem" : "0.68rem",
          fontWeight: 600,
          letterSpacing: "1.8px",
          color: isLight ? "#64748b" : "#94a3b8",
          marginTop: "4px",
          textTransform: "uppercase",
        }}
      >
        AI-Powered Radiology Workflow Intelligence
      </div>
    </div>
  );
};

export default RadixLogo;
