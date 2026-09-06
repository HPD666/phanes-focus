/**
 * PHANES ASSISTANT — on-device engine
 * ----------------------------------
 * The default "brain" runs entirely in the browser and answers the operator
 * from *real* telemetry only: live vision metrics, weather, location,
 * archived captures and detected anomalies. No prompts are invented — every
 * number in an answer comes from the supplied context.
 *
 * If the operator adds a SAMBANOVA_API_KEY (see project keys), the Focus
 * calls a Convex action instead and gets deeper LLM reasoning on the same
 * telemetry. Without it, this engine keeps Phanes fully functional forever
 * at zero cost.
 */

import type { Anomaly, FrameMetrics } from "./vision";
import type { WeatherNow } from "./weather";

export interface NetworkInfo {
  downlink?: number;
  rtt?: number;
  type?: string;
}

export interface AiContext {
  layer: string;
  layerName: string;
  metrics: FrameMetrics | null;
  weather: WeatherNow | null;
  lat: number | null;
  lng: number | null;
  heading: number | null;
  captureCount: number;
  nearbyCaptureCount: number;
  ocr: string[];
  anomalies: Anomaly[];
  feed: "camera" | "synthetic" | "off";
  network: NetworkInfo | null;
  timeOfDay: string;
  activeSince: string;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

function sceneLine(ctx: AiContext): string {
  const m = ctx.metrics;
  if (!m) {
    return `Feed offline. No vision telemetry available. Activating layer "${ctx.layerName}".`;
  }
  const hotspotKinds = m.hotspots
    .reduce<Record<string, number>>((acc, h) => {
      acc[h.kind] = (acc[h.kind] ?? 0) + 1;
      return acc;
    }, {});
  const kindList = Object.entries(hotspotKinds)
    .map(([k, n]) => `${n} ${k}`)
    .join(", ");
  return [
    `Vision online. Feed: ${ctx.feed.toUpperCase()}. Layer "${ctx.layerName}" active.`,
    `Luminance ${pct(m.brightness)}, contrast ${pct(m.contrast)}, edges ${pct(m.edgeDensity)}, vegetation ${pct(m.vegetationIndex)}.`,
    `Motion ${(m.motion * 100).toFixed(1)}%. Salient features: ${kindList || "none"}.`,
    `Anomaly score ${Math.round(m.anomalyScore * 100)}%.`,
    ctx.weather
      ? `Local weather: ${ctx.weather.temperature.toFixed(1)}°C, ${ctx.weather.label.toLowerCase()}, wind ${ctx.weather.windSpeed.toFixed(0)} km/h.`
      : "Weather link offline.",
    `${ctx.captureCount} archived captures on record.`,
  ].join("\n");
}

function weatherAnswer(w: WeatherNow | null): string {
  if (!w) {
    return "Weather layer: link offline (no network to Open-Meteo). All other layers remain nominal.";
  }
  const dir =
    w.windDirection < 22.5 || w.windDirection >= 337.5
      ? "N"
      : w.windDirection < 67.5
        ? "NE"
        : w.windDirection < 112.5
          ? "E"
          : w.windDirection < 157.5
            ? "SE"
            : w.windDirection < 202.5
              ? "S"
              : w.windDirection < 247.5
                ? "SW"
                : w.windDirection < 292.5
                  ? "W"
                  : "NW";
  return [
    `${w.label}. ${w.temperature.toFixed(1)}°C (feels ${w.apparent.toFixed(1)}°C).`,
    `Humidity ${Math.round(w.humidity)}%. Precipitation ${w.precipitation.toFixed(1)} mm.`,
    `Wind ${w.windSpeed.toFixed(0)} km/h from ${dir}. ${w.isDay ? "Day cycle." : "Night cycle."}`,
    "Source: Open-Meteo, free keyless telemetry.",
  ].join("\n");
}

function historyAnswer(ctx: AiContext): string {
  if (ctx.captureCount === 0) {
    return "History layer: no archived captures yet. Hold the capture key to record this scene — future scans of the same area will ghost-paste your past view over the live feed.";
  }
  return [
    `${ctx.captureCount} captures archived. ${ctx.nearbyCaptureCount} within scan radius of this position.`,
    "History ghosts appear when the archived capture was taken within ~120 m of your current location, and are overlaid at their stored heading.",
    ctx.ocr.length > 0
      ? `Archived readings include text: "${ctx.ocr.slice(0, 2).join(' | ')}".`
      : "No text was recoverable in archived frames.",
  ].join("\n");
}

function inscriptionsAnswer(ctx: AiContext): string {
  const lines = ctx.ocr.filter((t) => t.trim().length > 1);
  if (lines.length === 0) {
    return "Inscriptions layer: no readable text in the current frame. Point the lens at signage, documents, or markings — OCR runs fully on-device, nothing is uploaded.";
  }
  return [
    `Inscriptions detected (${lines.length}):`,
    ...lines.slice(0, 6).map((t) => `  ▸ ${t}`),
    "Confidence-weighted on-device OCR via Tesseract. Text is never uploaded.",
  ].join("\n");
}

function anomalyAnswer(ctx: AiContext): string {
  if (ctx.anomalies.length === 0) {
    return `Anomaly layer: nominal. Current composite score ${ctx.metrics ? Math.round(ctx.metrics.anomalyScore * 100) : 0}%. No measurable deviation from your baseline.`;
  }
  return [
    `${ctx.anomalies.length} deviation(s) flagged:`,
    ...ctx.anomalies.map(
      (a) => `  ▸ ${a.label} (${Math.round(a.severity * 100)}% confidence) — ${a.detail}`,
    ),
    "Thresholds are computed against the mean of your archived captures, not guessed.",
  ].join("\n");
}

function signalAnswer(ctx: AiContext): string {
  const n = ctx.network;
  const parts = [
    "Signals layer:",
    n
      ? `  Network ${n.type ?? "unknown"} · ${n.downlink ? `${n.downlink} Mb/s downlink` : "downlink n/a"} · ${n.rtt ? `${n.rtt} ms RTT` : "RTT n/a"}`
      : "  Browser network telemetry unavailable.",
    "  Device sensor data is read live via the Network Information API.",
  ];
  return parts.join("\n");
}

function defaultAnswer(ctx: AiContext): string {
  const m = ctx.metrics;
  const isDark = m ? m.brightness < 0.4 : false;
  const busy = m ? m.motion > 0.06 : false;
  return [
    `PHANES // ${ctx.layerName.toUpperCase()} LAYER — ${ctx.feed.toUpperCase()} FEED.`,
    isDark
      ? "Scene is dim — the optics are compensating; expect fewer resolved features."
      : "Scene well-lit. Feature resolution nominal.",
    busy
      ? "Motion detected in frame — kinetic analysis engaged."
      : "Scene static. Motion baseline stable.",
    m
      ? `Highlights: ${m.hotspots.length} salient features, dominant color ${m.dominantColors[0]?.hex ?? "n/a"} (${m.dominantColors[0] ? Math.round(m.dominantColors[0].share * 100) : 0}% of frame).`
      : "",
    ctx.weather
      ? `Environment: ${ctx.weather.temperature.toFixed(1)}°C, ${ctx.weather.label.toLowerCase()}.`
      : "",
    "Ask me: 'what do you see', 'weather', 'history', 'inscriptions', 'anomalies', 'signals'.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Route an operator prompt to an answer built from real telemetry. */
export function phanesAnswer(prompt: string, ctx: AiContext): string {
  const q = prompt.toLowerCase();
  if (/(weather|rain|wind|temperature|humid|forecast)/.test(q)) {
    return weatherAnswer(ctx.weather);
  }
  if (/(histor|past|old|ghost|before|archive)/.test(q)) {
    return historyAnswer(ctx);
  }
  if (/(text|read|inscription|ocr|write|word|sign|glyph)/.test(q)) {
    return inscriptionsAnswer(ctx);
  }
  if (/(anomal|danger|wrong|alert|spike|deviat|suspicious)/.test(q)) {
    return anomalyAnswer(ctx);
  }
  if (/(signal|network|wifi|connection|link|rtt)/.test(q)) {
    return signalAnswer(ctx);
  }
  if (/(see|scene|look|what'?s? here|summary|status|report)/.test(q)) {
    return sceneLine(ctx);
  }
  if (/(help|what can you|how do|layer)/.test(q)) {
    return [
      "PHANES layers: core, history, inscriptions, energy, weather, flow, biosphere, structure, signals, anomalies, omni.",
      "Select a layer from the bar at the bottom of the Focus, or ask me directly about the scene.",
      "Everything runs on-device or via free telemetry — no subscription, no cloud bill.",
    ].join("\n");
  }
  return defaultAnswer(ctx);
}

/** Compact JSON scene brief for the cloud-brain action. */
export function buildSceneBrief(ctx: AiContext): string {
  return JSON.stringify({
    layer: ctx.layer,
    metrics: ctx.metrics
      ? {
          brightness: +ctx.metrics.brightness.toFixed(3),
          contrast: +ctx.metrics.contrast.toFixed(3),
          edgeDensity: +ctx.metrics.edgeDensity.toFixed(3),
          vegetationIndex: +ctx.metrics.vegetationIndex.toFixed(3),
          motion: +ctx.metrics.motion.toFixed(3),
          anomalyScore: +ctx.metrics.anomalyScore.toFixed(3),
          dominantColors: ctx.metrics.dominantColors.slice(0, 3),
          hotspots: ctx.metrics.hotspots.map((h) => ({
            x: +h.x.toFixed(2),
            y: +h.y.toFixed(2),
            kind: h.kind,
            score: +h.score.toFixed(2),
          })),
        }
      : null,
    weather: ctx.weather
      ? {
          temperature: ctx.weather.temperature,
          label: ctx.weather.label,
          windSpeed: ctx.weather.windSpeed,
          humidity: ctx.weather.humidity,
        }
      : null,
    location: ctx.lat !== null && ctx.lng !== null ? { lat: ctx.lat, lng: ctx.lng } : null,
    heading: ctx.heading,
    captures: ctx.captureCount,
    nearbyCaptures: ctx.nearbyCaptureCount,
    ocr: ctx.ocr.slice(0, 8),
    anomalies: ctx.anomalies.map((a) => ({
      code: a.code,
      label: a.label,
      severity: +a.severity.toFixed(2),
    })),
    feed: ctx.feed,
    time: ctx.timeOfDay,
  });
}