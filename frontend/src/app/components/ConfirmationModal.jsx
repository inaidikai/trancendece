import React from "react";

function RemoveButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="bg-gradient-to-b from-[#f4e4a8] h-[38.5px] relative rounded-[8px] shrink-0 to-[#e8d58f] w-[76.688px] cursor-pointer transition-transform hover:scale-105 active:scale-95"
    >
      <div
        aria-hidden="true"
        className="absolute border-2 border-[#c9b675] border-solid inset-0 pointer-events-none rounded-[8px]"
        style={{ boxShadow: "0px 4px 0px rgba(197,193,176,0.6)" }}
      />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="-translate-x-1/2 absolute font-['Baloo_Thambi_2',sans-serif] leading-[22.5px] left-[38.5px] not-italic text-[#402f2d] text-[15px] text-center top-[9.5px]">
          Remove
        </p>
      </div>
    </button>
  );
}

function CancelButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="bg-gradient-to-b from-[#8a7b79] h-[38.5px] relative rounded-[8px] shrink-0 to-[#6b5b59] w-[71.836px] cursor-pointer transition-transform hover:scale-105 active:scale-95"
    >
      <div
        aria-hidden="true"
        className="absolute border-2 border-[#4a3c3a] border-solid inset-0 pointer-events-none rounded-[8px]"
        style={{ boxShadow: "0px 4px 0px rgba(197,193,176,0.6)" }}
      />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="-translate-x-1/2 absolute font-['Baloo_Thambi_2',sans-serif] leading-[22.5px] left-[36px] not-italic text-[#f8f8f8] text-[15px] text-center top-[9.5px]">
          Cancel
        </p>
      </div>
    </button>
  );
}

export default function ConfirmationModal({ isOpen, onConfirm, onCancel }) {
  if (!isOpen) return null;

  return (
    <>
      <div
        aria-hidden="true"
        onClick={onCancel}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 900,
          background: "transparent",
        }}
      />
      <div className="fixed bottom-[140px] left-1/2 -translate-x-1/2 z-[1000] pointer-events-auto">
        <div className="relative w-[260px] rounded-[12px] border-[2px] border-[#C5C1B0] bg-[#FFFAE8] shadow-[0_8px_20px_rgba(0,0,0,0.25)] px-[12px] py-[10px]">
          <div className="flex flex-col items-center justify-center gap-[8px]">
            <p className="font-['Baloo_Thambi_2',sans-serif] text-[#402f2d] text-[18px] text-center">
              Remove this page?
            </p>

            <div className="flex gap-[10px]">
              <RemoveButton onClick={onConfirm} />
              <CancelButton onClick={onCancel} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
