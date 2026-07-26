import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  context: {
    role: "owner",
    organizationId: "org-test",
    supabase: { rpc: vi.fn() },
  } as {
    role: string;
    organizationId: string;
    supabase: { rpc: ReturnType<typeof vi.fn> };
    error?: Response;
  },
}));

vi.mock("@/lib/supabase/auth-context", () => ({
  isOrganizationEditor: (role: unknown) => role === "owner" || role === "admin",
  requireOrganization: vi.fn(async () => mocks.context),
}));

const changes = [{
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
}];

function request(overrides: Record<string, unknown> = {}) {
  return new Request("https://app.example.com/api/records/batch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      changes,
      requestId: "request-batch-123",
      clientSentAt: "2026-07-26T18:00:00.000Z",
      tabId: "tab-batch-123",
      ...overrides,
    }),
  });
}

describe("POST /api/records/batch", () => {
  beforeEach(() => {
    mocks.context = {
      role: "owner",
      organizationId: "org-test",
      supabase: {
        rpc: vi.fn().mockResolvedValue({
          data: {
            status: "committed",
            stateVersion: 30,
            savedAt: "2026-07-26T18:00:01.000Z",
            changes: [{
              entityType: "issues",
              entityId: "ISSUE-1",
              operation: "upsert",
              recordVersion: 1,
            }],
          },
          error: null,
        }),
      },
    };
  });

  it("przekazuje zwalidowaną paczkę do jednego RPC", async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.context.supabase.rpc).toHaveBeenCalledWith(
      "mutate_operational_record_batch",
      {
        p_organization_id: "org-test",
        p_changes: changes,
        p_request_id: "request-batch-123",
        p_client_sent_at: "2026-07-26T18:00:00.000Z",
        p_tab_id: "tab-batch-123",
      },
    );
    expect(await response.json()).toMatchObject({
      ok: true,
      stateVersion: 30,
      changes: [{ entityId: "ISSUE-1", recordVersion: 1 }],
    });
  });

  it("mapuje konflikt rekordu na 409", async () => {
    mocks.context.supabase.rpc.mockResolvedValue({
      data: {
        status: "conflict",
        conflict: {
          entityType: "issues",
          entityId: "ISSUE-1",
          expectedRecordVersion: 1,
          currentRecordVersion: 2,
        },
      },
      error: null,
    });
    const response = await POST(request());

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      entityType: "issues",
      entityId: "ISSUE-1",
      currentRecordVersion: 2,
    });
  });

  it("blokuje viewer, błędny payload i zbyt dużą paczkę", async () => {
    mocks.context.role = "viewer";
    expect((await POST(request())).status).toBe(403);

    mocks.context.role = "owner";
    expect((await POST(request({ changes: [] }))).status).toBe(400);
    const oversized = request();
    oversized.headers.set("content-length", "4000001");
    expect((await POST(oversized)).status).toBe(413);
    expect(mocks.context.supabase.rpc).not.toHaveBeenCalled();
  });

  it("nie ujawnia szczegółów błędu bazy", async () => {
    mocks.context.supabase.rpc.mockResolvedValue({
      data: null,
      error: { code: "XX000", message: "tajny szczegół" },
    });
    const response = await POST(request());

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Nie udało się zapisać paczki rekordów." });
  });
});
