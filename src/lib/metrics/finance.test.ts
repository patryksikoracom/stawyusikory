import { describe, expect, it } from "vitest";
import type { Booking, PaymentTransaction } from "@/lib/types";
import { buildBookingFinanceCsv, calculateBookingFinance, calculateFinanceOverview } from "./finance";

const booking = (overrides: Partial<Booking> = {}): Booking => ({
  id: "B-550",
  bookingDate: "2026-07-01",
  source: "Telefon",
  platform: "Bezpośrednio",
  unitId: "u1",
  checkIn: "2026-08-01",
  checkOut: "2026-08-03",
  adults: 2,
  children: 0,
  guestLabel: "Gość testowy",
  grossPrice: 550,
  currency: "PLN",
  paymentStatus: "Częściowo",
  workflowStatus: "Potwierdzona",
  createdBy: "test",
  ...overrides,
});

const payment = (overrides: Partial<PaymentTransaction> = {}): PaymentTransaction => ({
  id: "PAY-1",
  bookingId: "B-550",
  occurredAt: "2026-07-20",
  type: "Wpłata",
  amount: 300,
  currency: "PLN",
  status: "Zaksięgowana",
  ...overrides,
});

describe("booking finance engine", () => {
  it("calculates a partial payment and exposes stable perspective identifiers", () => {
    const result = calculateBookingFinance(booking(), [payment({ type: "Zaliczka" })]);

    expect(result).toMatchObject({
      bookingValue: 550,
      guestPayments: 300,
      guestRefunds: 0,
      guestPaidNet: 300,
      balance: 250,
      amountDue: 250,
      overpayment: 0,
      balanceStatus: "due",
    });
    expect(result.perspectives.sales.metricId).toBe("sales_booking_value_v1");
    expect(result.perspectives.receivables.metricId).toBe("receivables_guest_balance_v1");
    expect(result.perspectives.cashflow.metricId).toBe("cashflow_posted_transactions_v1");
    expect(result.perspectives.management.metricId).toBe("management_result_inputs_v1");
  });

  it("shows overpayment instead of clamping a negative balance to zero", () => {
    const result = calculateBookingFinance(booking(), [payment({ amount: 600 })]);

    expect(result.balance).toBe(-50);
    expect(result.amountDue).toBe(0);
    expect(result.overpayment).toBe(50);
    expect(result.balanceStatus).toBe("overpaid");
  });

  it("subtracts refunds but keeps commission, costs and OTA payout outside guest payments", () => {
    const result = calculateBookingFinance(booking({ platform: "Booking" }), [
      payment({ id: "deposit", type: "Zaliczka", amount: 300 }),
      payment({ id: "refund", type: "Zwrot", amount: 50 }),
      payment({ id: "commission", type: "Prowizja", amount: 80 }),
      payment({ id: "cleaning", type: "Koszt", amount: 100 }),
      payment({ id: "payout", type: "Wypłata OTA", amount: 370 }),
    ]);

    expect(result.guestPaidNet).toBe(250);
    expect(result.balance).toBe(300);
    expect(result.managementInputs).toEqual({ commission: 80, costs: 100, otaPayout: 370 });
    expect(result.cashflow).toEqual({ inflows: 670, outflows: 230, net: 440 });
  });

  it("uses an explicit opening balance with provenance", () => {
    const result = calculateBookingFinance(booking({
      openingPaidAmount: 300,
      openingPaidCurrency: "PLN",
      openingPaidSource: "Import Mobile-Calendar 2026-07-20",
    }), []);

    expect(result.guestPaidNet).toBe(300);
    expect(result.balance).toBe(250);
    expect(result.openingPaidSource).toBe("Import Mobile-Calendar 2026-07-20");
    expect(result.perspectives.receivables.completeness).toBe("complete");
  });

  it("marks missing price and currency conflicts as incomplete without mixing amounts", () => {
    const missingPrice = calculateBookingFinance(booking({ grossPrice: undefined }), [payment()]);
    const conflict = calculateBookingFinance(booking(), [payment({ currency: "EUR" })]);

    expect(missingPrice.balance).toBeNull();
    expect(missingPrice.perspectives.receivables.completeness).toBe("unavailable");
    expect(conflict.guestPaidNet).toBe(0);
    expect(conflict.balance).toBe(550);
    expect(conflict.perspectives.receivables.completeness).toBe("partial");
    expect(conflict.issues).toContainEqual({ code: "transaction_currency_mismatch", recordId: "PAY-1" });
  });

  it("does not require an OTA commission for a direct booking", () => {
    const result = calculateBookingFinance(booking({ paymentStatus: "Do dopłaty" }), [payment()]);

    expect(result.managementInputs.commission).toBe(0);
    expect(result.perspectives.management.completeness).toBe("complete");
    expect(result.issues.map((issue) => issue.code)).not.toContain("payment_status_without_evidence");
  });

  it("keeps malformed management inputs outside receivables completeness", () => {
    const result = calculateBookingFinance(booking(), [
      payment(),
      payment({ id: "BROKEN-COST", type: "Koszt", amount: Number.NaN }),
    ]);

    expect(result.guestPaidNet).toBe(300);
    expect(result.balance).toBe(250);
    expect(result.perspectives.receivables.completeness).toBe("complete");
    expect(result.perspectives.management.completeness).toBe("partial");
  });

  it("keeps PLN and EUR evidence separate", () => {
    const eur = calculateBookingFinance(booking({ currency: "EUR", grossPrice: 550 }), [
      payment({ currency: "EUR", amount: 300 }),
      payment({ id: "PLN-WRONG", currency: "PLN", amount: 200 }),
    ]);

    expect(eur.currency).toBe("EUR");
    expect(eur.guestPaidNet).toBe(300);
    expect(eur.balance).toBe(250);
    expect(eur.perspectives.receivables.completeness).toBe("partial");
  });

  it("separates sales, receivables, cashflow and management inputs in a period", () => {
    const overview = calculateFinanceOverview({
      bookings: [booking(), booking({ id: "EUR", currency: "EUR", grossPrice: 200 })],
      payments: [
        payment(),
        payment({ id: "EUR-PAY", bookingId: "EUR", currency: "EUR", amount: 50 }),
        payment({ id: "COST", type: "Koszt", amount: 80 }),
      ],
      period: { from: "2026-01-01", toExclusive: "2027-01-01" },
    });

    expect(overview.sales).toEqual({ PLN: 550, EUR: 200 });
    expect(overview.receivables).toEqual({ PLN: 250, EUR: 150 });
    expect(overview.cashflow).toEqual({ PLN: 220, EUR: 50 });
    expect(overview.costs).toEqual({ PLN: 80, EUR: 0 });
  });

  it("exports raw balance, due amount, overpayment, currency and opening provenance", () => {
    const csv = buildBookingFinanceCsv({
      bookings: [booking({
        openingPaidAmount: 600,
        openingPaidCurrency: "PLN",
        openingPaidSource: "Import Mobile-Calendar",
      })],
      payments: [],
      units: [{ id: "u1", name: "Rybak", maxPeople: 4, bedrooms: 2, defaultPricePerNight: 500, defaultCleaningCost: 100, notes: "" }],
    });

    expect(csv).toContain('"saldo_surowe"');
    expect(csv).toContain('"nadpłata"');
    expect(csv).toContain('"Import Mobile-Calendar"');
    expect(csv).toContain('"-50"');
    expect(csv).toContain('"50"');
  });
});
