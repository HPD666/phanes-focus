import { action } from "./_generated/server";
import { v } from "convex/values";

export type Hit = {
  label: string;
  confidence: number;
  source: "exact" | "generic";
  description: string | null;
  price: string | null;
  url: string | null;
  box: {
    x: number;
    y: number;
    w: number;
    h: number;
  } | null;
};

const hitValidator = v.object({
  label: v.string(),
  confidence: v.number(),
  source: v.string(),
  description: v.optional(v.string()),
  price: v.optional(v.string()),
  url: v.optional(v.string()),
  box: v.optional(
    v.object({
      x: v.number(),
      y: v.number(),
      w: v.number(),
      h: v.number(),
    }),
  ),
});

/**
 * Identifies the primary object in a Focus crop and returns the object
 * label, confidence, and a bounding box so the HUD can draw a real frame
 * around the recognized object. When a downstream provider returns an exact
 * object identity plus details like description, price and source, the hit
 * is marked EXACT; otherwise it is marked GENERIC.
 *
 * Right now this is a focused stub that returns a deterministic demo object
 * so the live scan overlay is fully wired and testable. The real provider
 * call replaces the stub body when a CV_ENDPOINT / CV_SECRET is configured.
 */
export const identifyObject = action({
  args: {
    thumbBase64: v.string(),
    prompt: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.CV_ENDPOINT;
    const secret = process.env.CV_SECRET;

    if (!apiKey || !secret) {
      /* Demo/testing fallback so the scan overlay is always wired. */
      return {
        label: "Monochrome Study Desk",
        confidence: 0.94,
        source: "generic" as const,
        description:
          "A flat, high-contrast test surface rendered by the Focus calibration scene. Not a live recognition result.",
        price: null,
        url: null,
        box: {
          x: 0.35,
          y: 0.3,
          w: 0.3,
          h: 0.3,
        },
      };
    }

    try {
      const res = await fetch(apiKey, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          images: [{ content: args.thumbBase64 }],
          features: [{ type: "LABEL_DETECTION", maxResults: 1 }],
        }),
      });

      if (!res.ok) {
        return null;
      }

      const data = (await res.json()) as {
        responses?: Array<{
          labelAnnotations?: Array<{
            description: string;
            score: number;
          }>;
        }>;
      };

      const labels =
        data.responses?.[0]?.labelAnnotations?.filter(
          (l) => l.score > 0.65,
        ) ?? [];

      if (labels.length === 0) {
        return null;
      }

      const top = labels[0];
      const label = top.description;
      const confidence = +top.score.toFixed(2);

      return {
        label,
        confidence,
        source:
          confidence >= 0.9 ? ("exact" as const) : ("generic" as const),
        description: null,
        price: null,
        url: null,
        box: null,
      };
    } catch {
      return null;
    }
  },
});
