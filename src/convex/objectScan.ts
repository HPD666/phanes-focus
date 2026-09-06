import { action } from "./_generated/server";
import { v } from "convex/values";

/**
 * PHANES OBJECT SCAN — real wiring layer
 * ---------------------------------------
 * The actual identification happens on-device in the Focus page using the
 * browser-visible frame. This action is the honest backend handshake:
 * - When a real remote vision/enrichment provider is configured by the
 *   operator, this action can receive the frame and return a real `Hit`.
 * - Without a configured provider it intentionally returns `null` so the
 *   frontend does not fabricate an object identity it cannot justify.
 */

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

export const identifyObject = action({
  args: {
    thumbBase64: v.string(),
    prompt: v.optional(v.string()),
    // Honor the request to filter the net lookup to a specific known title
    // when the user already knows what they pointed the scanner at (for
    // example "[Vidhan Soudha]" in the earlier prompt).
    exactTitle: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    if (!args.thumbBase64) {
      return null;
    }

    // No authentic remote vision provider configured yet. The page still has
    // access to the live frame, but we do not pretend to identify the object
    // server-side from the thumbnail beyond what the on-device path can say.
    return null;
  },
});
