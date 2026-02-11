import React from "react";

export default function AuthInput({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  error,
  disabled = false,
  action,
}) {
  return (
    <div className="auth-input-group">
      <label className="auth-input-label">{label}</label>
      <div className="auth-input-wrap">
        <input
          className={`auth-input${error ? " error" : ""}${action ? " has-action" : ""}`}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
        />
        {action ? (
          <button
            type="button"
            className="auth-input-action"
            onClick={action.onClick}
            aria-label={action.ariaLabel}
            disabled={action.disabled}
          >
            {action.label}
          </button>
        ) : null}
      </div>
      {error && <span className="auth-input-help">{error}</span>}
    </div>
  );
}
