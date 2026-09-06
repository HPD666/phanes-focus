import { AnimatePresence, motion } from "framer-motion";
import { Scan, X } from "lucide-react";
import type { Hit } from "@/convex/objectScan";
import { cn } from "@/lib/utils";

interface ObjectScanProps {
  hit: Hit | null;
  accent: string;
  canScan: boolean;
  cooldown: number;
  onDismiss: () => void;
  onRescan: () => void;
}

export function ObjectScan({
  hit,
  accent,
  canScan,
  cooldown,
  onDismiss,
  onRescan,
}: ObjectScanProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <AnimatePresence>
        {hit && (
          <motion.div
            key="panel"
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
}: ObjectScanProps) {
  if (!hit) return null;

  return (
    <div
      className={cn(
        "pointer-events-auto flex h-full max-w-[320px] flex-col gap-2 overflow-hidden rounded-sm border border-white/10 bg-[#02060d]/75 p-4 backdrop-blur-sm",
        "md:absolute md:right-4 md:top-[88px] md:z-30 md:h-[min(70vh,620px)]"
      )}
      style={{ borderColor: `${accent}44` }}
    >
      {/* header */}
      <div className="flex items-center gap-2">
        <Scan className="size-4 shrink-0" style={{ color: accent }} />
        <span className="font-display text-xs font-semibold tracking-[0.2em] text-white">
          SCAN
        </span>
        <span className="ml-auto font-mono text-[9px] text-white/40">
          SNAP {hit.source === "exact" ? "EXACT" : "GENERIC"}
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
      <div className="flex flex-col gap-2 overflow-y-auto">
        {/* object name + match type */}
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">
              OBJECT
            </span>
            {hit.source === "exact" ? (
              <span className="ml-auto font-mono text-[9px] text-[#7dff9b]">
                EXACT
              </span>
            ) : (
              <span className="ml-auto font-mono text-[9px] text-[#ffb454]">
                GENERIC
              </span>
            )}
          </div>
          <h3 className="truncate font-display text-sm text-white">
            {hit.label}
          </h3>
          {hit.description && (
            <p className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-white/70">
              {hit.description}
            </p>
          )}
        </div>

        {/* price */}
        {hit.price && (
          <div className="flex items-center gap-2 rounded-sm border border-[#ffcf3f]/30 bg-[#ffcf3f]/5 px-2 py-1.5">
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#ffcf3f]/70">
              PRICE
            </span>
            <span className="font-mono text-sm text-[#ffcf3f]">
              {hit.price}
            </span>
          </div>
        )}

        {/* confidence + source */}
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">
              CONFIDENCE
            </span>
            <div className="flex max-w-[120px] flex-1 flex-row group relative overflow-hidden rounded-full bg-white/5 px-1.5 py-0.5">
              <div
                className="absolute inset-y-0 left-0 bg-white/15 transition-all duration-300"
                style={{
                  width: `${hit.confidence * 100}%`,
                  backgroundColor: accent,
                }}
              />
              <span className="relative z-10 font-mono text-[9px] text-white/80">
                {Math.round(hit.confidence * 100)}%
              </span>
            </div>
          </div>
          {hit.url && (
            <div className="mt-1 flex items-center gap-2">
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">
                SOURCE
              </span>
              <a
                href={hit.url}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto font-mono text-[9px] text-[#9fd4f2]/80 underline underline-offset-2 hover:text-white"
              >
                {hit.source}
              </a>
            </div>
          )}
        </div>
      </div>

      {/* actions */}
      <div className="mt-auto flex items-center gap-2 border-t border-white/10 pt-2">
        <button
          type="button"
          onClick={onRescan}
          disabled={!canScan || cooldown > 0}
          className="flex-1 hud-label cursor-pointer rounded-sm border border-white/10 py-1 text-[10px] font-mono uppercase tracking-[0.2em] transition-colors hover:border-white/30 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {cooldown > 0 ? `RESCAN ${Math.ceil(cooldown / 100)}s` : "RESCAN"}
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
