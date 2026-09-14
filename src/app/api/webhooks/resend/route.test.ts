import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ verify: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/integrations/resend", () => ({ verifyResendWebhook: mocks.verify }));
vi.mock("@/lib/supabase/server", () => ({ createServiceClient: () => ({ rpc: mocks.rpc }) }));
import { POST } from "./route";
const request = () => new Request("https://app.example.com/api/webhooks/resend", { method: "POST", body: "{}" });
describe("Resend transactional webhook", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.verify.mockReturnValue({ eventId: "evt", event: { type: "email.delivered", created_at: "2026-09-14T10:00:00Z", data: { email_id: "provider" } } });
  });
  it("rejects invalid signatures before accessing the database", async () => {
    mocks.verify.mockImplementation(() => { throw new Error("invalid"); });
    expect((await POST(request())).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("passes the verified event to one database transaction", async () => {
    mocks.rpc.mockResolvedValue({ data: { ok: true, status: "delivered" }, error: null });
    expect(await (await POST(request())).json()).toEqual({ ok: true, status: "delivered" });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("apply_resend_webhook", {
      p_event_id: "evt", p_provider_message_id: "provider", p_event_type: "email.delivered",
      p_occurred_at: "2026-09-14T10:00:00Z", p_reason: null,
    });
  });
  it("acknowledges a committed duplicate", async () => {
    mocks.rpc.mockResolvedValue({ data: { ok: true, duplicate: true } });
    expect((await POST(request())).status).toBe(200);
  });
  it.each([{ error: { message: "private database details" } }, { data: { ok: false, unmatched: true } }])("requests retry after failure or an early callback", async (result) => {
    mocks.rpc.mockResolvedValue(result);
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private database details");
  });
});
