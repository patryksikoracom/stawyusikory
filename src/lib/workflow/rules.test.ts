import { describe, expect, it } from "vitest";
import { boundaryTimesOverlap, calendarBarPlacement, cancelOpenStayTasks, getBookingConflicts, getBookingDataIssues, getNextAction, nightsBetween, overlaps, rescheduleOpenTasksForBooking } from "./rules";
import type { Booking, CalendarBlock, OpsTask } from "../types";
import { initialData } from "../demo-data";
import { todayInPoland } from "../date";

const base: Booking = { id:"A",bookingDate:"2026-07-01",source:"test",platform:"Bezpośrednio",unitId:"u1",checkIn:"2026-07-10",checkOut:"2026-07-12",adults:2,children:0,guestLabel:"Test",paymentStatus:"Opłacone",workflowStatus:"Potwierdzona",createdBy:"test" };

describe("availability rules", () => {
  it("allows same-day turnover and rejects actual overlap", () => {
    expect(overlaps("2026-07-10","2026-07-12","2026-07-12","2026-07-14")).toBe(false);
    expect(overlaps("2026-07-10","2026-07-13","2026-07-12","2026-07-14")).toBe(true);
    expect(nightsBetween("2026-07-10","2026-07-12")).toBe(2);
  });

  it("allows an afternoon arrival after a same-day departure", () => {
    const outgoing = { ...base, id: "BIANKA", checkIn: "2026-08-01", checkOut: "2026-08-08", departureTime: "11:00" };
    const incoming = { ...base, id: "NEW", checkIn: "2026-08-08", checkOut: "2026-08-12", arrivalTime: "16:00" };
    expect(boundaryTimesOverlap(incoming, outgoing)).toBe(false);
    expect(getBookingConflicts([outgoing], [], incoming)).toEqual([]);
  });

  it("draws stays from check-in noon to checkout noon, including the first visible day edge", () => {
    expect(calendarBarPlacement("2026-07-10", "2026-07-12", "2026-07-10", 28, 44)).toEqual({ start: 0, span: 2, marginLeft: 24, marginRight: -20 });
    expect(calendarBarPlacement("2026-07-08", "2026-07-10", "2026-07-10", 28, 44)).toEqual({ start: 0, span: 1, marginLeft: 2, marginRight: 24 });
  });

  it("blocks a boundary arrival that is earlier than the recorded departure", () => {
    const outgoing = { ...base, id: "LATE", checkOut: "2026-07-12", departureTime: "18:00" };
    const incoming = { ...base, id: "EARLY", checkIn: "2026-07-12", checkOut: "2026-07-14", arrivalTime: "16:00" };
    expect(getBookingConflicts([outgoing], [], incoming)).toEqual(["Godziny nachodzą się z rezerwacją LATE"]);
    expect(boundaryTimesOverlap({ ...incoming, arrivalTime: "16:00" }, { ...outgoing, departureTime: "8:00" })).toBe(false);
  });

  it("ignores cancelled bookings and reports active blocks", () => {
    const cancelled={...base,id:"B",workflowStatus:"Anulowana" as const};
    const block:CalendarBlock={id:"BLK",unitId:"u1",dateFrom:"2026-07-11",dateTo:"2026-07-13",blockType:"Serwis",reason:"Pompa",status:"Aktywna"};
    expect(getBookingConflicts([base,cancelled],[],base)).toEqual([]);
    expect(getBookingConflicts([base],[block],base)).toEqual(["Blokada: Pompa"]);
  });

  it("reschedules open operational tasks but preserves repairs and completed work", () => {
    const tasks: OpsTask[] = [
      { id: "clean", bookingId: base.id, type: "Sprzątanie", priority: "Wysoki", status: "Do zrobienia", dueDate: "2026-07-12", owner: "Ewa", title: "Sprzątanie" },
      { id: "review", bookingId: base.id, type: "Opinia", priority: "Średni", status: "Zrobione", dueDate: "2026-07-13", owner: "Patryk", title: "Opinia" },
      { id: "repair", bookingId: base.id, type: "Naprawa", priority: "Średni", status: "Do zrobienia", planningHorizon: "Po sezonie", owner: "Patryk", title: "Drzwi" },
    ];
    const updated = rescheduleOpenTasksForBooking(tasks, { ...base, checkOut: "2026-07-15" });
    expect(updated.find((item) => item.id === "clean")?.dueDate).toBe("2026-07-15");
    expect(updated.find((item) => item.id === "review")?.dueDate).toBe("2026-07-13");
    expect(updated.find((item) => item.id === "repair")?.planningHorizon).toBe("Po sezonie");
  });

  it("cancels stay tasks without discarding a linked physical repair", () => {
    const tasks: OpsTask[] = [
      { id: "clean", bookingId: base.id, type: "Sprzątanie", priority: "Wysoki", status: "Do zrobienia", owner: "Ewa", title: "Sprzątanie" },
      { id: "repair", bookingId: base.id, type: "Naprawa", priority: "Wysoki", status: "Do zrobienia", owner: "Patryk", title: "Drzwi" },
    ];
    const cancelled = cancelOpenStayTasks(tasks, base.id);
    expect(cancelled.find((item) => item.id === "clean")?.status).toBe("Nie dotyczy");
    expect(cancelled.find((item) => item.id === "repair")?.status).toBe("Do zrobienia");
  });

  it("uses the departure debrief as the next action after checkout", () => {
    const today = todayInPoland();
    const departed = { ...base, checkIn: "2026-07-10", checkOut: today, grossPrice: 1800 };
    const data = { ...initialData, bookings: [departed], blocks: [], tasks: [], departureDebriefs: [], imports: [], media: [], guests: [], consents: [] };
    expect(getNextAction(data, departed)).toBe("Uzupełnić podsumowanie wyjazdu");
    expect(getNextAction({ ...data, departureDebriefs: [{ id: `DEB-${departed.id}`, bookingId: departed.id, status: "Ukończony", keysSettled: true, urgentNextArrivalRisk: false, publicQuotePermission: "Nie" }] }, departed)).toBe("Gotowe do analizy");
  });

  it("does not treat optional research fields as missing operational data", () => {
    const departed = { ...base, checkIn: "2026-07-01", checkOut: "2026-07-02", grossPrice: 1200 };
    const data = { ...initialData, bookings: [departed], blocks: [], tasks: [], departureDebriefs: [], imports: [], media: [], guests: [], consents: [] };
    expect(getBookingDataIssues(data, departed)).toEqual([]);
  });
});
