import { describe, expect, it } from "vitest";
import { recordBatchCommandSchema } from "./record-batch-command";

const metadata = {
  requestId: "request-batch-123",
  clientSentAt: "2026-07-26T18:00:00.000Z",
  tabId: "tab-batch-123",
};

describe("recordBatchCommandSchema", () => {
  it("przyjmuje atomową paczkę utworzenia, aktualizacji i usunięcia", () => {
    const result = recordBatchCommandSchema.safeParse({
      ...metadata,
      changes: [
        {
          entityType: "issues",
          entityId: "ISSUE-1",
          operation: "upsert",
          expectedRecordVersion: 0,
          payload: {
            id: "ISSUE-1",
            title: "Nieszczelny kran",
            status: "Otwarte",
            createdAt: "2026-07-26T18:00:00.000Z",
          },
        },
        {
          entityType: "invoices",
          entityId: "INV-1",
          operation: "delete",
          expectedRecordVersion: 2,
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("przyjmuje znacznik czasu PostgreSQL z przesunięciem podczas edycji po synchronizacji", () => {
    expect(recordBatchCommandSchema.safeParse({
      ...metadata,
      changes: [{
        entityType: "sourceConnections",
        entityId: "SRC-AIRBNB",
        operation: "upsert",
        expectedRecordVersion: 2,
        payload: {
          id: "SRC-AIRBNB",
          platform: "Airbnb",
          connectionType: "iCal",
          status: "Wymaga sprawdzenia",
          coverage: 0,
          nextStep: "Uruchom kontrolę połączenia.",
          notes: "iCal blokuje terminy.",
          priority: "Teraz",
          updatedAt: "2026-08-10T13:45:00+00:00",
        },
      }],
    }).success).toBe(true);
  });

  it.each([
    ["duplikat", [
      { entityType: "issues", entityId: "ISSUE-1", operation: "delete", expectedRecordVersion: 1 },
      { entityType: "issues", entityId: "ISSUE-1", operation: "delete", expectedRecordVersion: 1 },
    ]],
    ["niezgodne ID", [{
      entityType: "issues",
      entityId: "ISSUE-1",
      operation: "upsert",
      expectedRecordVersion: 0,
      payload: { id: "ISSUE-2", title: "Test", status: "Otwarte", createdAt: "2026-07-26T18:00:00.000Z" },
    }]],
    ["usunięcie wersji zero", [{
      entityType: "issues", entityId: "ISSUE-1", operation: "delete", expectedRecordVersion: 0,
    }]],
    ["błędny rekord", [{
      entityType: "invoices",
      entityId: "INV-1",
      operation: "upsert",
      expectedRecordVersion: 0,
      payload: { id: "INV-1", number: "", issuedAt: "nie-data", amount: -1, status: "Wystawiona" },
    }]],
  ])("odrzuca: %s", (_name, changes) => {
    expect(recordBatchCommandSchema.safeParse({ ...metadata, changes }).success).toBe(false);
  });
});
