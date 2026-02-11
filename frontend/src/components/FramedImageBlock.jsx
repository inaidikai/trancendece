import React from 'react';
import DraggableResizable from './DraggableResizable';

const DEFAULT_FRAME_INSET = {
  top: 12,
  right: 10,
  bottom: 18,
  left: 10,
};

export default function FramedImageBlock({
  id,
  x,
  y,
  width,
  height,
  imageSrc,
  frameSrc,
  frameInset = DEFAULT_FRAME_INSET,
  onUpdate,
  onDelete,
  isSelected,
  pageBounds,
  onSelect,
}) {
  const inset = frameInset || DEFAULT_FRAME_INSET;

  return (
    <DraggableResizable
      x={x}
      y={y}
      width={width}
      height={height}
      minWidth={80}
      minHeight={120}
      onUpdate={onUpdate}
      onDelete={onDelete}
      isSelected={isSelected}
      pageBounds={pageBounds}
    >
      <div className="relative w-full h-full" onClick={onSelect}>
        <div
          className="absolute overflow-hidden z-10"
          style={{
            top: `${inset.top}%`,
            left: `${inset.left}%`,
            right: `${inset.right}%`,
            bottom: `${inset.bottom}%`,
            background: "#fff",
          }}
        >
          <img
            src={imageSrc}
            alt="Uploaded"
            className="w-full h-full object-cover"
            draggable={false}
          />
        </div>
        <img
          src={frameSrc}
          alt="Frame"
          className="absolute inset-0 w-full h-full pointer-events-none select-none shadow-[0_3px_6px_rgba(0,0,0,0.12)] z-0"
          draggable={false}
        />
      </div>
    </DraggableResizable>
  );
}
