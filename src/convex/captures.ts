import { getAuthUserId } from "@convex-dev/auth/server";
import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";

const hotspot = v.object({
  x: v.number(),
  y: v.number(),
  score: v.number(),
  kind: v.string(),
});

const ocrText = v.object({
  text: v.string(),
  confidence: v.number(),
  x: v.number(),
  y: v.number(),
});

const metricsValidator = v.object({
  brightness: v.number(),
  contrast: v.number(),
  saturation: v.number(),
  edgeDensity: v.number(),
  vegetationIndex: v.number(),
  motion: v.number(),
  anomalyScore: v.number(),
  dominantColors: v.array(v.object({ hex: v.string(), share: v.number() })),
  hotspots: v.array(hotspot),
});

/** Archives a scene capture for the signed-in user. */
export const create = mutation({
  args: {
    lat: v.number(),
    lng: v.number(),
    heading: v.number(),
    thumb: v.string(),
    note: v.optional(v.string()),
    metrics: metricsValidator,
    ocr: v.array(ocrText),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not signed in");
    }
    const id = await ctx.db.insert("captures", {
      userId,
      lat: args.lat,
      lng: args.lng,
      heading: args.heading,
      createdAt: Date.now(),
      thumb: args.thumb,
      note: args.note,
      metrics: args.metrics,
      ocr: args.ocr,
    });
    return id;
  },
});

/** Deletes one of the signed-in user's captures (ownership checked). */
export const remove = mutation({
  args: { id: v.id("captures") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not signed in");
    }
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== userId) {
      throw new Error("Capture not found");
    }
    await ctx.db.delete(args.id);
    return true;
  },
});

/** The signed-in user's most recent captures (with thumbs, for History layer). */
export const listForUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return [];
    }
    return await ctx.db
      .query("captures")
      .withIndex("by_user_time", (q) => q.eq("userId", userId))
      .order("desc")
      .take(120);
  },
});

/** Lightweight recent activity from all users (last 24h, no thumbs) — feeds
 *  the Flow / Signals beacon layers with real data from other operators.
 */
export const recentActivity = query({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const rows = await ctx.db
      .query("captures")
      .withIndex("by_time", (q) => q.gte("createdAt", cutoff))
      .order("desc")
      .take(60);
    return rows.map((row) => ({
      id: row._id,
      lat: row.lat,
      lng: row.lng,
      heading: row.heading,
      createdAt: row.createdAt,
      userId: row.userId,
      anomalyScore: row.metrics.anomalyScore,
    }));
  },
});

/** Optional cloud-brain for the Phanes assistant.
 *
 * Phanes is designed to be free forever with no paid dependencies, so the
 * default, always-on brain is the on-device engine in `src/lib/ai.ts`, which
 * answers the operator using ONLY real live telemetry — no API key, no cloud
 * bill, no outage surface.
 *
 * This action exists as an OPTIONAL user opt-in only. If the operator
 * explicitly enables a cloud provider in the AI panel, this action is called.
 * The only provider wired here is the Vly integration gateway (already present
 * via the project's VLY_INTEGRATION_KEY). SambaNova has been removed because
 * it is a paid-tier path that breaks the free-forever goal.
 *
 * If no cloud provider has been chosen, or the call fails, this action returns
 * null and the client falls back to the on-device engine — which keeps Phanes
 * fully functional and free forever at zero cost.
 */
export const ask = action({
  args: {
    prompt: v.string(),
    scene: v.string(), // compact JSON context assembled by the client
  },
  handler: async (_ctx, args) => {
    // Cloud brain is opt-in only. Enabled from the AI panel via the
    // VLY_INTEGRATION_KEY that ships with this project.
    const vlyKey = process.env.VLY_INTEGRATION_KEY;
    if (!vlyKey) {
      return null;
    }

    try {
      const { vly } = await import("../lib/vly-integrations");
      const result = await vly.ai.completion({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content:
              "You are PHANES, the on-head AI of a Focus-style augmented-reality device. " +
              "Answer the operator about their current scene using ONLY the supplied telemetry. " +
              "Be precise, terse, and a little technical, like a HUD assistant. Never invent data " +
              "that is not in the context. Format with short lines, no markdown headers.",
          },
          {
            role: "user",
            content: `SCENE TELEMETRY:\n${args.scene}\n\nOPERATOR QUESTION:\n${args.prompt}`,
          },
        ],
        temperature: 0.4,
        maxTokens: 500,
      });
      if (result.success && result.data?.choices?.[0]?.message?.content) {
        return result.data.choices[0].message.content;
      }
    } catch {
      // cloud brain unavailable — fall back to on-device engine
    }

    return null;
  },
});