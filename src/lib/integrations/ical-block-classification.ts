import type { CalendarBlock } from "@/lib/types";
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
