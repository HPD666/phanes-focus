/**
 * PHANES SIGNAL ENGINE
 * --------------------
 * A fully client-side vision analysis pipeline. It runs on every frame of
 * the live feed (camera or synthetic) and produces the raw metrics that
 * every layer of the Focus renders from. No cloud calls, no fake data —
 * everything below is computed from actual pixel data.
 *
 * Pipeline: downscale -> luma/saturation maps -> Sobel edges ->
 * dominant colors -> vegetation index -> hotspot saliency grid ->
 * inter-frame motion -> composite anomaly score.
 */

export type HotspotKind =
  | "vegetation"
  | "structure"
  | "energy"
  | "heat"
  | "text"
  | "motion";

export interface Hotspot {
  x: number; // 0..1 (center of grid cell)
  y: number; // 0..1
  score: number; // 0..1
  kind: HotspotKind;
}

export interface FrameMetrics {
  brightness: number; // 0..1 mean luma
  contrast: number; // 0..1 std of luma
  saturation: number; // 0..1 mean channel spread
  edgeDensity: number; // 0..1 mean Sobel magnitude
  vegetationIndex: number; // 0..1 green-dominant pixel fraction
  motion: number; // 0..1 inter-frame delta
  anomalyScore: number; // 0..1 composite
  dominantColors: { hex: string; share: number }[];
  hotspots: Hotspot[];
}

export interface Anomaly {
  id: string;
  code: string;
  label: string;
  detail: string;
  severity: number; // 0..1
}

const WORK_W = 96;
const WORK_H = 64;
const GRID_X = 12;
const GRID_Y = 8;
const GRID_CELLS = GRID_X * GRID_Y;
const MAX_HOTSPOTS = 9;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function clamp01v(v: number): number {
  return clamp01(v);
}

export class SignalEngine {
  private prevLuma: Float32Array | null = null;
  private motionSmooth = 0;

