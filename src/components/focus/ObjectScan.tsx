import { AnimatePresence, motion } from "framer-motion";
import { Scan, X, Loader2 } from "lucide-react";
import type { Hit } from "@/convex/objectScan";
import { cn } from "@/lib/utils";

interface ObjectScanProps {
  hit: Hit | null;
  accent: string;
  canScan: boolean;
  cooldown: number;
  onDismiss: () => void;
  onRescan: () => void;
  pending?: boolean;
}

export function ObjectScan({
  hit,
  accent,
  canScan,
  cooldown,
  onDismiss,
  onRescan,
  pending = false,
}: ObjectScanProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <AnimatePresence>
        {(hit || pending) && (
          <motion.div
            key={hit ? "panel" : "pending"}
            initial={{ opacity: 0, x: 40, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
          >
            <ObjectScanPanel
              hit={hit}
              accent={accent}
              canScan={canScan}
              cooldown={cooldown}
              onDismiss={onDismiss}
              onRescan={onRescan}
              pending={pending}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ObjectScanPanel({
  hit,
  accent,
  canScan,
  cooldown,
  onDismiss,
  onRescan,
  pending,
}: ObjectScanProps) {
  if (!hit && !pending) return null;

  const exact = Boolean(hit?.source === "exact");
  const label = hit?.label ?? "";
  const description = hit?.description;
  const price = hit?.price;
  const url = hit?.url;
  const box = hit?.box;
  const confidence = hit?.confidence ?? 0;
  const matchTag = pending
    ? "ANALYZING FRAME"
    : exact
      ? "MATCH CONFIRMED"
      : "INFERENCE";

  return (
    <div
      className={cn(
        "pointer-events-auto flex h-full max-w-[340px] flex-col gap-3 overflow-hidden rounded-sm border border-white/10 bg-[#02060d]/80 p-4 backdrop-blur-sm",
        "md:absolute md:right-4 md:top-[92px] md:z-30 md:h-[min(70vh,640px)]"
      )}
      style={{ borderColor: `${accent}48` }}
    >
      {/* header */}
      <div className="flex items-center gap-2">
        <Scan className="size-4 shrink-0" style={{ color: accent }} />
        <span className="font-display text-xs font-semibold tracking-[0.2em] text-white">
          PHANES · OBJECT SCAN
        </span>
        <span
          className={cn(
            "ml-auto font-mono text-[9px] uppercase tracking-[0.2em]",
            pending
              ? "text-white/60 border border-white/15 bg-white/[0.04] px-1.5 py-0.5"
              : exact
                ? "text-[#7dff9b] border border-[#7dff9b]/30 bg-[#7dff9b]/8 px-1.5 py-0.5"
                : "text-[#ffb454] border border-[#ffb454]/30 bg-[#ffb454]/8 px-1.5 py-0.5"
          )}
        >
          {matchTag}
        </span>
        <button
          type="button"
          onClick={onDismiss}
          className="ml-2 hud-label cursor-pointer rounded-sm border border-white/10 px-1.5 py-0.5 text-white/60 transition-colors hover:border-white/30 hover:text-white flex items-center gap-1"
        >
          <X className="size-3" />
          <span className="text-[8px]">CLOSE</span>
        </button>
      </div>

      {/* body */}
      <div className="flex flex-col gap-3 overflow-y-auto">
        {pending ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" style={{ color: accent }} />
              <span className="hud-label">Reading frame…</span>
            </div>
            <p className="text-[11px] leading-relaxed text-white/70">
              Phanes extracts the dominant object from the live frame and looks it up.
            </p>
          </div>
        ) : (
          <>
            {/* object name + match type */}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">
                  PHANTOM ROW
                </span>
                {exact ? (
                  <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.2em] text-[#7dff9b]">
                    EXACT MATCH
                  </span>
                ) : (
                  <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.2em] text-[#ffb454]">
                    GENERIC CLASS
                  </span>
                )}
              </div>
              <h3 className="truncate font-display text-base text-white">
                {label}
              </h3>
              {description ? (
                <p className="mt-1 line-clamp-4 text-[11px] leading-relaxed text-white/70">
                  {description}
                </p>
              ) : (
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-white/30">
                  NO ENRICHMENT AVAILABLE
                </p>
              )}
            </div>

            {/* price */}
            {price && (
              <div className="flex items-center gap-2 rounded-sm border border-[#ffcf3f]/30 bg-[#ffcf3f]/6 px-2 py-1.5">
                <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#ffcf3f]/80">
                  PRICE
                </span>
                <span className="font-mono text-sm text-[#ffcf3f]">
                  {price}
                </span>
              </div>
            )}

            {/* confidence + optional source */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">
                  CONFIDENCE
                </span>
                <div className="flex max-w-[160px] flex-1 flex-row group relative overflow-hidden rounded-full bg-white/5 px-1.5 py-0.5">
                  <div
                    className="absolute inset-y-0 left-0 bg-white/15 transition-all duration-300"
                    style={{
                      width: `${confidence * 100}%`,
                      backgroundColor: exact ? "#7dff9b" : accent,
                    }}
                  />
                  <span className="relative z-10 font-mono text-[9px] text-white/80">
                    {Math.round(confidence * 100)}%
                  </span>
                </div>
              </div>

              {url ? (
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">
                    SOURCE
                  </span>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto font-mono text-[9px] text-[#9fd4f2]/80 underline underline-offset-2 hover:text-white truncate max-w-[200px]"
                  >
                    {url}
                  </a>
                </div>
              ) : null}
            </div>

            {/* bounding box note when present */}
            {box && (
              <div className="flex items-center gap-2 rounded-sm border border-white/10 bg-white/[0.02] px-2 py-1.5">
                <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">
                  LOCK
                </span>
                <span className="font-mono text-[10px] text-white/70">
                  BOX ACTIVE ·
                  {(box.x * 100).toFixed(0)}%,
                  {(box.y * 100).toFixed(0)}% ·
                  {(box.w * 100).toFixed(0)}×{(box.h * 100).toFixed(0)}%
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* actions */}
      <div className="mt-auto flex items-center gap-2 border-t border-white/10 pt-2">
        <button
          type="button"
          onClick={onRescan}
          disabled={!canScan || cooldown > 0 || pending}
          className="flex-1 hud-label cursor-pointer rounded-sm border border-white/10 py-1 text-[10px] font-mono uppercase tracking-[0.2em] transition-colors hover:border-white/30 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {cooldown > 0
            ? `SCAN TOOL READY · RESCAN IN ${Math.ceil(cooldown / 100)}s`
            : pending
              ? "BUSY"
              : "RESCAN LIVE FRAME"}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="hud-label cursor-pointer rounded-sm border border-white/10 px-2 py-1 text-[10px] font-mono uppercase tracking-[0.2em] transition-colors hover:border-white/30 hover:text-white"
        >
          DISMISS
        </button>
      </div>
    </div>
  );
}
