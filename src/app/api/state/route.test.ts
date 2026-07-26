import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

describe("GET /api/state wersje rekordów", () => {
  it("dołącza wersje do danych i pełną mapę wersji dla komend batchowych", async () => {
    const membershipQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      limit: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { organization_id: "org-test", role: "owner" },
        error: null,
      }),
    };
    membershipQuery.select.mockReturnValue(membershipQuery);
    membershipQuery.eq.mockReturnValue(membershipQuery);
    membershipQuery.limit.mockReturnValue(membershipQuery);

    const records = [
      {
        entity_type: "bookings",
        entity_id: "BOOKING-1",
        payload: { id: "BOOKING-1" },
        record_version: 4,
        updated_at: "2026-07-25T20:00:00.000Z",
      },
      {
        entity_type: "consents",
        entity_id: "BOOKING-1",
        payload: { bookingId: "BOOKING-1" },
        record_version: 3,
        updated_at: "2026-07-25T20:00:00.000Z",
      },
      {
        entity_type: "tasks",
        entity_id: "TASK-1",
        payload: { id: "TASK-1", bookingId: "BOOKING-1" },
        record_version: 6,
        updated_at: "2026-07-25T20:00:00.000Z",
      },
      {
        entity_type: "scheduledMessages",
        entity_id: "SCH-1",
        payload: { id: "SCH-1", bookingId: "BOOKING-1" },
        record_version: 2,
        updated_at: "2026-07-25T20:00:00.000Z",
      },
      {
        entity_type: "payments",
        entity_id: "PAYMENT-1",
        payload: { id: "PAYMENT-1", bookingId: "BOOKING-1", amount: 450 },
        record_version: 1,
        updated_at: "2026-07-25T20:00:00.000Z",
      },
      {
        entity_type: "blocks",
        entity_id: "BLOCK-1",
        payload: {
          id: "BLOCK-1",
          unitId: "UNIT-1",
          dateFrom: "2026-08-10",
          dateTo: "2026-08-12",
          blockType: "Serwis",
          reason: "Przegląd",
          status: "Aktywna",
        },
        record_version: 5,
        updated_at: "2026-07-25T20:00:00.000Z",
      },
      {
        entity_type: "settings",
        entity_id: "organization",
        payload: {
          organizationName: "Stawy u Sikory",
          timezone: "Europe/Warsaw",
        },
        record_version: 7,
        updated_at: "2026-07-25T20:00:00.000Z",
      },
    ];
    const recordsQuery = {
      select: vi.fn(),
      eq: vi.fn().mockResolvedValue({ data: records, error: null }),
    };
    recordsQuery.select.mockReturnValue(recordsQuery);
    const revisionQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { version: 12, updated_at: "2026-07-25T20:00:00.000Z" },
        error: null,
      }),
    };
    revisionQuery.select.mockReturnValue(revisionQuery);
    revisionQuery.eq.mockReturnValue(revisionQuery);

    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-test" } } }) },
      from: vi.fn((table: string) => {
        if (table === "organization_memberships") return membershipQuery;
        if (table === "operational_records") return recordsQuery;
        if (table === "operational_state_versions") return revisionQuery;
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      version: 12,
      recordVersions: {
        "bookings:BOOKING-1": 4,
        "consents:BOOKING-1": 3,
        "tasks:TASK-1": 6,
        "scheduledMessages:SCH-1": 2,
        "payments:PAYMENT-1": 1,
        "blocks:BLOCK-1": 5,
        "settings:organization": 7,
      },
      data: {
        bookings: [{ id: "BOOKING-1", version: 4 }],
        consents: [{ bookingId: "BOOKING-1", version: 3 }],
        tasks: [{ id: "TASK-1", version: 6 }],
        payments: [{ id: "PAYMENT-1", version: 1 }],
        blocks: [{ id: "BLOCK-1", version: 5 }],
        scheduledMessages: [{ id: "SCH-1", version: 2 }],
        settings: {
          organizationName: "Stawy u Sikory",
          version: 7,
          updatedAt: "2026-07-25T20:00:00.000Z",
        },
      },
    });
  });
});
