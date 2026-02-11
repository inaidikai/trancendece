import React, { useState } from "react";
import Tooltip from "./Tooltip";
import "./MicToolButton.css";

export default function MicToolButton({ isActive, isListening, isDisabled, onClick }) {
  const [isHovered, setIsHovered] = useState(false);
  const tooltipText = isDisabled
    ? "Microphone disabled for collaborators"
    : isListening
      ? "Listening..."
      : "Mic";

  return (
    <div className="tool-icon-button-wrapper">
      {isHovered && <Tooltip text={tooltipText} />}
      <button
        type="button"
        className={`tool-icon-button mic-tool-button${isActive ? " active" : ""}${
          isListening ? " listening" : ""
        }${isDisabled ? " disabled" : ""}`}
        onClick={isDisabled ? undefined : onClick}
        aria-label="Mic"
        disabled={isDisabled}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <span className="tool-icon-shadow" aria-hidden="true" />
        {isListening && (
          <>
            <span className="listening-ring ring-1" aria-hidden="true" />
            <span className="listening-ring ring-2" aria-hidden="true" />
            <span className="listening-ring ring-3" aria-hidden="true" />
          </>
        )}
        <span className="tool-icon-content">
          <img className="tool-icon-img mic-icon-img mic-svg" src="/assets/mic.png" alt="Mic" />
        </span>
      </button>
    </div>
  );
}
