import { Bot, LogOut } from "lucide-react";
import type { FeedMode } from "@/hooks/use-scene";
import type { OcrStatus } from "@/hooks/use-ocr";
import type { NetworkInfo } from "@/lib/ai";
import { formatLatLng } from "@/lib/geo";
import { cn } from "@/lib/utils";

interface HudChromeProps {
  feed: FeedMode;
  lat: number | null;
  lng: number | null;
  heading: number;
  network: NetworkInfo | null;
  captureCount: number;
  accent: string;
  layerCode: string;
  layerName: string;
  ocrStatus: OcrStatus;
  time: string;
  aiOpen: boolean;
  onToggleAi: () => void;
  onExit: () => void;
}

export function HudChrome({
  feed,
  lat,
  lng,
  heading,
  network,
  captureCount,
  accent,
  layerCode,
  layerName,
  ocrStatus,
  time,
  aiOpen,
  onToggleAi,
  onExit,
}: HudChromeProps) {
  const feedLabel = feed === "camera" ? "CAM" : feed === "synthetic" ? "SIM" : "OFF";
  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {/* scanlines */}
      <div className="hud-scanlines absolute inset-0" />
      {/* vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)",
        }}
      />
      {/* corner brackets */}
      <Corner className="left-3 top-12 border-l-2 border-t-2" />
      <Corner className="right-3 top-12 border-r-2 border-t-2" />
      <Corner className="bottom-24 left-3 border-b-2 border-l-2" />
      <Corner className="bottom-24 right-3 border-b-2 border-r-2" />

      {/* top status bar */}
      <div className="absolute inset-x-0 top-0 flex h-11 items-center justify-between border-b border-white/10 bg-[#02060d]/70 px-4 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm leading-none" style={{ color: accent }}>
              ◈
            </span>
            <span className="font-display text-sm font-semibold tracking-[0.25em] text-white">
              PHANES
            </span>
            <span className="hud-label">Focus</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="relative flex size-1.5">
              <span
                className="absolute inline-flex size-full animate-ping rounded-full opacity-60"
                style={{ backgroundColor: accent }}
              />
              <span
                className="relative inline-flex size-1.5 rounded-full"
                style={{ backgroundColor: accent }}
              />
            </span>
            <span className="hud-label">Online</span>
          </div>
          <button
            type="button"
            onClick={onToggleAi}
            className="hud-label pointer-events-auto flex cursor-pointer items-center gap-1 rounded-sm border border-white/10 px-2 py-1 transition-colors hover:border-white/30"
          >
            <Bot className="size-3" style={{ color: accent }} />
            {aiOpen ? "Hide AI" : "AI"}
          </button>
          <span className="hud-label rounded-sm border border-white/10 px-2 py-1">
            {feedLabel}
          </span>
          <span
            className={cn(
              "hud-label hidden rounded-sm border border-white/10 px-2 py-1 md:inline",
              ocrStatus === "offline" && "text-red-400/80",
            )}
          >
            OCR {ocrStatus === "ready" ? "RDY" : ocrStatus === "loading" ? "INIT" : ocrStatus === "offline" ? "OFF" : "STBY"}
          </span>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <span className="hud-label">
            {lat !== null && lng !== null ? formatLatLng(lat, lng) : "POS ACQUIRING"}
          </span>
          <span className="hud-label" style={{ color: accent }}>
            HDG {Math.round(heading).toString().padStart(3, "0")}°
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="hud-label hidden sm:inline">
            {network?.type ? network.type.toUpperCase() : "NET --"}
          </span>
          <span className="hud-label hidden sm:inline">
            {network?.downlink ? `${network.downlink.toFixed(1)} Mb/s` : ""}
          </span>
          <span className="hud-label" style={{ color: accent }}>
            {layerCode} · {layerName.toUpperCase()}
          </span>
          <span className="hud-label">{time}</span>
          <span className="hud-label hidden sm:inline">CAP {captureCount}</span>
          <button
            type="button"
            onClick={onExit}
            className="hud-label pointer-events-auto flex cursor-pointer items-center gap-1 rounded-sm border border-white/10 px-2 py-1 text-red-300/70 transition-colors hover:border-red-400/40 hover:text-red-300"
          >
            <LogOut className="size-3" />
            Exit
          </button>
        </div>
      </div>
    </div>
  );
}

function Corner({ className }: { className: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute size-10 border-white/25 transition-colors",
        className,
      )}
    />
  );
}