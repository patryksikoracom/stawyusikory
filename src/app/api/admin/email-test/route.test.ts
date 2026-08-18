import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  context: { role: "owner", organizationId: "org-test" } as { role: string; organizationId: string; error?: Response },
  sendResendEmail: vi.fn(),
}));

vi.mock("@/lib/supabase/auth-context", () => ({
  requireOrganization: vi.fn(async () => mocks.context),
}));

vi.mock("@/lib/integrations/resend", () => ({
  sendResendEmail: mocks.sendResendEmail,
}));

import { POST } from "./route";

function request(body: unknown) {
  return new Request("https://stawyusikory.vercel.app/api/admin/email-test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/email-test", () => {
  beforeEach(() => {
    mocks.context = { role: "owner", organizationId: "org-test" };
    mocks.sendResendEmail.mockReset();
    mocks.sendResendEmail.mockResolvedValue({ ok: true, providerMessageId: "email_test_123" });
  });

  it("wysyła pojedynczy, idempotentny test dla właściciela", async () => {
    const response = await POST(request({ email: "PatrykSikora98@gmail.com" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      email: "patryksikora98@gmail.com",
      providerMessageId: "email_test_123",
    });
    expect(mocks.sendResendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: "patryksikora98@gmail.com",
      subject: "[TEST] Stawy OS — sprawdzenie wysyłki e-mail",
      bookingId: "EMAIL-TEST",
      category: "system_test",
      idempotencyKey: expect.stringMatching(/^email-test:org-test:patryksikora98@gmail\.com:\d{4}-\d{2}-\d{2}$/),
    }));
  });

  it("odrzuca niepoprawny adres", async () => {
    const response = await POST(request({ email: "zly-adres" }));
    expect(response.status).toBe(400);
    expect(mocks.sendResendEmail).not.toHaveBeenCalled();
  });

  it("odrzuca rolę bez uprawnień", async () => {
    mocks.context = { role: "viewer", organizationId: "org-test" };
    const response = await POST(request({ email: "patryk@example.com" }));
    expect(response.status).toBe(403);
    expect(mocks.sendResendEmail).not.toHaveBeenCalled();
  });

  it("przekazuje błąd konfiguracji bez udawania sukcesu", async () => {
    mocks.sendResendEmail.mockResolvedValue({ ok: false, retryable: false, error: "missing_api_key" });
    const response = await POST(request({ email: "patryk@example.com" }));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "missing_api_key" });
  });
});
