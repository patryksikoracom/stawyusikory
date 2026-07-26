import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PUT } from "./route";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

function request(body: unknown) {
  return new Request("https://app.example.com/api/state", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    data: { bookings: [] },
    expectedVersion: 7,
    requestId: "request-test-123",
    clientSentAt: "2026-07-25T18:15:00.000Z",
    tabId: "tab-test-123",
    ...overrides,
  };
}

describe("PUT /api/state telemetryka zapisu", () => {
  beforeEach(() => {
    mocks.rpc.mockReset().mockResolvedValue({ data: 8, error: null });
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
    mocks.createClient.mockReset().mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-test" } } }) },
      from: vi.fn((table: string) => {
        if (table === "organization_memberships") return membershipQuery;
        return { upsert: vi.fn().mockResolvedValue({ error: null }) };
      }),
      rpc: mocks.rpc,
    });
  });

  it("przekazuje identyfikator żądania, karty i czas do audytowanego RPC", async () => {
    const response = await PUT(request(payload()));

    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("replace_operational_state_v2", {
      p_expected_version: 7,
      p_state: { bookings: [] },
      p_request_id: "request-test-123",
      p_client_sent_at: "2026-07-25T18:15:00.000Z",
      p_tab_id: "tab-test-123",
    });
    expect(await response.json()).toMatchObject({
      ok: true,
      requestId: "request-test-123",
      expectedVersion: 7,
      version: 8,
    });
  });

  it("zwraca czytelne wersje i ten sam requestId przy kontrolowanym konflikcie", async () => {
    mocks.rpc.mockResolvedValue({ data: -10, error: null });

    const response = await PUT(request(payload()));

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      requestId: "request-test-123",
      expectedVersion: 7,
      currentVersion: 9,
    });
  });

  it("odrzuca zapis bez pełnych metadanych telemetrycznych", async () => {
    const response = await PUT(request({
      data: { bookings: [] },
      expectedVersion: 7,
    }));

    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

describe("GET /api/state wersje rekordów agregatu rezerwacji", () => {
  it("dołącza wersje rezerwacji, kontaktu, zadań i wiadomości", async () => {
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
      data: {
        bookings: [{ id: "BOOKING-1", version: 4 }],
        consents: [{ bookingId: "BOOKING-1", version: 3 }],
        tasks: [{ id: "TASK-1", version: 6 }],
        payments: [{ id: "PAYMENT-1", version: 1 }],
        scheduledMessages: [{ id: "SCH-1", version: 2 }],
      },
    });
  });
});
