import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "./route";

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

const item = {
  id: "CHECK-1",
  taskId: "TASK-1",
  label: "Sprawdź czujnik dymu",
  done: true,
  completedAt: "2026-07-25T20:00:00.000Z",
  version: 3,
};

function request(overrides: Record<string, unknown> = {}) {
  return new Request("https://app.example.com/api/checklist-items/CHECK-1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      item,
      expectedRecordVersion: 3,
      requestId: "request-check-123",
      clientSentAt: "2026-07-25T20:00:00.000Z",
      tabId: "tab-checklist-123",
      ...overrides,
    }),
  });
}

const routeContext = { params: Promise.resolve({ id: "CHECK-1" }) };

describe("PATCH /api/checklist-items/:id", () => {
  beforeEach(() => {
    mocks.context = {
      role: "owner",
      organizationId: "org-test",
      supabase: { rpc: vi.fn().mockResolvedValue({
        data: {
          status: "committed",
          item: { ...item, version: 4, updatedAt: "2026-07-25T20:00:01.000Z" },
          recordVersion: 4,
          stateVersion: 12,
          savedAt: "2026-07-25T20:00:01.000Z",
        },
        error: null,
      }) },
    };
  });

  it("wykonuje wersjonowaną komendę dla jednego punktu checklisty", async () => {
    const response = await PATCH(request(), routeContext);

    expect(response.status).toBe(200);
    expect(mocks.context.supabase.rpc).toHaveBeenCalledWith("update_operational_checklist_item", {
      p_organization_id: "org-test",
      p_item_id: "CHECK-1",
      p_expected_record_version: 3,
      p_item: item,
      p_request_id: "request-check-123",
      p_client_sent_at: "2026-07-25T20:00:00.000Z",
      p_tab_id: "tab-checklist-123",
    });
    expect(await response.json()).toMatchObject({
      ok: true,
      recordVersion: 4,
      stateVersion: 12,
      item: { id: "CHECK-1", done: true, version: 4 },
    });
  });

  it("zwraca konflikt wyłącznie dla nieaktualnej wersji tego punktu", async () => {
    mocks.context.supabase.rpc.mockResolvedValue({
      data: { status: "conflict", recordVersion: 7 },
      error: null,
    });

    const response = await PATCH(request(), routeContext);

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      requestId: "request-check-123",
      expectedRecordVersion: 3,
      currentRecordVersion: 7,
    });
  });

  it("odrzuca różne identyfikatory trasy i payloadu", async () => {
    const response = await PATCH(request({ item: { ...item, id: "CHECK-2" } }), routeContext);

    expect(response.status).toBe(400);
    expect(mocks.context.supabase.rpc).not.toHaveBeenCalled();
  });

  it("odrzuca nieprawidłową wartość done przed wywołaniem bazy", async () => {
    const response = await PATCH(request({ item: { ...item, done: "tak" } }), routeContext);

    expect(response.status).toBe(400);
    expect(mocks.context.supabase.rpc).not.toHaveBeenCalled();
  });

  it("odrzuca zbyt duży payload mierzony po faktycznej treści", async () => {
    const oversized = request({ item: { ...item, label: "x".repeat(33_000) } });

    const response = await PATCH(oversized, routeContext);

    expect(response.status).toBe(413);
    expect(mocks.context.supabase.rpc).not.toHaveBeenCalled();
  });

  it("blokuje rolę viewer", async () => {
    mocks.context.role = "viewer";

    const response = await PATCH(request(), routeContext);

    expect(response.status).toBe(403);
    expect(mocks.context.supabase.rpc).not.toHaveBeenCalled();
  });

  it("nie ujawnia komunikatu błędu bazy", async () => {
    mocks.context.supabase.rpc.mockResolvedValue({
      data: null,
      error: { code: "XX000", message: "sensitive database detail" },
    });

    const response = await PATCH(request(), routeContext);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Nie udało się zapisać checklisty." });
  });
});
