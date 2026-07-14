import { describe, expect, it } from "vitest";
import { getBookingConflicts, nightsBetween, overlaps } from "./rules";
import type { Booking, CalendarBlock } from "../types";

const base: Booking = { id:"A",bookingDate:"2026-07-01",source:"test",platform:"Bezpośrednio",unitId:"u1",checkIn:"2026-07-10",checkOut:"2026-07-12",adults:2,children:0,guestLabel:"Test",paymentStatus:"Opłacone",workflowStatus:"Potwierdzona",createdBy:"test" };

describe("availability rules", () => {
  it("allows same-day turnover and rejects actual overlap", () => {
    expect(overlaps("2026-07-10","2026-07-12","2026-07-12","2026-07-14")).toBe(false);
    expect(overlaps("2026-07-10","2026-07-13","2026-07-12","2026-07-14")).toBe(true);
    expect(nightsBetween("2026-07-10","2026-07-12")).toBe(2);
  });

  it("ignores cancelled bookings and reports active blocks", () => {
    const cancelled={...base,id:"B",workflowStatus:"Anulowana" as const};
    const block:CalendarBlock={id:"BLK",unitId:"u1",dateFrom:"2026-07-11",dateTo:"2026-07-13",blockType:"Serwis",reason:"Pompa",status:"Aktywna"};
    expect(getBookingConflicts([base,cancelled],[],base)).toEqual([]);
    expect(getBookingConflicts([base],[block],base)).toEqual(["Blokada: Pompa"]);
  });
});
