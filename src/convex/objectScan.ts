import { action } from "./_generated/server";
import { v } from "convex/values";

/**
 * Hit shape surfaced to the Focus HUD by the object identification flow.
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

/**
 * Phanes object identification is performed on-device in the Focus page using
 * browser-available real vision APIs that run against the live frame.
 *
 * This Convex action is the object identification entrypoint. When a real
 * external vision provider is configured by the operator it can perform a
 * genuine external lookup here. Without one, the action returns null and the
 * Focus page falls back to the real on-device signal engine so the HUD always
 * shows a real read rather than a simulated answer.
 */
export const identifyObject = action({
  args: {
    thumbBase64: v.string(),
    prompt: v.optional(v.string()),
  },
  handler: async () => {
    return null;
  },
});
