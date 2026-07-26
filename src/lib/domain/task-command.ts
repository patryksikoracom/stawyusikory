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
  complianceKind: z.literal("minor-protection").optional(),
  priority: z.enum(["Wysoki", "Średni", "Niski"]),
  status: z.enum(["Do zrobienia", "W toku", "Zrobione", "Zablokowane", "Nie dotyczy"]),
  dueDate: z.iso.date().optional(),
  owner: z.string().trim().min(1).max(200),
  assigneeUserId: z.string().uuid().optional(),
  assigneeRole: z.enum(["owner", "admin", "manager", "cleaning", "marketing", "accounting", "viewer"]).optional(),
  assignmentStatus: z.enum(["Do przyjęcia", "Przyjęte", "Odrzucone"]).optional(),
  acceptedAt: z.iso.datetime().optional(),
  rejectedAt: z.iso.datetime().optional(),
  proposedStartTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  startedAt: z.iso.datetime().optional(),
  readyAt: z.iso.datetime().optional(),
  readinessEvidence: z.object({
    source: z.enum(["checklist", "owner-override"]),
    completedItems: z.number().int().nonnegative(),
    totalItems: z.number().int().nonnegative(),
    reason: z.string().trim().min(2).max(500).optional(),
  }).optional(),
  checklistTemplateId: z.string().trim().min(1).max(128).optional(),
  checklistTemplateVersion: z.number().int().positive().optional(),
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
  statusBeforeBookingDeletion: z.enum([
    "Do zrobienia",
    "W toku",
    "Zrobione",
    "Zablokowane",
    "Nie dotyczy",
  ]).optional(),
  version: z.number().int().positive().optional(),
  updatedAt: z.iso.datetime().optional(),
}).superRefine((task, context) => {
  if (task.readinessEvidence?.source === "owner-override" && !task.readinessEvidence.reason) {
    context.addIssue({
      code: "custom",
      message: "Awaryjne nadpisanie gotowości wymaga powodu.",
      path: ["readinessEvidence", "reason"],
    });
  }
  if (task.readinessEvidence && task.readinessEvidence.completedItems > task.readinessEvidence.totalItems) {
    context.addIssue({
      code: "custom",
      message: "Liczba ukończonych punktów nie może przekraczać liczby wszystkich punktów.",
      path: ["readinessEvidence", "completedItems"],
    });
  }
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
