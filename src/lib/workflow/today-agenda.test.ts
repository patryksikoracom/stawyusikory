import { describe, expect, it } from "vitest";
import { initialData } from "@/lib/demo-data";
import type { AppData, Booking, OpsTask } from "@/lib/types";
import { buildTodayAgenda, buildTodayUnitStates } from "./today-agenda";

const today = "2026-07-27";

function booking(overrides: Partial<Booking> & Pick<Booking, "id" | "unitId" | "checkIn" | "checkOut" | "guestLabel">): Booking {
  return {
    bookingDate: "2026-07-01",
    source: "Telefon",
    platform: "Bezpośrednio",
    adults: 2,
    children: 0,
    paymentStatus: "Opłacone",
    workflowStatus: "Potwierdzona",
    createdBy: "Test",
    ...overrides,
  };
}

function task(overrides: Partial<OpsTask> & Pick<OpsTask, "id" | "bookingId" | "title">): OpsTask {
  return {
    type: "Sprzątanie",
    priority: "Wysoki",
    status: "Do zrobienia",
    dueDate: today,
    owner: "Pani Ewa",
    ...overrides,
  };
}

function fixture(): AppData {
  const departure = booking({
    id: "departure",
    unitId: "domek-rybaka",
    checkIn: "2026-07-24",
    checkOut: today,
    departureTime: "11:00",
    guestLabel: "Anna Kowalska",
    platform: "Booking",
  });
  const arrival = booking({
    id: "arrival",
    unitId: "domek-rybaka",
    checkIn: today,
    checkOut: "2026-07-31",
    arrivalTime: "16:00",
    guestLabel: "Jan Nowak",
    platform: "Airbnb",
  });
  return {
    ...initialData,
    bookings: [departure, arrival],
    tasks: [task({
      id: "cleaning",
      bookingId: departure.id,
      unitId: departure.unitId,
      title: "Przygotuj Domek Rybaka",
      blocker: "Brak potwierdzenia prania",
    })],
    issues: [],
    scheduledMessages: [{
      id: "message",
      bookingId: arrival.id,
      ruleId: "rule",
      templateId: "template",
      templateVersion: 1,
      dueAt: `${today}T18:00:00.000Z`,
      channel: "E-mail",
      renderedBody: "Test",
      status: "Wersja robocza",
      idempotencyKey: "message",
      bookingFingerprint: "arrival",
      createdAt: `${today}T08:00:00.000Z`,
    }],
    messageTemplates: [{
      id: "template",
      name: "Wiadomość kontrolna",
      purpose: "W trakcie pobytu",
      channel: "E-mail",
      language: "pl",
      body: "Test",
      allowedVariables: [],
      version: 1,
      active: true,
    }],
  };
}

describe("today agenda", () => {
  it("łączy wyjazd, turnover, przyjazd i wiadomość w jednej chronologii", () => {
    const events = buildTodayAgenda(fixture(), today);

    expect(events.map((event) => [event.time, event.kind])).toEqual([
      ["11:00", "Wyjazd"],
      ["11:15", "Turnover"],
      ["16:00", "Przyjazd"],
      ["18:00", "Wiadomość"],
    ]);
    expect(events[0]).toMatchObject({ channel: "Booking", actionLabel: "Podsumuj wyjazd" });
    expect(events[1]).toMatchObject({ status: "Do zrobienia", href: "/tasks" });
    expect(events[2]).toMatchObject({ channel: "Airbnb", href: "/bookings/arrival" });
    expect(events[3]).toMatchObject({ href: "/bookings/arrival?tab=messages" });
  });

  it("pokazuje okno same-day turnoveru i blokadę domku", () => {
    const states = buildTodayUnitStates(fixture(), today);
    const fisherman = states.find((state) => state.unitId === "domek-rybaka");

    expect(fisherman).toMatchObject({
      state: "Goście",
      blocker: "Brak potwierdzenia prania",
      nextChange: "Wyjazd dzisiaj · 11:00",
      sameDayTurnover: {
        windowLabel: "5 godz.",
        risky: true,
      },
    });
  });

  it("nie tworzy zdarzeń z anulowanych ani zakończonych elementów", () => {
    const data = fixture();
    data.bookings = data.bookings.map((item) => ({ ...item, workflowStatus: "Anulowana" }));
    data.tasks = data.tasks.map((item) => ({ ...item, status: "Zrobione" }));
    data.scheduledMessages = data.scheduledMessages.map((item) => ({ ...item, status: "Dostarczona" }));

    expect(buildTodayAgenda(data, today)).toEqual([]);
  });

  it("nie pokazuje przyjazdu bieżącego gościa jako następnej zmiany", () => {
    const data = fixture();
    const arrival = data.bookings.find((booking) => booking.id === "arrival")!;
    data.bookings = [{
      ...arrival,
      id: "current-arrival",
      checkIn: today,
      checkOut: "2026-07-31",
    }];
    data.tasks = [];
    data.issues = [];

    const state = buildTodayUnitStates(data, today).find(
      (item) => item.unitId === arrival.unitId,
    );

    expect(state).toMatchObject({
      currentGuest: arrival.guestLabel,
      nextChange: "Wyjazd 2026-07-31 · 11:00",
    });
  });
});
