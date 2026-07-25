import { describe, expect, it } from "vitest";
import { initialData } from "@/lib/demo-data";
import { conflictBackup, summarizeSyncChanges, type SyncConflict } from "./state-conflict";

describe("porównanie zmian po konflikcie synchronizacji", () => {
  it("liczy zmienione rekordy według identyfikatora, a nie kolejności tablicy", () => {
    const base = structuredClone(initialData);
    const reordered = {
      ...base,
      bookings: [...base.bookings].reverse(),
    };
    const changed = {
      ...reordered,
      bookings: reordered.bookings.map((booking, index) => index === 0
        ? { ...booking, guestLabel: "Lokalna korekta" }
        : booking),
      settings: { ...reordered.settings, organizationName: "Nowa nazwa" },
    };

    expect(summarizeSyncChanges(base, reordered)).toEqual([]);
    expect(summarizeSyncChanges(base, changed)).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "bookings", localChanges: 1 }),
      expect.objectContaining({ key: "settings", localChanges: 1 }),
    ]));
  });

  it("tworzy samodzielną kopię lokalnego stanu z metadanymi konfliktu", () => {
    const conflict: SyncConflict = {
      source: "server-rejection",
      detectedAt: "2026-07-25T18:00:00.000Z",
      expectedVersion: 4,
      currentVersion: 5,
      requestId: "request-test-123",
      changes: [],
    };

    const backup = JSON.parse(conflictBackup(initialData, conflict)) as {
      reason: string;
      conflict: { requestId: string; expectedVersion: number; currentVersion: number };
      data: typeof initialData;
    };

    expect(backup.reason).toContain("Niezapisane zmiany");
    expect(backup.conflict).toMatchObject({
      requestId: "request-test-123",
      expectedVersion: 4,
      currentVersion: 5,
    });
    expect(backup.data.bookings).toHaveLength(initialData.bookings.length);
  });
});
