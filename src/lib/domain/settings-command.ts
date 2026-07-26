import { z } from "zod";

const clockTime = z.string().regex(
  /^([01]\d|2[0-3]):[0-5]\d$/,
  "Godzina musi mieć format HH:mm.",
);

export const operationalSettingsSchema = z.object({
  organizationName: z.string().trim().min(1).max(200),
  timezone: z.literal("Europe/Warsaw"),
  cleaningContactName: z.string().trim().max(200),
  cleaningPhone: z.string().trim().max(32),
  defaultCheckIn: clockTime,
  defaultCheckOut: clockTime,
  aiApprovalRequired: z.boolean(),
  version: z.number().int().positive().optional(),
  updatedAt: z.iso.datetime().optional(),
});

export const updateSettingsCommandSchema = z.object({
  settings: operationalSettingsSchema,
  expectedRecordVersion: z.number().int().nonnegative(),
  requestId: z.string().trim().min(8).max(128),
  clientSentAt: z.iso.datetime(),
  tabId: z.string().trim().min(8).max(128),
});

export type OperationalSettings = z.infer<typeof operationalSettingsSchema>;

export type UpdateSettingsCommandResult = {
  status: "committed" | "conflict";
  settings?: OperationalSettings;
  recordVersion?: number;
  stateVersion?: number;
  savedAt?: string;
};
