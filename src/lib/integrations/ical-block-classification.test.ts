import { describe, expect, it } from "vitest";
import type { CalendarBlock } from "@/lib/types";
import type { Booking } from "@/lib/types";
import { classifyImportedIcalBlock, importedReservationBlockMatchesBooking, isOverridableCleaningBuffer } from "./ical-block-classification";

function block(overrides: Partial<CalendarBlock> = {}): CalendarBlock {
  return {
    id: "ICAL-SRC-AIRBNB-1",
    unitId: "unit-1",
    dateFrom: "2026-08-20",
    dateTo: "2026-08-21",
    blockType: "Inne",
    reason: "[Airbnb] Not available",
    status: "Aktywna",
    ...overrides,
  };
}

describe("klasyfikacja blokad iCal", () => {
  it("rozpoznaje krótki techniczny wpis jako bufor", () => {
    expect(classifyImportedIcalBlock(block())?.kind).toBe("buffer");
    expect(isOverridableCleaningBuffer(block())).toBe(true);
  });

  it("nigdy nie uznaje jawnej rezerwacji za bufor", () => {
    expect(classifyImportedIcalBlock(block({ reason: "[Airbnb] Reserved" }))?.kind).toBe("reservation");
    expect(isOverridableCleaningBuffer(block({ reason: "[Airbnb] Reserved" }))).toBe(false);
  });

  it("pozwala obejść lokalną blokadę wyłącznie oznaczoną jako bufor", () => {
    expect(isOverridableCleaningBuffer(block({ id: "BLK-1", blockType: "Bufor sprzątania" }))).toBe(true);
    expect(isOverridableCleaningBuffer(block({ id: "BLK-2", blockType: "Remont" }))).toBe(false);
  });

  it("rozpoznaje wpis Booking reprezentujący edytowaną rezerwację", () => {
    const booking = {
      id: "BOOKING-1",
      unitId: "unit-1",
      checkIn: "2026-08-20",
      checkOut: "2026-08-24",
      platform: "Booking",
      workflowStatus: "Potwierdzona",
    } as Booking;
    const sourceBlock = block({
      id: "ICAL-SRC-BOOKING-1",
      dateFrom: "2026-08-20",
      dateTo: "2026-08-24",
      reason: "[Booking] CLOSED - Not available",
    });

    expect(importedReservationBlockMatchesBooking(sourceBlock, booking)).toBe(true);
    expect(importedReservationBlockMatchesBooking({ ...sourceBlock, unitId: "unit-2" }, booking)).toBe(false);
    expect(importedReservationBlockMatchesBooking({ ...sourceBlock, dateFrom: "2026-08-25", dateTo: "2026-08-29" }, booking)).toBe(false);
  });
});
