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

const task = {
  id: "TASK-1",
  bookingId: "BOOKING-1",
  type: "Sprzątanie",
  priority: "Wysoki",
  status: "Zrobione",
  dueDate: "2026-07-26",
  owner: "Tata",
  unitId: "CZAPLA",
  title: "Przygotuj domek",
  completedAt: "2026-07-25",
  version: 3,
};

function request(overrides: Record<string, unknown> = {}) {
  return new Request("https://app.example.com/api/tasks/TASK-1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      task,
      expectedRecordVersion: 3,
      requestId: "request-task-123",
      clientSentAt: "2026-07-25T20:00:00.000Z",
      tabId: "tab-task-123",
      ...overrides,
    }),
  });
}

const routeContext = { params: Promise.resolve({ id: "TASK-1" }) };

describe("PATCH /api/tasks/:id", () => {
  beforeEach(() => {
    mocks.context = {
      role: "owner",
      organizationId: "org-test",
      supabase: { rpc: vi.fn().mockResolvedValue({
        data: {
          status: "committed",
          task: { ...task, version: 4, updatedAt: "2026-07-25T20:00:01.000Z" },
          recordVersion: 4,
          stateVersion: 12,
          savedAt: "2026-07-25T20:00:01.000Z",
        },
        error: null,
      }) },
    };
  });

  it("wykonuje wersjonowaną komendę dla jednego zadania", async () => {
    const response = await PATCH(request(), routeContext);

    expect(response.status).toBe(200);
    expect(mocks.context.supabase.rpc).toHaveBeenCalledWith("update_operational_task", {
      p_organization_id: "org-test",
      p_task_id: "TASK-1",
      p_expected_record_version: 3,
      p_task: {
        ...task,
        version: 4,
        updatedAt: "2026-07-25T20:00:00.000Z",
      },
      p_request_id: "request-task-123",
      p_client_sent_at: "2026-07-25T20:00:00.000Z",
      p_tab_id: "tab-task-123",
    });
    expect(await response.json()).toMatchObject({
      ok: true,
      recordVersion: 4,
      stateVersion: 12,
      task: { id: "TASK-1", status: "Zrobione", version: 4 },
    });
  });

  it("zwraca 409 z wersją wyłącznie konfliktowego rekordu", async () => {
    mocks.context.supabase.rpc.mockResolvedValue({
      data: { status: "conflict", recordVersion: 7 },
      error: null,
    });

    const response = await PATCH(request(), routeContext);

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      requestId: "request-task-123",
      expectedRecordVersion: 3,
      currentRecordVersion: 7,
    });
  });

  it("odrzuca różne identyfikatory trasy i payloadu", async () => {
    const response = await PATCH(request({ task: { ...task, id: "TASK-2" } }), routeContext);

    expect(response.status).toBe(400);
    expect(mocks.context.supabase.rpc).not.toHaveBeenCalled();
  });

  it("odrzuca nieprawidłowy status przed wywołaniem bazy", async () => {
    const response = await PATCH(request({ task: { ...task, status: "Prawie gotowe" } }), routeContext);

    expect(response.status).toBe(400);
    expect(mocks.context.supabase.rpc).not.toHaveBeenCalled();
  });

  it("mierzy faktyczny payload i odrzuca go także bez zaufania do Content-Length", async () => {
    const oversized = new Request("https://app.example.com/api/tasks/TASK-1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        task: { ...task, comment: "x".repeat(65_000) },
        expectedRecordVersion: 3,
        requestId: "request-task-123",
        clientSentAt: "2026-07-25T20:00:00.000Z",
        tabId: "tab-task-123",
      }),
    });

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
    expect(await response.json()).toEqual({ error: "Nie udało się zapisać zadania." });
  });
});
