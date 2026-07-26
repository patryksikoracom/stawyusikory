import { addLocalDays } from "@/lib/date";
import type {
  AppData,
  CleaningChecklistTemplate,
  OpsTask,
  TaskChecklistItem,
  UserRole,
} from "@/lib/types";

export const defaultCleaningChecklistTemplates: CleaningChecklistTemplate[] = [{
  id: "cleaning-standard-v1",
  version: 1,
  effectiveFrom: "2026-07-01",
  items: [
    { id: "prepare", label: "Przygotuj chemię, tekstylia i zapasy", kind: "stały" },
    { id: "walkthrough", label: "Wykonaj obchód, zgłoś szkody i wynieś śmieci", kind: "stały" },
    { id: "dishwasher", label: "Uruchom, a na końcu opróżnij zmywarkę", kind: "stały" },
    { id: "textiles", label: "Wymień pościel i ręczniki", kind: "stały" },
    { id: "surfaces", label: "Umyj kuchnię, meble i powierzchnie od góry", kind: "stały" },
    { id: "bathroom", label: "Umyj łazienkę od najczystszych miejsc do toalety", kind: "stały" },
    { id: "vacuum", label: "Odkurz cały domek", kind: "stały" },
    { id: "floors", label: "Umyj podłogi od najdalszego miejsca do wyjścia", kind: "stały" },
    { id: "supplies", label: "Uzupełnij wyposażenie i zapasy", kind: "stały" },
    { id: "final", label: "Wykonaj kontrolę końcową i zdjęcia", kind: "stały" },
  ],
}];

function applicableTemplate(
  templates: CleaningChecklistTemplate[],
  unitId: string | undefined,
  date: string,
) {
  return templates
    .filter((template) =>
      (!template.unitId || template.unitId === unitId)
      && template.effectiveFrom <= date
      && (!template.effectiveTo || template.effectiveTo >= date),
    )
    .sort((left, right) => {
      const specificity = Number(Boolean(right.unitId)) - Number(Boolean(left.unitId));
      return specificity || right.version - left.version;
    })[0];
}

export function instantiateCleaningChecklist(
  task: OpsTask,
  date: string,
  templates = defaultCleaningChecklistTemplates,
  extras: Array<Pick<TaskChecklistItem, "label" | "kind">> = [],
): TaskChecklistItem[] {
  const template = applicableTemplate(templates, task.unitId, date);
  if (!template) return [];
  const month = Number(date.slice(5, 7));
  const baseItems = template.items.filter(
    (item) => item.kind !== "sezonowy" || !item.activeMonths || item.activeMonths.includes(month),
  );
  return [
    ...baseItems.map((item) => ({
      id: `${task.id}-${template.id}-${item.id}`,
      taskId: task.id,
      label: item.label,
      done: false,
      kind: item.kind,
      templateId: template.id,
      templateVersion: template.version,
    })),
    ...extras.map((item, index) => ({
      id: `${task.id}-extra-${index}`,
      taskId: task.id,
      label: item.label,
      done: false,
      kind: item.kind ?? "jednorazowy",
      templateId: template.id,
      templateVersion: template.version,
    })),
  ];
}

export type TeamTaskQueues = {
  mine: OpsTask[];
  team: OpsTask[];
  overdue: OpsTask[];
};

export type TaskNotificationPreference = {
  userId?: string;
  role?: UserRole;
  enabled: boolean;
  minimumPriority: OpsTask["priority"];
  daysBeforeDue: number;
};

export function deriveTeamTaskQueues(
  tasks: OpsTask[],
  identity: { userId?: string | null; role?: UserRole | null; displayName?: string },
  today: string,
): TeamTaskQueues {
  const team = tasks.filter((task) => !["Zrobione", "Nie dotyczy"].includes(task.status));
  const mine = team.filter((task) =>
    (identity.userId && task.assigneeUserId === identity.userId)
    || (identity.role && task.assigneeRole === identity.role)
    || (identity.displayName && task.owner === identity.displayName),
  );
  const overdue = team.filter((task) => Boolean(task.dueDate && task.dueDate < today));
  return { mine, team, overdue };
}

const priorityRank: Record<OpsTask["priority"], number> = {
  Niski: 1,
  Średni: 2,
  Wysoki: 3,
};

export function deriveTaskNotifications(
  tasks: OpsTask[],
  preferences: TaskNotificationPreference[],
  today: string,
) {
  return tasks.flatMap((task) => {
    if (!task.dueDate || ["Zrobione", "Nie dotyczy"].includes(task.status)) return [];
    const preference = preferences.find((item) =>
      item.enabled
      && ((item.userId && item.userId === task.assigneeUserId)
        || (item.role && item.role === task.assigneeRole)),
    );
    if (!preference || priorityRank[task.priority] < priorityRank[preference.minimumPriority]) return [];
    const notifyFrom = addLocalDays(task.dueDate, -preference.daysBeforeDue);
    if (today < notifyFrom) return [];
    return [{
      id: `task-${task.id}-${task.dueDate}`,
      taskId: task.id,
      dueDate: task.dueDate,
      overdue: task.dueDate < today,
      reason: task.dueDate < today ? "Zadanie jest przeterminowane." : "Zbliża się termin zadania.",
    }];
  });
}

