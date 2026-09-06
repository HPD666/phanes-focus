import { Camera, RefreshCw } from "lucide-react";
import type { FeedMode } from "@/hooks/use-scene";

interface CaptureButtonProps {
  capturing: boolean;
  accent: string;
  feed: FeedMode;
  onCapture: () => void;
  onToggleFeed: () => void;
}

export function CaptureButton({
  capturing,
  accent,
  feed,
  onCapture,
  onToggleFeed,
}: CaptureButtonProps) {
  return (
    <div className="pointer-events-auto absolute bottom-24 right-4 z-30 flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={onToggleFeed}
        title="Toggle camera / synthetic feed"
        className="hud-panel flex cursor-pointer items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-[0.15em] text-[#8fd0f5]/80 transition-colors hover:text-white"
      >
        <RefreshCw className="size-3" />
        {feed === "camera" ? "Cam" : feed === "synthetic" ? "Sim" : "Off"}
      </button>
      <button
        type="button"
        onClick={onCapture}
        disabled={capturing}
        title="Archive capture (History layer)"
        className="group relative flex size-[76px] cursor-pointer items-center justify-center rounded-full transition-transform active:scale-95 disabled:opacity-70"
        style={{
          boxShadow: `0 0 0 2px ${accent}55, 0 0 24px ${accent}33, inset 0 0 18px ${accent}22`,
        }}
      >
        {[
          "left-0 top-0 border-l-2 border-t-2",
          "right-0 top-0 border-r-2 border-t-2",
          "bottom-0 left-0 border-b-2 border-l-2",
          "bottom-0 right-0 border-b-2 border-r-2",
        ].map((pos) => (
          <span
            key={pos}
            className={`absolute size-4 ${pos}`}
            style={{ borderColor: accent }}
          />
        ))}
        <div
          className="flex size-14 flex-col items-center justify-center rounded-full transition-colors group-hover:bg-white/5"
          style={{
            border: `1px solid ${accent}66`,
          }}
        >
          {capturing ? (
            <span
              className="size-4 animate-ping rounded-full"
              style={{ backgroundColor: accent }}
            />
          ) : (
            <>
              <Camera className="size-5" style={{ color: accent }} />
              <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-white/80">
                Cap
              </span>
            </>
          )}
        </div>
      </button>
    </div>
  );
}