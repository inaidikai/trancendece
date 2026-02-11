import React, { useState, useRef, useEffect } from 'react';

export default function DraggableResizable({
  children,
  x,
  y,
  width,
  height,
  minWidth = 50,
  minHeight = 50,
  onUpdate,
  onDelete,
  isSelected = false,
  pageBounds,
  disabled = false,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [resizeHandle, setResizeHandle] = useState(null);
  const elementRef = useRef(null);

  const constrainPosition = (newX, newY, newWidth, newHeight) => {
    if (!pageBounds) return { x: newX, y: newY, width: newWidth, height: newHeight };

    const constrainedX = Math.max(0, Math.min(newX, pageBounds.width - newWidth));
    const constrainedY = Math.max(0, Math.min(newY, pageBounds.height - newHeight));
    const constrainedWidth = Math.max(minWidth, Math.min(newWidth, pageBounds.width - constrainedX));
    const constrainedHeight = Math.max(minHeight, Math.min(newHeight, pageBounds.height - constrainedY));

    return {
      x: constrainedX,
      y: constrainedY,
      width: constrainedWidth,
      height: constrainedHeight,
    };
  };

  const handleMouseDown = (e) => {
    if (disabled) return;
    if (e.target.classList.contains('resize-handle')) return;
    setIsDragging(true);
    const rect = elementRef.current.getBoundingClientRect();
    
    setDragStart({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    e.preventDefault();
    e.stopPropagation();
  };

  const handleResizeStart = (e, handle) => {
    if (disabled) return;
    setIsResizing(true);
    setResizeHandle(handle);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width,
      height,
    });
    e.preventDefault();
    e.stopPropagation();
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) {
        const rect = elementRef.current?.parentElement?.getBoundingClientRect();
        if (!rect) return;
        
        const newX = e.clientX - rect.left - dragStart.x;
        const newY = e.clientY - rect.top - dragStart.y;
        
        const constrained = constrainPosition(newX, newY, width, height);
        onUpdate({ ...constrained });
      } else if (isResizing) {
        const deltaX = e.clientX - resizeStart.x;
        const deltaY = e.clientY - resizeStart.y;
        
        let newWidth = resizeStart.width;
        let newHeight = resizeStart.height;
        let newX = x;
        let newY = y;

        if (resizeHandle.includes('e')) {
          newWidth = Math.max(minWidth, resizeStart.width + deltaX);
        }
        if (resizeHandle.includes('w')) {
          newWidth = Math.max(minWidth, resizeStart.width - deltaX);
          newX = x + deltaX;
        }
        if (resizeHandle.includes('s')) {
          newHeight = Math.max(minHeight, resizeStart.height + deltaY);
        }
        if (resizeHandle.includes('n')) {
          newHeight = Math.max(minHeight, resizeStart.height - deltaY);
          newY = y + deltaY;
        }

        const constrained = constrainPosition(newX, newY, newWidth, newHeight);
        onUpdate({ ...constrained });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      setResizeHandle(null);
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, dragStart, resizeStart, resizeHandle, x, y, width, height, minWidth, minHeight, onUpdate]);

  const handles = ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'];

  return (
    <div
      ref={elementRef}
      className={`absolute ${isSelected ? 'selection-outline' : ''} ${disabled ? 'pointer-events-none' : 'cursor-move'}`}
      style={{
        left: `${x}px`,
        top: `${y}px`,
        width: `${width}px`,
        height: `${height}px`,
      }}
      onMouseDown={handleMouseDown}
    >
      {children}
      {isSelected && !disabled && (
        <>
          {handles.map((handle) => (
            <div
              key={handle}
              className={`resize-handle handle-${handle} absolute ${handle === 'nw' ? 'top-0 left-0 cursor-nw-resize' : ''} ${handle === 'ne' ? 'top-0 right-0 cursor-ne-resize' : ''} ${handle === 'sw' ? 'bottom-0 left-0 cursor-sw-resize' : ''} ${handle === 'se' ? 'bottom-0 right-0 cursor-se-resize' : ''} ${handle === 'n' ? 'top-0 left-1/2 cursor-n-resize' : ''} ${handle === 's' ? 'bottom-0 left-1/2 cursor-s-resize' : ''} ${handle === 'e' ? 'right-0 top-1/2 cursor-e-resize' : ''} ${handle === 'w' ? 'left-0 top-1/2 cursor-w-resize' : ''}`}
              onMouseDown={(e) => handleResizeStart(e, handle)}
            >
              <span className="resize-handle-inner" />
            </div>
          ))}
          {onDelete && (
            <button
              className="selection-close absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs z-10"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              ×
            </button>
          )}
        </>
      )}
    </div>
  );
}
