import React from "react";

export default function ToolIconButton({
  name,
  label,
  isActive,
  onClick,
  iconSrc,
  children,
}) {
  return (
    <button
      type="button"
      className={`tool-icon-button${isActive ? " active" : ""}`}
      onClick={onClick}
      aria-label={label || name}
    >
      {iconSrc ? (
        <img src={iconSrc} alt="" className="tool-icon-img" draggable="false" />
      ) : (
        children
      )}
      {label ? <span className="tool-label">{label}</span> : null}
    </button>
  );
}