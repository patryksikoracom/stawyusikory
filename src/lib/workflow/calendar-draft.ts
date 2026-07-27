import type { AppData, Booking } from "@/lib/types";
import { addLocalDays } from "@/lib/date";
import { getBookingConflicts } from "@/lib/workflow/rules";

export type CalendarBookingDraft = {
  unitId: string;
  checkIn: string;
  checkOut: string;
};

export function calendarWindowStart(today: string) {
  return addLocalDays(today, -7);
}

export function buildCalendarBookingDraft(
  data: AppData,
  unitId: string,
  firstDate: string,
  secondDate: string,
): { draft?: CalendarBookingDraft; conflict?: string } {
  const start = firstDate <= secondDate ? firstDate : secondDate;
  const selectedEnd = firstDate <= secondDate ? secondDate : firstDate;
  const checkOut = selectedEnd === start ? addLocalDays(start, 1) : selectedEnd;
  const draft = { unitId, checkIn: start, checkOut };
  const probe: Booking = {
    id: "calendar-draft",
    bookingDate: start,
    source: "Kalendarz Stawy OS",
    platform: "Telefon",
    unitId,
    checkIn: start,
    checkOut,
    arrivalTime: data.settings.defaultCheckIn,
    departureTime: data.settings.defaultCheckOut,
    adults: 2,
    children: 0,
    guestLabel: "Wersja robocza",
    paymentStatus: "Do uzupełnienia",
    workflowStatus: "Nowa",
    createdBy: "Stawy OS",
  };
  const conflict = getBookingConflicts(data.bookings, data.blocks, probe)[0];
  return conflict ? { conflict } : { draft };
}
