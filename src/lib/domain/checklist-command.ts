import { z } from "zod";

export const operationalChecklistItemSchema = z.object({
  id: z.string().trim().min(1).max(128),
  taskId: z.string().trim().min(1).max(128),
  label: z.string().trim().min(1).max(500),
  done: z.boolean(),
  completedAt: z.iso.datetime().optional(),
  kind: z.enum(["stały", "sezonowy", "jednorazowy", "handoff", "usterka"]).optional(),
  templateId: z.string().trim().min(1).max(128).optional(),
  templateVersion: z.number().int().positive().optional(),
  version: z.number().int().positive().optional(),
  updatedAt: z.iso.datetime().optional(),
});

export const updateChecklistItemCommandSchema = z.object({
  item: operationalChecklistItemSchema,
  expectedRecordVersion: z.number().int().positive(),
  requestId: z.string().trim().min(8).max(128),
  clientSentAt: z.iso.datetime(),
  tabId: z.string().trim().min(8).max(128),
});

export type UpdateChecklistItemCommandResult = {
  status: "committed" | "conflict" | "not_found" | "task_not_found";
  item?: z.infer<typeof operationalChecklistItemSchema>;
  recordVersion?: number;
  stateVersion?: number;
  savedAt?: string;
};
