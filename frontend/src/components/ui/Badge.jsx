import React from "react";
import "./ui.css";

export const Badge = ({
  children,
  variant = "neutral", // high | medium | low | info | neutral | cyan | dark
  size = "md", // sm | md
  hasDot = false,
  className = "",
  ...props
}) => {
  return (
    <span className={`radix-badge radix-badge-${variant} radix-badge-${size} ${className}`.trim()} {...props}>
      {hasDot && <span className="radix-badge-dot"></span>}
      <span>{children}</span>
    </span>
  );
};

export default Badge;
