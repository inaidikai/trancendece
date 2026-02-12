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
  return (
    <div className="fixed inset-0 bg-[#3B2A28] z-50 flex items-center justify-center p-6 md:p-8">
      <div className="relative">
        <button
          onClick={onClose}
          aria-label="Back to Book"
          className="absolute -top-[18px] -left-[18px] z-10 h-11 w-11 rounded-full bg-[#FFFAE8] border border-[#4A3C3A] text-[#4A3C3A] text-xl font-bold shadow-[0_3px_0_rgba(197,193,176,0.6)] transition-transform hover:scale-105"
        >
          ←
        </button>

        <div
          className="relative editor-shell w-[1261px] max-w-[calc(100vw-48px)] h-[calc(100vh-120px)] min-h-[920px] bg-white rounded-[8px] overflow-visible px-[30px] pt-[26px] pb-[153px] flex flex-col"
          style={{
            "--page-width": `${pageBounds?.width || 400}px`,
            "--page-height": `${pageBounds?.height || 500}px`,
            "--page-half": `${(pageBounds?.width || 400) / 2}px`,
            "--sticker-width": "320px",
            "--sticker-gap": "14px",
            "--sticker-shift": "140px",
            "--toolbar-top": "34px",
          }}
        >
        {toolbar && (
          <div className="w-full mt-[8px] mb-6 px-[28px]">
            {toolbar}
          </div>
        )}

          <div className="flex-1 min-h-0 flex items-center justify-center pb-8">
            <div
              className="relative w-full flex items-start justify-center"
              style={{ height: pageBounds?.height || 500 }}
            >
              <div
                className="bg-white mx-auto rounded-[8px] shadow-[0_10px_30px_rgba(0,0,0,0.18)]"
                style={{
                  width: pageBounds?.width || 400,
                  height: pageBounds?.height || 500,
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
