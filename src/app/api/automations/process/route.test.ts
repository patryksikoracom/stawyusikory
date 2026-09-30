import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ send: vi.fn(), read: vi.fn(), current: vi.fn(), rpc: vi.fn(), from: vi.fn(), existing: null as unknown, claim: null as unknown }));
vi.mock("@/lib/supabase/server", () => ({ createServiceClient: () => ({ from: mocks.from, rpc: mocks.rpc }) }));
vi.mock("@/lib/integrations/read-email-queue", () => ({ readEmailQueue: mocks.read }));
vi.mock("@/lib/integrations/current-email", () => ({ readCommunicationData: vi.fn().mockResolvedValue({}), isCurrentEmail: mocks.current }));
vi.mock("@/lib/integrations/resend", () => ({ defaultResendFromEmail: "test@example.com", emailDeliveryDisabledMessage: "disabled", isEmailDeliveryEnabled: () => process.env.STAWY_OS_EMAIL_ENABLED === "true", sendResendEmail: mocks.send }));
import { POST } from "./route";
const row = { id: "m1", organization_id: "org", booking_id: "b1", rule_id: "RULE-CONFIRM", recipient: "guest@example.com", subject: "Hello", rendered_body: "Current message", idempotency_key: "key" };
function request(auth = "secret") { return new Request("https://example.com/api/automations/process", { method: "POST", headers: { authorization: `Bearer ${auth}` } }); }
describe("scheduled email processing", () => {
  beforeEach(() => {
    vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-30T12:00:00Z"));
    for (const [key, value] of Object.entries({ CRON_SECRET: "secret", EMAIL_CRON_SECRET: "", STAWY_OS_EMAIL_ENABLED: "true", RESEND_API_KEY: "test", RESEND_FROM_EMAIL: "test@example.com" })) vi.stubEnv(key, value);
    mocks.existing = null;
    mocks.claim = { id: "outbound", attempts: 0, status: "processing", created_at: new Date().toISOString() };
    mocks.read.mockResolvedValue([row]); mocks.current.mockReturnValue(true);
    mocks.send.mockResolvedValue({ ok: true, providerMessageId: "provider" }); mocks.rpc.mockResolvedValue({ data: { ok: true }, error: null });
    mocks.from.mockImplementation(() => {
      let operation = "read";
      const chain: Record<string, unknown> = {};
      for (const name of ["select", "eq", "is", "in", "gte"]) chain[name] = vi.fn(() => chain);
      chain.insert = vi.fn(() => { operation = "insert"; return chain; });
      chain.update = vi.fn(() => { operation = "update"; return chain; });
      chain.maybeSingle = vi.fn(async () => ({ data: operation === "read" ? mocks.existing : mocks.claim, error: null }));
      chain.single = vi.fn(async () => ({ data: mocks.claim, error: null }));
      chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ count: 0, error: null }).then(resolve);
      return chain;
    });
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
  it("rejects unauthorized calls before touching the queue", async () => {
    expect((await POST(request("wrong"))).status).toBe(401); expect(mocks.read).not.toHaveBeenCalled();
  });
  it("accepts the dedicated database scheduler credential", async () => {
    vi.stubEnv("EMAIL_CRON_SECRET", "database-secret");
    vi.stubEnv("CRON_SECRET", "");
    mocks.read.mockResolvedValue([]);
    expect((await POST(request("database-secret"))).status).toBe(200);
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it.each(["", "undefined", "null", "secret"])("rejects requests when neither credential is configured: %s", async auth => {
    vi.stubEnv("EMAIL_CRON_SECRET", ""); vi.stubEnv("CRON_SECRET", "");
    expect((await POST(request(auth))).status).toBe(401);
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it("honors the delivery switch", async () => {
    vi.stubEnv("STAWY_OS_EMAIL_ENABLED", "false"); expect((await POST(request())).status).toBe(423); expect(mocks.send).not.toHaveBeenCalled();
  });
  it("sends once and atomically records provider acceptance", async () => {
    expect((await POST(request())).status).toBe(200);
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("complete_email_send", { p_outbound_id: "outbound", p_provider_message_id: "provider", p_attempts: 1 });
  });
  it("skips stale content", async () => { mocks.current.mockReturnValue(false); await POST(request()); expect(mocks.send).not.toHaveBeenCalled(); });
  it.each([
    { status: "sent", attempts: 1, next_attempt_at: null },
    { status: "error", attempts: 5, next_attempt_at: null },
    { status: "processing", attempts: 1, next_attempt_at: "2026-09-30T12:10:00Z" },
  ])("does not resend a completed, terminal or leased message", async existing => {
    mocks.existing = { id: "outbound", created_at: "2026-09-30T10:00:00Z", ...existing };
    await POST(request()); expect(mocks.send).not.toHaveBeenCalled();
  });
  it("stops an ambiguous retry outside the provider deduplication window", async () => {
    mocks.existing = { id: "outbound", status: "processing", attempts: 0, next_attempt_at: null, created_at: "2026-09-29T10:00:00Z" };
    expect((await POST(request())).status).toBe(503); expect(mocks.send).not.toHaveBeenCalled();
  });
  it("reports a database failure after provider acceptance", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "unavailable" } }); expect((await POST(request())).status).toBe(503);
  });
  it("fails closed on incomplete queue reads", async () => {
    mocks.read.mockRejectedValue(new Error("partial")); expect((await POST(request())).status).toBe(503); expect(mocks.send).not.toHaveBeenCalled();
  });
});
