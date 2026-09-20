import React, { useState } from "react";
import { Eye, EyeOff, AlertCircle } from "lucide-react";
import "./ui.css";

export const Input = ({
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  error,
  helperText,
  leftIcon = null,
  required = false,
  disabled = false,
  id,
  name,
  autoComplete,
  className = "",
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  const actualType = isPassword ? (showPassword ? "text" : "password") : type;

  return (
    <div className={`radix-input-group ${error ? "has-error" : ""} ${className}`.trim()}>
      {label && (
        <label className="radix-input-label" htmlFor={id || name}>
          {label}
          {required && <span className="required-star">*</span>}
        </label>
      )}

      <div className="radix-input-box">
        {leftIcon && <span className="radix-input-left-icon">{leftIcon}</span>}

        <input
          id={id || name}
          name={name}
          type={actualType}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          disabled={disabled}
          required={required}
          autoComplete={autoComplete}
          className="radix-input-control"
          {...props}
        />

        {isPassword && (
          <button
            type="button"
            className="radix-input-toggle-btn"
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>

      {error ? (
        <div className="radix-input-error">
          <AlertCircle size={13} className="error-icon" />
          <span>{error}</span>
        </div>
      ) : helperText ? (
        <div className="radix-input-helper">{helperText}</div>
      ) : null}
    </div>
  );
};

export default Input;
