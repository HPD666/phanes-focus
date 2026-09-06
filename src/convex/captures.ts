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

export const metricsValidator = v.object({
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

/**
 * Archives a scene capture for the signed-in user.
 */
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

/**
 * Deletes one of the signed-in user's captures (ownership checked).
 */
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
  },
});

/**
 * The signed-in user's most recent captures (with thumbs, for History layer).
 */
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

/**
 * Lightweight recent activity from all users (last 24h, no thumbs) — feeds
 * the Flow / Signals beacon layers with real data from other operators.
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

/**
 * Optional cloud-brain for the Phanes assistant.
 *
 * If the operator has pasted a SAMBANOVA_API_KEY into the project keys, this
 * action calls SambaNova's OpenAI-compatible endpoint with an open model
 * (generous free tier — the app stays free). Without a key it returns null
 * and the client uses the on-device engine, so Phanes works forever with
 * zero infrastructure cost.
 */
export const ask = action({
  args: {
    prompt: v.string(),
    scene: v.string(), // compact JSON context assembled by the client
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.SAMBANOVA_API_KEY;
    if (!apiKey) {
      return null;
    }
    try {
      const res = await fetch("https://api.sambanova.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "meta-llama/Llama-3.1-70B-Instruct",
          temperature: 0.4,
          max_tokens: 500,
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
        }),
      });
      if (!res.ok) {
        return null;
      }
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      return data.choices?.[0]?.message?.content ?? null;
    } catch {
      return null;
    }
  },
});