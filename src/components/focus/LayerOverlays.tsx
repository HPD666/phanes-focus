import { motion } from "framer-motion";
import { useMemo } from "react";
import { ageLabel, distanceM, hash01 } from "@/lib/geo";
import type { LayerId } from "@/lib/layers";
import type { Anomaly, FrameMetrics, Hotspot } from "@/lib/vision";
import type { WeatherNow } from "@/lib/weather";
import type { OcrItem, OcrStatus } from "@/hooks/use-ocr";
import { cn } from "@/lib/utils";

export interface HistoryCapture {
  id: string;
  createdAt: number;
  thumb: string;
  lat: number;
  lng: number;
  heading: number;
  metrics: FrameMetrics;
}

export interface ActivityPing {
  id: string;
  createdAt: number;
  lat: number;
  lng: number;
}

interface LayerOverlaysProps {
  layer: LayerId;
  metrics: FrameMetrics | null;
  weather: WeatherNow | null;
  captures: HistoryCapture[];
  activity: ActivityPing[];
  geo: { lat: number | null; lng: number | null };
  ocr: OcrItem[];
  ocrStatus: OcrStatus;
  anomalies: Anomaly[];
  accent: string;
}

function At({
  x,
  y,
  className,
  children,
}: {
  x: number;
  y: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn("absolute -translate-x-1/2 -translate-y-1/2", className)}
      style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
    >
      {children}
    </div>
  );
}

function HotspotNode({ h, color, label }: { h: Hotspot; color: string; label?: string }) {
  return (
    <At x={h.x} y={h.y}>
      <div className="relative flex items-center justify-center">
        <span
          className="absolute size-6 animate-ping rounded-full opacity-30"
          style={{ backgroundColor: color }}
        />
        <span
          className="relative size-2 rounded-full"
          style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }}
        />
        {label && (
          <span
            className="absolute left-3 top-2 whitespace-nowrap font-mono text-[8px] uppercase tracking-[0.18em]"
            style={{ color }}
          >
            {label}
          </span>
        )}
      </div>
    </At>
  );
}

