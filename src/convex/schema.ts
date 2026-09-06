import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // Phanes Focus — archived scene captures.
    // Every "Capture" stores the metrics the on-device Signal Engine computed
    // for a frame, plus a small thumbnail and any OCR text that was read.
    captures: defineTable({
      userId: v.string(), // owner
      lat: v.number(),
      lng: v.number(),
      heading: v.number(), // compass heading at capture time (deg)
      createdAt: v.number(),
      thumb: v.string(), // small jpeg dataURL
      note: v.optional(v.string()),
      metrics: v.object({
        brightness: v.number(),
        contrast: v.number(),
        saturation: v.number(),
        edgeDensity: v.number(),
        vegetationIndex: v.number(),
        motion: v.number(),
        anomalyScore: v.number(),
        dominantColors: v.array(
          v.object({ hex: v.string(), share: v.number() }),
        ),
        hotspots: v.array(
          v.object({
            x: v.number(),
            y: v.number(),
            score: v.number(),
            kind: v.string(),
          }),
        ),
      }),
      ocr: v.array(
        v.object({
          text: v.string(),
          confidence: v.number(),
          x: v.number(),
          y: v.number(),
        }),
      ),
    })
      .index("by_user", ["userId"])
      .index("by_user_time", ["userId", "createdAt"])
      .index("by_time", ["createdAt"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
