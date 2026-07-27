import { describe, expect, it } from "vitest";
import { initialData } from "@/lib/demo-data";
import { calculateGrowthMetrics, paybackByUnit, returnReminderEligibility } from "./growth-metrics";

describe("growth metrics", () => {
  it("shows a collection plan instead of a conclusion below the threshold", () => {
    const metrics = calculateGrowthMetrics(initialData, { from: "2026-01-01", to: "2026-12-31" });
    expect(metrics.every((metric) => metric.status === "collecting")).toBe(true);
    expect(metrics.every((metric) => Array.isArray(metric.evidenceBookingIds))).toBe(true);
  });

  it("does not calculate payback without explicit investment inputs", () => {
    expect(paybackByUnit(initialData, initialData.units[0].id, "PLN")).toEqual({
      ready: false,
      missing: ["kapitał i nakłady"],
    });
  });

  it("does not propose a return reminder without the exact marketing consent", () => {
    const data = {
      ...initialData,
      people: [{ id: "PERSON-1", displayName: "Anna", createdAt: "2026-01-01T00:00:00.000Z", createdBy: "owner" }],
      guests: [{ bookingId: initialData.bookings[0].id, personId: "PERSON-1" }],
      consentLedger: [],
    };
    expect(returnReminderEligibility(data, "PERSON-1").eligible).toBe(false);
  });
});
