import React, { useRef, useEffect } from 'react';
import TextBlock from './TextBlock';
import Sticker from './Sticker';
import ImageBlock from './ImageBlock';
import FramedImageBlock from './FramedImageBlock';

export default function PageCanvas({
  content,
  onContentUpdate,
  selectedId,
  onSelect,
  fontFamily,
  color,
  fontSize = 16,
  pageBounds,
  isEditable = true,
  mode = 'text',
  onAddItem,
  onTextEditStart,
  onTextEditEnd,
  currentUser,
  getUserColor,
  remotePresence,
  currentUserId,
  onCursorChange,
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      // Update pageBounds if needed
    }
  }, []);

  const handleCanvasClick = (e) => {
    if (e.target === canvasRef.current || e.target.classList.contains('page-canvas-area')) {
      if (isEditable && onAddItem && mode && mode !== 'select') {
        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        onAddItem(mode, { x, y });
        return;
      }
      onSelect(null);
    }
  };

  const updateItem = (id, updates) => {
    const updatedContent = content.map((item) =>
      item.id === id
        ? (() => {
            if (item.type === 'text' && typeof updates.text === 'string') {
              const username = currentUser?.username;
              if (!username) {
                return { ...item, ...updates };
              }
              const prevText = item.text || '';
              const nextText = updates.text;
              const prevSegments = Array.isArray(item.segments) ? item.segments : [];
              let nextSegments = prevSegments;
              if (nextText !== prevText) {
                const appended = prevText && nextText.startsWith(prevText)
                  ? nextText.slice(prevText.length)
                  : null;
                const userColor = getUserColor ? getUserColor(username) : '#F4E4A8';
                if (appended && appended.length) {
                  const last = prevSegments[prevSegments.length - 1];
                  if (last && last.username === username) {
                    nextSegments = [
                      ...prevSegments.slice(0, -1),
                      { ...last, text: `${last.text}${appended}` },
                    ];
                  } else {
                    nextSegments = [
                      ...prevSegments,
                      { username, color: userColor, text: appended, timestamp: Date.now() },
                    ];
                  }
                } else {
                  nextSegments = [
                    { username, color: userColor, text: nextText, timestamp: Date.now() },
                  ];
                }
              }
              return { ...item, ...updates, segments: nextSegments };
            }
            return { ...item, ...updates };
          })()
        : item
    );
    onContentUpdate(updatedContent);
  };

  const deleteItem = (id) => {
    const updatedContent = content.filter((item) => item.id !== id);
    onContentUpdate(updatedContent);
    onSelect(null);
  };

  const getPageBounds = () => {
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      return {
        width: rect.width,
        height: rect.height,
      };
    }
    return pageBounds || { width: 400, height: 500 };
  };

  return (
    <div
      ref={canvasRef}
      className="w-full h-full relative overflow-hidden page-canvas-area"
      onClick={handleCanvasClick}
      style={{
        padding: 0,
        boxSizing: 'border-box',
      }}
    >
      {content.map((item) => {
        const bounds = getPageBounds();
        const isSelected = selectedId === item.id;
        
        // Ensure item stays within bounds
        const minWidth =
          item.type === 'framedImage' ? 80 : item.type === 'image' ? 50 : 50;
        const minHeight =
          item.type === 'framedImage' ? 120 : item.type === 'image' ? 50 : 30;

        const constrainedItem = {
          ...item,
          x: Math.max(0, Math.min(item.x, bounds.width - item.width)),
          y: Math.max(0, Math.min(item.y, bounds.height - item.height)),
          width: Math.max(minWidth, Math.min(item.width, bounds.width - item.x)),
          height: Math.max(minHeight, Math.min(item.height, bounds.height - item.y)),
        };

        if (constrainedItem.type === 'text') {
          return (
            <TextBlock
              key={constrainedItem.id}
              id={constrainedItem.id}
              x={constrainedItem.x}
              y={constrainedItem.y}
              width={constrainedItem.width}
              height={constrainedItem.height}
              text={constrainedItem.text}
              segments={constrainedItem.segments}
              fontFamily={constrainedItem.fontFamily || fontFamily}
              color={constrainedItem.color || color}
              fontSize={constrainedItem.fontSize || fontSize}
              onUpdate={(updates) => updateItem(constrainedItem.id, updates)}
              onDelete={() => deleteItem(constrainedItem.id)}
              isSelected={isSelected}
              pageBounds={bounds}
              onSelect={() => onSelect(constrainedItem.id)}
              onEditStart={() => onTextEditStart?.(constrainedItem.id)}
              onEditEnd={() => onTextEditEnd?.(constrainedItem.id)}
              onCursorChange={(payload) => onCursorChange?.(payload)}
              remotePresence={remotePresence?.[constrainedItem.id]}
              currentUserId={currentUserId}
            />
          );
        } else if (constrainedItem.type === 'sticker') {
          return (
            <Sticker
              key={constrainedItem.id}
              id={constrainedItem.id}
              x={constrainedItem.x}
              y={constrainedItem.y}
              width={constrainedItem.width}
              height={constrainedItem.height}
              stickerId={constrainedItem.stickerId}
              src={constrainedItem.src}
              onUpdate={(updates) => updateItem(constrainedItem.id, updates)}
              onDelete={() => deleteItem(constrainedItem.id)}
              isSelected={isSelected}
              pageBounds={bounds}
              onSelect={() => onSelect(constrainedItem.id)}
            />
          );
        } else if (constrainedItem.type === 'image') {
          return (
            <ImageBlock
              key={constrainedItem.id}
              id={constrainedItem.id}
              x={constrainedItem.x}
              y={constrainedItem.y}
              width={constrainedItem.width}
              height={constrainedItem.height}
              src={constrainedItem.src}
              onUpdate={(updates) => updateItem(constrainedItem.id, updates)}
              onDelete={() => deleteItem(constrainedItem.id)}
              isSelected={isSelected}
              pageBounds={bounds}
              onSelect={() => onSelect(constrainedItem.id)}
            />
          );
        } else if (constrainedItem.type === 'framedImage') {
          return (
            <FramedImageBlock
              key={constrainedItem.id}
              id={constrainedItem.id}
              x={constrainedItem.x}
              y={constrainedItem.y}
              width={constrainedItem.width}
              height={constrainedItem.height}
              imageSrc={constrainedItem.imageSrc || constrainedItem.src}
              frameSrc={constrainedItem.frameSrc}
              frameInset={constrainedItem.frameInset}
              onUpdate={(updates) => updateItem(constrainedItem.id, updates)}
              onDelete={() => deleteItem(constrainedItem.id)}
              isSelected={isSelected}
              pageBounds={bounds}
              onSelect={() => onSelect(constrainedItem.id)}
            />
          );
        }
        return null;
      })}
    </div>
  );
}
