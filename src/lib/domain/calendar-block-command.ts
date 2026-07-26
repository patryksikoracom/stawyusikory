import { z } from "zod";

export const calendarBlockTypes = [
  "Właściciel",
  "Serwis",
  "Remont",
  "Bufor sprzątania",
  "Influencer/barter",
  "Inne",
] as const;

export const calendarBlockStatuses = [
  "Planowana",
  "Aktywna",
  "Zakończona",
  "Anulowana",
] as const;

export const operationalCalendarBlockSchema = z.object({
  id: z.string().trim().min(1).max(128),
  unitId: z.string().trim().min(1).max(128),
  dateFrom: z.iso.date(),
  dateTo: z.iso.date(),
  blockType: z.enum(calendarBlockTypes),
  reason: z.string().trim().min(1).max(1_000),
  status: z.enum(calendarBlockStatuses),
  version: z.number().int().positive().optional(),
  updatedAt: z.iso.datetime().optional(),
}).superRefine((block, context) => {
  if (block.dateTo <= block.dateFrom) {
    context.addIssue({
      code: "custom",
      path: ["dateTo"],
      message: "Data końcowa musi być późniejsza niż początkowa.",
    });
  }
});

const commandMetadataSchema = z.object({
  requestId: z.string().trim().min(8).max(128),
  clientSentAt: z.iso.datetime(),
  tabId: z.string().trim().min(8).max(128),
});

export const createCalendarBlockCommandSchema = commandMetadataSchema.extend({
  block: operationalCalendarBlockSchema.safeExtend({
    version: z.literal(1),
  }),
  expectedRecordVersion: z.literal(0),
});

export const updateCalendarBlockCommandSchema = commandMetadataSchema.extend({
  block: operationalCalendarBlockSchema,
  expectedRecordVersion: z.number().int().positive(),
}).superRefine((command, context) => {
  if (command.block.version !== command.expectedRecordVersion + 1) {
    context.addIssue({
      code: "custom",
      path: ["block", "version"],
      message: "Wersja blokady nie jest kolejną wersją rekordu.",
    });
  }
});

export type CalendarBlockCommandResult = {
  status:
    | "committed"
    | "already_committed"
    | "conflict"
    | "exists"
    | "not_found"
    | "unit_not_found"
    | "availability_conflict";
  block?: z.infer<typeof operationalCalendarBlockSchema>;
  recordVersion?: number;
  stateVersion?: number;
  savedAt?: string;
  conflictType?: "booking" | "block";
  conflictId?: string;
};
