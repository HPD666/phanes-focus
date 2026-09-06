import type { Hit } from "@/convex/objectScan";

interface ScanFrameProps {
  box: NonNullable<Hit["box"]>;
  accent: string;
  label: string;
}

export function ScanFrame({ box, accent, label }: ScanFrameProps) {
  if (!box) return null;

  const frame = "hud-scan-pop 0.32s cubic-bezier(0.2, 0.9, 0.3, 1.1) both";

  return (
    <div
      className="pointer-events-none absolute inset-0 z-20"
      style={{
        paddingLeft: "var(--focus-l0)",
        paddingTop: "var(--focus-t0)",
        paddingRight: "var(--focus-r0)",
        paddingBottom: "var(--focus-b0)",
      }}
    >
      <div
        className="absolute hidden md:block"
        style={{
          left: `${box.x * 100}%`,
          top: `${box.y * 100}%`,
          width: `${box.w * 100}%`,
          height: `${box.h * 100}%`,
        }}
      >
        {/* outer tether */}
        <div
          className="absolute inset-0 rounded-sm border border-dashed"
          style={{
            borderColor: accent,
            borderWidth: "1px",
            opacity: 0.9,
          }}
        />
        {/* glow edge */}
        <div
          className="absolute inset-0 rounded-sm"
          style={{
            boxShadow: `0 0 22px ${accent}66, inset 0 0 18px ${accent}33`,
            animation: frame,
          }}
        />
        {/* corners */}
        <div className="absolute left-0 top-0 border-l-2 border-t-2" style={{ borderColor: accent }} />
        <div className="absolute right-0 top-0 border-r-2 border-t-2" style={{ borderColor: accent }} />
        <div className="absolute left-0 bottom-0 border-l-2 border-b-2" style={{ borderColor: accent }} />
        <div className="absolute right-0 bottom-0 border-r-2 border-b-2" style={{ borderColor: accent }} />
        {/* top label */}
        <div
          className="pointer-events-none absolute -top-5 left-0 font-mono text-[9px] uppercase tracking-[0.2em]"
          style={{
            color: accent,
            textShadow: `0 0 10px ${accent}`,
          }}
        >
          {label.toUpperCase()}
        </div>
      </div>
    </div>
  );
}
