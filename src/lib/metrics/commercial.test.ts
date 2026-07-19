import { describe, expect, it } from "vitest";
import type { Booking, CalendarBlock, Unit } from "@/lib/types";
import {
  addDateDays,
  calculateCommercialMetrics,
  dateOrdinal,
  intersectPeriods,
  isActiveBooking,
  monthPeriodContaining,
  periodNights,
  stayNightsInPeriod,
} from "./commercial";

const units: Unit[] = [
  { id: "u1", name: "Rybak", maxPeople: 4, bedrooms: 2, defaultPricePerNight: 500, defaultCleaningCost: 100, notes: "" },
  { id: "u2", name: "Czapla", maxPeople: 4, bedrooms: 2, defaultPricePerNight: 500, defaultCleaningCost: 100, notes: "" },
];
const booking = (overrides: Partial<Booking> = {}): Booking => ({
  id: "B1",
  bookingDate: "2026-01-01",
  source: "test",
  platform: "Bezpośrednio",
  unitId: "u1",
  checkIn: "2026-01-30",
  checkOut: "2026-02-02",
  adults: 2,
  children: 0,
  guestLabel: "Test",
  pricePerNight: 500,
  currency: "PLN",
  paymentStatus: "Opłacone",
  workflowStatus: "Potwierdzona",
  createdBy: "test",
  ...overrides,
});
const block = (overrides: Partial<CalendarBlock> = {}): CalendarBlock => ({
  id: "BL1",
  unitId: "u1",
  dateFrom: "2026-01-10",
  dateTo: "2026-01-12",
  blockType: "Serwis",
  reason: "Test",
  status: "Aktywna",
  ...overrides,
});
const period = { from: "2026-01-01", toExclusive: "2026-02-01" };

