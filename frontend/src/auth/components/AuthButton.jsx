import React from "react";

export default function AuthButton({
  children,
  onClick,
  type = "button",
  disabled,
  variant = "primary",
  block = false,
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`auth-button ${variant === "secondary" ? "secondary" : ""} ${
        block ? "block" : ""
      } ${disabled ? "disabled" : ""}`}
    >
      {children}
    </button>
  );
}
