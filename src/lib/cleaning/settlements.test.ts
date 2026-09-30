import { describe, expect, it } from "vitest";
import { cleaningSettlementSummary } from "./settlements";
import type { OpsTask } from "@/lib/types";

const task: OpsTask = { id: "clean-1", bookingId: "booking-1", type: "Sprzątanie", status: "Zrobione", priority: "Średni", owner: "Jadzia", title: "Sprzątanie" };
describe("rozliczenia sprzątania", () => {
  it("sumuje tylko wykonane, niezapłacone sprzątania i oddziela brakującą kwotę od zera", () => {
    expect(cleaningSettlementSummary([
      task,
      { ...task, id: "2", cleaningSettlement: { amount: 150.10, currency: "PLN" } },
      { ...task, id: "3", cleaningSettlement: { amount: 180.20, currency: "PLN" } },
      { ...task, id: "4", cleaningSettlement: { amount: 100, currency: "PLN", paidAt: "2026-09-30T12:00:00Z" } },
      { ...task, id: "5", status: "Do zrobienia", cleaningSettlement: { amount: 200, currency: "PLN" } },
      { ...task, id: "6", cleaningSettlement: { amount: 0, currency: "PLN" } },
    ])).toEqual({ unpaidAmount: 330.30, unpaidCount: 3, missingAmountCount: 1 });
  });
});
