import { addLocalDays } from "@/lib/date";
import type { AppData, Booking, OpsTask, UserRole } from "@/lib/types";

export type MinorProtectionOutcome = "Bez uwag" | "Wymaga reakcji";
export type MinorProtectionReactionStatus = "Otwarte" | "Przyjęte" | "Zamknięte";

export type MinorProtectionStandard = {
  id: string;
  version: string;
  approvedAt: string;
  effectiveFrom: string;
  reviewDueAt: string;
  fullDocumentUrl: string;
  childFriendlyDocumentUrl: string;
  reviewOwner: string;
  staffPreparationReference: string;
  publicationConfirmed: boolean;
  premisesDisplayConfirmed: boolean;
  steps: readonly string[];
  active: boolean;
};

export type MinorProtectionExecution = {
  bookingId: string;
  required: true;
  performed: true;
  performedAt: string;
  performedBy: string;
  standardId: string;
  standardVersion: string;
  outcome: MinorProtectionOutcome;
};

export type MinorProtectionReaction = {
  bookingId: string;
  status: MinorProtectionReactionStatus;
  openedAt: string;
  acknowledgedAt?: string;
  closedAt?: string;
  resolutionReference?: string;
};

export function requiresMinorProtection(booking: Pick<Booking, "children" | "workflowStatus" | "deletedAt">) {
  return booking.children > 0 && booking.workflowStatus !== "Anulowana" && !booking.deletedAt;
}

export function createMinorProtectionTask(booking: Booking, id: string): OpsTask | null {
  if (!requiresMinorProtection(booking)) return null;
  return {
    id,
    bookingId: booking.id,
    type: "Przed przyjazdem",
    complianceKind: "minor-protection",
    priority: "Wysoki",
    status: "Do zrobienia",
    dueDate: booking.checkIn,
    owner: "Operacje",
    assigneeRole: "manager",
    unitId: booking.unitId,
    title: "Wykonać zatwierdzoną procedurę ochrony małoletnich przed wydaniem kluczy.",
  };
}

export function validateStandardReviewWindow(
  standard: Pick<MinorProtectionStandard, "effectiveFrom" | "reviewDueAt">,
) {
  return standard.reviewDueAt > standard.effectiveFrom
    && standard.reviewDueAt <= addLocalDays(standard.effectiveFrom, 731);
}

export type MinorProtectionGate =
  | "Nie dotyczy"
  | "Brak aktywnego SOP"
  | "Do wykonania"
  | "Wymaga reakcji"
  | "Wykonana";

export function deriveMinorProtectionGate(
  booking: Booking,
  standard: MinorProtectionStandard | null,
  execution: MinorProtectionExecution | null,
  reaction: MinorProtectionReaction | null,
): MinorProtectionGate {
  if (!requiresMinorProtection(booking)) return "Nie dotyczy";
  if (!standard?.active || standard.effectiveFrom > booking.checkIn) return "Brak aktywnego SOP";
  if (!execution?.performed || execution.standardId !== standard.id) return "Do wykonania";
  if (execution.outcome === "Wymaga reakcji" && reaction?.status !== "Zamknięte") return "Wymaga reakcji";
  return "Wykonana";
}

export function canManageMinorProtectionStandard(role: UserRole | null | undefined) {
  return role === "owner" || role === "admin";
}

export function canExecuteMinorProtection(role: UserRole | null | undefined) {
  return role === "owner" || role === "admin" || role === "manager";
}

export function deriveMinorProtectionTasks(data: AppData) {
  return data.bookings.flatMap((booking) => {
    const task = createMinorProtectionTask(booking, `${booking.id}-minor-protection`);
    return task ? [task] : [];
  });
}
