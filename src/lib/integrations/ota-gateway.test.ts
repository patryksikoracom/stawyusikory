import { describe, expect, it } from "vitest";
import {
  compareOtaSnapshots,
  evaluateGatewayCutover,
  OTA_REQUIRED_FIELDS,
  webhookReplayKey,
  type DailyShadowReport,
} from "./ota-gateway";

const snapshot = {
  externalId: "OTA-1",
  unitId: "rybak",
  channel: "Booking",
  checkIn: "2026-08-01",
  checkOut: "2026-08-04",
  status: "confirmed",
  grossPrice: 1200,
  currency: "PLN",
  updatedAt: "2026-07-27T10:00:00Z",
};

describe("OTA gateway shadow mode", () => {
  it("reports deterministic field differences and missing records", () => {
    expect(compareOtaSnapshots([snapshot], [{ ...snapshot, grossPrice: 1250 }])).toEqual([
      expect.objectContaining({ key: "OTA-1:grossPrice", sourceValue: 1200, gatewayValue: 1250 }),
    ]);
    expect(compareOtaSnapshots([snapshot], [])).toEqual([
      expect.objectContaining({ key: "OTA-1:missing:gateway", field: "missing" }),
    ]);
  });

  it("keeps cutover closed until seven consecutive clean days and every manual gate", () => {
    const reports: DailyShadowReport[] = Array.from({ length: 7 }, (_, index) => ({
      date: `2026-07-${String(21 + index).padStart(2, "0")}`,
      differences: [],
      unresolved: 0,
      compared: 12,
    }));
    const contract = {
      provider: "candidate",
      version: "v1",
      signedAt: "2026-07-20",
      rtoMinutes: 60,
      rpoMinutes: 15,
      channels: ["Booking", "Airbnb", "Aloha Camp"],
      unitIds: ["rybak", "czapla"],
      fieldCoverage: Object.fromEntries(OTA_REQUIRED_FIELDS.map((field) => [field, true])),
    };
    expect(evaluateGatewayCutover({
      contract,
      reports: reports.slice(0, 6),
      allActiveRecordsReconciled: true,
      rollbackTestedAt: "2026-07-27",
      ownerApprovedAt: "2026-07-27",
    }).ready).toBe(false);
    expect(evaluateGatewayCutover({
      contract,
      reports,
      allActiveRecordsReconciled: true,
      rollbackTestedAt: "2026-07-27",
      ownerApprovedAt: "2026-07-27",
    })).toMatchObject({ ready: true, cleanDays: 7, blockers: [] });
  });

  it("builds a stable provider webhook replay key", () => {
    expect(webhookReplayKey(" Beds24 ", " EVENT-42 ")).toBe("beds24:EVENT-42");
  });

  it("does not count a gap or an unresolved day as continuous shadow evidence", () => {
    const result = evaluateGatewayCutover({
      reports: [
        { date: "2026-07-27", differences: [], unresolved: 0, compared: 10 },
        { date: "2026-07-25", differences: [], unresolved: 0, compared: 10 },
        { date: "2026-07-24", differences: [], unresolved: 1, compared: 10 },
      ],
      allActiveRecordsReconciled: false,
    });
    expect(result.cleanDays).toBe(1);
  });
});
