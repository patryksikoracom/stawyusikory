import { afterEach, describe, expect, it, vi } from "vitest";
import { isOutboundClaimable } from "@/lib/integrations/delivery-queue";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  sendResendEmail: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createServiceClient: mocks.createServiceClient }));
vi.mock("@/lib/integrations/resend", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/integrations/resend")>();
  return { ...original, sendResendEmail: mocks.sendResendEmail };
});

describe("email automation delivery gate", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    mocks.createServiceClient.mockReset();
    mocks.sendResendEmail.mockReset();
  });

  it("blocks the worker before any database or provider action", async () => {
    vi.stubEnv("CRON_SECRET", "cron-test-secret");
    vi.stubEnv("STAWY_OS_EMAIL_ENABLED", "false");
    const response = await POST(new Request("http://localhost/api/automations/process", {
      method: "POST",
      headers: { authorization: "Bearer cron-test-secret" },
    }));

    expect(response.status).toBe(423);
    expect(await response.json()).toMatchObject({ deliveryEnabled: false });
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
    expect(mocks.sendResendEmail).not.toHaveBeenCalled();
  });

  it("rejects an invalid cron secret before checking email configuration", async () => {
    vi.stubEnv("CRON_SECRET", "cron-test-secret");
    vi.stubEnv("STAWY_OS_EMAIL_ENABLED", "true");
    const response = await POST(new Request("http://localhost/api/automations/process", {
      method: "POST",
      headers: { authorization: "Bearer wrong" },
    }));
    expect(response.status).toBe(401);
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
  });

  it("reclaims only an expired processing lease", () => {
    const now = new Date("2026-08-10T20:00:00.000Z");
    expect(isOutboundClaimable({ status: "processing", next_attempt_at: "2026-08-10T19:59:59.000Z" }, now)).toBe(true);
    expect(isOutboundClaimable({ status: "processing", next_attempt_at: "2026-08-10T20:05:00.000Z" }, now)).toBe(false);
    expect(isOutboundClaimable({ status: "delivered", next_attempt_at: null }, now)).toBe(false);
  });
});
