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

const block = {
  id: "BLOCK-1",
  unitId: "UNIT-1",
  dateFrom: "2026-08-10",
  dateTo: "2026-08-12",
  blockType: "Serwis",
  reason: "Przegląd pompy",
  status: "Aktywna",
  version: 1,
};

function request(overrides: Record<string, unknown> = {}) {
  return new Request("https://app.example.com/api/calendar-blocks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      block,
      expectedRecordVersion: 0,
      requestId: "request-block-create",
      clientSentAt: "2026-07-26T17:00:00.000Z",
      tabId: "tab-block-create",
      ...overrides,
    }),
  });
}

describe("POST /api/calendar-blocks", () => {
  beforeEach(() => {
    mocks.context = {
      role: "owner",
      organizationId: "org-test",
      supabase: {
        rpc: vi.fn().mockResolvedValue({
          data: {
            status: "committed",
            block: {
              ...block,
              updatedAt: "2026-07-26T17:00:01.000Z",
            },
            recordVersion: 1,
            stateVersion: 21,
            savedAt: "2026-07-26T17:00:01.000Z",
          },
          error: null,
        }),
      },
    };
  });

  it("tworzy wersjonowaną blokadę bez pełnego zapisu stanu", async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.context.supabase.rpc).toHaveBeenCalledWith(
      "mutate_operational_calendar_block",
      {
        p_organization_id: "org-test",
        p_operation: "create",
        p_block_id: "BLOCK-1",
        p_expected_record_version: 0,
        p_block: block,
        p_request_id: "request-block-create",
        p_client_sent_at: "2026-07-26T17:00:00.000Z",
        p_tab_id: "tab-block-create",
      },
    );
    expect(await response.json()).toMatchObject({
      ok: true,
      block: { id: "BLOCK-1", version: 1 },
      recordVersion: 1,
      stateVersion: 21,
    });
  });

  it("zwraca idempotentny replay jako sukces", async () => {
    mocks.context.supabase.rpc.mockResolvedValue({
      data: {
        status: "already_committed",
        block,
        recordVersion: 1,
        stateVersion: 21,
      },
      error: null,
    });

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ idempotentReplay: true });
  });

  it.each([
    ["booking", "BOOKING-9", "Termin koliduje z aktywną rezerwacją."],
    ["block", "BLOCK-9", "Termin koliduje z inną aktywną blokadą."],
  ])("mapuje konflikt dostępności %s na 409", async (conflictType, conflictId, error) => {
    mocks.context.supabase.rpc.mockResolvedValue({
      data: { status: "availability_conflict", conflictType, conflictId },
      error: null,
    });

    const response = await POST(request());

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error, conflictType, conflictId });
  });

  it.each([
    [{ block: { ...block, reason: " " } }, 400],
    [{ block: { ...block, dateTo: block.dateFrom } }, 400],
    [{ block: { ...block, blockType: "Nieznany" } }, 400],
    [{ expectedRecordVersion: 1 }, 400],
  ])("odrzuca błędny payload %o", async (override, status) => {
    const response = await POST(request(override));

    expect(response.status).toBe(status);
    expect(mocks.context.supabase.rpc).not.toHaveBeenCalled();
  });

  it("blokuje viewer i faktycznie mierzy rozmiar payloadu", async () => {
    mocks.context.role = "viewer";
    expect((await POST(request())).status).toBe(403);

    mocks.context.role = "owner";
    const oversized = await POST(request({
      block: { ...block, reason: "x".repeat(25_000) },
    }));
    expect(oversized.status).toBe(413);
    expect(mocks.context.supabase.rpc).not.toHaveBeenCalled();
  });

  it("nie ujawnia błędu bazy i odrzuca niepełny wynik", async () => {
    mocks.context.supabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "XX000", message: "sensitive detail" },
    });
    const failure = await POST(request());
    expect(failure.status).toBe(500);
    expect(await failure.json()).toEqual({
      error: "Nie udało się zapisać blokady kalendarza.",
    });

    mocks.context.supabase.rpc.mockResolvedValueOnce({
      data: { status: "committed", block, stateVersion: 21 },
      error: null,
    });
    expect((await POST(request())).status).toBe(500);
  });
});
