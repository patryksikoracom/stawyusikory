import { describe, expect, it } from "vitest";
import type { CalendarBlock } from "@/lib/types";
import { isOutboundCalendarBlock } from "./ical-export";

function block(id: string, status: CalendarBlock["status"] = "Aktywna"): CalendarBlock {
  return {
    id,
    unitId: "domek-rybaka",
    dateFrom: "2026-08-14",
    dateTo: "2026-08-19",
    blockType: "Inne",
    reason: "test",
    status,
  };
}

describe("eksport iCal Stawy OS", () => {
  it("nie odsyła do portali blokad wcześniej zaimportowanych z iCal", () => {
    expect(isOutboundCalendarBlock(block("ICAL-SRC-AIRBNB-event"))).toBe(false);
    expect(isOutboundCalendarBlock(block("ICAL-SRC-BOOKING-event"))).toBe(false);
  });

  it("wysyła aktywne lokalne blokady, ale pomija anulowane", () => {
    expect(isOutboundCalendarBlock(block("BLK-LOCAL"))).toBe(true);
    expect(isOutboundCalendarBlock(block("BLK-CANCELLED", "Anulowana"))).toBe(false);
  });
});
