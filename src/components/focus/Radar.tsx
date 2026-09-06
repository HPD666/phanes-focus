import type { FrameMetrics } from "@/lib/vision";
import type { Anomaly } from "@/lib/vision";

interface RadarProps {
  metrics: FrameMetrics | null;
  anomalies: Anomaly[];
  accent: string;
}

export function Radar({ metrics, anomalies, accent }: RadarProps) {
  const C = 56;
  const R = 48;
  return (
    <div className="hud-panel relative size-[120px] overflow-hidden rounded-sm p-2">
      <svg viewBox="0 0 112 112" className="size-full">
        <circle cx={C} cy={C} r={R} fill="none" stroke="rgba(140,210,245,0.25)" strokeWidth="1" />
        <circle cx={C} cy={C} r={R * 0.66} fill="none" stroke="rgba(140,210,245,0.15)" strokeWidth="1" />
        <circle cx={C} cy={C} r={R * 0.33} fill="none" stroke="rgba(140,210,245,0.12)" strokeWidth="1" />
        <line x1={C - R} y1={C} x2={C + R} y2={C} stroke="rgba(140,210,245,0.12)" strokeWidth="1" />
        <line x1={C} y1={C - R} x2={C} y2={C + R} stroke="rgba(140,210,245,0.12)" strokeWidth="1" />
        {/* blips */}
        {metrics?.hotspots.map((h, i) => {
          const bx = C + (h.x - 0.5) * 2 * R * 0.8;
          const by = C + (h.y - 0.5) * 2 * R * 0.8;
          return (
            <circle
              key={`h-${i}`}
              cx={bx}
              cy={by}
              r={2 + h.score * 3}
              fill={accent}
              opacity={0.5 + h.score * 0.5}
            />
          );
        })}
        {anomalies.slice(0, 3).map((a, i) => {
          const bx = C + ((i * 37 + 11) % 80) - 40;
          const by = C + ((i * 53 + 23) % 80) - 40;
          return (
            <circle
              key={`a-${i}`}
              cx={bx}
              cy={by}
              r={3 + a.severity * 3}
              fill="none"
              stroke="#ff5d6c"
              strokeWidth="1.5"
              opacity={0.9}
            />
          );
        })}
      </svg>
      {/* rotating sweep */}
      <div
        className="absolute inset-2 animate-[hud-sweep_3.2s_linear_infinite]"
        style={{
          background:
            "conic-gradient(from 0deg, rgba(120,220,255,0.28), transparent 60deg, transparent 360deg)",
          maskImage: "radial-gradient(circle, black 0%, black 55%, transparent 72%)",
          WebkitMaskImage: "radial-gradient(circle, black 0%, black 55%, transparent 72%)",
        }}
      />
      <div className="hud-label absolute bottom-1 left-1/2 -translate-x-1/2">RADAR</div>
    </div>
  );
}