import { beforeEach, describe, expect, it, vi } from "vitest";
import { PUT } from "./route";

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
