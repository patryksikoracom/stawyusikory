import type { AppData, Booking, WorkflowStatus } from "@/lib/types";
import { getBookingDataIssues } from "@/lib/workflow/rules";

export type BookingListScope = "operational" | "history";
export type BookingListSort = "arrival-asc" | "arrival-desc" | "created-desc";

export type BookingListFilters = {
  scope: BookingListScope;
  period: "all" | "30" | "90";
  unitId: "all" | string;
  workflow: "all" | WorkflowStatus;
  channel: "all" | string;
  balance: "all" | "open" | "settled";
  quality: "all" | "complete" | "incomplete";
  importState: "all" | "imported" | "manual";
  sort: BookingListSort;
  search: string;
};

export const defaultBookingListFilters: BookingListFilters = {
  scope: "operational",
  period: "all",
  unitId: "all",
  workflow: "all",
  channel: "all",
  balance: "all",
  quality: "all",
  importState: "all",
  sort: "arrival-asc",
  search: "",
};

function addDays(date: string, count: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + count);
  return value.toISOString().slice(0, 10);
}
export function bookingListRows(
  data: AppData,
  filters: BookingListFilters,
  today: string,
): Booking[] {
  const q = filters.search.trim().toLocaleLowerCase("pl-PL");
  const periodEnd = filters.period === "all"
    ? undefined
    : addDays(today, Number(filters.period));

  return data.bookings
    .filter((booking) => !booking.deletedAt)
    .filter((booking) => {
      const historical = booking.checkOut < today
        || booking.workflowStatus === "Zamknięta"
        || booking.workflowStatus === "Anulowana";
      if (filters.scope === "operational" ? historical : !historical) return false;
      if (periodEnd && booking.checkIn > periodEnd) return false;
      if (filters.unitId !== "all" && booking.unitId !== filters.unitId) return false;
      if (filters.workflow !== "all" && booking.workflowStatus !== filters.workflow) return false;
      if (filters.channel !== "all" && booking.platform !== filters.channel) return false;
      const settled = booking.paymentStatus === "Opłacone";
      if (filters.balance === "open" && settled) return false;
      if (filters.balance === "settled" && !settled) return false;
      const incomplete = booking.needsReview || getBookingDataIssues(data, booking).length > 0;
      if (filters.quality === "complete" && incomplete) return false;
      if (filters.quality === "incomplete" && !incomplete) return false;
      if (filters.importState === "imported" && !booking.importRef) return false;
      if (filters.importState === "manual" && booking.importRef) return false;
      if (!q) return true;
      const unit = data.units.find((candidate) => candidate.id === booking.unitId)?.name;
      return [
        booking.guestLabel,
        booking.id,
        booking.platformReservationNo,
        unit,
      ].filter(Boolean).some((value) => String(value).toLocaleLowerCase("pl-PL").includes(q));
    })
    .sort((left, right) => {
      if (filters.sort === "arrival-asc") {
        return left.checkIn.localeCompare(right.checkIn) || left.id.localeCompare(right.id);
      }
      if (filters.sort === "arrival-desc") {
        return right.checkIn.localeCompare(left.checkIn) || left.id.localeCompare(right.id);
      }
      return right.bookingDate.localeCompare(left.bookingDate) || left.id.localeCompare(right.id);
    });
}
