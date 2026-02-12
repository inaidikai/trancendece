import React from "react";
import "./Tooltip.css";

export default function Tooltip({ text }) {
  if (!text) return null;

  return (
    <div className="tool-tooltip" role="tooltip">
      {text}
      <span className="tool-tooltip-arrow" aria-hidden="true" />
    </div>
  );
}
