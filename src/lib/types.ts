import { z } from "zod";

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const date = new Date(`${s}T12:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === s;
  }, "Invalid calendar date");

export const documentSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  text: z.string().min(10).max(50000),
  kind: z.enum(["sample", "text", "pdf", "image"]),
  publishedDate: isoDate.nullable(),
  createdAt: z.string(),
});

export const actionSchema = z.object({
  id: z.string(),
  kind: z.enum(["submit", "pay", "bring", "attend", "confirm", "other"]),
  summary: z.string(),
  summaryHi: z.string().nullable(),
  evidence: z.object({
    quote: z.string(),
    start: z.number().int().nonnegative(),
    end: z.number().int().nonnegative(),
  }),
  dueDate: isoDate.nullable(),
  dueLabel: z.string().nullable(),
  dateIssue: z.string().nullable(),
  completed: z.boolean(),
  reviewed: z.boolean(),
  obligation: z.enum(["required", "optional"]),
  change: z.enum(["added", "updated", "unchanged"]).nullable(),
  previous: z
    .object({ summary: z.string(), dueDate: isoDate.nullable(), dueLabel: z.string().nullable() })
    .optional(),
});

export const analysisSchema = z.object({
  id: z.string(),
  document: documentSchema,
  title: z.string(),
  audience: z.string(),
  summary: z.string(),
  summaryHi: z.string().nullable(),
  actions: z.array(actionSchema).max(60),
  mode: z.enum(["local", "ai"]),
  warning: z.string().optional(),
  version: z.number().int().positive(),
  revision: z
    .object({
      previousTitle: z.string(),
      previousDocument: documentSchema,
      removed: z.array(actionSchema),
      changedCount: z.number(),
    })
    .optional(),
});

export const profileSchema = z.object({
  name: z.string().max(28),
  school: z.string().max(70),
  className: z.string().max(30),
});

export const workspaceSchema = z.object({
  version: z.literal(1),
  notices: z.array(analysisSchema).max(20),
  activeId: z.string(),
  language: z.enum(["en", "hi"]),
  profile: profileSchema.default({ name: "", school: "", className: "" }),
});

export type SourceDocument = z.infer<typeof documentSchema>;
export type ActionItem = z.infer<typeof actionSchema>;
export type NoticeAnalysis = z.infer<typeof analysisSchema>;
export type Workspace = z.infer<typeof workspaceSchema>;
export type Language = Workspace["language"];
export type BoardProfile = z.infer<typeof profileSchema>;
