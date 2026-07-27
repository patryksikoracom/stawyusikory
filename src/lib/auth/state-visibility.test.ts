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
      },
    };
    expect(visibleOperationalRecord(pricedBooking, "manager")?.payload).toMatchObject({
      grossPrice: 2400,
      pricePerNight: 600,
      depositAmount: 800,
      currency: "PLN",
    });
    expect(visibleOperationalRecord(pricedBooking, "manager")?.payload).not.toHaveProperty("commission");
    expect(visibleOperationalRecord(pricedBooking, "manager")?.payload).not.toHaveProperty("payout");
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
