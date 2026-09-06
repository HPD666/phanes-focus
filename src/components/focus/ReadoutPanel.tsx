import { AnimatePresence, motion } from "framer-motion";
import { CloudSun, Radio, AlertTriangle, Wind } from "lucide-react";
import type { FocusLayer } from "@/lib/layers";
import type { FrameMetrics, Anomaly } from "@/lib/vision";
import type { WeatherNow } from "@/lib/weather";
import type { NetworkInfo } from "@/lib/ai";

interface ReadoutPanelProps {
  layer: FocusLayer;
  metrics: FrameMetrics | null;
  weather: WeatherNow | null;
  network: NetworkInfo | null;
  anomalies: Anomaly[];
  baselineCaptureCount: number;
}

function Bar({
  label,
  value,
  color,
}: {
  label: string;
  value: number | null;
  color: string;
}) {
  const v = value ?? 0;
  return (
    <div className="flex items-center gap-2">
      <span className="hud-label w-20 shrink-0">{label}</span>
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}88` }}
          animate={{ width: `${Math.max(2, Math.round(v * 100))}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>
      <span className="w-8 shrink-0 text-right font-mono text-[9px] text-[#9fd4f2]/80">
        {Math.round(v * 100)}
      </span>
    </div>
  );
}

export function ReadoutPanel({
  layer,
  metrics,
  weather,
  network,
  anomalies,
  baselineCaptureCount,
}: ReadoutPanelProps) {
  const m = metrics;
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={layer.id}
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -8 }}
        transition={{ duration: 0.18 }}
        className="hud-panel pointer-events-none absolute left-3 top-[52px] z-30 hidden w-56 flex-col gap-2 rounded-sm p-3 md:flex"
      >
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-white">
            {layer.code}
          </span>
          <span className="hud-label">Signal Engine</span>
        </div>
        <p className="text-[10px] leading-relaxed text-[#8fb8d8]/70">
          {layer.tagline}
        </p>
        <div className="my-0.5 h-px bg-white/10" />

        {layer.id === "weather" && !weather ? (
          <div className="flex flex-col gap-1.5 text-[11px] text-[#cfeaff]/90">
            <div className="flex items-center gap-2">
              <CloudSun className="size-4" style={{ color: layer.color }} />
              <span>Weather link offline</span>
            </div>
            <span className="hud-label">
              No location fix or no network — retry when the position locks.
            </span>
          </div>
        ) : layer.id === "weather" && weather ? (
          <div className="flex flex-col gap-1.5 text-[11px] text-[#cfeaff]/90">
            <div className="flex items-center gap-2">
              <CloudSun className="size-4" style={{ color: layer.color }} />
              <span className="font-semibold">{weather.label}</span>
              <span className="ml-auto font-mono">{weather.temperature.toFixed(1)}°C</span>
            </div>
            <div className="flex items-center gap-2">
              <Wind className="size-4 text-[#9fd4f2]/70" />
              <span>{weather.windSpeed.toFixed(0)} km/h</span>
              <span className="ml-auto font-mono">RH {Math.round(weather.humidity)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="hud-label">Feels</span>
              <span className="font-mono">{weather.apparent.toFixed(1)}°C</span>
              <span className="ml-auto hud-label">Precip</span>
              <span className="font-mono">{weather.precipitation.toFixed(1)} mm</span>
            </div>
            <span className="hud-label">Open-Meteo · free keyless link</span>
          </div>
        ) : layer.id === "signals" && network ? (
          <div className="flex flex-col gap-1.5 text-[11px] text-[#cfeaff]/90">
            <div className="flex items-center gap-2">
              <Radio className="size-4" style={{ color: layer.color }} />
              <span className="font-semibold uppercase">{network.type ?? "unknown"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="hud-label">Downlink</span>
              <span className="font-mono">{network.downlink?.toFixed(1)} Mb/s</span>
              <span className="ml-auto hud-label">RTT</span>
              <span className="font-mono">{network.rtt} ms</span>
            </div>
            <span className="hud-label">Network Information API · live device telemetry</span>
          </div>
        ) : layer.id === "anomalies" ? (
          <div className="flex flex-col gap-1.5">
            {anomalies.length === 0 ? (
              <span className="text-[11px] text-[#9fd4f2]/70">
                Nominal — no measurable deviation from baseline
                {baselineCaptureCount === 0 && " (no baseline captures yet)"}.
              </span>
            ) : (
              anomalies.map((a) => (
                <div key={a.id} className="flex items-start gap-2 text-[11px]">
                  <AlertTriangle
                    className="mt-0.5 size-3 shrink-0"
                    style={{ color: layer.color }}
                  />
                  <div>
                    <span className="text-white/90">{a.label}</span>
                    <p className="text-[10px] leading-snug text-[#9fd4f2]/70">{a.detail}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Bar label="Luma" value={m?.brightness ?? null} color={layer.color} />
            <Bar label="Contrast" value={m?.contrast ?? null} color={layer.color} />
            <Bar label="Edges" value={m?.edgeDensity ?? null} color={layer.color} />
            <Bar label="Motion" value={m?.motion ?? null} color="#ff8fa3" />
            {layer.id === "biosphere" && (
              <Bar label="Biomass" value={m?.vegetationIndex ?? null} color="#7dff9b" />
            )}
            <Bar
              label="Anomaly"
              value={m?.anomalyScore ?? null}
              color={m && m.anomalyScore > 0.55 ? "#ff5d6c" : layer.color}
            />
          </div>
        )}

        <div className="my-0.5 h-px bg-white/10" />
        <div className="flex items-center justify-between">
          <span className="hud-label">Hotspots</span>
          <span className="font-mono text-[10px] text-[#9fd4f2]/90">
            {m?.hotspots.length ?? 0}
          </span>
        </div>
        <div className="flex gap-1.5">
          {(m?.dominantColors ?? []).map((c) => (
            <div
              key={c.hex}
              className="flex items-center gap-1"
              title={`${c.hex} ${Math.round(c.share * 100)}%`}
            >
              <span
                className="size-3 rounded-[2px]"
                style={{ backgroundColor: c.hex, boxShadow: `0 0 6px ${c.hex}88` }}
              />
            </div>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}