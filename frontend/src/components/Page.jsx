import React from "react";

const HANDLE_SIZE = 12;

export default function Page({
  index,
  totalPages = 0,
  current,
  frontBlocks,
  backBlocks,
  pageBounds,
  active,
  activeTool,
  selectedBlock,
  onPagePointerDown,
  onBlockSelect,
  onStartDrag,
  onTextChange,
  onDeleteBlock,
  registerContentRef,
  isDeleting,
}) {
  const flipped = index < current;
  const isActiveSpread = index === current || index === current - 1;
  const isCurrentPage = index === current;
  const isLeftPage = index === current - 1;
  const isNearCurrent = Math.abs(index - current) <= 2;

  const isFrontActive = active?.index === index && active?.side === "front";
  const isBackActive = active?.index === index && active?.side === "back";

  const maxLayer = Math.max(totalPages + 50, 200);
  const zIndex = flipped ? index + 1 : maxLayer - index;
  const pageCursor =
    activeTool === "text" ? "text" : activeTool === "select" ? "default" : "crosshair";

  const handleBlockSelect = (side, blockId, event) => {
    if (event) {
      event.stopPropagation();
    }
    onBlockSelect?.(index, side, blockId);
  };

  const handleMoveStart = (side, blockId, event, allowDrag = true) => {
    if (event) {
      event.stopPropagation();
    }

    if (!allowDrag || !(active?.index === index && active?.side === side)) {
      onBlockSelect?.(index, side, blockId);
      return;
    }

    onBlockSelect?.(index, side, blockId);
    onStartDrag?.(event, index, side, blockId, "move");
  };

  const handleResizeStart = (side, blockId, event) => {
    if (event) {
      event.stopPropagation();
    }
    if (!(active?.index === index && active?.side === side)) {
      onBlockSelect?.(index, side, blockId);
      return;
    }
    onStartDrag?.(event, index, side, blockId, "resize");
  };

  const getSafeRect = (block) => {
    const rawX = Number.isFinite(block.x) ? block.x : 0;
    const rawY = Number.isFinite(block.y) ? block.y : 0;
    const rawWidth = Number.isFinite(block.w)
      ? block.w
      : Number.isFinite(block.width)
        ? block.width
        : 120;
    const rawHeight = Number.isFinite(block.h)
      ? block.h
      : Number.isFinite(block.height)
        ? block.height
        : 80;

    const boundsWidth = pageBounds?.width;
    const boundsHeight = pageBounds?.height;

    if (!Number.isFinite(boundsWidth) || !Number.isFinite(boundsHeight)) {
      return {
        x: rawX,
        y: rawY,
        width: rawWidth,
        height: rawHeight,
      };
    }

    const minWidth =
    block.type === "sticker"
      ? 30
      : block.type === "image" || block.type === "framedImage"
        ? 50
        : 50;
    const minHeight =
    block.type === "sticker"
      ? 30
      : block.type === "image" || block.type === "framedImage"
        ? 50
        : 30;

    const safeX = Math.max(0, Math.min(rawX, boundsWidth - rawWidth));
    const safeY = Math.max(0, Math.min(rawY, boundsHeight - rawHeight));
    const safeWidth = Math.max(minWidth, Math.min(rawWidth, boundsWidth - rawX));
    const safeHeight = Math.max(minHeight, Math.min(rawHeight, boundsHeight - rawY));

    return {
      x: safeX,
      y: safeY,
      width: safeWidth,
      height: safeHeight,
    };
  };

  const renderBlocks = (blocks, side, isSideActive) =>
    (blocks || []).map((block) => {
      const isBackSide = side === "back";
      const contentFlip = isBackSide ? "scaleX(-1)" : "none";
      const isSelected =
        selectedBlock?.index === index &&
        selectedBlock?.side === side &&
        selectedBlock?.id === block.id;

      const safeRect = getSafeRect(block);
      const baseStyle = {
        left: `${safeRect.x}px`,
        top: `${safeRect.y}px`,
        width: `${safeRect.width}px`,
        height: `${safeRect.height}px`,
      };

      const showHandles = isSelected && isSideActive;

      const wrapperClass = `absolute rounded-md ${
        isSelected ? "ring-2 ring-emerald-400" : "ring-1 ring-transparent"
      }`;

      if (block.type === "text") {
        const isTextEditable = isSideActive && activeTool === "text";

        return (
          <div
            key={block.id}
            data-block-id={block.id}
            className={wrapperClass}
            style={baseStyle}
            onPointerDown={(event) => {
              const isTextTarget = event.target.closest('[data-role="text"]');
              if (isTextTarget) {
                handleBlockSelect(side, block.id, event);
                return;
              }
              handleMoveStart(side, block.id, event, true);
            }}
          >
            <div
              data-role="text"
              dir="ltr"
              contentEditable={isTextEditable}
              suppressContentEditableWarning
              className="w-full h-full p-2 outline-none whitespace-pre-wrap break-words"
              style={{
                fontFamily: block.font,
                color: block.color,
                fontSize: `${block.fontSize || 16}px`,
                cursor: isTextEditable ? "text" : "default",
                transform: contentFlip,
                transformOrigin: "center",
                direction: "ltr",
                unicodeBidi: "plaintext",
                textAlign: "left",
              }}
              onInput={(event) => {
                if (!isTextEditable) return;
                const nextText = event.currentTarget.textContent || "";
                onTextChange?.(index, side, block.id, nextText);
              }}
              onPointerDown={(event) => {
                event.stopPropagation();
                handleBlockSelect(side, block.id);
              }}
            >
              {block.text}
            </div>

            {showHandles && (
              <>
                <button
                  type="button"
                  aria-label="Move block"
                  className="absolute -top-3 left-2 h-5 w-5 rounded-full bg-emerald-500 text-white text-xs flex items-center justify-center cursor-move shadow"
                  onPointerDown={(event) => handleMoveStart(side, block.id, event, true)}
                >
                  M
                </button>
                <button
                  type="button"
                  aria-label="Delete block"
                  className="absolute -top-3 -right-3 h-6 w-6 rounded-full bg-rose-500 text-white text-sm flex items-center justify-center shadow"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    onDeleteBlock?.(index, side, block.id);
                  }}
                >
                  x
                </button>
                <button
                  type="button"
                  aria-label="Resize block"
                  className="absolute -bottom-2 -right-2 bg-emerald-500 shadow"
                  style={{
                    width: `${HANDLE_SIZE}px`,
                    height: `${HANDLE_SIZE}px`,
                    borderRadius: "3px",
                    cursor: "nwse-resize",
                  }}
                  onPointerDown={(event) => handleResizeStart(side, block.id, event)}
                />
              </>
            )}
          </div>
        );
      }

      const media =
        block.type === "framedImage" ? (
          <div className="relative w-full h-full">
            <div
              className="absolute overflow-hidden z-10"
              style={{
                top: "10%",
                left: "10%",
                right: "10%",
                bottom: "30%",
                background: "#fff",
              }}
            >
              <img
                src={block.imageSrc || block.src}
                alt="Uploaded"
                className="w-full h-full object-cover"
                draggable={false}
                style={{
                  transform: contentFlip,
                  transformOrigin: "center",
                }}
              />
            </div>
            <img
              src={block.frameSrc || "/assets/frame.png"}
              alt="Frame"
              className="absolute inset-0 w-full h-full pointer-events-none select-none shadow-[0_3px_6px_rgba(0,0,0,0.12)] z-0"
              draggable={false}
              style={{
                transform: contentFlip,
                transformOrigin: "center",
              }}
            />
          </div>
        ) : block.type === "image" ? (
          <img
            src={block.src}
            alt="Uploaded"
            className="w-full h-full object-contain"
            draggable={false}
            style={{
              transform: contentFlip,
              transformOrigin: "center",
            }}
          />
        ) : (
          <img
            src={block.src}
            alt="Sticker"
            className="w-full h-full object-contain"
            draggable={false}
            style={{
              transform: contentFlip,
              transformOrigin: "center",
            }}
          />
        );

      return (
        <div
          key={block.id}
          data-block-id={block.id}
          className={`${wrapperClass} cursor-move`}
          style={baseStyle}
          onPointerDown={(event) => handleMoveStart(side, block.id, event, true)}
        >
          <div className="w-full h-full flex items-center justify-center" onClick={(event) => handleBlockSelect(side, block.id, event)}>
            {media}
          </div>
          {showHandles && (
            <>
              <button
                type="button"
                aria-label="Delete block"
                className="absolute -top-3 -right-3 h-6 w-6 rounded-full bg-rose-500 text-white text-sm flex items-center justify-center shadow"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  onDeleteBlock?.(index, side, block.id);
                }}
              >
                x
              </button>
              <button
                type="button"
                aria-label="Resize block"
                className="absolute -bottom-2 -right-2 bg-emerald-500 shadow"
                style={{
                  width: `${HANDLE_SIZE}px`,
                  height: `${HANDLE_SIZE}px`,
                  borderRadius: "3px",
                  cursor: "nwse-resize",
                }}
                onPointerDown={(event) => handleResizeStart(side, block.id, event)}
              />
            </>
          )}
        </div>
      );
    });

  return (
    <div
      className={`page ${flipped ? "flipped" : ""} ${isCurrentPage ? "current" : ""} ${
        isNearCurrent ? "nearby" : ""
      } ${
        isDeleting ? "deleting" : ""
      }`}
      style={{
        zIndex,
        pointerEvents: isActiveSpread && !isDeleting ? "auto" : "none",
      }}
    >
      <div className="front-page">
        <div
          ref={(element) => registerContentRef?.(index, "front", element)}
          className="page-editor"
          style={{ cursor: pageCursor }}
          onPointerDown={(event) => onPagePointerDown?.(event, index, "front")}
        >
          {(isCurrentPage || isFrontActive) && renderBlocks(frontBlocks, "front", isFrontActive)}
        </div>
      </div>

      <div className="back-page">
        <div
          ref={(element) => registerContentRef?.(index, "back", element)}
          className="page-editor"
          style={{ cursor: pageCursor }}
          onPointerDown={(event) => onPagePointerDown?.(event, index, "back")}
        >
          {(isLeftPage || isBackActive) && renderBlocks(backBlocks, "back", isBackActive)}
        </div>
      </div>
    </div>
  );
}
