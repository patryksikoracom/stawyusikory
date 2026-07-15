import { describe, expect, it } from "vitest";
import type { Booking, CostSetting, RateRule, Unit } from "../types";
import { calculateModeledCosts, pricingReadiness, quoteStay } from "./pricing";

const unit: Unit = { id: "u1", name: "Domek", maxPeople: 4, bedrooms: 2, defaultPricePerNight: 400, defaultCleaningCost: 150, notes: "" };
const high: RateRule = { id: "high", unitId: unit.id, dateFrom: "2026-08-01", dateTo: "2026-08-31", season: "Wysoki", pricePerNight: 600, minNights: 3, active: true };
const booking: Booking = { id: "B1", bookingDate: "2026-01-01", source: "test", platform: "Bezpośrednio", unitId: unit.id, checkIn: "2026-08-01", checkOut: "2026-08-04", adults: 2, children: 0, guestLabel: "Gość", grossPrice: 1800, paymentStatus: "Opłacone", workflowStatus: "Potwierdzona", createdBy: "test" };

describe("seasonal pricing", () => {
  it("prices each night and falls back to the cottage base price", () => {
    const quote = quoteStay([unit], [high], unit.id, "2026-07-31", "2026-08-02");
    expect(quote.total).toBe(1000);
    expect(quote.averagePerNight).toBe(500);
    expect(quote.breakdown.map((item) => item.label)).toEqual(["Cena bazowa", "Sezon: Wysoki"]);
    expect(quote.belowMinimum).toBe(true);
  });

  it("gives a dated special rule priority over the regular season", () => {
    const special: RateRule = { ...high, id: "special", dateFrom: "2026-08-15", dateTo: "2026-08-15", season: "Specjalny", pricePerNight: 900, minNights: 1 };
    expect(quoteStay([unit], [high, special], unit.id, "2026-08-15", "2026-08-16").total).toBe(900);
  });
});

describe("profitability inputs", () => {
  it("calculates fixed, per-stay, per-night and revenue costs", () => {
    const costs: CostSetting[] = [
      { id: "monthly", label: "Media", value: 100, unit: "miesiąc", active: true },
      { id: "stay", label: "Pranie", value: 50, unit: "pobyt", active: true },
      { id: "night", label: "Zużycie", value: 10, unit: "noc", active: true },
      { id: "percent", label: "Marketing", value: 5, unit: "% przychodu", active: true },
    ];
    expect(calculateModeledCosts(costs, [booking], 1).total).toBe(270);
  });

  it("does not mark AI pricing ready without costs and two years of priced history", () => {
    const readiness = pricingReadiness({ units: [unit], rates: [high], costSettings: [], bookings: [booking] });
    expect(readiness.ready).toBe(false);
    expect(readiness.readyCount).toBe(2);
  });
});
