import { describe, expect, it } from "vitest";
import { initialData } from "@/lib/demo-data";
import { annualSalesCutoff, buildAnnualOverview, classifyGap, detectAnnualGaps } from "./annual-overview";

describe("annual overview", () => {
  it("uses the same sales day for the selected and previous year", () => {
    expect(annualSalesCutoff(2026, "2026-07-27")).toBe("2026-07-27");
    expect(annualSalesCutoff(2025, "2026-07-27")).toBe("2025-07-27");
  });

  it("keeps currencies separate and does not treat missing prices as zero", () => {
    const unitId = initialData.units[0]!.id;
    const data = {
      ...initialData,
      bookings: [
        { ...initialData.bookings[0]!, id: "PLN", unitId, bookingDate: "2026-01-01", checkIn: "2026-07-01", checkOut: "2026-07-03", grossPrice: 1000, currency: "PLN" as const },
        { ...initialData.bookings[0]!, id: "EUR", unitId, bookingDate: "2026-01-02", checkIn: "2026-07-03", checkOut: "2026-07-05", grossPrice: 400, currency: "EUR" as const },
        { ...initialData.bookings[0]!, id: "MISSING", unitId, bookingDate: "2026-01-03", checkIn: "2026-07-05", checkOut: "2026-07-06", grossPrice: undefined, currency: undefined },
      ],
    };
    const july = buildAnnualOverview(data, 2026, "2026-07-27").months.find((item) => item.unitId === unitId && item.month === 7)!;

    expect(july.revenue).toEqual({ PLN: 1000, EUR: 400 });
    expect(july.soldNights).toBe(5);
    expect(july.pricedBookingsCount).toBe(2);
    expect(july.bookingsCount).toBe(3);
  });

  it("excludes reservations not yet sold at the comparison cutoff", () => {
    const unitId = initialData.units[0]!.id;
    const data = {
      ...initialData,
      bookings: [
        { ...initialData.bookings[0]!, id: "KNOWN", unitId, bookingDate: "2025-07-20", checkIn: "2025-10-01", checkOut: "2025-10-05" },
        { ...initialData.bookings[0]!, id: "FUTURE-SALE", unitId, bookingDate: "2025-08-01", checkIn: "2025-10-10", checkOut: "2025-10-15" },
      ],
    };
    const october = buildAnnualOverview(data, 2025, "2026-07-27").months.find((item) => item.unitId === unitId && item.month === 10)!;

    expect(october.soldNights).toBe(4);
    expect(october.bookingsCount).toBe(1);
  });

  it.each([[1, "1 noc"], [2, "2–3 noce"], [3, "2–3 noce"], [4, "4–6 nocy"], [6, "4–6 nocy"], [7, "7+ nocy"]])(
    "classifies %i nights as %s",
    (nights, expected) => expect(classifyGap(nights)).toBe(expected),
  );

  it("splits free sequences when season evidence changes", () => {
    const unitId = initialData.units[0]!.id;
    const data = {
      ...initialData,
      units: [initialData.units[0]!],
      bookings: [],
      blocks: [],
      rates: [
        { id: "LOW", unitId, dateFrom: "2026-01-01", dateTo: "2026-01-03", season: "Niski" as const, pricePerNight: 400, minNights: 2, active: true, occupancyTargetPercent: 50 },
        { id: "HIGH", unitId, dateFrom: "2026-01-04", dateTo: "2026-12-31", season: "Wysoki" as const, pricePerNight: 600, minNights: 4, active: true, occupancyTargetPercent: 85 },
      ],
    };
    const gaps = detectAnnualGaps(data, 2026, "2025-12-01");

    expect(gaps[0]).toMatchObject({ dateFrom: "2026-01-01", dateTo: "2026-01-04", nights: 3, season: "Niski", minNights: 2 });
    expect(gaps[1]).toMatchObject({ dateFrom: "2026-01-04", season: "Wysoki", minNights: 4 });
  });
});
