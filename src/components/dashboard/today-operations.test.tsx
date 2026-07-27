// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TodayOperations } from "./today-operations";
import type { TodayAgendaEvent, TodayUnitState } from "@/lib/workflow/today-agenda";

const events: TodayAgendaEvent[] = [
  {
    id: "departure",
    kind: "Wyjazd",
    time: "11:00",
    sortMinutes: 660,
    title: "Anna Kowalska",
    detail: "Domek Rybaka",
    bookingId: "booking-out",
    channel: "Booking",
    status: "Do podsumowania",
    actionLabel: "Podsumuj wyjazd",
  },
  {
    id: "arrival",
    kind: "Przyjazd",
    time: "16:00",
    sortMinutes: 960,
    title: "Jan Nowak",
    detail: "Domek Rybaka",
    bookingId: "booking-in",
    channel: "Airbnb",
    status: "Potwierdzona",
    href: "/bookings/booking-in",
    actionLabel: "Otwórz przyjazd",
  },
];

const units: TodayUnitState[] = [{
  unitId: "domek-rybaka",
  unitName: "Domek Rybaka",
  state: "Goście",
  currentGuest: "Anna Kowalska",
  nextChange: "Wyjazd dzisiaj · 11:00",
  blocker: {
    label: "Brak potwierdzenia prania",
    href: "/tasks#task-TASK-1",
    actionLabel: "Otwórz sprzątanie",
  },
  sameDayTurnover: { windowLabel: "5 godz.", risky: true },
}];

describe("TodayOperations", () => {
  afterEach(cleanup);

  it("w pięć sekund pokazuje chronologię, kanały, stan i ryzyko", () => {
    render(<TodayOperations events={events} units={units} onOpenDeparture={vi.fn()}/>);

    expect(screen.getByRole("heading", { name: "Dzisiaj, krok po kroku" })).toBeInTheDocument();
    expect(screen.getByText("Turnover tego samego dnia · 5 godz.")).toBeInTheDocument();
    expect(screen.getByText("Blokada: Brak potwierdzenia prania")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Otwórz sprzątanie/ })).toHaveAttribute("href", "/tasks#task-TASK-1");
    expect(screen.getByText("Booking")).toBeInTheDocument();
    expect(screen.getByText("Airbnb")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Otwórz przyjazd/ })).toHaveAttribute("href", "/bookings/booking-in");
  });

  it("otwiera właściwą akcję podsumowania wyjazdu", () => {
    const onOpenDeparture = vi.fn();
    render(<TodayOperations events={events} units={units} onOpenDeparture={onOpenDeparture}/>);

    fireEvent.click(screen.getByRole("button", { name: /Podsumuj wyjazd/ }));
    expect(onOpenDeparture).toHaveBeenCalledWith("booking-out");
  });
});
