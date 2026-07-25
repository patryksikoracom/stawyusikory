import { z } from "zod";

const optionalText = z.string().trim().max(2_000).optional();

export const operationalTaskSchema = z.object({
  id: z.string().trim().min(1).max(128),
  bookingId: z.string().trim().min(1).max(128),
  type: z.enum([
    "Dane",
    "Rezerwacja",
    "Płatność",
    "Przed przyjazdem",
    "Sprzątanie",
    "Content",
    "Opinia",
    "Follow-up",
    "Naprawa",
    "Inne",
  ]),
  priority: z.enum(["Wysoki", "Średni", "Niski"]),
  status: z.enum(["Do zrobienia", "W toku", "Zrobione", "Zablokowane", "Nie dotyczy"]),
  dueDate: z.iso.date().optional(),
  owner: z.string().trim().min(1).max(200),
  unitId: z.string().trim().max(128).optional(),
  title: z.string().trim().min(1).max(500),
  blocker: optionalText,
  completedAt: z.union([z.iso.date(), z.iso.datetime()]).optional(),
  comment: optionalText,
  issueId: z.string().trim().max(128).optional(),
  planningHorizon: z.enum([
    "Do oceny",
    "Przed następnym przyjazdem",
    "W tym tygodniu",
    "Po sezonie",
    "Backlog",
  ]).optional(),
  version: z.number().int().positive().optional(),
  updatedAt: z.iso.datetime().optional(),
});

export const updateTaskCommandSchema = z.object({
  task: operationalTaskSchema,
  expectedRecordVersion: z.number().int().positive(),
  requestId: z.string().trim().min(8).max(128),
  clientSentAt: z.iso.datetime(),
  tabId: z.string().trim().min(8).max(128),
});

export type UpdateTaskCommandResult = {
  status: "committed" | "conflict" | "not_found";
  task?: z.infer<typeof operationalTaskSchema>;
  recordVersion?: number;
  stateVersion?: number;
  savedAt?: string;
};
