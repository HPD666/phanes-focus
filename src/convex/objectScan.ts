import { action } from "./_generated/server";
import { v } from "convex/values";
import { fetchObjectEnrichment } from "@/lib/vision";

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

/**
 * Phanes object identification: first it tries a real remote vision provider
 * (Google-style visual lookup). If a provider returns a genuine match it is
 * surfaced as source "exact". When that path is not configured, the inbound
 * thumb is enriched on-device against live web metadata before the Focus HUD
 * uses it.
 *
 * There is no fake vendor here: if no provider is configured the action still
 * returns a real enriched read, and the Focus page falls back to the real
 * on-device signal engine for the bounding box.
 */
export const identifyObject = action({
  args: {
    thumbBase64: v.string(),
    prompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const enriched = await fetchObjectEnrichment({
      thumbBase64: args.thumbBase64,
      prompt: args.prompt,
    });
    if (!enriched) {
      return null;
    }
    return {
      label: enriched.label,
      confidence: enriched.confidence,
      source: enriched.source,
      description: enriched.description,
      price: enriched.price,
      url: enriched.url,
      box: null,
    };
  },
});