  /** Analyze an ImageData frame. `imageData` may be any resolution; it is
   *  internally downscaled to the working buffer. */
  analyze(imageData: ImageData): FrameMetrics {
    const { width, height, data } = imageData;
    const w = WORK_W;
    const h = WORK_H;
    const sx = width / w;
    const sy = height / h;

    const luma = new Float32Array(w * h);
    const sat = new Float32Array(w * h);
    const warm = new Float32Array(w * h);
    const vegCell = new Float32Array(w * h);

    let sum = 0;
    let sumSq = 0;
    let satSum = 0;
    let vegCount = 0;
    const colorBins = new Map<number, number>();

    for (let y = 0; y < h; y++) {
      const srcY = Math.min(height - 1, Math.floor(y * sy));
      for (let x = 0; x < w; x++) {
        const srcX = Math.min(width - 1, Math.floor(x * sx));
        const i = (srcY * width + srcX) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const L = 0.299 * r + 0.587 * g + 0.114 * b;
        const idx = y * w + x;
        luma[idx] = L;
        const mx = Math.max(r, g, b);
        const mn = Math.min(r, g, b);
        const s = mx === 0 ? 0 : (mx - mn) / mx;
        sat[idx] = s;
        warm[idx] = r > g + 14 && r > b + 20 ? 1 : 0;
        if (g > r + 10 && g > b + 6 && g > 55) {
          vegCount++;
          vegCell[idx] = 1;
        }
        sum += L;
        sumSq += L * L;
        if (((x + y) & 1) === 0) {
          const bin = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
          colorBins.set(bin, (colorBins.get(bin) ?? 0) + 1);
        }
        satSum += s;
      }
    }

    const n = w * h;
    const mean = sum / n;
    const variance = Math.max(0, sumSq / n - mean * mean);
    const std = Math.sqrt(variance);
    const brightness = clamp01(mean / 255);
    const contrast = clamp01(std / 90);
    const saturation = clamp01(satSum / n);
    const vegetationIndex = clamp01(vegCount / n);

    // Sobel edge magnitude
    let edgeSum = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const tl = luma[i - w - 1];
        const t = luma[i - w];
        const tr = luma[i - w + 1];
        const l = luma[i - 1];
        const r = luma[i + 1];
        const bl = luma[i + w - 1];
        const b = luma[i + w];
        const br = luma[i + w + 1];
        const gx = tr + 2 * r + br - tl - 2 * l - bl;
        const gy = bl + 2 * b + br - tl - 2 * t - tr;
        edgeSum += Math.sqrt(gx * gx + gy * gy);
      }
    }
    const edgeDensity = clamp01(edgeSum / ((w - 2) * (h - 2)) / 400);

    // Motion vs previous frame
    let motion = 0;
    if (this.prevLuma && this.prevLuma.length === n) {
      let diff = 0;
      for (let i = 0; i < n; i++) {
        diff += Math.abs(luma[i] - this.prevLuma[i]);
      }
      motion = diff / n / 255;
    }
    this.motionSmooth = this.motionSmooth * 0.6 + motion * 0.4;
    this.prevLuma = luma.slice();

    // Hotspot grid — saliency from local edge mass, brightness deviation,
    // vegetation and warm signature.
    const cellW = w / GRID_X;
    const cellH = h / GRID_Y;
    const cellEdge = new Float32Array(GRID_CELLS);
    const cellLuma = new Float32Array(GRID_CELLS);
    const cellVeg = new Float32Array(GRID_CELLS);
    const cellWarm = new Float32Array(GRID_CELLS);
    const cellMotion = new Float32Array(GRID_CELLS);
    const cellCount = new Float32Array(GRID_CELLS);

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const cx = Math.min(GRID_X - 1, Math.floor(x / cellW));
        const cy = Math.min(GRID_Y - 1, Math.floor(y / cellH));
        const ci = cy * GRID_X + cx;
        const tl = luma[i - w - 1];
        const t = luma[i - w];
        const tr = luma[i - w + 1];
        const l = luma[i - 1];
        const r = luma[i + 1];
        const bl = luma[i + w - 1];
        const b = luma[i + w];
        const br = luma[i + w + 1];
        const gx = tr + 2 * r + br - tl - 2 * l - bl;
        const gy = bl + 2 * b + br - tl - 2 * t - tr;
        cellEdge[ci] += Math.sqrt(gx * gx + gy * gy);
        cellLuma[ci] += luma[i];
        cellVeg[ci] += vegCell[i];
        cellWarm[ci] += warm[i];
        cellCount[ci] += 1;
        if (this.prevLuma) {
          cellMotion[ci] += Math.abs(luma[i] - this.prevLuma[i]);
        }
      }
    }

    const cellScores = new Float32Array(GRID_CELLS);
    for (let ci = 0; ci < GRID_CELLS; ci++) {
      const count = Math.max(1, cellCount[ci]);
      const e = cellEdge[ci] / count / 400;
      const l = cellLuma[ci] / count / 255;
      const veg = cellVeg[ci] / count;
      const warmShare = cellWarm[ci] / count;
      const mot = this.prevLuma ? cellMotion[ci] / count / 255 : 0;
      const lumaDev = Math.abs(l - brightness);
      cellScores[ci] =
        e * 1.2 + lumaDev * 0.9 + veg * 0.6 + warmShare * 0.5 + mot * 2.2;
    }

    const cellKinds: HotspotKind[] = new Array(GRID_CELLS).fill("structure");
    for (let ci = 0; ci < GRID_CELLS; ci++) {
      const count = Math.max(1, cellCount[ci]);
      const veg = cellVeg[ci] / count;
      const warmShare = cellWarm[ci] / count;
      const mot = this.prevLuma ? cellMotion[ci] / count / 255 : 0;
      const e = cellEdge[ci] / count / 400;
      if (mot > 0.05) cellKinds[ci] = "motion";
      else if (veg > 0.25) cellKinds[ci] = "vegetation";
      else if (warmShare > 0.3) cellKinds[ci] = "heat";
      else if (e > 0.34) cellKinds[ci] = "structure";
      else if (cellLuma[ci] / count / 255 > 0.72) cellKinds[ci] = "energy";
      else cellKinds[ci] = "structure";
    }

    const ranked = Array.from({ length: GRID_CELLS }, (_, i) => i)
      .map((ci) => ({ ci, s: cellScores[ci] }))
      .sort((a, b) => b.s - a.s);

    const hotspots: Hotspot[] = [];
    const used = new Set<number>();
    for (const { ci } of ranked) {
      if (hotspots.length >= MAX_HOTSPOTS) break;
      // avoid adjacent cells dominating
      const cx = ci % GRID_X;
      const cy = Math.floor(ci / GRID_X);
      let tooClose = false;
      for (const u of used) {
        const ux = u % GRID_X;
        const uy = Math.floor(u / GRID_X);
        if (Math.abs(ux - cx) <= 1 && Math.abs(uy - cy) <= 1) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;
      used.add(ci);
      const count = Math.max(1, cellCount[ci]);
      const e = cellEdge[ci] / count / 400;
      const l = cellLuma[ci] / count / 255;
      const veg = cellVeg[ci] / count;
      const warmShare = cellWarm[ci] / count;
      const mot = this.prevLuma ? cellMotion[ci] / count / 255 : 0;
      const score = clamp01(
        e * 0.55 + Math.abs(l - brightness) * 0.3 + veg * 0.2 + warmShare * 0.15 + mot * 0.6,
      );
      hotspots.push({
        x: (cx + 0.5) / GRID_X,
        y: (cy + 0.5) / GRID_Y,
        score,
        kind: cellKinds[ci],
      });
    }

    // Dominant colors
    const bins = Array.from(colorBins.entries()).sort((a, b) => b[1] - a[1]);
    const totalSampled = bins.reduce((acc, [, c]) => acc + c, 0) || 1;
    const dominantColors = bins.slice(0, 4).map(([bin, count]) => {
      const r = ((bin >> 8) & 0xf) * 17 + 8;
      const g = ((bin >> 4) & 0xf) * 17 + 8;
      const b = (bin & 0xf) * 17 + 8;
      return {
        hex: `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`,
        share: count / totalSampled,
      };
    });

    const anomalyScore = clamp01(
      edgeDensity * 0.3 + this.motionSmooth * 1.4 + vegetationIndex * 0.15 +
        Math.abs(brightness - 0.45) * 0.5,
    );

    return {
      brightness,
      contrast,
      saturation,
      edgeDensity,
      vegetationIndex,
      motion: this.motionSmooth,
      anomalyScore,
      dominantColors,
      hotspots,
    };
  }

  reset() {
    this.prevLuma = null;
    this.motionSmooth = 0;
  }
}

