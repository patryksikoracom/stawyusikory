import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PATCH } from "./route";

const mocks = vi.hoisted(() => ({
  context: {
    role: "cleaning",
    organizationId: "00000000-0000-4000-8000-000000000001",
    user: { id: "00000000-0000-4000-8000-000000000002" },
  },
  rpc: vi.fn(),
  read: vi.fn(),
}));

vi.mock("@/lib/supabase/auth-context", () => ({
  requireOrganization: vi.fn(async () => mocks.context),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({ rpc: mocks.rpc }),
}));

function request(body: unknown) {
  return new Request("https://app.example.com/api/cleaning", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/cleaning", () => {
  beforeEach(() => {
    mocks.context.role = "cleaning";
    mocks.rpc.mockReset().mockResolvedValue({ data: 12, error: null });
  });

  it("przyjmuje zlecenie w jawnie aktywnej organizacji", async () => {
    const response = await PATCH(request({
      action: "accept",
      taskId: "TASK-1",
      proposedStartTime: "12:30",
    }));

    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("mutate_cleaning_task", {
      p_organization_id: "00000000-0000-4000-8000-000000000001",
      p_actor: "00000000-0000-4000-8000-000000000002",
      p_task_id: "TASK-1",
      p_action: "accept",
      p_item_id: null,
      p_details: { proposedStartTime: "12:30" },
    });
  });

  it("wymaga konkretnego powodu odrzucenia", async () => {
    const response = await PATCH(request({ action: "reject", taskId: "TASK-1", reason: " " }));

    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("blokuje role spoza panelu sprzątania", async () => {
    mocks.context.role = "manager";

    const response = await PATCH(request({ action: "start", taskId: "TASK-1" }));

    expect(response.status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("nie ujawnia szczegółów błędu bazy", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "secret" } });

    const response = await PATCH(request({ action: "start", taskId: "TASK-1" }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Nie udało się zapisać zmiany." });
  });

  it("odróżnia naruszenie reguł domenowych od konfliktu stanu", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "22023", message: "details" } });

    const response = await PATCH(request({ action: "start", taskId: "TASK-1" }));

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: "Nie udało się zapisać zmiany." });
  });
});

vi.mock("@/lib/supabase/read-operational-state", () => ({ readOperationalState: mocks.read }));

describe("GET /api/cleaning", () => {
  beforeEach(() => {
    mocks.context.role = "cleaning";
    mocks.read.mockReset().mockResolvedValue({ records: [], revision: null });
  });
  it("requires the cleaning role before reading privileged data", async () => {
    mocks.context.role = "manager";
    expect((await GET(new Request("https://app.example.com/api/cleaning"))).status).toBe(403);
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it("returns an unavailable response instead of an incomplete plan", async () => {
    mocks.read.mockRejectedValue(new Error("private database detail"));
    const response = await GET(new Request("https://app.example.com/api/cleaning"));
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("private database detail");
  });
  it("does not expose unrelated raw records in the cleaning response", async () => {
    mocks.read.mockResolvedValue({ records: [{ entity_type: "consents", entity_id: "private", payload: { email: "private@example.com" } }], revision: null });
    const response = await GET(new Request("https://app.example.com/api/cleaning"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(JSON.stringify(await response.json())).not.toContain("private@example.com");
    expect(mocks.read).toHaveBeenCalledWith(expect.anything(), mocks.context.organizationId);
  });
});