export type UnitOperationalState =
  | "Goście"
  | "Wyjazd dzisiaj"
  | "Do sprzątania"
  | "W toku"
  | "Gotowy"
  | "Zablokowany usterką";

export function deriveUnitOperationalStates(data: AppData, today: string) {
  return data.units.map((unit) => {
    const currentStay = data.bookings.find((booking) =>
      booking.unitId === unit.id
      && booking.workflowStatus !== "Anulowana"
      && !booking.deletedAt
      && booking.checkIn <= today
      && booking.checkOut > today,
    );
    const departureToday = data.bookings.some((booking) =>
      booking.unitId === unit.id
      && booking.workflowStatus !== "Anulowana"
      && !booking.deletedAt
      && booking.checkOut === today,
    );
    const cleaning = data.tasks
      .filter((task) => task.type === "Sprzątanie" && task.unitId === unit.id && task.dueDate && task.dueDate <= today)
      .sort((left, right) => (right.dueDate ?? "").localeCompare(left.dueDate ?? ""))[0];
    const state: UnitOperationalState = cleaning?.status === "Zablokowane"
      ? "Zablokowany usterką"
      : cleaning?.status === "W toku"
        ? "W toku"
        : cleaning?.status === "Zrobione" && Boolean(cleaning.readyAt && cleaning.readinessEvidence)
          ? "Gotowy"
          : currentStay
            ? "Goście"
            : departureToday
              ? "Wyjazd dzisiaj"
              : "Do sprzątania";
    return { unitId: unit.id, state, evidence: cleaning?.readinessEvidence };
  });
}

function dayDistance(from: string, to: string) {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
}

export function deriveRefreshSuggestions(data: AppData, today: string) {
  return data.bookings
    .filter((booking) =>
      booking.workflowStatus !== "Anulowana"
      && !booking.deletedAt
      && booking.checkIn >= today,
    )
    .flatMap((booking) => {
      const lastReady = data.tasks
        .filter((task) =>
          task.type === "Sprzątanie"
          && task.unitId === booking.unitId
          && task.status === "Zrobione"
          && Boolean(task.readyAt)
          && task.readyAt!.slice(0, 10) <= booking.checkIn,
        )
        .sort((left, right) => (right.readyAt ?? "").localeCompare(left.readyAt ?? ""))[0];
      if (!lastReady?.readyAt || dayDistance(lastReady.readyAt.slice(0, 10), booking.checkIn) <= 7) return [];
      return [{
        bookingId: booking.id,
        unitId: booking.unitId,
        lastReadyAt: lastReady.readyAt,
        refreshDueDate: addLocalDays(booking.checkIn, -1),
        reason: "Od ostatniego potwierdzonego sprzątania lub kontroli minęło ponad 7 dni.",
      }];
    });
}

function bookingHasConfirmedDeposit(data: AppData, bookingId: string) {
  const booking = data.bookings.find((item) => item.id === bookingId);
  if (!booking) return false;
  if ((booking.openingPaidAmount ?? 0) > 0) return true;
  return data.payments.some((payment) =>
    payment.bookingId === bookingId
    && payment.status === "Zaksięgowana"
    && (payment.type === "Wpłata" || payment.type === "Zaliczka")
    && payment.amount > 0,
  );
}

export function deriveWeeklyCleaningPlan(data: AppData, today: string) {
  const lastDay = addLocalDays(today, 7);
  return data.tasks.filter((task) =>
    task.type === "Sprzątanie"
    && task.status !== "Nie dotyczy"
    && Boolean(task.dueDate && task.dueDate >= today && task.dueDate <= lastDay)
    && bookingHasConfirmedDeposit(data, task.bookingId),
  );
}

export function deriveKeyHandoffGate(data: AppData, bookingId: string) {
  const booking = data.bookings.find((item) => item.id === bookingId);
  if (!booking) return null;
  const readiness = deriveUnitOperationalStates(data, booking.checkIn)
    .find((item) => item.unitId === booking.unitId);
  return {
    bookingId,
    unitId: booking.unitId,
    ready: readiness?.state === "Gotowy",
    paymentConfirmed: bookingHasConfirmedDeposit(data, bookingId),
    minorProcedure: booking.children > 0 ? "Wymaga potwierdzenia PR-9c" as const : "Nie dotyczy" as const,
  };
}
