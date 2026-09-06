import { action } from "./_generated/server";
import { v } from "convex/values";

export type Hit = {
  label: string;
  confidence: number;
  source: "exact" | "generic";
  description: string | null;
  price: string | null;
  url: string | null;
};

const hitValidator = v.object({
  label: v.string(),
  confidence: v.number(),
  source: v.string(),
  description: v.optional(v.string()),
  price: v.optional(v.string()),
  url: v.optional(v.string()),
});

/**
 * Identifies the primary object in a Focus crop using label detection.
 * Returns a generic identification when the provider only returns a label
 * and a confidence score; returns an exact match only when a downstream
 * provider explicitly confirms the exact object identity and desired
 * details like description and price.
 *
 * The client-side ObjectScan overlay only surfaces a hit when it can be
 * shown with a confidence score and a clear source, and only marks it as
 * EXACT when the provider explicitly confirms an exact object match.
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
      return null;
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
      };
    } catch {
      return null;
    }
  },
});





