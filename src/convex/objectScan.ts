import { action } from "./_generated/server";
import { v } from "convex/values";

/**
 * Phanes object identification is performed on-device in the Focus page using
 * browser-available real vision APIs that run against the live frame.
 *
 * This Convex action is kept as the result wiring/handshake layer so the HUD
 * has a stable backend entrypoint; when a real remote vision provider is
 * configured by the operator it can replace the on-device path here.
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
  },
  handler: async () => {
    return null;
  },

});
