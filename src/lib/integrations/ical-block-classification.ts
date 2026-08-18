import type { Booking, CalendarBlock } from "@/lib/types";
import { dateDiffDays } from "@/lib/date";

export type ImportedIcalBlockClassification = {
  kind: "reservation" | "buffer" | "closed";
  platform: "Booking" | "Airbnb";
};

export function classifyImportedIcalBlock(block: CalendarBlock): ImportedIcalBlockClassification | undefined {
  if (!block.id.startsWith("ICAL-")) return undefined;
  const match = block.reason.match(/^\[(Booking|Airbnb)\]\s*(.*)$/i);
  if (!match) return undefined;
  const platform = match[1]?.toLowerCase() === "booking" ? "Booking" : "Airbnb";
  const summary = match[2]?.trim() ?? "";
  const duration = Math.max(1, dateDiffDays(block.dateFrom, block.dateTo));
  const explicitlyReserved = /reserved|reservation|booked|rezerw/i.test(summary);
  const kind = explicitlyReserved || (platform === "Booking" && duration > 2 && duration <= 30)
    ? "reservation"
    : duration <= 2 ? "buffer" : "closed";
  return { kind, platform };
}

export function isOverridableCleaningBuffer(block: CalendarBlock) {
  return block.blockType === "Bufor sprzątania"
    || classifyImportedIcalBlock(block)?.kind === "buffer";
}

export function importedReservationBlockMatchesBooking(block: CalendarBlock, booking: Booking) {
  const classification = classifyImportedIcalBlock(block);
  if (classification?.kind !== "reservation") return false;
  if (classification.platform !== booking.platform || block.unitId !== booking.unitId) return false;
  if (booking.workflowStatus === "Anulowana") return false;

  const overlapStart = booking.checkIn > block.dateFrom ? booking.checkIn : block.dateFrom;
  const overlapEnd = booking.checkOut < block.dateTo ? booking.checkOut : block.dateTo;
  const overlapDays = Math.max(0, dateDiffDays(overlapStart, overlapEnd));
  const bookingDays = Math.max(1, dateDiffDays(booking.checkIn, booking.checkOut));
  const blockDays = Math.max(1, dateDiffDays(block.dateFrom, block.dateTo));

  return overlapDays / Math.min(bookingDays, blockDays) >= 0.75
    && Math.abs(dateDiffDays(booking.checkIn, block.dateFrom)) <= 1
    && Math.abs(dateDiffDays(booking.checkOut, block.dateTo)) <= 1;
}
