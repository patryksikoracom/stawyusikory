import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "./route";

const mocks = vi.hoisted(() => ({
  context: {
    role: "admin",
    organizationId: "org-test",
    supabase: { rpc: vi.fn() },
  } as {
    role: string;
    organizationId: string;
    supabase: { rpc: ReturnType<typeof vi.fn> };
  },
}));

vi.mock("@/lib/supabase/auth-context", () => ({
  isOrganizationEditor: (role: unknown) => role === "owner" || role === "admin",
  requireOrganization: vi.fn(async () => mocks.context),
}));

const block = {
  id: "BLOCK-1",
  unitId: "UNIT-1",
  dateFrom: "2026-08-10",
  dateTo: "2026-08-12",
  blockType: "Serwis",
  reason: "Przegląd pompy",
  status: "Anulowana",
  version: 4,
};

function request(overrides: Record<string, unknown> = {}) {
  return new Request("https://app.example.com/api/calendar-blocks/BLOCK-1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      block,
      expectedRecordVersion: 3,
      requestId: "request-block-update",
      clientSentAt: "2026-07-26T17:10:00.000Z",
      tabId: "tab-block-update",
      ...overrides,
    }),
  });
}

const routeContext = { params: Promise.resolve({ id: "BLOCK-1" }) };

describe("PATCH /api/calendar-blocks/:id", () => {
  beforeEach(() => {
    mocks.context = {
      role: "admin",
      organizationId: "org-test",
      supabase: {
        rpc: vi.fn().mockResolvedValue({
          data: {
            status: "committed",
            block: {
              ...block,
              updatedAt: "2026-07-26T17:10:01.000Z",
            },
            recordVersion: 4,
            stateVersion: 22,
            savedAt: "2026-07-26T17:10:01.000Z",
          },
          error: null,
        }),
      },
    };
  });

  it("anuluje rekord z oczekiwaną wersją", async () => {
    const response = await PATCH(request(), routeContext);

    expect(response.status).toBe(200);
    expect(mocks.context.supabase.rpc).toHaveBeenCalledWith(
      "mutate_operational_calendar_block",
      expect.objectContaining({
        p_operation: "update",
        p_block_id: "BLOCK-1",
        p_expected_record_version: 3,
        p_block: block,
      }),
    );
    expect(await response.json()).toMatchObject({
      block: { status: "Anulowana", version: 4 },
      recordVersion: 4,
    });
  });

  it("zwraca 409 z bieżącą wersją rekordu", async () => {
    mocks.context.supabase.rpc.mockResolvedValue({
      data: { status: "conflict", recordVersion: 8 },
      error: null,
    });

    const response = await PATCH(request(), routeContext);

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      expectedRecordVersion: 3,
      currentRecordVersion: 8,
    });
  });

  it("odróżnia brak rekordu i brak domku", async () => {
    mocks.context.supabase.rpc.mockResolvedValueOnce({
      data: { status: "not_found" },
      error: null,
    });
    expect((await PATCH(request(), routeContext)).status).toBe(404);

    mocks.context.supabase.rpc.mockResolvedValueOnce({
      data: { status: "unit_not_found" },
      error: null,
    });
    expect((await PATCH(request(), routeContext)).status).toBe(422);
  });

  it("odrzuca niezgodny identyfikator i wersję payloadu", async () => {
    const wrongId = await PATCH(
      request({ block: { ...block, id: "BLOCK-OTHER" } }),
      routeContext,
    );
    expect(wrongId.status).toBe(400);

    const wrongVersion = await PATCH(
      request({ block: { ...block, version: 9 } }),
      routeContext,
    );
    expect(wrongVersion.status).toBe(400);
    expect(mocks.context.supabase.rpc).not.toHaveBeenCalled();
  });

  it("blokuje viewer i mapuje konflikt transakcyjny na 409", async () => {
    mocks.context.role = "viewer";
    expect((await PATCH(request(), routeContext)).status).toBe(403);

    mocks.context.role = "admin";
    mocks.context.supabase.rpc.mockResolvedValue({
      data: null,
      error: { code: "40001", message: "serialization" },
    });
    expect((await PATCH(request(), routeContext)).status).toBe(409);
  });
});