export function LayerOverlays({
  layer,
  metrics,
  weather,
  captures,
  activity,
  geo,
  ocr,
  ocrStatus,
  anomalies,
  accent,
}: LayerOverlaysProps) {
  const hotspots = metrics?.hotspots ?? [];

  // History ghosts — real archived captures near the operator.
  const ghosts = useMemo(() => {
    const nearby = captures.filter((c) => {
      if (geo.lat === null || geo.lng === null) return true;
      return distanceM(geo.lat, geo.lng, c.lat, c.lng) <= 120;
    });
    return (nearby.length > 0 ? nearby : captures).slice(0, 8);
  }, [captures, geo.lat, geo.lng]);

  // Activity pings — real captures by other operators in the last 24h.
  const pings = useMemo(() => {
    return activity.filter((a) => {
      if (geo.lat === null || geo.lng === null) return true;
      return distanceM(geo.lat, geo.lng, a.lat, a.lng) <= 3000;
    });
  }, [activity, geo.lat, geo.lng]);

  const showText = layer === "inscriptions" || layer === "omni";
  const showHistory = layer === "history" || layer === "omni";
  const showEnergy = layer === "energy" || layer === "omni";
  const showWeather = layer === "weather" || layer === "omni";
  const showFlow = layer === "flow" || layer === "omni";
  const showBio = layer === "biosphere" || layer === "omni";
  const showStructure = layer === "structure" || layer === "omni";
  const showSignals = layer === "signals" || layer === "omni";
  const showAnomalies = layer === "anomalies" || layer === "omni";
  const isOmni = layer === "omni";

  const energyPoints = hotspots.filter((h) => h.kind === "energy" || h.kind === "heat");
  const bioPoints = hotspots.filter((h) => h.kind === "vegetation");
  const structPoints = hotspots.filter((h) => h.kind === "structure" || h.kind === "energy");
  const motionPoints = hotspots.filter((h) => h.kind === "motion");

  const weatherIsRain =
    weather !== null &&
    ((weather.code >= 51 && weather.code <= 67) ||
      (weather.code >= 80 && weather.code <= 82));

  const weatherIsSnow = weather !== null && weather.code >= 71 && weather.code <= 86;

  const windStreaks = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => ({
        top: 12 + hash01(`w${i}`) * 70,
        delay: hash01(`wd${i}`) * 3,
        duration: 1.6 + hash01(`wl${i}`) * 2.4,
        width: 30 + hash01(`ww${i}`) * 90,
        opacity: 0.12 + hash01(`wo${i}`) * 0.25,
      })),
    [],
  );

  const rainStreaks = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        left: hash01(`r${i}`) * 100,
        top: hash01(`rt${i}`) * 100,
        delay: hash01(`rd${i}`) * 2,
        duration: 0.7 + hash01(`rl${i}`) * 0.9,
      })),
    [],
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {/* ------- HISTORY ------- */}
      {showHistory &&
        ghosts.map((c, i) => {
          const hx = 0.12 + hash01(c.id) * 0.76;
          const hy = 0.24 + hash01(`${c.id}-y`) * 0.4;
          return (
            <At key={c.id} x={hx} y={hy}>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: isOmni ? 0.55 : 0.92, scale: 1 }}
                transition={{ delay: i * 0.06 }}
                className="group relative cursor-pointer"
              >
                <div className="absolute -inset-px border border-[#ffb454]/40" />
                <img
                  src={c.thumb}
                  alt="Past capture"
                  className="h-20 w-28 rounded-[2px] object-cover opacity-50 grayscale-[35%] transition-all group-hover:opacity-90 sm:h-24 sm:w-36"
                  style={{ filter: "sepia(0.3) hue-rotate(-20deg)" }}
                />
                <div
                  className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/50 px-1.5 py-0.5 font-mono text-[8px]"
                  style={{ color: "#ffb454" }}
                >
                  <span>{ageLabel(c.createdAt)}</span>
                  <span>
                    {geo.lat !== null && geo.lng !== null
                      ? `${Math.round(distanceM(geo.lat, geo.lng, c.lat, c.lng))}m`
                      : "near"}
                  </span>
                </div>
                <div className="absolute -top-2 left-1/2 h-4 w-px -translate-x-1/2 bg-[#ffb454]/50" />
              </motion.div>
            </At>
          );
        })}

      {/* ------- INSCRIPTIONS ------- */}
      {showText &&
        ocr.map((item) => (
          <At key={`${item.text}-${item.x}`} x={item.x} y={item.y}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-1.5 rounded-[2px] border border-[#c3a1ff]/50 bg-black/45 px-2 py-1 backdrop-blur-[1px]"
            >
              <span
                className="font-mono text-[10px] tracking-wide text-[#c3a1ff]"
                style={{ textShadow: "0 0 8px rgba(195,161,255,0.8)" }}
              >
                {item.text}
              </span>
              <span className="font-mono text-[8px] text-[#c3a1ff]/60">
                {Math.round(item.confidence)}
              </span>
            </motion.div>
          </At>
        ))}
      {showText && ocrStatus === "offline" && (
        <div className="absolute left-1/2 top-16 -translate-x-1/2 rounded-sm border border-red-400/30 bg-black/50 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-red-300/80">
          OCR link offline — text layer degraded
        </div>
      )}
      {showText && ocrStatus === "ready" && ocr.length === 0 && (
        <div className="absolute left-1/2 top-16 -translate-x-1/2 animate-pulse rounded-sm border border-[#c3a1ff]/25 bg-black/40 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-[#c3a1ff]/70">
          Scanning for inscriptions…
        </div>
      )}

      {/* ------- ENERGY ------- */}
      {showEnergy && energyPoints.length >= 2 && (
        <>
          <svg
            viewBox="0 0 100 62.5"
            preserveAspectRatio="none"
            className="absolute inset-0 size-full"
          >
            {energyPoints.slice(0, 6).map((h, i) => {
              const other = energyPoints[(i + 1) % energyPoints.length];
              return (
                <line
                  key={i}
                  x1={h.x * 100}
                  y1={h.y * 62.5}
                  x2={other.x * 100}
                  y2={other.y * 62.5}
                  stroke={accent}
                  strokeWidth="0.18"
                  strokeDasharray="1.5 1"
                  opacity="0.45"
                />
              );
            })}
          </svg>
          {energyPoints.slice(0, 6).map((h, i) => (
            <HotspotNode key={`e-${i}`} h={h} color="#ffcf3f" label={`E${i + 1}`} />
          ))}
        </>
      )}

      {/* ------- WEATHER ------- */}
      {showWeather && weather && (
        <>
          {/* sky tint */}
          <div
            className="absolute inset-0"
            style={{
              background: weather.isDay
                ? "linear-gradient(to bottom, rgba(90,140,200,0.10), transparent 45%)"
                : "linear-gradient(to bottom, rgba(20,30,70,0.30), transparent 55%)",
            }}
          />
          {/* wind streaks */}
          {windStreaks.map((s, i) => (
            <div
              key={`w-${i}`}
              className="absolute h-px"
              style={{
                top: `${s.top}%`,
                left: "-20%",
                width: `${s.width}px`,
                opacity: s.opacity,
                background: "linear-gradient(to right, transparent, #bfe9ff)",
                animation: `hud-wind ${s.duration}s linear ${s.delay}s infinite`,
              }}
            />
          ))}
          {/* precipitation */}
          {weatherIsRain &&
            rainStreaks.map((s, i) => (
              <div
                key={`ra-${i}`}
                className="absolute w-px"
                style={{
                  left: `${s.left}%`,
                  top: `${s.top}%`,
                  height: "14px",
                  opacity: 0.4,
                  background: "linear-gradient(to bottom, transparent, #9fd4f2)",
                  animation: `hud-rain ${s.duration}s linear ${s.delay}s infinite`,
                }}
              />
            ))}
          {weatherIsSnow &&
            rainStreaks.slice(0, 14).map((s, i) => (
              <div
                key={`sn-${i}`}
                className="absolute size-1 rounded-full bg-white/70"
                style={{
                  left: `${s.left}%`,
                  top: `${s.top}%`,
                  animation: `hud-snow ${s.duration + 1.2}s linear ${s.delay}s infinite`,
                }}
              />
            ))}
          {/* condition tag */}
          <div className="absolute right-3 top-[136px] hidden rounded-sm border border-white/10 bg-black/40 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-[#9fd4f2]/90 md:block">
            {weather.label} · {weather.temperature.toFixed(0)}°C ·{" "}
            {weather.windSpeed.toFixed(0)} km/h
          </div>
        </>
      )}

      {/* ------- FLOW ------- */}
      {showFlow && (
        <>
          {pings.map((p, i) => {
            const px = 0.14 + hash01(p.id) * 0.72;
            const py = 0.2 + hash01(`${p.id}-f`) * 0.55;
            return (
              <At key={p.id} x={px} y={py}>
                <div className="relative">
                  <span
                    className="absolute -inset-3 animate-ping rounded-full border border-[#ff8fa3]/60"
                    style={{ animationDelay: `${i * 0.4}s`, animationDuration: "2.6s" }}
                  />
                  <span className="relative block size-2 rounded-full bg-[#ff8fa3]" />
                  <span
                    className="absolute left-3 top-1 whitespace-nowrap font-mono text-[8px] text-[#ff8fa3]/90"
                  >
                    {ageLabel(p.createdAt)}
                  </span>
                </div>
              </At>
            );
          })}
          {pings.length === 0 && (
            <div className="absolute left-1/2 top-20 -translate-x-1/2 rounded-sm border border-[#ff8fa3]/25 bg-black/40 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-[#ff8fa3]/70">
              No operator activity in range
            </div>
          )}
          {motionPoints.map((h, i) => (
            <HotspotNode key={`m-${i}`} h={h} color="#ff8fa3" label="MOT" />
          ))}
        </>
      )}

      {/* ------- BIOSPHERE ------- */}
      {showBio && (
        <>
          {bioPoints.map((h, i) => (
            <At key={`b-${i}`} x={h.x} y={h.y}>
              <div
                className="size-24 rounded-full"
                style={{
                  background:
                    "radial-gradient(circle, rgba(125,255,155,0.28), transparent 70%)",
                }}
              />
              <span className="absolute left-8 top-8 font-mono text-[8px] text-[#7dff9b]">
                FLORA
              </span>
            </At>
          ))}
          {metrics && metrics.vegetationIndex > 0.25 && (
            <div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(ellipse at 50% 55%, rgba(125,255,155,${
                  0.04 + metrics.vegetationIndex * 0.08
                }), transparent 70%)`,
              }}
            />
          )}
        </>
      )}

      {/* ------- STRUCTURE ------- */}
      {showStructure && (
        <>
          {structPoints.slice(0, 6).map((h, i) => (
            <At key={`s-${i}`} x={h.x} y={h.y}>
              <div className="relative flex size-10 items-center justify-center">
                <span className="absolute left-0 top-0 size-2.5 border-l-2 border-t-2" style={{ borderColor: "#9fb6ff" }} />
                <span className="absolute right-0 top-0 size-2.5 border-r-2 border-t-2" style={{ borderColor: "#9fb6ff" }} />
                <span className="absolute bottom-0 left-0 size-2.5 border-b-2 border-l-2" style={{ borderColor: "#9fb6ff" }} />
                <span className="absolute bottom-0 right-0 size-2.5 border-b-2 border-r-2" style={{ borderColor: "#9fb6ff" }} />
                <span className="font-mono text-[7px] text-[#9fb6ff]/80">S{i + 1}</span>
              </div>
            </At>
          ))}
          {metrics && metrics.edgeDensity > 0.3 && (
            <div
              className="absolute inset-0"
              style={{
                background:
                  "repeating-linear-gradient(0deg, transparent 0 3px, rgba(159,182,255,0.02) 3px 4px)",
              }}
            />
          )}
        </>
      )}

      {/* ------- SIGNALS ------- */}
      {showSignals && (
        <>
          {pings.slice(0, 5).map((p, i) => {
            const px = 0.2 + hash01(`${p.id}-s`) * 0.6;
            const py = 0.25 + hash01(`${p.id}-sy`) * 0.4;
            return (
              <At key={`sig-${p.id}`} x={px} y={py}>
                <div
                  className="absolute -left-10 top-1/2 h-px w-24 origin-left"
                  style={{
                    background:
                      "conic-gradient(from 90deg at 0% 50%, transparent 0deg, rgba(47,243,224,0.5) 30deg, transparent 60deg)",
                    animation: `hud-sweep 2.8s linear ${i * 0.5}s infinite`,
                  }}
                />
                <span className="size-1.5 rounded-full bg-[#2ff3e0]" style={{ boxShadow: "0 0 8px #2ff3e0" }} />
              </At>
            );
          })}
        </>
      )}

      {/* ------- ANOMALIES ------- */}
      {showAnomalies &&
        anomalies.map((a) => {
          const ax = 0.3 + hash01(a.id) * 0.4;
          const ay = 0.3 + hash01(`${a.id}-y`) * 0.3;
          return (
            <At key={a.id} x={ax} y={ay}>
              <div className="relative">
                <span
                  className="absolute -inset-3 animate-ping rounded-full border border-red-400/70"
                  style={{ animationDuration: "1.4s" }}
                />
                <span
                  className="relative block size-3 rotate-45"
                  style={{
                    backgroundColor: "#ff5d6c",
                    boxShadow: "0 0 12px rgba(255,93,108,0.9)",
                  }}
                />
                <span className="absolute left-4 top-0 whitespace-nowrap font-mono text-[8px] uppercase tracking-[0.15em] text-red-300/90">
                  {a.label}
                </span>
              </div>
            </At>
          );
        })}

      {/* anomaly ticker */}
      {layer === "anomalies" && anomalies.length > 0 && (
        <div className="absolute bottom-24 left-3 z-30 flex max-w-[46%] flex-col gap-1">
          {anomalies.slice(0, 3).map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-2 rounded-sm border border-red-400/30 bg-black/55 px-2.5 py-1.5"
            >
              <span className="hud-label text-red-300/90">{a.code}</span>
              <span className="truncate text-[11px] text-white/85">{a.label}</span>
              <span className="ml-auto font-mono text-[9px] text-red-300/80">
                {Math.round(a.severity * 100)}%
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ------- OMNI counters ------- */}
      {isOmni && (
        <div className="absolute left-1/2 top-[52px] flex -translate-x-1/2 items-center gap-2 rounded-sm border border-white/10 bg-black/45 px-3 py-1.5 font-mono text-[9px] tracking-[0.15em] text-white/80">
          <span className="text-[#ffb454]">H {ghosts.length}</span>
          <span className="text-[#c3a1ff]">T {ocr.length}</span>
          <span className="text-[#ffcf3f]">P {energyPoints.length}</span>
          <span className="text-[#7dff9b]">B {bioPoints.length}</span>
          <span className="text-[#9fb6ff]">S {structPoints.length}</span>
          <span className="text-[#ff5d6c]">A {anomalies.length}</span>
        </div>
      )}
    </div>
  );
}