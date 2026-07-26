import { describe, expect, it } from "vitest";
import {
  createCalendarBlockCommandSchema,
  operationalCalendarBlockSchema,
  updateCalendarBlockCommandSchema,
} from "./calendar-block-command";

const block = {
  id: "BLOCK-1",
  unitId: "UNIT-1",
  dateFrom: "2026-08-10",
  dateTo: "2026-08-12",
  blockType: "Serwis",
  reason: "Przegląd pompy",
  status: "Aktywna",
  version: 1,
} as const;

describe("komendy blokad kalendarza", () => {
  it("akceptuje poprawny półotwarty zakres dat", () => {
    expect(operationalCalendarBlockSchema.safeParse(block).success).toBe(true);
  });

  it.each([
    { ...block, dateTo: block.dateFrom },
    { ...block, reason: "" },
    { ...block, unitId: "" },
    { ...block, blockType: "Awaria" },
    { ...block, status: "Usunięta" },
  ])("odrzuca naruszenie domeny %o", (candidate) => {
    expect(operationalCalendarBlockSchema.safeParse(candidate).success).toBe(false);
  });

  it("wymaga wersji 1 przy tworzeniu i kolejnej wersji przy aktualizacji", () => {
    expect(createCalendarBlockCommandSchema.safeParse({
      block,
      expectedRecordVersion: 0,
      requestId: "request-create",
      clientSentAt: "2026-07-26T17:00:00.000Z",
      tabId: "tab-create-123",
    }).success).toBe(true);

    expect(updateCalendarBlockCommandSchema.safeParse({
      block: { ...block, version: 4 },
      expectedRecordVersion: 3,
      requestId: "request-update",
      clientSentAt: "2026-07-26T17:00:00.000Z",
      tabId: "tab-update-123",
    }).success).toBe(true);

    expect(updateCalendarBlockCommandSchema.safeParse({
      block: { ...block, version: 3 },
      expectedRecordVersion: 3,
      requestId: "request-update",
      clientSentAt: "2026-07-26T17:00:00.000Z",
      tabId: "tab-update-123",
    }).success).toBe(false);
  });
});
