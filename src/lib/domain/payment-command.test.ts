import { describe, expect, it } from "vitest";
import { createPaymentCommandSchema, operationalPaymentSchema } from "./payment-command";

const payment = {
  id: "PAYMENT-1",
  bookingId: "BOOKING-1",
  occurredAt: "2026-07-26",
  type: "Wpłata",
  amount: 450.25,
  currency: "PLN",
  status: "Zaksięgowana",
  method: "Przelew",
  note: "Wpłata potwierdzona w banku",
};

describe("komenda płatności", () => {
  it("akceptuje zaksięgowaną wpłatę z dokładnością do grosza", () => {
    expect(createPaymentCommandSchema.safeParse({
      payment,
      requestId: "request-payment-1",
      clientSentAt: "2026-07-26T15:00:00.000Z",
      tabId: "tab-payment-1",
    }).success).toBe(true);
  });

  it.each([
    [{ ...payment, amount: 0 }, "zerową kwotę"],
    [{ ...payment, amount: -10 }, "ujemną kwotę"],
    [{ ...payment, amount: 10.001 }, "ułamkowe grosze"],
    [{ ...payment, currency: "USD" }, "nieobsługiwaną walutę"],
    [{ ...payment, status: "Oczekuje" }, "niezaksięgowany status"],
  ])("odrzuca %s", (candidate) => {
    expect(operationalPaymentSchema.safeParse(candidate).success).toBe(false);
  });

  it("wymaga dowodu i kategorii dla kosztu oraz prowizji", () => {
    expect(operationalPaymentSchema.safeParse({
      ...payment,
      type: "Koszt",
      source: undefined,
      unitId: undefined,
      costCategory: undefined,
    }).success).toBe(false);
    expect(operationalPaymentSchema.safeParse({
      ...payment,
      type: "Koszt",
      source: "FV 12/2026",
      unitId: "CZAPLA",
      costCategory: "Energia",
    }).success).toBe(true);
    expect(operationalPaymentSchema.safeParse({
      ...payment,
      type: "Prowizja",
      source: "Panel OTA",
      unitId: "CZAPLA",
      costCategory: "Prowizja OTA",
    }).success).toBe(true);
  });

  it("nie pozwala podpinać zwykłej wpłaty pod model kosztowy", () => {
    expect(operationalPaymentSchema.safeParse({
      ...payment,
      costSettingId: "COST-ENERGY",
    }).success).toBe(false);
  });
});
