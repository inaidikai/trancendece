import React from 'react';
import DraggableResizable from './DraggableResizable';

const STICKER_LIBRARY = [
  { id: 'star', emoji: '⭐', name: 'Star' },
  { id: 'heart', emoji: '❤️', name: 'Heart' },
  { id: 'smile', emoji: '😊', name: 'Smile' },
  { id: 'fire', emoji: '🔥', name: 'Fire' },
  { id: 'thumbsup', emoji: '👍', name: 'Thumbs Up' },
  { id: 'clap', emoji: '👏', name: 'Clap' },
  { id: 'party', emoji: '🎉', name: 'Party' },
  { id: 'cake', emoji: '🎂', name: 'Cake' },
  { id: 'gift', emoji: '🎁', name: 'Gift' },
  { id: 'balloon', emoji: '🎈', name: 'Balloon' },
  { id: 'rainbow', emoji: '🌈', name: 'Rainbow' },
  { id: 'sun', emoji: '☀️', name: 'Sun' },
  { id: 'moon', emoji: '🌙', name: 'Moon' },
  { id: 'flower', emoji: '🌸', name: 'Flower' },
  { id: 'butterfly', emoji: '🦋', name: 'Butterfly' },
  { id: 'unicorn', emoji: '🦄', name: 'Unicorn' },
];

export const STICKER_OPTIONS = STICKER_LIBRARY;

export default function Sticker({
  id,
  x,
  y,
  width,
  height,
  stickerId,
  src,
  onUpdate,
  onDelete,
  isSelected,
  pageBounds,
  onSelect,
}) {
  const sticker = STICKER_LIBRARY.find(s => s.id === stickerId) || STICKER_LIBRARY[0];

  return (
    <DraggableResizable
      x={x}
      y={y}
      width={width}
      height={height}
      minWidth={30}
      minHeight={30}
      onUpdate={onUpdate}
      onDelete={onDelete}
      isSelected={isSelected}
      pageBounds={pageBounds}
    >
      <div
        className="w-full h-full flex items-center justify-center select-none"
        onClick={onSelect}
        style={{
          fontSize: `${Math.min(width, height) * 0.7}px`,
          userSelect: 'none',
        }}
      >
        {src ? (
          <img
            src={src}
            alt={sticker.name}
            className="w-full h-full object-contain"
            draggable={false}
          />
        ) : (
          sticker.emoji
        )}
      </div>
    </DraggableResizable>
  );
}
