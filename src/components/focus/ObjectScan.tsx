import { motion } from "framer-motion";
import { Scan } from "lucide-react";
import type { Hit } from "@/convex/objectScan";
import { cn } from "@/lib/utils";

interface ObjectScanProps {
  hit: Hit | null;
  accent: string;
}

export function ObjectScan({ hit, accent }: ObjectScanProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-start justify-end gap-3">
      <div className="flex h-full w-72 flex-col overflow-hidden">
        <ObjectScanPanel hit={hit} accent={accent} />
      </div>
    </div>
  );
}

function ObjectScanPanel({ hit, accent }: ObjectScanProps) {
  if (!hit) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 40, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40, scale: 0.98 }}
      className="pointer-events-none flex h-full flex-col gap-2"
    >
      <div
        className="pointer-events-auto flex h-full flex-col gap-2 overflow-hidden rounded-sm border border-white/10 bg-[#02060d]/75 p-3 backdrop-blur-sm"
        style={{ borderColor: `${accent}44` }}
      >
        <div className="flex items-center gap-2">
          <Scan className="size-4 shrink-0" style={{ color: accent }} />
          <span className="font-display text-xs font-semibold tracking-[0.2em] text-white">
            SCAN
          </span>            <span className="ml-auto font-mono text-[9px] text-white/40">
            SNAP {hit.source === "exact" ? "EXACT" : "GENERIC"}
          </span>
        </div>

        <div className="flex flex-col gap-2 overflow-y-auto">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">
                OBJECT
              </span>                     {hit.source === "exact" ? (
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
      </div>
    </motion.div>
  );
}
