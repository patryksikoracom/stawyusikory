type OperationalRecord = {
  entity_type: string;
  entity_id: string;
  payload: unknown;
};

type JsonRecord = Record<string, unknown>;

export type CleaningChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  completedAt?: string;
};

export type CleaningJob = {
  id: string;
  unit: { id: string; name: string };
  dueDate?: string;
  status: "Do zrobienia" | "W toku" | "Zrobione" | "Zablokowane";
  priority: "Wysoki" | "Średni" | "Niski";
  departureTime: string;
  nextArrival: null | {
    date: string;
    time: string;
    people: number;
    adults: number;
    children: number;
  };
  sameDayTurnover: boolean;
  bedsToPrepare: number;
  bedrooms: number;
  handoffNote?: string;
  blocker?: string;
  checklist: CleaningChecklistItem[];
};

export type CleaningDashboard = {
  organizationName: string;
  defaultCheckIn: string;
  defaultCheckOut: string;
  jobs: CleaningJob[];
};

function object(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function recordsOf(records: OperationalRecord[], type: string) {
  return records.filter((record) => record.entity_type === type).map((record) => object(record.payload)).filter((item): item is JsonRecord => Boolean(item));
}

export function buildCleaningDashboard(records: OperationalRecord[]): CleaningDashboard {
  const settings = recordsOf(records, "settings")[0] ?? {};
  const defaultCheckIn = text(settings.defaultCheckIn) ?? "16:00";
  const defaultCheckOut = text(settings.defaultCheckOut) ?? "11:00";
  const units = recordsOf(records, "units");
  const bookings = recordsOf(records, "bookings");
  const tasks = recordsOf(records, "tasks");
  const checklistItems = recordsOf(records, "checklistItems");
  const debriefs = recordsOf(records, "departureDebriefs");

  const jobs = tasks
    .filter((task) => task.type === "Sprzątanie" && task.status !== "Nie dotyczy")
    .map((task): CleaningJob | null => {
      const id = text(task.id);
      const unitId = text(task.unitId);
      if (!id || !unitId) return null;
      const unit = units.find((item) => item.id === unitId);
      const bookingId = text(task.bookingId);
      const previousBooking = bookings.find((item) => item.id === bookingId);
      const dueDate = text(task.dueDate) ?? text(previousBooking?.checkOut);
      const nextBooking = bookings
        .filter((item) => item.unitId === unitId && item.id !== bookingId && item.workflowStatus !== "Anulowana" && text(item.checkIn) && (!dueDate || String(item.checkIn) >= dueDate))
        .sort((left, right) => String(left.checkIn).localeCompare(String(right.checkIn)))[0];
      const adults = number(nextBooking?.adults);
      const children = number(nextBooking?.children);
      const nextArrivalDate = text(nextBooking?.checkIn);
      const debrief = debriefs.find((item) => item.bookingId === bookingId);
      const rawStatus = text(task.status);
      const status: CleaningJob["status"] = rawStatus === "W toku" || rawStatus === "Zrobione" || rawStatus === "Zablokowane" ? rawStatus : "Do zrobienia";
      const rawPriority = text(task.priority);
      const priority: CleaningJob["priority"] = rawPriority === "Wysoki" || rawPriority === "Niski" ? rawPriority : "Średni";

      return {
        id,
        unit: { id: unitId, name: text(unit?.name) ?? "Domek" },
        dueDate,
        status,
        priority,
        departureTime: text(previousBooking?.departureTime) ?? defaultCheckOut,
        nextArrival: nextArrivalDate ? {
          date: nextArrivalDate,
          time: text(nextBooking?.arrivalTime) ?? defaultCheckIn,
          people: adults + children,
          adults,
          children,
        } : null,
        sameDayTurnover: Boolean(dueDate && nextArrivalDate === dueDate),
        bedsToPrepare: adults + children,
        bedrooms: number(unit?.bedrooms),
        handoffNote: text(debrief?.cleaningHandoff),
        blocker: text(task.blocker),
        checklist: checklistItems
          .filter((item) => item.taskId === id)
          .map((item) => ({
            id: text(item.id) ?? "",
            label: text(item.label) ?? "Element checklisty",
            done: item.done === true,
            completedAt: text(item.completedAt),
          }))
          .filter((item) => item.id),
      };
    })
    .filter((job): job is CleaningJob => Boolean(job))
    .sort((left, right) => (left.dueDate ?? "9999").localeCompare(right.dueDate ?? "9999"));

  return {
    organizationName: text(settings.organizationName) ?? "Stawy u Sikory",
    defaultCheckIn,
    defaultCheckOut,
    jobs,
  };
}
