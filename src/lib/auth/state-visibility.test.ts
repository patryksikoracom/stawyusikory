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
