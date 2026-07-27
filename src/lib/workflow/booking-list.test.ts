import { describe, expect, it } from "vitest";
import { initialData } from "@/lib/demo-data";
import type { Booking } from "@/lib/types";
import {
  bookingListRows,
  defaultBookingListFilters,
  type BookingListFilters,
} from "./booking-list";

const today = "2026-07-27";

function booking(id: string, overrides: Partial<Booking>): Booking {
  return {
    id,
    bookingDate: "2026-07-01",
    source: "Telefon",
    platform: "Bezpośrednio",
    unitId: initialData.units[0].id,
    checkIn: "2026-08-01",
    checkOut: "2026-08-04",
    adults: 2,
    children: 0,
    guestLabel: id,
    paymentStatus: "Do dopłaty",
    workflowStatus: "Potwierdzona",
    createdBy: "test",
    ...overrides,
  };
}

function rows(filters: Partial<BookingListFilters> = {}) {
  const data = {
    ...initialData,
    bookings: [
      booking("ongoing", { checkIn: "2026-07-26", checkOut: "2026-07-30" }),
      booking("future", { checkIn: "2026-08-10", checkOut: "2026-08-14", platform: "Booking", paymentStatus: "Opłacone", importRef: { source: "mobile-calendar", key: "1" } }),
      booking("far", { checkIn: "2026-12-10", checkOut: "2026-12-14" }),
      booking("closed", { checkIn: "2026-06-10", checkOut: "2026-06-14", workflowStatus: "Zamknięta" }),
      booking("cancelled", { workflowStatus: "Anulowana" }),
    ],
  };
  return bookingListRows(data, { ...defaultBookingListFilters, ...filters }, today);
}

describe("booking operational list", () => {
  it("domyślnie pokazuje tylko trwające i nadchodzące pobyty od najbliższego przyjazdu", () => {
    expect(rows().map((item) => item.id)).toEqual(["ongoing", "future", "far"]);
  });

  it("oddziela historię od listy operacyjnej", () => {
    expect(rows({ scope: "history" }).map((item) => item.id)).toEqual(["closed", "cancelled"]);
  });

  it("łączy nazwane filtry okresu, kanału, salda i importu", () => {
    expect(rows({
      period: "30",
      channel: "Booking",
      balance: "settled",
      importState: "imported",
    }).map((item) => item.id)).toEqual(["future"]);
  });

  it("sortuje zgodnie z uczciwą nazwą pola", () => {
    expect(rows({ sort: "arrival-desc" }).map((item) => item.id)).toEqual(["far", "future", "ongoing"]);
    expect(rows({ sort: "created-desc" })).toHaveLength(3);
  });
});
