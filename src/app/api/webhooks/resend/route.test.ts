import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ verify: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/integrations/resend", () => ({ verifyResendWebhook: mocks.verify }));
vi.mock("@/lib/supabase/server", () => ({ createServiceClient: () => ({ rpc: mocks.rpc }) }));
import { POST } from "./route";
function request() { return new Request("https://app.example.com/api/webhooks/resend", { method: "POST", body: "{}" }); }
describe("atomic Resend webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verify.mockReturnValue({ eventId: "evt_1", event: { type: "email.delivered", created_at: "2026-09-30T10:00:00Z", data: { email_id: "email_1" } } });
    mocks.rpc.mockResolvedValue({ data: { ok: true, status: "delivered" }, error: null });
  });
  it("rejects a forged signature before database access", async () => {
    mocks.verify.mockImplementation(() => { throw new Error("signature"); });
    expect((await POST(request())).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("commits receipt and projection in one transaction", async () => {
    expect((await POST(request())).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("apply_resend_webhook", {
      p_event_id: "evt_1", p_provider_message_id: "email_1", p_event_type: "email.delivered",
      p_occurred_at: "2026-09-30T10:00:00Z", p_reason: null,
    });
  });
  it("acknowledges an already committed event", async () => {
    mocks.rpc.mockResolvedValue({ data: { ok: true, duplicate: true }, error: null });
    expect(await (await POST(request())).json()).toEqual({ ok: true, duplicate: true });
  });
  it.each([{ data: { unmatched: true } }, { error: { message: "failed" } }])("requests retry if the callback cannot be committed", async result => {
    mocks.rpc.mockResolvedValue(result);
    expect((await POST(request())).status).toBe(503);
  });
});
