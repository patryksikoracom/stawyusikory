import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as sendSms } from "./route";
import { POST as processSmsQueue } from "./process/route";

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  from: vi.fn(),
  sendSmsApi: vi.fn(),
}));

vi.mock("@/lib/supabase/auth-context", () => ({
  requireOrganization: vi.fn(async () => ({
    organizationId: "org-test",
    role: "admin",
    supabase: { from: mocks.from },
  })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: mocks.createServiceClient,
}));

vi.mock("@/lib/integrations/smsapi", () => ({
  sendSmsApi: mocks.sendSmsApi,
}));

describe("SMS delivery gate", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    mocks.createServiceClient.mockReset();
    mocks.from.mockReset();
    mocks.sendSmsApi.mockReset();
  });

  it("blokuje ręczną wysyłkę przed zapisaniem wiadomości w kolejce", async () => {
    vi.stubEnv("STAWY_OS_SMS_ENABLED", "false");
    const response = await sendSms(new Request("http://localhost/api/messages/sms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        to: "+48123123123",
        message: "Wiadomość testowa",
        idempotencyKey: "test-message-001",
      }),
    }));

    expect(response.status).toBe(423);
    expect(await response.json()).toMatchObject({ deliveryEnabled: false });
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.sendSmsApi).not.toHaveBeenCalled();
  });

  it("blokuje worker kolejki nawet przy prawidłowym sekrecie cron", async () => {
    vi.stubEnv("CRON_SECRET", "cron-test-secret");
    vi.stubEnv("STAWY_OS_SMS_ENABLED", "false");
    const response = await processSmsQueue(new Request("http://localhost/api/messages/sms/process", {
      method: "POST",
      headers: { authorization: "Bearer cron-test-secret" },
    }));

    expect(response.status).toBe(423);
    expect(await response.json()).toMatchObject({ deliveryEnabled: false });
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
    expect(mocks.sendSmsApi).not.toHaveBeenCalled();
  });
});
