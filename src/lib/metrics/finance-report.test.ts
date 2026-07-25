import { describe, expect, it } from "vitest";
import { initialData } from "@/lib/demo-data";
import type { AppData, Booking, PaymentTransaction } from "@/lib/types";
import {
  buildFinanceEvidenceCsv,
  createFinanceReport,
  financePeriodForPreset,
} from "./finance-report";

const booking = (overrides: Partial<Booking> = {}): Booking => ({
  id: "B-REPORT",
  bookingDate: "2026-06-20",
  source: "Telefon",
  platform: "Bezpośrednio",
  unitId: "u-report",
  checkIn: "2026-07-10",
  checkOut: "2026-07-12",
  adults: 2,
  children: 0,
  guestLabel: "Gość raportowy",
  grossPrice: 550,
  currency: "PLN",
  paymentStatus: "Częściowo",
  workflowStatus: "Potwierdzona",
  createdBy: "test",
  ...overrides,
});

const payment = (overrides: Partial<PaymentTransaction> = {}): PaymentTransaction => ({
  id: "PAY-REPORT",
  bookingId: "B-REPORT",
  occurredAt: "2026-07-05",
  type: "Zaliczka",
  amount: 300,
  currency: "PLN",
  status: "Zaksięgowana",
  ...overrides,
});

function reportData(overrides: Partial<AppData> = {}): AppData {
  return {
    ...initialData,
    units: [{
      id: "u-report",
      name: "Domek testowy",
      maxPeople: 4,
      bedrooms: 2,
      defaultPricePerNight: 275,
      defaultCleaningCost: 0,
      notes: "",
    }],
    bookings: [booking()],
    payments: [
      payment(),
      payment({
        id: "COST-REPORT",
        type: "Koszt",
        amount: 100,
        occurredAt: "2026-07-15",
        source: "FV 7/2026",
        costCategory: "Sprzątanie",
        unitId: "u-report",
      }),
    ],
    costSettings: [],
    imports: [],
    ...overrides,
  };
}

describe("finance report periods", () => {
  it("builds stable today, 14-day, month and YTD ranges", () => {
    expect(financePeriodForPreset("today", "2026-07-25")).toMatchObject({
      from: "2026-07-25",
      toExclusive: "2026-07-26",
    });
    expect(financePeriodForPreset("next14", "2026-07-25")).toMatchObject({
      from: "2026-07-25",
      toExclusive: "2026-08-08",
    });
    expect(financePeriodForPreset("month", "2026-07-25")).toMatchObject({
      from: "2026-07-01",
      toExclusive: "2026-08-01",
    });
    expect(financePeriodForPreset("ytd", "2026-07-25")).toMatchObject({
      from: "2026-01-01",
      toExclusive: "2026-07-26",
    });
  });

  it("normalizes a reversed custom range and keeps the end date inclusive", () => {
    expect(financePeriodForPreset("custom", "2026-07-25", {
      from: "2026-08-05",
      toInclusive: "2026-08-01",
    })).toMatchObject({
      from: "2026-08-01",
      toExclusive: "2026-08-06",
    });
  });
});

describe("finance evidence report", () => {
  it("keeps four perspectives reconstructable from their evidence", () => {
    const report = createFinanceReport({
      data: reportData(),
      period: financePeriodForPreset("month", "2026-07-25"),
      calculatedAt: "2026-07-25T12:00:00.000Z",
    });
    const values = Object.fromEntries(report.metrics.map((metric) => [
      metric.id,
      metric.values.find((value) => value.currency === "PLN")?.value,
    ]));
    const reconstructed = Object.fromEntries(report.metrics.map((metric) => [
      metric.id,
      metric.evidence.reduce((sum, row) => sum + (row.contribution ?? 0), 0),
    ]));

    expect(values).toEqual({
      sales_booking_value_v1: 550,
      receivables_guest_balance_v1: 250,
      cashflow_posted_transactions_v1: 200,
      management_result_v1: 450,
    });
    expect(reconstructed).toEqual(values);
    expect(report.metrics.map((metric) => metric.label)).toEqual([
      "Sprzedaż",
      "Należności gości",
      "Cashflow netto",
      "Wynik zarządczy",
    ]);
  });

  it("keeps PLN and EUR in separate card values and evidence rows", () => {
    const eurBooking = booking({
      id: "B-EUR",
      guestLabel: "Gość EUR",
      currency: "EUR",
      grossPrice: 200,
    });
    const report = createFinanceReport({
      data: reportData({
        bookings: [booking(), eurBooking],
        payments: [
          payment(),
          payment({ id: "PAY-EUR", bookingId: "B-EUR", currency: "EUR", amount: 50 }),
        ],
      }),
      period: financePeriodForPreset("month", "2026-07-25"),
      calculatedAt: "2026-07-25",
    });
    const sales = report.metrics.find((metric) => metric.id === "sales_booking_value_v1")!;

    expect(sales.values).toEqual([
      { currency: "PLN", value: 550 },
      { currency: "EUR", value: 200 },
    ]);
    expect(sales.evidence.map((row) => row.currency)).toEqual(["PLN", "EUR"]);
  });

  it("exports summaries and source records needed to reproduce every card", () => {
    const report = createFinanceReport({
      data: reportData(),
      period: financePeriodForPreset("month", "2026-07-25"),
      calculatedAt: "2026-07-25T12:00:00.000Z",
    });
    const csv = buildFinanceEvidenceCsv(report);

    expect(csv).toContain('"sekcja","metryka_id"');
    expect(csv).toContain('"podsumowanie","sales_booking_value_v1"');
    expect(csv).toContain('"dowód","cashflow_posted_transactions_v1"');
    expect(csv).toContain('"2026-07-01","2026-07-31"');
    expect(csv).toContain('"COST-REPORT"');
    expect(csv).toContain('"450"');
  });
});
