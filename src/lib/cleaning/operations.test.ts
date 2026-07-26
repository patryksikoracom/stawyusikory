import { describe, expect, it } from "vitest";
import { initialData } from "@/lib/demo-data";
import type { CleaningChecklistTemplate, OpsTask } from "@/lib/types";
import {
  deriveRefreshSuggestions,
  deriveKeyHandoffGate,
  deriveTaskNotifications,
  deriveTeamTaskQueues,
  deriveUnitOperationalStates,
  deriveWeeklyCleaningPlan,
  instantiateCleaningChecklist,
} from "./operations";

const task: OpsTask = {
  id: "clean-1",
  bookingId: "booking-1",
  unitId: "unit-1",
  type: "Sprzątanie",
  priority: "Wysoki",
  status: "Do zrobienia",
  owner: "Sprzątanie",
  title: "Turnover",
};

describe("operacje zespołu PR-9b", () => {
  it("wybiera najnowszy szablon domku i dodaje wyjątki z pochodzeniem", () => {
    const templates: CleaningChecklistTemplate[] = [
      {
        id: "global",
        version: 1,
        effectiveFrom: "2026-01-01",
        items: [{ id: "base", label: "Standard", kind: "stały" }],
      },
      {
        id: "unit",
        unitId: "unit-1",
        version: 2,
        effectiveFrom: "2026-07-01",
        items: [
          { id: "base", label: "Standard domku", kind: "stały" },
          { id: "summer", label: "Sprawdź taras", kind: "sezonowy", activeMonths: [7, 8] },
        ],
      },
    ];

    const items = instantiateCleaningChecklist(task, "2026-07-26", templates, [
      { label: "Sprawdź lampkę po poprzednim pobycie", kind: "handoff" },
    ]);

    expect(items.map((item) => item.label)).toEqual([
      "Standard domku",
      "Sprawdź taras",
      "Sprawdź lampkę po poprzednim pobycie",
    ]);
    expect(items.every((item) => item.templateId === "unit" && item.templateVersion === 2)).toBe(true);
  });

  it("rozdziela kolejki moje, zespołu i przeterminowane", () => {
    const tasks: OpsTask[] = [
      { ...task, id: "mine", assigneeRole: "manager", dueDate: "2026-07-25" },
      { ...task, id: "other", type: "Naprawa", assigneeRole: "owner", dueDate: "2026-07-27" },
      { ...task, id: "done", status: "Zrobione", assigneeRole: "manager" },
    ];

    const queues = deriveTeamTaskQueues(tasks, { role: "manager" }, "2026-07-26");

    expect(queues.mine.map((item) => item.id)).toEqual(["mine"]);
    expect(queues.team.map((item) => item.id)).toEqual(["mine", "other"]);
    expect(queues.overdue.map((item) => item.id)).toEqual(["mine"]);
  });

  it("tworzy powiadomienie wyłącznie z terminu, priorytetu i preferencji odbiorcy", () => {
    const tasks: OpsTask[] = [
      { ...task, id: "urgent", assigneeRole: "manager", priority: "Wysoki", dueDate: "2026-07-27" },
      { ...task, id: "low", assigneeRole: "manager", priority: "Niski", dueDate: "2026-07-27" },
      { ...task, id: "other", assigneeRole: "owner", priority: "Wysoki", dueDate: "2026-07-27" },
    ];

    const notifications = deriveTaskNotifications(tasks, [{
      role: "manager",
      enabled: true,
      minimumPriority: "Średni",
      daysBeforeDue: 1,
    }], "2026-07-26");

    expect(notifications.map((item) => item.taskId)).toEqual(["urgent"]);
  });

  it("uznaje domek za gotowy wyłącznie z dowodem", () => {
    const data = structuredClone(initialData);
    data.units = [{ id: "unit-1", name: "Czapla", bedrooms: 2, maxPeople: 4, defaultPricePerNight: 500, defaultCleaningCost: 200, notes: "" }];
    data.bookings = [];
    data.tasks = [{
      ...task,
      status: "Zrobione",
      dueDate: "2026-07-26",
      readyAt: "2026-07-26T14:00:00.000Z",
      readinessEvidence: { source: "checklist", completedItems: 10, totalItems: 10 },
    }];

    expect(deriveUnitOperationalStates(data, "2026-07-26")).toEqual([{
      unitId: "unit-1",
      state: "Gotowy",
      evidence: { source: "checklist", completedItems: 10, totalItems: 10 },
    }]);

    delete data.tasks[0].readinessEvidence;
    expect(deriveUnitOperationalStates(data, "2026-07-26")[0].state).toBe("Do sprzątania");
  });

  it("proponuje odświeżenie tylko na podstawie starego potwierdzenia gotowości", () => {
    const data = structuredClone(initialData);
    data.bookings = [{
      id: "arrival",
      bookingDate: "2026-07-01",
      source: "Telefon",
      platform: "Telefon",
      unitId: "unit-1",
      checkIn: "2026-07-20",
      checkOut: "2026-07-24",
      adults: 2,
      children: 0,
      guestLabel: "Gość",
      paymentStatus: "Zaliczka",
      workflowStatus: "Potwierdzona",
      createdBy: "test",
    }];
    data.tasks = [{
      ...task,
      status: "Zrobione",
      dueDate: "2026-07-01",
      readyAt: "2026-07-01T14:00:00.000Z",
      readinessEvidence: { source: "checklist", completedItems: 10, totalItems: 10 },
    }];

    expect(deriveRefreshSuggestions(data, "2026-07-10")).toMatchObject([{
      bookingId: "arrival",
      refreshDueDate: "2026-07-19",
    }]);
  });

  it("dodaje do planu tygodnia wyłącznie pobyt z zaksięgowaną zaliczką", () => {
    const data = structuredClone(initialData);
    data.bookings = [
      { ...data.bookings[0], id: "paid", checkOut: "2026-07-30", openingPaidAmount: 300 },
      { ...data.bookings[0], id: "unpaid", checkOut: "2026-07-30", openingPaidAmount: 0 },
    ];
    data.payments = [];
    data.tasks = [
      { ...task, id: "paid-clean", bookingId: "paid", dueDate: "2026-07-30" },
      { ...task, id: "unpaid-clean", bookingId: "unpaid", dueDate: "2026-07-30" },
    ];

    expect(deriveWeeklyCleaningPlan(data, "2026-07-26").map((item) => item.id)).toEqual(["paid-clean"]);
  });

  it("wydaje osobie od kluczy tylko trzy niezbędne bramki", () => {
    const data = structuredClone(initialData);
    data.units = [{ id: "unit-1", name: "Czapla", bedrooms: 2, maxPeople: 4, defaultPricePerNight: 500, defaultCleaningCost: 200, notes: "" }];
    data.bookings = [{
      id: "arrival",
      bookingDate: "2026-07-01",
      source: "Telefon",
      platform: "Telefon",
      unitId: "unit-1",
      checkIn: "2026-07-26",
      checkOut: "2026-07-30",
      adults: 2,
      children: 1,
      guestLabel: "Sekret",
      openingPaidAmount: 300,
      paymentStatus: "Zaliczka",
      workflowStatus: "Potwierdzona",
      createdBy: "test",
    }];
    data.payments = [];
    data.tasks = [{
      ...task,
      status: "Zrobione",
      dueDate: "2026-07-26",
      readyAt: "2026-07-26T14:00:00.000Z",
      readinessEvidence: { source: "checklist", completedItems: 10, totalItems: 10 },
    }];

    const gate = deriveKeyHandoffGate(data, "arrival");

    expect(gate).toEqual({
      bookingId: "arrival",
      unitId: "unit-1",
      ready: true,
      paymentConfirmed: true,
      minorProcedure: "Brak aktywnego SOP",
    });
    expect(JSON.stringify(gate)).not.toContain("Sekret");
  });
});
