import { describe, expect, it } from "vitest";
import { initialData } from "@/lib/demo-data";
import { buildCalendarBookingDraft, calendarWindowStart } from "./calendar-draft";

describe("calendar booking draft", () => {
  it("ustawia okno 42 dni od 7 dni przed dzisiaj", () => {
    expect(calendarWindowStart("2026-07-27")).toBe("2026-07-20");
  });

  it("zachowuje domek i porządkuje dwa wskazane końce zakresu", () => {
    const result = buildCalendarBookingDraft(
      { ...initialData, bookings: [], blocks: [] },
      "domek-rybaka",
      "2026-08-12",
      "2026-08-08",
    );

    expect(result.draft).toEqual({
      unitId: "domek-rybaka",
      checkIn: "2026-08-08",
      checkOut: "2026-08-12",
    });
  });

  it("dla jednego dnia tworzy jedną noc i blokuje konflikt przed formularzem", () => {
    const free = buildCalendarBookingDraft(
      { ...initialData, bookings: [], blocks: [] },
      "domek-rybaka",
      "2026-08-08",
      "2026-08-08",
    );
    expect(free.draft?.checkOut).toBe("2026-08-09");

    const occupied = buildCalendarBookingDraft(
      initialData,
      initialData.bookings[0].unitId,
      initialData.bookings[0].checkIn,
      initialData.bookings[0].checkOut,
    );
    expect(occupied.conflict).toBeTruthy();
    expect(occupied.draft).toBeUndefined();
  });
});