describe("date-only period engine", () => {
  it("uses [from, to) and clips stays at month and year boundaries", () => {
    expect(intersectPeriods(
      { from: "2025-12-30", toExclusive: "2026-01-03" },
      { from: "2026-01-01", toExclusive: "2026-02-01" },
    )).toEqual({ from: "2026-01-01", toExclusive: "2026-01-03" });
    expect(stayNightsInPeriod("2026-01-30", "2026-02-02", period)).toBe(2);
    expect(stayNightsInPeriod("2025-12-30", "2026-01-02", period)).toBe(1);
    expect(stayNightsInPeriod("2026-02-01", "2026-02-03", period)).toBe(0);
  });

  it("is independent of DST and handles leap day", () => {
    expect(periodNights({ from: "2026-03-28", toExclusive: "2026-03-31" })).toBe(3);
    expect(periodNights({ from: "2026-10-24", toExclusive: "2026-10-27" })).toBe(3);
    expect(periodNights({ from: "2024-02-28", toExclusive: "2024-03-01" })).toBe(2);
    expect(addDateDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(monthPeriodContaining("2026-12-15")).toEqual({
      from: "2026-12-01",
      toExclusive: "2027-01-01",
    });
  });

  it("rejects impossible and same-day periods", () => {
    expect(dateOrdinal("2026-02-30")).toBeNull();
    expect(periodNights({ from: "2026-01-01", toExclusive: "2026-01-01" })).toBe(0);
    expect(intersectPeriods(
      { from: "2026-01-01", toExclusive: "2026-01-01" },
      period,
    )).toBeNull();
  });
});

describe("commercial KPI engine", () => {
  it("defines active bookings consistently", () => {
    expect(isActiveBooking(booking())).toBe(true);
    expect(isActiveBooking(booking({ workflowStatus: "Nowa" }))).toBe(false);
    expect(isActiveBooking(booking({ workflowStatus: "Anulowana" }))).toBe(false);
    expect(isActiveBooking(booking({ deletedAt: "2026-01-02" }))).toBe(false);
  });

  it("counts only the stay nights inside the selected period", () => {
    const result = calculateCommercialMetrics({ bookings: [booking()], units, blocks: [], period });
    expect(result.soldNights).toBe(2);
    expect(result.availableNights).toBe(62);
    expect(result.occupancyPercent).toBeCloseTo((2 / 62) * 100);
  });

  it("excludes cancelled, new, deleted, invalid and unknown-unit records", () => {
    const result = calculateCommercialMetrics({
      bookings: [
        booking(),
        booking({ id: "NEW", workflowStatus: "Nowa" }),
        booking({ id: "CANCEL", workflowStatus: "Anulowana" }),
        booking({ id: "TRASH", deletedAt: "2026-01-03" }),
        booking({ id: "BAD-DATE", checkOut: "2026-01-20" }),
        booking({ id: "NO-UNIT", unitId: "missing" }),
      ],
      units,
      blocks: [],
      period,
    });
    expect(result.soldNights).toBe(2);
    expect(result.issues).toEqual(expect.arrayContaining([
      { code: "invalid_booking_dates", recordId: "BAD-DATE" },
      { code: "unknown_booking_unit", recordId: "NO-UNIT" },
    ]));
    expect(result.occupancyMetadata.completeness).toBe("partial");
  });

  it("does not lower period completeness for valid records outside the period", () => {
    const result = calculateCommercialMetrics({
      bookings: [booking({ id: "FUTURE", unitId: "missing", checkIn: "2027-01-01", checkOut: "2027-01-02", needsReview: true })],
      units,
      blocks: [block({ id: "FUTURE-BLOCK", unitId: "missing", dateFrom: "2027-01-01", dateTo: "2027-01-02" })],
      period,
    });
    expect(result.issues).toEqual([]);
    expect(result.occupancyMetadata.completeness).toBe("complete");
  });

  it("reduces capacity only for non-cancelled service and renovation blocks", () => {
    const result = calculateCommercialMetrics({
      bookings: [],
      units,
      blocks: [
        block(),
        block({ id: "BL2", dateFrom: "2026-01-11", dateTo: "2026-01-13", blockType: "Remont", status: "Zakończona" }),
        block({ id: "OWNER", dateFrom: "2026-01-01", dateTo: "2026-02-01", blockType: "Właściciel" }),
        block({ id: "BUFFER", dateFrom: "2026-01-01", dateTo: "2026-02-01", blockType: "Bufor sprzątania" }),
        block({ id: "CANCEL", dateFrom: "2026-01-20", dateTo: "2026-01-25", status: "Anulowana" }),
      ],
      period,
    });
    expect(result.technicalBlockedNights).toBe(3);
    expect(result.availableNights).toBe(59);
  });

  it("does not clamp occupancy and reports a booking/block conflict", () => {
    const oneDay = { from: "2026-01-10", toExclusive: "2026-01-11" };
    const result = calculateCommercialMetrics({
      bookings: [
        booking({ id: "A", checkIn: "2026-01-10", checkOut: "2026-01-11" }),
        booking({ id: "B", checkIn: "2026-01-10", checkOut: "2026-01-11" }),
      ],
      units: [units[0]],
      blocks: [block({ dateFrom: "2026-01-10", dateTo: "2026-01-11" })],
      period: oneDay,
    });
    expect(result.soldNights).toBe(2);
    expect(result.availableNights).toBe(0);
    expect(result.occupancyPercent).toBeNull();
    expect(result.issues).toContainEqual({ code: "booking_overlaps_technical_block", recordId: "u1" });
  });

  it("can expose occupancy above 100% when source bookings overlap", () => {
    const oneDay = { from: "2026-01-10", toExclusive: "2026-01-11" };
    const result = calculateCommercialMetrics({
      bookings: [
        booking({ id: "A", checkIn: "2026-01-10", checkOut: "2026-01-11" }),
        booking({ id: "B", checkIn: "2026-01-10", checkOut: "2026-01-11" }),
      ],
      units: [units[0]],
      blocks: [],
      period: oneDay,
    });
    expect(result.occupancyPercent).toBe(200);
    expect(result.issues).toContainEqual({ code: "overlapping_active_bookings", recordId: "u1" });
    expect(result.occupancyMetadata.completeness).toBe("partial");
  });

  it("separates PLN and EUR values and uses the realized cutoff", () => {
    const result = calculateCommercialMetrics({
      bookings: [
        booking({ id: "PLN", checkIn: "2026-01-01", checkOut: "2026-01-04", pricePerNight: 400 }),
        booking({ id: "EUR", checkIn: "2026-01-01", checkOut: "2026-01-04", pricePerNight: 100, currency: "EUR" }),
      ],
      units,
      blocks: [],
      period,
      realizedToExclusive: "2026-01-03",
    });
    expect(result.soldNights).toBe(6);
    expect(result.currencies).toEqual(expect.arrayContaining([
      expect.objectContaining({ currency: "PLN", soldNights: 2, lodgingValue: 800, adr: 400, revPar: 200 }),
      expect.objectContaining({ currency: "EUR", soldNights: 2, lodgingValue: 200, adr: 100, revPar: 50 }),
    ]));
    expect(result.realizedAvailableNights).toBe(4);
  });

  it("uses technical capacity from the same realized period for RevPAR", () => {
    const result = calculateCommercialMetrics({
      bookings: [booking({ checkIn: "2026-01-01", checkOut: "2026-01-03", pricePerNight: 100 })],
      units,
      blocks: [block({ dateFrom: "2026-01-01", dateTo: "2026-01-02" })],
      period: { from: "2026-01-01", toExclusive: "2026-01-05" },
      realizedToExclusive: "2026-01-03",
    });
    expect(result.availableNights).toBe(7);
    expect(result.realizedAvailableNights).toBe(3);
    expect(result.currencies[0]).toMatchObject({ lodgingValue: 200, revPar: 200 / 3 });
  });

  it("prorates gross price but never treats a missing price as zero", () => {
    const result = calculateCommercialMetrics({
      bookings: [
        booking({ id: "GROSS", pricePerNight: undefined, grossPrice: 1500 }),
        booking({ id: "MISSING", unitId: "u2", pricePerNight: undefined, grossPrice: undefined }),
      ],
      units,
      blocks: [],
      period,
    });
    const pln = result.currencies.find((metric) => metric.currency === "PLN");
    expect(result.evidence.bookings.find((row) => row.bookingId === "GROSS")?.lodgingValue).toBe(1000);
    expect(pln?.lodgingValue).toBeNull();
    expect(pln?.adr).toBeNull();
    expect(pln?.revPar).toBeNull();
    expect(pln?.completeness).toBe("unavailable");
  });

  it("marks legacy missing currency and review records as partial", () => {
    const result = calculateCommercialMetrics({
      bookings: [booking({ currency: undefined, needsReview: true })],
      units,
      blocks: [],
      period,
    });
    expect(result.currencies[0]).toMatchObject({ currency: "PLN", completeness: "partial" });
    expect(result.issues).toEqual(expect.arrayContaining([
      { code: "currency_assumed_pln", recordId: "B1" },
      { code: "booking_needs_review", recordId: "B1" },
    ]));
  });

  it("returns unavailable instead of fake zero without inventory", () => {
    const result = calculateCommercialMetrics({ bookings: [booking()], units: [], blocks: [], period });
    expect(result.availableNights).toBe(0);
    expect(result.occupancyPercent).toBeNull();
    expect(result.occupancyMetadata.completeness).toBe("unavailable");
  });
});
