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

const settings = {
  organizationName: "Stawy u Sikory",
  timezone: "Europe/Warsaw",
  cleaningContactName: "Anna",
  cleaningPhone: "+48 600 000 000",
  defaultCheckIn: "16:00",
  defaultCheckOut: "11:00",
  aiApprovalRequired: true,
  version: 3,
};

function request(overrides: Record<string, unknown> = {}) {
  return new Request("https://app.example.com/api/settings", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      settings,
      expectedRecordVersion: 3,
      requestId: "request-settings-123",
      clientSentAt: "2026-07-26T16:30:00.000Z",
      tabId: "tab-settings-123",
      ...overrides,
    }),
  });
}

describe("PATCH /api/settings", () => {
  beforeEach(() => {
    mocks.context = {
      role: "owner",
      organizationId: "org-test",
      supabase: { rpc: vi.fn().mockResolvedValue({
        data: {
          status: "committed",
          settings: {
            ...settings,
            version: 4,
            updatedAt: "2026-07-26T16:30:01.000Z",
          },
          recordVersion: 4,
          stateVersion: 14,
          savedAt: "2026-07-26T16:30:01.000Z",
        },
        error: null,
      }) },
    };
  });

  it("wykonuje wersjonowaną komendę jednego rekordu ustawień", async () => {
    const response = await PATCH(request());

    expect(response.status).toBe(200);
    expect(mocks.context.supabase.rpc).toHaveBeenCalledWith(
      "update_operational_settings",
      {
        p_organization_id: "org-test",
        p_expected_record_version: 3,
        p_settings: settings,
        p_request_id: "request-settings-123",
        p_client_sent_at: "2026-07-26T16:30:00.000Z",
        p_tab_id: "tab-settings-123",
      },
    );
    expect(await response.json()).toMatchObject({
      ok: true,
      settings: { organizationName: "Stawy u Sikory", version: 4 },
      recordVersion: 4,
      stateVersion: 14,
    });
  });

  it("zwraca 409 z wersją konfliktowego rekordu", async () => {
    mocks.context.supabase.rpc.mockResolvedValue({
      data: { status: "conflict", recordVersion: 7 },
      error: null,
    });

    const response = await PATCH(request());

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      requestId: "request-settings-123",
      expectedRecordVersion: 3,
      currentRecordVersion: 7,
    });
  });

  it("pozwala utworzyć pierwszy rekord ustawień z wersji zero", async () => {
    const response = await PATCH(request({
      settings: { ...settings, version: undefined },
      expectedRecordVersion: 0,
    }));

    expect(response.status).toBe(200);
    expect(mocks.context.supabase.rpc).toHaveBeenCalledWith(
      "update_operational_settings",
      expect.objectContaining({ p_expected_record_version: 0 }),
    );
  });

  it.each([
    [{ settings: { ...settings, organizationName: " " } }, 400],
    [{ settings: { ...settings, timezone: "UTC" } }, 400],
    [{ settings: { ...settings, defaultCheckIn: "25:00" } }, 400],
    [{ settings: { ...settings, aiApprovalRequired: "tak" } }, 400],
  ])("odrzuca błędny payload %o", async (override, expectedStatus) => {
    const response = await PATCH(request(override));

    expect(response.status).toBe(expectedStatus);
    expect(mocks.context.supabase.rpc).not.toHaveBeenCalled();
  });

  it("mierzy faktyczny payload i blokuje rolę viewer", async () => {
    const oversized = await PATCH(request({
      settings: { ...settings, organizationName: "x".repeat(17_000) },
    }));
    expect(oversized.status).toBe(413);

    mocks.context.role = "viewer";
    const forbidden = await PATCH(request());
    expect(forbidden.status).toBe(403);
    expect(mocks.context.supabase.rpc).not.toHaveBeenCalled();
  });

  it("nie ujawnia szczegółu błędu bazy ani nie przyjmuje niepełnego wyniku", async () => {
    mocks.context.supabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "XX000", message: "sensitive database detail" },
    });
    const failure = await PATCH(request());
    expect(failure.status).toBe(500);
    expect(await failure.json()).toEqual({ error: "Nie udało się zapisać ustawień." });

    mocks.context.supabase.rpc.mockResolvedValueOnce({
      data: { status: "committed", settings, stateVersion: 14 },
      error: null,
    });
    const incomplete = await PATCH(request());
    expect(incomplete.status).toBe(500);
  });
});
