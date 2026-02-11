import React, { useState, useRef, useEffect } from 'react';
import DraggableResizable from './DraggableResizable';
import RemoteCursorsOverlay from './RemoteCursorsOverlay';

export default function TextBlock({
  id,
  x,
  y,
  width,
  height,
  text,
  segments,
  fontFamily,
  color,
  fontSize = 16,
  onUpdate,
  onDelete,
  isSelected,
  pageBounds,
  onSelect,
  onEditStart,
  onEditEnd,
  onCursorChange,
  remotePresence,
  currentUserId,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(text);
  const textareaRef = useRef(null);
  const editorWrapperRef = useRef(null);
  const measureRef = useRef(null);
  const editingStateRef = useRef(isEditing);

  useEffect(() => {
    setEditText(text);
  }, [text]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (editingStateRef.current === isEditing) return;
    editingStateRef.current = isEditing;
    if (isEditing) {
      onEditStart?.();
    } else {
      onEditEnd?.();
    }
  }, [isEditing, onEditEnd, onEditStart]);

  const handleDoubleClick = () => {
    setIsEditing(true);
  };

  const emitCursorChange = () => {
    if (!textareaRef.current) return;
    const { selectionStart, selectionEnd } = textareaRef.current;
    const cursorIndex =
      Number.isFinite(selectionEnd) ? selectionEnd : selectionStart || 0;
    onCursorChange?.({
      id,
      cursorIndex,
      selectionStart,
      selectionEnd,
    });
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (editText !== text) {
      onUpdate({ text: editText });
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleBlur();
    }
    if (e.key === 'Escape') {
      setEditText(text);
      setIsEditing(false);
    }
  };

  return (
    <DraggableResizable
      x={x}
      y={y}
      width={width}
      height={height}
      minWidth={50}
      minHeight={30}
      onUpdate={onUpdate}
      onDelete={onDelete}
      isSelected={isSelected}
      pageBounds={pageBounds}
    >
      <div
        className="w-full h-full p-2 outline-none"
        onClick={onSelect}
        onDoubleClick={handleDoubleClick}
        style={{
          fontFamily,
          color,
          fontSize: `${fontSize}px`,
          wordWrap: 'break-word',
          overflow: 'hidden',
        }}
      >
        <div className="relative w-full h-full" ref={editorWrapperRef}>
          {isEditing ? (
            <textarea
              ref={textareaRef}
              className="w-full h-full resize-none outline-none border-none bg-transparent"
              value={editText}
              onChange={(e) => {
                const nextValue = e.target.value;
                setEditText(nextValue);
                emitCursorChange();
                onUpdate?.({ text: nextValue });
              }}
              onSelect={emitCursorChange}
              onKeyUp={emitCursorChange}
              onMouseUp={emitCursorChange}
              onFocus={emitCursorChange}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              style={{
                fontFamily,
                color,
                fontSize: `${fontSize}px`,
              }}
            />
          ) : (
            <div className="w-full h-full whitespace-pre-wrap break-words">
              {Array.isArray(segments) && segments.length
                ? segments.map((segment) => segment.text).join('')
                : text || 'Double-click to edit'}
            </div>
          )}

          <textarea
            ref={measureRef}
            className="remote-caret-measure"
            value={isEditing ? editText : text || ""}
            readOnly
            tabIndex={-1}
            aria-hidden="true"
            style={{
              fontFamily,
              color,
              fontSize: `${fontSize}px`,
              display: isEditing ? "none" : "block",
            }}
          />

          <RemoteCursorsOverlay
            textareaRef={isEditing ? textareaRef : measureRef}
            wrapperRef={editorWrapperRef}
            presenceMap={remotePresence}
            currentUserId={currentUserId}
          />
        </div>
      </div>
    </DraggableResizable>
  );
}
