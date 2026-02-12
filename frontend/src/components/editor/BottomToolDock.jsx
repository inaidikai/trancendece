import React, { useState, useRef, useEffect } from "react";
import ToolIconButton from "./ToolIconButton";
import MicToolButton from "./MicToolButton";
import "./BottomToolDock.css";

const dockPath =
  "M32 80 Q32 48 64 48 L1452 48 Q1484 48 1484 80 L1484 470 L32 470 Z";

export default function BottomToolDock({
  activeTool,
  isListening,
  isMicDisabled = false,
  onToolClick = () => {},
}) {
  const [internalActiveTool, setInternalActiveTool] = useState(null);
  const [internalListening, setInternalListening] = useState(false);
  const [showPaperNotice, setShowPaperNotice] = useState(false);
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const uploadMenuRef = useRef(null);
  const isControlled = activeTool !== undefined;
  const currentActiveTool = isControlled ? activeTool : internalActiveTool;
  const currentListening = isListening !== undefined ? isListening : internalListening;
  const handleToolClick = (tool) => {
    if (tool !== "paper") {
      setShowPaperNotice(false);
    }
    if (tool !== "upload") {
      setShowUploadMenu(false);
    }
    if (tool === "mic" && isMicDisabled) {
      return;
    }
    if (tool === "mic") {
      if (currentListening) {
        if (isListening === undefined) {
          setInternalListening(false);
        }
        if (!isControlled) {
          setInternalActiveTool(null);
        }
      } else {
        if (!isControlled) {
          setInternalActiveTool("mic");
        }
        if (isListening === undefined) {
          setInternalListening(true);
        }
      }
    } else {
      if (!isControlled) {
        setInternalActiveTool(tool);
      }
      if (isListening === undefined) {
        setInternalListening(false);
      }
    }
    if (tool === "paper") {
      setShowPaperNotice((prev) => !prev);
    }
    onToolClick(tool);
  };

  useEffect(() => {
    if (!showUploadMenu) return;
    const handleOutside = (event) => {
      if (uploadMenuRef.current && !uploadMenuRef.current.contains(event.target)) {
        setShowUploadMenu(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [showUploadMenu]);

  return (
    <div className="bottom-tool-dock-container">
      <div className="bottom-tool-dock">
        <div className="dock-background">
          <svg
            className="block size-full"
            fill="none"
            preserveAspectRatio="none"
            viewBox="0 0 1515.05 445.048"
          >
            <g>
              <path
                d={dockPath}
                fill="#C5C1B0"
                opacity="0.8"
                stroke="#230401"
                strokeWidth="3.04774"
                transform="translate(0,-16)"
              />
              <path d={dockPath} fill="#FFFAE8" />
            </g>
          </svg>
        </div>

        <div className="tool-icons-container">
          <ToolIconButton
            name="select"
            label="Select"
            isActive={currentActiveTool === "select"}
            onClick={() => handleToolClick("select")}
          >
            <img className="tool-icon-img" src="/assets/select.png" alt="Select" />
          </ToolIconButton>

          <MicToolButton
            isActive={currentListening}
            isListening={currentListening}
            isDisabled={isMicDisabled}
            onClick={() => handleToolClick("mic")}
          />

          <ToolIconButton
            name="text"
            label="Text"
            isActive={currentActiveTool === "text"}
            onClick={() => handleToolClick("text")}
          >
            <img className="tool-icon-img" src="/assets/text.png" alt="Text" />
          </ToolIconButton>

          <div className="upload-tool-wrapper" ref={uploadMenuRef}>
            {showUploadMenu && (
              <div className="upload-mode-popover" role="menu">
                <button
                  type="button"
                  className="upload-mode-item"
                  onClick={() => {
                    setShowUploadMenu(false);
                    if (!isControlled) {
                      setInternalActiveTool("upload");
                    }
                    if (isListening === undefined) {
                      setInternalListening(false);
                    }
                    onToolClick("upload", "normal");
                  }}
                >
                  Upload from photo
                </button>
                <button
                  type="button"
                  className="upload-mode-item"
                  onClick={() => {
                    setShowUploadMenu(false);
                    if (!isControlled) {
                      setInternalActiveTool("upload");
                    }
                    if (isListening === undefined) {
                      setInternalListening(false);
                    }
                    onToolClick("upload", "portrait");
                  }}
                >
                  Upload with frame
                </button>
              </div>
            )}
            <ToolIconButton
              name="upload"
              label="Upload"
              isActive={currentActiveTool === "upload"}
              onClick={() => setShowUploadMenu((prev) => !prev)}
            >
              <img className="tool-icon-img" src="/assets/pic.png" alt="Upload" />
            </ToolIconButton>
          </div>

          <ToolIconButton
            name="sticker"
            label="Sticker"
            isActive={currentActiveTool === "sticker"}
            onClick={() => handleToolClick("sticker")}
          >
            <img className="tool-icon-img" src="/assets/sticker.png" alt="Sticker" />
          </ToolIconButton>

          <div className="paper-tool-wrapper">
            {showPaperNotice && (
              <div className="paper-coming-soon" role="status">
                Coming soon
                <span className="paper-coming-soon-arrow" />
              </div>
            )}
            <ToolIconButton
              name="paper"
              label="Paper"
              isActive={currentActiveTool === "paper"}
              onClick={() => handleToolClick("paper")}
            >
              <img className="tool-icon-img" src="/assets/paper.png" alt="Paper" />
            </ToolIconButton>
          </div>
        </div>
      </div>
    </div>
  );
}
