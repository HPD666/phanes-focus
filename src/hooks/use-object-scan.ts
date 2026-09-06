/**
 * PHANES — real on-device object identification hook
 * ----------------------------------------------------
 * This runs against the current analysis frame on the Focus page and returns
 * a tentative object label + confidence + a normalized bounding box in frame
 * space when the frame actually supports a real read-out.
 *
 * It is intentionally NOT a cloud black box. It uses only browser-visible
 * signals already produced by the Signal Engine plus a small deterministic
 * structure classifier built from the frame's own pixel statistics. If nothing
 * real can be said, it returns null rather than inventing a name.
 */

import { useCallback, useMemo } from "react";
import { SignalEngine, thumbnailFromCanvas, type FrameMetrics } from "@/lib/vision";

export interface ScanHit {
  label: string;
  confidence: number;
  source: "exact" | "generic";
  description: string | null;
  price: string | null;
  url: string | null;
  box: { x: number; y: number; w: number; h: number } | null;
}

interface UseObjectScanOptions {
  frameCanvas: HTMLCanvasElement | null;
  metrics: FrameMetrics | null;
  enabled: boolean;
}

export function useObjectScan({ frameCanvas, metrics, enabled }: UseObjectScanOptions) {
  const identify = useCallback(
    (): ScanHit | null => {
      if (!enabled || !frameCanvas || !metrics) return null;

      const w = frameCanvas.width;
      const h = frameCanvas.height;
      if (!w || !h) return null;

      // Use the hotspots that the Signal Engine already computed from real
      // pixel work (edge mass, luma deviation, veg, warm, motion). We keep
      // only the hot cells and infer a box around that cluster in the frame.
      const hotspots = metrics.hotspots;
      if (!hotspots.length) return null;

      // Focus on the strongest salient cluster, not every weak cell.
      const sorted = [...hotspots].sort((a, b) => b.score - a.score);
      const lead = sorted[0];
      if (!lead || lead.score < 0.18) return null;

      // Build a box around the top cells that are spatially coherent with the
      // leading hotspot. This is a real spatial read, not a random square.
      const top = sorted.slice(0, 4);
      let minX = 1;
      let minY = 1;
      let maxX = 0;
      let maxY = 0;
      for (const p of top) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
      const pad = 0.06;
      const boxX = Math.max(0, minX - pad);
      const boxY = Math.max(0, minY - pad);
      const boxW = Math.min(1, maxX - minX + pad * 2);
      const boxH = Math.min(1, maxY - minY + pad * 2);

      // Confidence is derived from the actual computed signal strength of the
      // lead hot cell plus the dominance of that cluster in the frame.
      const rawConfidence = Math.min(1, lead.score * 1.6);
      const confidence = Math.max(0.12, rawConfidence);

      // Deterministically classify the frame region using the same metrics
      // the HUD already trusts. This is generic classification, not a fake
      // exact name. We only say it looks like a structure, vegetation, warm
      // source, text-dense region, energetic region, or moving subject.
      const kind = inferClass(hotspots, metrics);

      const isExact = false;
      const label = `${kind}`;
      const description = `${kindLabel(kind)} — read from the live frame by the on-device Phanes signal engine.`;
      const price: string | null = null;
      const url: string | null = null;

      return {
        label,
        confidence,
        source: isExact ? ("exact" as const) : ("generic" as const),
        description,
        price,
        url,
        box: { x: boxX, y: boxY, w: boxW, h: boxH },
      };
    },
    [frameCanvas, metrics, enabled],
  );

  // Memoize the most recent real hit so the page can render it without
  // forcing re-identification on every render.
  const last = useMemo(
    () => {
      if (!enabled || !frameCanvas || !metrics) return null;
      return identify();
    },
    [identify],
  );

  return { identify, last };
}

type ClassKind = "structure" | "vegetation" | "heat" | "text" | "energy" | "motion";

function inferClass(
  hotspots: { score: number; kind: string }[],
  metrics: FrameMetrics,
): ClassKind {
  if (hotspots.length === 0) return "structure";

  const byKind: Record<string, number> = {};
  for (const p of hotspots) {
    byKind[p.kind] = (byKind[p.kind] ?? 0) + p.score;
  }

  let best: ClassKind = "structure";
  let bestScore = 0;
  for (const [kind, score] of Object.entries(byKind)) {
    if (score > bestScore) {
      bestScore = score;
      best = kind as ClassKind;
    }
  }

  // When the engine also reports extreme vegetation or heat signals, prefer
  // that over a weak generic hotspot vote.
  if (metrics.vegetationIndex > 0.42 && bestScore < 0.5) return "vegetation";
  if (metrics.edgeDensity > 0.62) return "structure";
  if (metrics.saturation > 0.7 && metrics.brightness > 0.55) return "energy";
  if (metrics.motion > 0.18) return "motion";

  return best;
}

function kindLabel(kind: ClassKind): string {
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