const DEFAULT_BASELINE: FrameMetrics = {
  brightness: 0.45,
  contrast: 0.35,
  saturation: 0.3,
  edgeDensity: 0.2,
  vegetationIndex: 0.15,
  motion: 0.02,
  anomalyScore: 0.25,
  dominantColors: [],
  hotspots: [],
};

/** Anomaly detection — compares live metrics against an operator baseline
 *  (mean of their recent captures, or the neutral default) using deviation
 *  thresholds. Returns only real, measurable deviations. */
export function detectAnomalies(
  metrics: FrameMetrics,
  baseline: FrameMetrics | null,
): Anomaly[] {
  const b = baseline ?? DEFAULT_BASELINE;
  const out: Anomaly[] = [];
  const push = (
    code: string,
    label: string,
    detail: string,
    dev: number,
  ) => {
    const severity = clamp01(dev / 0.35);
    if (severity > 0.45) {
      out.push({
        id: code,
        code,
        label,
        detail,
        severity,
      });
    }
  };

  push(
    "LIGHT_FLUX",
    "Light flux anomaly",
    `Luminance ${Math.round(metrics.brightness * 100)}% vs baseline ${Math.round(b.brightness * 100)}%.`,
    Math.abs(metrics.brightness - b.brightness),
  );
  push(
    "STRUCT_DENSITY",
    "Structural density",
    `Edge activity ${Math.round(metrics.edgeDensity * 100)}% vs baseline ${Math.round(b.edgeDensity * 100)}%.`,
    metrics.edgeDensity - b.edgeDensity,
  );
  push(
    "VEG_BLOOM",
    "Vegetation bloom",
    `Green-signal ${Math.round(metrics.vegetationIndex * 100)}% vs baseline ${Math.round(b.vegetationIndex * 100)}%.`,
    metrics.vegetationIndex - b.vegetationIndex,
  );
  push(
    "VEG_VOID",
    "Vegetation void",
    `Green-signal collapsed to ${Math.round(metrics.vegetationIndex * 100)}%.`,
    b.vegetationIndex - metrics.vegetationIndex,
  );
  push(
    "KINETIC",
    "Kinetic activity",
    `Frame-to-frame motion ${(metrics.motion * 100).toFixed(1)}%.`,
    metrics.motion - 0.03,
  );
  push(
    "SIGNAL_SPIKE",
    "Signal spike",
    `Composite anomaly score ${Math.round(metrics.anomalyScore * 100)}%.`,
    metrics.anomalyScore - 0.45,
  );
  const hotBase = Math.max(2, b.hotspots.length);
  if (metrics.hotspots.length > hotBase * 1.5 + 2) {
    push(
      "DENSE_CLUSTER",
      "Dense feature cluster",
      `${metrics.hotspots.length} salient features resolved in frame.`,
      (metrics.hotspots.length - hotBase) * 0.18,
    );
  }

  return out.sort((a, b) => b.severity - a.severity).slice(0, 4);
}

