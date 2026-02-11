import React, { useState } from "react";
import "./ToolIconButton.css";
import Tooltip from "./Tooltip";

export default function ToolIconButton({ name, label, isActive, onClick, children }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div className="tool-icon-button-wrapper">
      {isHovered && <Tooltip text={label || name} />}
      <button
        type="button"
        className={`tool-icon-button${isActive ? " active" : ""}`}
        onClick={onClick}
        aria-label={label || name}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <span className="tool-icon-shadow" aria-hidden="true" />
        <span className="tool-icon-content">{children}</span>
      </button>
    </div>
  );
}
