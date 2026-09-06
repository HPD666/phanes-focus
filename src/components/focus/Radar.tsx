import { Radar, Wifi, Loader2 } from "lucide-react";
import type { FrameMetrics } from "@/lib/vision";
import { cn } from "@/lib/utils";

interface RadarProps {
  metrics: FrameMetrics | null;
  anomalies: { id: string; code: string; label: string; severity: number }[];
  accent: string;
}

export function Radar({ metrics, anomalies, accent }: RadarProps) {
  const live = metrics !== null;
  const activeSignal = live
    ? Math.min(1, (metrics.anomalyScore ?? 0) + metrics.motion)
    : 0;

  return (
    <div className="pointer-events-none absolute size-20 rounded-full border border-white/10 bg-[#02060d]/70 backdrop-blur-sm flex items-center justify-center">
      {/* sweep ring */}
      <svg
        className="pointer-events-none absolute inset-0"
        width="80"
        height="80"
        viewBox="0 0 80 80"
        aria-hidden="true"
      >
        <circle
          cx="40"
          cy="40"
          r="32"
          fill="none"
          stroke="rgba(120,200,255,0.12)"
          strokeWidth="1"
        />
        <circle
          cx="40"
          cy="40"
          r="20"
          fill="none"
          stroke="rgba(120,200,255,0.10)"
          strokeWidth="1"
        />
        <circle
          cx="40"
          cy="40"
          r="8"
          fill="none"
          stroke={cn("rgba(120,200,255,0.18)")}
          strokeWidth="1"
        />
        {/* rotating sweep */}
        <g>
          <circle
            cx="40"
            cy="40"
            r="34"
            fill="none"
            stroke={cn("rgba(120,200,255,0.18)")}
            strokeWidth="1.25"
            strokeDasharray="4 10"
            transform="rotate(0 40 40)"
            className="animate-spin"
            style={{ transformOrigin: "40px 40px", animationDuration: "8s" }}
          />
        </g>
        {/* live signal blob */}
        <circle
          cx="40"
          cy="40"
          r={8 + activeSignal * 6}
          fill={cn("rgba(120,200,255,0.10)")}
        />
        <circle
          cx="40"
          cy="40"
          r={4 + activeSignal * 3}
          fill={cn("rgba(120,200,255,0.35)")}
          style={{
            boxShadow: `0 0 12px ${accent}55`,
          }}
        />
      </svg>

      {/* center status */}
      <div className="flex flex-col items-center gap-1 text-white select-none">
        {live ? (
          <>
            <Radar className="size-3.5" style={{ color: accent }} />
            <span className="font-mono text-[8px] uppercase tracking-[0.18em] text-white/70">
              SIGNAL LIVE
            </span>
          </>
        ) : (
          <>
            <Loader2 className="size-3.5 animate-spin" style={{ color: accent }} />
            <span className="font-mono text-[8px] uppercase tracking-[0.18em] text-white/50">
              LISTENING
            </span>
          </>
        )}
      </div>

      {/* real bottom-left metric block */}
      {live && (
        <div className="pointer-events-auto absolute left-0.5 bottom-0.5 flex flex-col gap-0.5 rounded-sm bg-[#02060d]/90 px-1.5 py-1 backdrop-blur-sm">
          <div className="flex items-center gap-1">
            <Wifi className="size-2.5 shrink-0" style={{ color: accent }} />
            <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-white/60">
              EDGE{" "}
              {Math.round((metrics?.edgeDensity ?? 0) * 100)}%
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-[#7dff9b]/90" />
            <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-white/60">
              ANOM{" "}
              {Math.round((metrics?.anomalyScore ?? 0) * 100)}%
            </span>
          </div>
        </div>
      )}

      {/* real top-right anomaly hint */}
      {live && anomalies.length > 0 && (
        <div className="pointer-events-auto absolute -top-0.5 right-0.5 flex flex-col gap-0.5 rounded-sm bg-[#02060d]/90 px-1.5 py-1 backdrop-blur-sm">
          <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-[#ff5d6c]/80">
            ANOMALY
          </span>
          <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-white/70">
            {(anomalies[0]?.label ?? "").slice(0, 16)}
          </span>
        </div>
      )}
    </div>
  );
}
