import { describe, expect, it } from "vitest";
import { visibleOperationalRecord } from "./state-visibility";

const booking = {
  entity_type: "bookings",
  entity_id: "B-1",
  payload: {
    id: "B-1",
    unitId: "U-1",
    dateFrom: "2026-08-01",
    dateTo: "2026-08-03",
    guestName: "Jan Kowalski",
    phone: "+48123456789",
    grossAmount: 2000,
  },
};

describe("widoczność rekordów według roli", () => {
  it("cleaning nie otrzymuje ogólnego stanu", () => {
    expect(visibleOperationalRecord(booking, "cleaning")).toBeNull();
  });

  it("viewer widzi dostępność bez PII i finansów", () => {
    expect(visibleOperationalRecord(booking, "viewer")?.payload).toEqual({
      id: "B-1",
      unitId: "U-1",
      dateFrom: "2026-08-01",
      dateTo: "2026-08-03",
    });
  });

  it("manager widzi dane operacyjne i PII bez finansów", () => {
    expect(visibleOperationalRecord(booking, "manager")?.payload).toEqual({
      id: "B-1",
      unitId: "U-1",
      dateFrom: "2026-08-01",
      dateTo: "2026-08-03",
      guestName: "Jan Kowalski",
      phone: "+48123456789",
    });
  });

  it("manager widzi cenę i rozliczenie pobytu bez kosztów ani prowizji", () => {
    const pricedBooking = {
      ...booking,
      payload: {
        ...booking.payload,
        grossPrice: 2400,
        pricePerNight: 600,
        depositAmount: 800,
        currency: "PLN",
        commission: 360,
        payout: 2040,
        openingPaidAmount: 2400,
        openingPaidCurrency: "PLN",
        openingPaidSource: "Import z panelem finansowym",
        importWarnings: ["Prowizja 360 PLN, wypłata 2040 PLN"],
      },
    };
    const visible = visibleOperationalRecord(pricedBooking, "manager", {
      currency: "PLN",
      bookingValue: 2400,
      paid: 2400,
      balance: 0,
      amountDue: 0,
      overpayment: 0,
      balanceStatus: "settled",
      completeness: "complete",
    })?.payload;
    expect(visible).toMatchObject({
      grossPrice: 2400,
      pricePerNight: 600,
      depositAmount: 800,
      currency: "PLN",
      operatorPaymentSummary: {
        paid: 2400,
        amountDue: 0,
        balanceStatus: "settled",
      },
    });
    expect(visible).not.toHaveProperty("commission");
    expect(visible).not.toHaveProperty("payout");
    expect(visible).not.toHaveProperty("openingPaidAmount");
    expect(visible).not.toHaveProperty("openingPaidSource");
    expect(visible).not.toHaveProperty("importWarnings");
  });

  it("manager otrzymuje stawkę potrzebną do wyceny bez kosztu sprzątania", () => {
    const unit = {
      entity_type: "units",
      entity_id: "U-1",
      payload: { id: "U-1", name: "Czapla", defaultPricePerNight: 600, defaultCleaningCost: 220 },
    };
    expect(visibleOperationalRecord(unit, "manager")?.payload).toEqual({
      id: "U-1",
      name: "Czapla",
      defaultPricePerNight: 600,
    });
  });

  it("manager sees Jadzia settlement while unrelated task finances stay hidden", () => {
    const task = { entity_type: "tasks", entity_id: "C-1", payload: {
      id: "C-1", type: "Sprzątanie", status: "Zrobione", internalCost: 900,
      cleaningSettlement: { amount: 150, currency: "PLN", paidAt: "2026-09-30T10:00:00Z" },
    } };
    const visible = visibleOperationalRecord(task, "manager")?.payload;
    expect(visible).toHaveProperty("cleaningSettlement", task.payload.cleaningSettlement);
    expect(visible).not.toHaveProperty("internalCost");
  });

  it("accounting widzi finanse, ale nie dane marketingowe", () => {
    expect(visibleOperationalRecord(booking, "accounting")).toEqual(booking);
    expect(visibleOperationalRecord({ ...booking, entity_type: "media" }, "accounting")).toBeNull();
  });

  it("marketing nie dostaje kontaktu ani danych finansowych", () => {
    const record = {
      ...booking,
      entity_type: "marketingTouchpoints",
      payload: { campaign: "Lato", email: "jan@example.com", amount: 200 },
    };
    expect(visibleOperationalRecord(record, "marketing")?.payload).toEqual({ campaign: "Lato" });
  });
});
