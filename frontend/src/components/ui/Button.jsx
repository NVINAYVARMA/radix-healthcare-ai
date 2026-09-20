import React from "react";
import { Loader2 } from "lucide-react";
import "./ui.css";

export const Button = ({
  children,
  variant = "primary", // primary | secondary | outline | ghost | danger | google
  size = "md", // sm | md | lg
  isLoading = false,
  disabled = false,
  fullWidth = false,
  leftIcon = null,
  rightIcon = null,
  className = "",
  type = "button",
  onClick,
  ...props
}) => {
  const variantClass = `radix-btn-${variant}`;
  const sizeClass = `radix-btn-${size}`;
  const widthClass = fullWidth ? "radix-btn-full" : "";
  const loadingClass = isLoading ? "radix-btn-loading" : "";

  return (
    <button
      type={type}
      className={`radix-btn ${variantClass} ${sizeClass} ${widthClass} ${loadingClass} ${className}`.trim()}
      disabled={disabled || isLoading}
      onClick={onClick}
      {...props}
    >
      {isLoading ? (
        <span className="radix-btn-spinner">
          <Loader2 size={size === "sm" ? 14 : size === "lg" ? 20 : 16} className="spinner-icon" />
          <span>{children}</span>
        </span>
      ) : (
        <>
          {leftIcon && <span className="radix-btn-icon-left">{leftIcon}</span>}
          <span className="radix-btn-text">{children}</span>
          {rightIcon && <span className="radix-btn-icon-right">{rightIcon}</span>}
        </>
      )}
    </button>
  );
};

export default Button;
