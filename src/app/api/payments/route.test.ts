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

const payment = {
  id: "PAYMENT-1",
  bookingId: "BOOKING-1",
  occurredAt: "2026-07-26",
  type: "Wpłata",
  amount: 450.25,
  currency: "PLN",
  status: "Zaksięgowana",
  method: "Przelew",
  note: "Dodano w panelu",
};

function request(overrides: Record<string, unknown> = {}) {
  return new Request("https://app.example.com/api/payments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      payment,
      requestId: "request-payment-123",
      clientSentAt: "2026-07-26T15:00:00.000Z",
      tabId: "tab-payment-123",
      ...overrides,
    }),
  });
}

describe("POST /api/payments", () => {
  beforeEach(() => {
    mocks.context = {
      role: "owner",
      organizationId: "org-test",
      supabase: { rpc: vi.fn().mockResolvedValue({
        data: {
          status: "committed",
          payment: {
            ...payment,
            version: 1,
            updatedAt: "2026-07-26T15:00:01.000Z",
          },
          recordVersion: 1,
          stateVersion: 13,
          savedAt: "2026-07-26T15:00:01.000Z",
        },
        error: null,
      }) },
    };
  });

  it("przekazuje jedną transakcję do idempotentnej komendy", async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.context.supabase.rpc).toHaveBeenCalledWith("create_operational_payment", {
      p_organization_id: "org-test",
      p_payment_id: payment.id,
      p_payment: payment,
      p_request_id: "request-payment-123",
      p_client_sent_at: "2026-07-26T15:00:00.000Z",
      p_tab_id: "tab-payment-123",
    });
    expect(await response.json()).toMatchObject({
      ok: true,
      idempotentReplay: false,
      payment: { id: payment.id, version: 1 },
      recordVersion: 1,
      stateVersion: 13,
    });
  });

  it("akceptuje bezpieczne ponowienie tej samej transakcji", async () => {
    mocks.context.supabase.rpc.mockResolvedValue({
      data: {
        status: "already_committed",
        payment: { ...payment, version: 1, updatedAt: "2026-07-26T15:00:01.000Z" },
        recordVersion: 1,
        stateVersion: 13,
        savedAt: "2026-07-26T15:00:01.000Z",
      },
      error: null,
    });

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ idempotentReplay: true, stateVersion: 13 });
  });

  it.each([
    [{ status: "booking_not_found" }, 422],
    [{ status: "cost_setting_not_found" }, 422],
    [{ status: "conflict", recordVersion: 1 }, 409],
  ])("mapuje kontrolowany wynik %o", async (result, expectedStatus) => {
    mocks.context.supabase.rpc.mockResolvedValue({ data: result, error: null });

    const response = await POST(request());

    expect(response.status).toBe(expectedStatus);
  });

  it("odrzuca błędną kwotę i koszt bez źródła przed wywołaniem bazy", async () => {
    const badAmount = await POST(request({ payment: { ...payment, amount: 10.001 } }));
    const missingSource = await POST(request({
      payment: {
        ...payment,
        type: "Koszt",
        unitId: "CZAPLA",
        costCategory: "Energia",
      },
    }));

    expect(badAmount.status).toBe(400);
    expect(missingSource.status).toBe(400);
    expect(mocks.context.supabase.rpc).not.toHaveBeenCalled();
  });

  it("mierzy faktyczny payload i blokuje rolę viewer", async () => {
    const oversized = await POST(request({ payment: { ...payment, note: "x".repeat(33_000) } }));
    expect(oversized.status).toBe(413);

    mocks.context.role = "viewer";
    const forbidden = await POST(request());
    expect(forbidden.status).toBe(403);
    expect(mocks.context.supabase.rpc).not.toHaveBeenCalled();
  });

  it("nie ujawnia szczegółu błędu bazy ani nie przyjmuje niepełnego wyniku", async () => {
    mocks.context.supabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "XX000", message: "sensitive database detail" },
    });
    const failure = await POST(request());
    expect(failure.status).toBe(500);
    expect(await failure.json()).toEqual({ error: "Nie udało się zaksięgować transakcji." });

    mocks.context.supabase.rpc.mockResolvedValueOnce({
      data: { status: "committed", payment, stateVersion: 13 },
      error: null,
    });
    const incomplete = await POST(request());
    expect(incomplete.status).toBe(500);
  });
});
