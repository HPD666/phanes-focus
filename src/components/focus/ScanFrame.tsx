import type { Hit } from "@/convex/objectScan";

interface ScanFrameProps {
  box: NonNullable<Hit["box"]>;
  accent: string;
  label: string;
}

export function ScanFrame({ box, accent, label }: ScanFrameProps) {
  return (
    <div
      className="pointer-events-none absolute left-0 top-0 z-20 h-full w-full"
      style={{ paddingLeft: "0px", paddingTop: "0px" }}
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
        {/* outer frame */}
        <div
          className="absolute inset-0 rounded-sm border border-dashed"
          style={{
            borderColor: accent,
            boxShadow: `0 0 14px ${accent}`,
            animation: "hud-scan-pop 0.35s ease-out",
          }}
        />
        {/* corner brackets */}
        <div className="absolute left-0 top-0 border-l-2 border-t-2 text-[8px]" style={{ color: accent }}>
          <span className="pointer-events-none absolute -top-2 -left-1 font-mono text-[9px] uppercase tracking-[0.18em]" style={{ color: accent }}>
            {label.toUpperCase()}
          </span>
        </div>
        <div className="absolute right-0 top-0 border-r-2 border-t-2" />
        <div className="absolute left-0 bottom-0 border-l-2 border-b-2" />
        <div className="absolute right-0 bottom-0 border-r-2 border-b-2" />
      </div>
    </div>
  );
}
