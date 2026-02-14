import React from 'react';
import PageCanvas from './PageCanvas';
import BottomToolDock from "../components/editor/BottomToolDock";

export default function ZoomEditMode({
  pageIndex,
  side,
  content,
  onContentUpdate,
  selectedId,
  onSelect,
  fontFamily,
  color,
  fontSize,
  onClose,
  pageBounds,
  mode,
  onAddItem,
  toolbar,
  bottomToolProps = {},
  stickerPopover = null,
  uploadInputRef,
  onUploadChange,
  onTextEditStart,
  onTextEditEnd,
  currentUser,
  getUserColor,
  remotePresence,
  currentUserId,
  onCursorChange,
}) {
  const resolvedPageWidth = pageBounds?.width || 400;
  const resolvedPageHeight = pageBounds?.height || 500;

  return (
    <div className="fixed inset-0 bg-[#3B2A28] z-50 flex items-center justify-center p-2 sm:p-4 md:p-8">
      <div className="relative w-full max-w-[1320px]">
        <button
          onClick={onClose}
          aria-label="Back to Book"
          className="absolute -top-3 -left-3 sm:-top-[18px] sm:-left-[18px] z-10 h-9 w-9 sm:h-11 sm:w-11 rounded-full bg-[#FFFAE8] border border-[#4A3C3A] text-[#4A3C3A] text-lg sm:text-xl font-bold shadow-[0_3px_0_rgba(197,193,176,0.6)] transition-transform hover:scale-105"
        >
          ←
        </button>

        <div
          className="relative editor-shell w-[1261px] max-w-[calc(100vw-16px)] sm:max-w-[calc(100vw-32px)] h-[calc(100dvh-20px)] sm:h-[calc(100dvh-64px)] max-h-[960px] bg-white rounded-[10px] overflow-visible px-3 sm:px-[30px] pt-3 sm:pt-[26px] pb-[122px] sm:pb-[140px] md:pb-[153px] flex flex-col"
          style={{
            "--page-width": `${resolvedPageWidth}px`,
            "--page-height": `${resolvedPageHeight}px`,
            "--page-half": `${resolvedPageWidth / 2}px`,
            "--sticker-width": "min(320px, calc(100vw - 24px))",
            "--sticker-gap": "14px",
            "--sticker-shift": "140px",
            "--toolbar-top": "34px",
          }}
        >
        {toolbar && (
          <div className="w-full mt-1 mb-3 sm:mb-6 px-1 sm:px-[28px]">
            {toolbar}
          </div>
        )}

          <div className="flex-1 min-h-0 flex items-start sm:items-center justify-center pb-4 sm:pb-8">
            <div
              className="relative w-full max-h-full flex items-start justify-center"
            >
              <div
                className="bg-white mx-auto rounded-[8px] shadow-[0_10px_30px_rgba(0,0,0,0.18)]"
                style={{
                  width: `min(100%, ${resolvedPageWidth}px)`,
                  aspectRatio: `${resolvedPageWidth} / ${resolvedPageHeight}`,
                  position: 'relative',
                }}
              >
              <PageCanvas
                content={content}
                onContentUpdate={onContentUpdate}
                selectedId={selectedId}
                onSelect={onSelect}
                fontFamily={fontFamily}
                color={color}
                fontSize={fontSize}
                pageBounds={pageBounds}
                isEditable={true}
                mode={mode}
                onAddItem={onAddItem}
                onTextEditStart={onTextEditStart}
                onTextEditEnd={onTextEditEnd}
                currentUser={currentUser}
                getUserColor={getUserColor}
                remotePresence={remotePresence}
                currentUserId={currentUserId}
                onCursorChange={onCursorChange}
              />
              </div>
              {stickerPopover}
            </div>
          </div>
        </div>
      </div>
      <BottomToolDock {...bottomToolProps} />
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/png,image/jpeg"
        onChange={onUploadChange}
        className="hidden"
      />
    </div>
  );
}
