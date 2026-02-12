import React from "react";

const HANDLE_SIZE = 12;

export default function PageOverlay({
  index,
  side,
  blocks,
  active,
  activeTool,
  selectedBlock,
  onPagePointerDown,
  onBlockSelect,
  onStartDrag,
  onTextChange,
  onDeleteBlock,
  registerContentRef,
}) {
  const isSideActive = active?.index === index && active?.side === side;
  const overlayClass = side === "back" ? "left-overlay" : "right-overlay";
  const pageCursor =
    activeTool === "text" ? "text" : activeTool === "select" ? "default" : "crosshair";

  const handleBlockSelect = (blockId, event) => {
    if (event) {
      event.stopPropagation();
    }
    onBlockSelect?.(index, side, blockId);
  };

  const handleMoveStart = (blockId, event, allowDrag = true) => {
    if (event) {
      event.stopPropagation();
    }

    onBlockSelect?.(index, side, blockId);
    onStartDrag?.(event, index, side, blockId, "move");
  };

  const handleResizeStart = (blockId, event) => {
    if (event) {
      event.stopPropagation();
    }
    onStartDrag?.(event, index, side, blockId, "resize");
  };

  const renderBlocks = () =>
    (blocks || []).map((block) => {
      const isSelected =
        selectedBlock?.index === index &&
        selectedBlock?.side === side &&
        selectedBlock?.id === block.id;

      const baseStyle = {
        left: `${block.x}px`,
        top: `${block.y}px`,
        width: `${block.w}px`,
        height: `${block.h}px`,
      };

      const showHandles = isSelected;

      const wrapperClass = `absolute rounded-md ${
        isSelected ? "ring-2 ring-emerald-400" : "ring-1 ring-transparent"
      }`;

      if (block.type === "text") {
        const isTextEditable = activeTool === "text";

        return (
          <div
            key={block.id}
            data-block-id={block.id}
            className={wrapperClass}
            style={baseStyle}
            onPointerDown={(event) => {
              const isTextTarget = event.target.closest('[data-role="text"]');
              if (isTextTarget) {
                handleBlockSelect(block.id, event);
                return;
              }
              handleMoveStart(block.id, event, true);
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
                handleBlockSelect(block.id);
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
                  onPointerDown={(event) => handleMoveStart(block.id, event, true)}
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
                  onPointerDown={(event) => handleResizeStart(block.id, event)}
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
              />
            </div>
            <img
              src={block.frameSrc || "/assets/frame.png"}
              alt="Frame"
              className="absolute inset-0 w-full h-full pointer-events-none select-none shadow-[0_3px_6px_rgba(0,0,0,0.12)] z-0"
              draggable={false}
            />
          </div>
        ) : block.type === "image" ? (
          <img
            src={block.src}
            alt="Uploaded"
            className="w-full h-full object-contain"
            draggable={false}
          />
        ) : (
          <img
            src={block.src}
            alt="Sticker"
            className="w-full h-full object-contain"
            draggable={false}
          />
        );

      return (
        <div
          key={block.id}
          data-block-id={block.id}
          className={`${wrapperClass} cursor-move`}
          style={baseStyle}
          onPointerDown={(event) => handleMoveStart(block.id, event, true)}
        >
          <div
            className="w-full h-full flex items-center justify-center"
            onClick={(event) => handleBlockSelect(block.id, event)}
          >
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
                onPointerDown={(event) => handleResizeStart(block.id, event)}
              />
            </>
          )}
        </div>
      );
    });

  return (
    <div className={overlayClass}>
      <div
        ref={(element) => registerContentRef?.(index, side, element)}
        className="page-editor"
        style={{ cursor: pageCursor }}
        onPointerDown={(event) => onPagePointerDown?.(event, index, side)}
      >
        {renderBlocks()}
      </div>
    </div>
  );
}
