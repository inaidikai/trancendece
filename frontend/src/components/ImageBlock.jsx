import React from 'react';
import DraggableResizable from './DraggableResizable';

export default function ImageBlock({
  id,
  x,
  y,
  width,
  height,
  src,
  onUpdate,
  onDelete,
  isSelected,
  pageBounds,
  onSelect,
}) {
  return (
    <DraggableResizable
      x={x}
      y={y}
      width={width}
      height={height}
      minWidth={50}
      minHeight={50}
      onUpdate={onUpdate}
      onDelete={onDelete}
      isSelected={isSelected}
      pageBounds={pageBounds}
    >
      <div
        className="w-full h-full overflow-hidden rounded"
        onClick={onSelect}
      >
        <img
          src={src}
          alt="Uploaded"
          className="w-full h-full object-contain"
          draggable={false}
        />
      </div>
    </DraggableResizable>
  );
}
