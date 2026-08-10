import type { CalendarBlock } from "@/lib/types";

export function isOutboundCalendarBlock(block: CalendarBlock) {
  return block.status !== "Anulowana" && !block.id.startsWith("ICAL-");
}
