import { motion, AnimatePresence } from "framer-motion";
import { Scan, Crosshair, RefreshCw, X } from "lucide-react";
import type { Hit } from "@/convex/objectScan";
import type { LiveDetection } from "@/hooks/use-object-detection";
import { cn } from "@/lib/utils";

interface ObjectScanProps {
  hit: Hit | null;
  accent: string;
  pending: boolean;
  canScan: boolean;
  cooldown: number;
  onDismiss: () => void;
  onRescan: () => void;
  allDetections?: LiveDetection[];
}

export function ObjectScan({
  hit,
  accent,
  pending,
  canScan,
  cooldown,
  onDismiss,
  onRescan,
  allDetections = [],
}: ObjectScanProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[20] flex items-start justify-end">
      <div className="flex h-full w-80 flex-col gap-2 overflow-hidden p-3 pt-14">
        {/* Scan status bar */}
        {canScan && (
          <ScanStatusBar pending={pending} cooldown={cooldown} accent={accent} onRescan={onRescan} />
        )}

        {/* Live detections list (before enrichment) */}
        {!hit && !pending && allDetections.length > 0 && canScan && (
          <LiveDetectionsList detections={allDetections} accent={accent} />
        )}

        {/* Enriched scan result panel */}
        <AnimatePresence>
          {hit && (
            <motion.div
              key="scan-result"
              initial={{ opacity: 0, x: 40, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.96 }}
              transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
              className="pointer-events-auto flex flex-col gap-2 overflow-y-auto rounded-sm border bg-[#02060d]/80 p-3 backdrop-blur-md"
              style={{ borderColor: `${accent}44` }}
            >
              {/* Header */}
              <div className="flex items-center gap-2">
                <Scan className="size-4 shrink-0" style={{ color: accent }} />
                <span
                  className="font-display text-xs font-semibold tracking-[0.2em]"
                  style={{ color: accent }}
                >
                  PHANES SCAN
                </span>
                <span className="ml-auto font-mono text-[9px] text-white/40">
                  {hit.source === "exact" ? "EXACT MATCH" : "GENERIC"}
                </span>
                <button
                  onClick={onDismiss}
                  className="ml-1 rounded-sm p-0.5 transition-colors hover:bg-white/10"
                >
                  <X className="size-3 text-white/40 hover:text-white/70" />
                </button>
              </div>

              {/* Divider */}
              <div className="h-px" style={{ background: `linear-gradient(90deg, ${accent}66, transparent)` }} />

              {/* Object identification */}
              <div>
                <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">
                  IDENTIFIED
                </span>
                <h3
                  className="mt-0.5 font-display text-sm font-semibold"
                  style={{ color: accent }}
                >
                  {hit.label}
                </h3>
                {hit.description && (
                  <p className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-white/65">
                    {hit.description}
                  </p>
                )}
              </div>

              {/* Price */}
              {hit.price && (
                <div
                  className="flex items-center gap-2 rounded-sm border px-2 py-1.5"
                  style={{
                    borderColor: `${accent}33`,
                    backgroundColor: `${accent}08`,
                  }}
                >
                  <span className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: `${accent}aa` }}>
                    PRICE
                  </span>
                  <span className="font-mono text-sm font-semibold" style={{ color: accent }}>
                    {hit.price}
                  </span>
                </div>
              )}

              {/* Confidence bar */}
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">
                    CONFIDENCE
                  </span>
                  <div className="relative flex-1 overflow-hidden rounded-full bg-white/5 px-1.5 py-0.5">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${hit.confidence * 100}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{ backgroundColor: `${accent}40` }}
                    />
                    <span className="relative z-10 font-mono text-[9px] text-white/80">
                      {Math.round(hit.confidence * 100)}%
                    </span>
                  </div>
                </div>

                {/* Source URL */}
                {hit.url && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">
                      SOURCE
                    </span>
                    <a
                      href={hit.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto max-w-[160px] truncate font-mono text-[9px] underline underline-offset-2 transition-colors hover:text-white"
                      style={{ color: `${accent}cc` }}
                    >
                      {new URL(hit.url).hostname}
                    </a>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────── */

function ScanStatusBar({
  pending,
  cooldown,
  accent,
  onRescan,
}: {
  pending: boolean;
  cooldown: number;
  accent: string;
  onRescan: () => void;
}) {
  return (
    <div
      className="flex items-center gap-2 rounded-sm border px-2 py-1.5 backdrop-blur-sm"
      style={{
        borderColor: `${accent}33`,
        backgroundColor: "#02060d66",
      }}
    >
      <Crosshair className="size-3.5 shrink-0" style={{ color: accent }} />
      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/50">
        {pending ? "SCANNING…" : cooldown > 0 ? `COOLDOWN ${Math.ceil(cooldown / 1000)}s` : "SCAN READY"}
      </span>
      {!pending && cooldown === 0 && (
        <button
          onClick={onRescan}
          className="ml-auto rounded-sm p-0.5 transition-colors hover:bg-white/10"
        >
          <RefreshCw className="size-3" style={{ color: accent }} />
        </button>
      )}
      {pending && (
        <div className="ml-auto flex gap-0.5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="size-1 rounded-full"
              style={{ backgroundColor: accent }}
              animate={{ opacity: [0.2, 1, 0.2] }}
              transition={{ duration: 0.8, delay: i * 0.15, repeat: Infinity }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LiveDetectionsList({
  detections,
  accent,
}: {
  detections: LiveDetection[];
  accent: string;
}) {
  return (
    <div
      className="flex flex-col gap-1 rounded-sm border p-2 backdrop-blur-sm"
      style={{
        borderColor: `${accent}22`,
        backgroundColor: "#02060d55",
      }}
    >
      <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-white/30">
        LIVE DETECTIONS ({detections.length})
      </span>
      {detections.slice(0, 4).map((d, i) => (
        <div
          key={`${d.label}-${i}`}
          className="flex items-center gap-1.5 rounded-sm px-1.5 py-0.5"
          style={{ backgroundColor: i === 0 ? `${accent}10` : "transparent" }}
        >
          <div
            className="size-1.5 rounded-full"
            style={{
              backgroundColor: accent,
              opacity: i === 0 ? 1 : 0.5,
            }}
          />
          <span
            className="flex-1 truncate font-mono text-[9px]"
            style={{ color: i === 0 ? accent : "rgba(255,255,255,0.5)" }}
          >
            {d.label.toUpperCase()}
          </span>
          <span className="font-mono text-[8px] text-white/30">
            {Math.round(d.confidence * 100)}%
          </span>
        </div>
      ))}
    </div>
  );
}
