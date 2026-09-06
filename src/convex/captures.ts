import { getAuthUserId } from "@convex-dev/auth/server";
import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { vly } from "../lib/vly-integrations";

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
 * Two interchangeable cloud providers, tried in order so Phanes keeps working
 * even if one provider is down or its key is missing:
 *
 * 1. SambaNova (free tier, open models) — configured with SAMBANOVA_API_KEY
 *    in the project keys. OpenAI-compatible endpoint, Meta-Llama 3.1 70B.
 * 2. Vly Integrations (free tier, billed through the Vly project key) —
 *    the project's VLY_INTEGRATION_KEY is already injected, so no extra key
 *    is required. Falls back here when SambaNova is unavailable.
 *
 * When neither provider is available the action returns null and the client
 * uses the on-device engine, so Phanes works forever at zero cost either way.
 */
export const ask = action({
  args: {
    prompt: v.string(),
    scene: v.string(), // compact JSON context assembled by the client
  },
  handler: async (_ctx, args) => {
    const sambanovaKey = process.env.SAMBANOVA_API_KEY;

    // Provider 1 — SambaNova (open model, free tier)
    if (sambanovaKey) {
      try {
        const res = await fetch("https://api.sambanova.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${sambanovaKey}`,
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
        if (res.ok) {
          const data = (await res.json()) as {
            choices?: { message?: { content?: string } }[];
          };
          const content = data.choices?.[0]?.message?.content ?? null;
          if (content) return content;
        }
      } catch {
        // SambaNova failed — fall through to the Vly provider
      }
    }

    // Provider 2 — Vly Integrations (free tier, already wired via VLY_INTEGRATION_KEY)
    try {
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
      // Vly also failed — fall through to on-device engine
    }

    return null;
  },
});