import React, { useEffect, useMemo, useState } from "react";

const MAX_STALE_MS = 5000;

const hexToRgba = (hex, alpha) => {
  if (!hex) return `rgba(0,0,0,${alpha})`;
  const value = hex.replace("#", "");
  if (value.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const getCaretCoordinates = (textarea, position) => {
  const style = window.getComputedStyle(textarea);
  const div = document.createElement("div");
  const properties = [
    "direction",
    "boxSizing",
    "width",
    "height",
    "overflowX",
    "overflowY",
    "borderTopWidth",
    "borderRightWidth",
    "borderBottomWidth",
    "borderLeftWidth",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "fontStyle",
    "fontVariant",
    "fontWeight",
    "fontStretch",
    "fontSize",
    "fontSizeAdjust",
    "lineHeight",
    "fontFamily",
    "textAlign",
    "textTransform",
    "textIndent",
    "textDecoration",
    "letterSpacing",
    "wordSpacing",
    "tabSize",
    "MozTabSize",
  ];

  div.style.position = "absolute";
  div.style.visibility = "hidden";
  div.style.whiteSpace = "pre-wrap";
  div.style.wordWrap = "break-word";
  div.style.top = "0";
  div.style.left = "-9999px";

  properties.forEach((prop) => {
    div.style[prop] = style[prop];
  });

  div.textContent = textarea.value.substring(0, position);

  const span = document.createElement("span");
  span.textContent = textarea.value.substring(position) || ".";
  div.appendChild(span);

  document.body.appendChild(div);
  const { offsetLeft, offsetTop } = span;
  const lineHeight =
    parseFloat(style.lineHeight) || parseFloat(style.fontSize) || 16;
  document.body.removeChild(div);

  return {
    left: offsetLeft - textarea.scrollLeft,
    top: offsetTop - textarea.scrollTop,
    lineHeight,
  };
};

export default function RemoteCursorsOverlay({
  textareaRef,
  wrapperRef,
  presenceMap,
  currentUserId,
}) {
  const [hoveredUserId, setHoveredUserId] = useState(null);

  const entries = useMemo(() => {
    if (!presenceMap) return [];
    return Object.entries(presenceMap)
      .filter(([userId]) => userId !== currentUserId)
      .map(([userId, data]) => ({ userId, ...data }));
  }, [presenceMap, currentUserId]);

  useEffect(() => {
    const textarea = textareaRef?.current;
    const wrapper = wrapperRef?.current;
    if (!textarea || !wrapper) return undefined;

    const handleMove = (event) => {
      if (!entries.length) return;
      const rect = wrapper.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const textareaRect = textarea.getBoundingClientRect();
      const offsetX = textareaRect.left - rect.left;
      const offsetY = textareaRect.top - rect.top;
      let hovered = null;

      for (const entry of entries) {
        const index =
          Number.isFinite(entry.cursorIndex) && entry.cursorIndex !== null
            ? entry.cursorIndex
            : entry.selectionEnd ?? entry.selectionStart ?? 0;
        const caret = getCaretCoordinates(textarea, index);
        if (!caret) continue;
        const dx = Math.abs(x - (offsetX + caret.left));
        const dy = Math.abs(y - (offsetY + caret.top));
        if (dx <= 14 && dy <= caret.lineHeight + 10) {
          hovered = entry.userId;
          break;
        }
      }

      setHoveredUserId(hovered);
    };

    const handleLeave = () => setHoveredUserId(null);

    wrapper.addEventListener("mousemove", handleMove);
    wrapper.addEventListener("mouseleave", handleLeave);

    return () => {
      wrapper.removeEventListener("mousemove", handleMove);
      wrapper.removeEventListener("mouseleave", handleLeave);
    };
  }, [entries, textareaRef]);

  const textarea = textareaRef?.current;
  const wrapper = wrapperRef?.current;

  if (!textarea || !wrapper || !entries.length) {
    return null;
  }

  const textareaRect = textarea.getBoundingClientRect();
  const wrapperRect = wrapper.getBoundingClientRect();
  const offsetX = textareaRect.left - wrapperRect.left;
  const offsetY = textareaRect.top - wrapperRect.top;
  const now = Date.now();

  return (
    <div className="remote-cursors-overlay">
      {entries.map((entry, index) => {
        const lastSeen = entry.lastSeenTs || 0;
        if (now - lastSeen > MAX_STALE_MS) {
          return null;
        }
        const caretIndex =
          Number.isFinite(entry.cursorIndex) && entry.cursorIndex !== null
            ? entry.cursorIndex
            : entry.selectionEnd ?? entry.selectionStart ?? 0;
        const caret = getCaretCoordinates(textarea, caretIndex);
        if (!caret) return null;
        const left = offsetX + caret.left;
        const top = offsetY + caret.top;
        const color = entry.color || "#4DB6AC";
        const showLabel = hoveredUserId === entry.userId;

        let selectionEl = null;
        if (
          Number.isFinite(entry.selectionStart) &&
          Number.isFinite(entry.selectionEnd) &&
          entry.selectionStart !== entry.selectionEnd
        ) {
          const start = getCaretCoordinates(textarea, entry.selectionStart);
          const end = getCaretCoordinates(textarea, entry.selectionEnd);
          if (start && end && Math.abs(start.top - end.top) < caret.lineHeight) {
            const selLeft = offsetX + Math.min(start.left, end.left);
            const selTop = offsetY + start.top;
            const width = Math.max(2, Math.abs(end.left - start.left));
            selectionEl = (
              <div
                className="remote-selection"
                style={{
                  left: selLeft,
                  top: selTop,
                  width,
                  height: caret.lineHeight,
                  background: hexToRgba(color, 0.2),
                }}
              />
            );
          }
        }

        const isActive = now - lastSeen < 1500;

        return (
          <React.Fragment key={`${entry.userId}-${index}`}>
            {selectionEl}
            <div
              className="remote-cursor-wrapper"
              style={{ left, top }}
            >
              <div
                className="remote-cursor-line"
                style={{ background: color, height: caret.lineHeight }}
              />
              <div
                className={`remote-cursor-dot${isActive ? " is-active" : ""}`}
                style={{ background: color }}
              />
              {showLabel && (
                <div
                  className="remote-cursor-label"
                  style={{ background: color }}
                >
                  {entry.name || entry.userId}
                </div>
              )}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}