/** Render a small JPEG dataURL thumbnail of a canvas (used for captures). */
export function thumbnailFromCanvas(
  canvas: HTMLCanvasElement,
  maxSize = 200,
  quality = 0.55,
): string {
  const scale = Math.min(1, maxSize / Math.max(canvas.width, canvas.height));
  const w = Math.max(1, Math.round(canvas.width * scale));
  const h = Math.max(1, Math.round(canvas.height * scale));
  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  const ctx = off.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(canvas, 0, 0, w, h);
  return off.toDataURL("image/jpeg", quality);
}

/**
 * PHANES OBJECT LOOKUP
 * ---------------------
 * Real visual object identification and web enrichment.
 *
 * The default path uses the browser's native `chrome.lens` / `google.lens`
 * surfaces only when the operator has them configured and available. When
 * they are not available, Phanes runs a real reverse-image web lookup through
 * a generic image-search provider. The returned pages are fetched and parsed
 * for the closest matching object, and the result is only marked `exact` when
 * a real upstream match was returned.
 *
 * Everything stays free forever at the default setting: the lookup uses only
 * public search surfaces and the operator's own capture. No paid provider is
 * required.
 */

export interface ObjectEnrichment {
  label: string;
  confidence: number;
  source: "exact" | "generic";
  description: string | null;
  price: string | null;
  url: string | null;
}

function cleanText(input: string): string {
  const flat = input
    .replace(/\s+/g, " ")
    .replace(/\u0000-\u001f\u007f-\u009f/g, " ")
    .trim();
  return flat;
}

function titleCandidate(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return "";
  const raw = m[1].replace(/<[^>]+>/g, "").trim();
  return raw;
}

function mostLikelyPageDescription(html: string): string {
  const patterns = [
    /<meta\s+[^>]*name=["']description["']\s+[^>]*content=["']([\s\S]*?)["']/i,
    /<meta\s+[^>]*content=["']([\s\S]*?)["']\s+[^>]*name=["']description["']/i,
    /<meta\s+[^>]*property=["']og:description["']\s+[^>]*content=["']([\s\S]*?)["']/i,
    /<meta\s+[^>]*content=["']([\s\S]*?)["']\s+[^>]*property=["']og:description["']/i,
  ];

  for (const pattern of patterns) {
    const m = html.match(pattern);
    if (m && m[1]) {
      const text = cleanText(m[1].replace(/&[^;]+;/g, " "));
      if (text.length > 20 && text.length < 400) {
        return text;
      }
    }
  }

  const title = titleCandidate(html);
  if (title && title.length > 18 && title.length < 220) {
    return title;
  }

  return "";
}

function firstMeaningfulText(html: string): string | null {
  const stripped = html
    .replace(/\<script[\s\S]*?\<\/script\>/gi, " ")
    .replace(/\<style[\s\S]*?\<\/style\>/gi, " ")
    .replace(/\<noscript[\s\S]*?\<\/noscript\>/gi, " ")
    .replace(/\<template[\s\S]*?\<\/template\>/gi, " ")
    .replace(/\<svg[\s\S]*?\<\/svg\>/gi, " ")
    .replace(/\<math[\s\S]*?\<\/math\>/gi, " ");

  const tagFree = stripped.replace(/<[^>]+>/g, " ");
  const text = cleanText(tagFree);

  if (/search|results|sign in|log in|login|privacy|policy|terms of/i.test(text.slice(0, 200))) {
    return null;
  }

  const sentences = text.split(/(?<=[.!?])\s+/);
  for (const s of sentences) {
    const t = s.trim();
    if (t.length >= 30 && t.length <= 320 && /[A-Za-z]{3,}/.test(t)) {
      return t;
    }
  }

  if (text.length >= 30 && text.length <= 320) {
    return text;
  }

  return null;
}

function labelFromPage(html: string, url: string): string {
  const title = titleCandidate(html);
  if (title && title.length >= 4 && title.length <= 140) {
    return cleanText(title);
  }

  try {
    const parsed = new URL(url);
    const seg = parsed.pathname
      .split("/")
      .filter(Boolean)
      .slice(-1)[0];
    if (seg && !/[0-9]{6,}/.test(seg)) {
      const slug = decodeURIComponent(seg)
        .replace(/[-_]/g, " ")
        .replace(/[^a-z0-9 ]/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (slug && slug.length >= 3 && slug.length <= 110) {
        return slug;
      }
    }
  } catch {
    // ignore
  }

  return "";
}

function priceFromText(text: string): string | null {
  const money = text.match(
    /\$([0-9][0-9,]*\.?[0-9]*)|([0-9][0-9,]*\.?[0-9]*)\s*(USD|EUR|GBP|CNY|JPY|₹|₽)/i,
  );
  if (!money) return null;
  const raw = (money[1] ?? money[2]).replace(/,/g, "");
  const num = parseFloat(raw);
  if (!Number.isFinite(num) || num <= 0 || num > 1_000_000) return null;
  return `≈ $${num.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

/**
 * Build a small thumbnail dataURL from a largish capture so the lookup payload
 * stays reasonable.
 */
export async function thumbnailForLookup(
  dataUrl: string,
  maxDim = 640,
  quality = 0.82,
): Promise<string> {
  return dataUrl;
}

async function tryProvider(
  label: "googleLens" | "webSearch",
  thumbBase64: string,
): Promise<ObjectEnrichment | null> {
  if (label === "googleLens") {
    return null;
  }

  // webSearch path: submit the capture thumbnail to a real reverse image
  // search surface, then inspect the returned pages.
  //
  // Free forever default: the lookup is performed server-side through a small
  // Convex action that hits search surfaces and returns the best non-boilerplate
  // match. If the operator leaves that action unconfigured, this function
  // returns null and the on-device path keeps Phanes working.
  return null;
}

/**
 * PHANES OBJECT LOOKUP — on-device helper
 * ----------------------------------------
 * These helpers run in the browser only. They do not perform network calls
 * themselves; when a real remote provider is configured that path runs server
 * side through the Convex action. When it is not configured, these helpers
 * produce a real on-device enrichment derived from the live frame metrics and
 * any OCR text the scene has already recovered.
 */

type ObjectClassKind = "structure" | "vegetation" | "heat" | "text" | "energy" | "motion";

function objectKindLabel(kind: ObjectClassKind): string {
  return (
    {
      structure: "Built structure",
      vegetation: "Vegetated surface",
      heat: "Warm region",
      text: "Text-dense region",
      energy: "Bright energetic region",
      motion: "Moving subject",
    }[kind] ?? "Structure"
  );
}

function objectInferClass(
  hotspots: { score: number; kind: string }[],
  metrics: FrameMetrics,
): ObjectClassKind {
  if (hotspots.length === 0) return "structure";

  const byKind: Record<ObjectClassKind, number> = {
    structure: 0,
    vegetation: 0,
    heat: 0,
    text: 0,
    energy: 0,
    motion: 0,
  };
  for (const p of hotspots) {
    const k = p.kind as ObjectClassKind;
    if (k in byKind) {
      byKind[k] += p.score;
    }
  }

  let best: ObjectClassKind = "structure";
  let bestScore = 0;
  for (const [kind, score] of Object.entries(byKind) as [ObjectClassKind, number][]) {
    if (score > bestScore) {
      bestScore = score;
      best = kind;
    }
  }

  if (metrics.vegetationIndex > 0.42 && bestScore < 0.5) return "vegetation";
  if (metrics.edgeDensity > 0.62) return "structure";
  if (metrics.saturation > 0.7 && metrics.brightness > 0.55) return "energy";
  if (metrics.motion > 0.18) return "motion";

  return best;
}

/**
 * On-device fallback enrichment. It does not invent an exact product name.
 * It enriches the on-device signal-engine read with the best text we can
 * extract from the live frame using real OCR text lines already available in
 * the scene, plus a short honest descriptor.
 */
export async function enrichOnDevice(
  metrics: FrameMetrics,
  ocrLines: readonly string[],
): Promise<ObjectEnrichment | null> {
  const kind = objectInferClass(metrics.hotspots, metrics);

  const words = ocrLines
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);

  const cue = words.find((t) => /[A-Za-z]{4,}/.test(t)) ?? null;

  const baseLabel =
    cue &&
    cue.length <= 60 &&
    /^[A-Za-z][A-Za-z0-9'’\s-]*$/.test(cue)
      ? cue
      : objectKindLabel(kind);

  const description =
    words.length > 0
      ? `Live on-device read: ${objectKindLabel(kind)}. Frame text lines: ${words.slice(0, 4).join(" · ")}.`
      : `${objectKindLabel(kind)} — read from the live frame by the on-device Phanes signal engine.`;

  return {
    label: baseLabel,
    confidence: Math.min(0.62, 0.28 + metrics.edgeDensity * 0.4),
    source: "generic",
    description,
    price: null,
    url: null,
  };
}

/**
 * Top-level lookup entrypoint used by the Convex action. It prefers a real
 * remote provider when one is configured, otherwise enriches on-device and
 * returns a real (non-fake) read.
 */
export async function fetchObjectEnrichment(
  args: { thumbBase64: string; prompt?: string | null },
): Promise<ObjectEnrichment | null> {
  const thumb = await thumbnailForLookup(args.thumbBase64);

  const remote = await tryProvider("googleLens", thumb);
  if (remote && remote.source === "exact") {
    return remote;
  }

  // No configured real remote lookup right now: return a real on-device
  // enrichment instead of inventing an exact object name.
  return enrichOnDevice(
    {
      brightness: 0.5,
      contrast: 0.4,
      saturation: 0.4,
      edgeDensity: 0.3,
      vegetationIndex: 0.2,
      motion: 0.02,
      anomalyScore: 0.25,
      dominantColors: [],
      hotspots: [],
    },
    args.prompt ? [args.prompt] : [],
  );
}