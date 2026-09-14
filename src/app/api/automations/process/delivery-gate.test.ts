import { createClient } from "@supabase/supabase-js";
vi.mock("@/lib/integrations/current-email", () => ({ readCommunicationData: vi.fn(async () => ({})), isCurrentEmail: vi.fn(() => true) }));
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
  it.each([
    {status:"error",attempts:1,next_attempt_at:null},
    {status:"error",attempts:5,next_attempt_at:"2020-01-01T00:00:00.000Z"},
  ])("does not send terminal or exhausted deliveries: %j",async(existing)=>{
    vi.stubEnv("CRON_SECRET","test");
    vi.stubEnv("STAWY_OS_EMAIL_ENABLED","true");
    vi.stubEnv("RESEND_API_KEY","test");
    vi.stubEnv("RESEND_FROM_EMAIL","test@example.com");
    const update=vi.fn();
    const due={id:"message",organization_id:"org",booking_id:"booking",rule_id:"arrival",recipient:"test@example.com",subject:"Test",rendered_body:"Test",idempotency_key:"key"};
    mocks.createServiceClient.mockReturnValue({from:(table:string)=>{
      const response=table==="scheduled_messages"?{data:[due],count:1}:table==="operational_records"?{data:[{organization_id:"org",entity_id:"message",payload:{deliveryPolicy:"manual_send"}}]}:{count:0};
      const query:Record<string,unknown>={then:(resolve:(value:unknown)=>unknown)=>Promise.resolve(resolve(response)),maybeSingle:async()=>({data:{id:"outbound",...existing}}),returns:async()=>response,update};
      for(const method of ["select","eq","in","gte","is","lte","order","limit","range"])query[method]=()=>query;
      return query;
    }});
    const response=await POST(new Request("http://localhost/api/automations/process",{method:"POST",headers:{authorization:"Bearer test"}}));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({sent:0,skipped:1});
    expect(mocks.sendResendEmail).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

});

describe("email queue progress", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    mocks.createServiceClient.mockReset();
    mocks.sendResendEmail.mockReset();
  });

  it.each([false, true])("scans beyond terminal messages and fails closed on a missing page (%s)", async (failSecondPage) => {
    vi.stubEnv("CRON_SECRET", "test");
    vi.stubEnv("STAWY_OS_EMAIL_ENABLED", "true");
    vi.stubEnv("RESEND_API_KEY", "test");
    vi.stubEnv("RESEND_FROM_EMAIL", "test@example.com");
    vi.stubEnv("STAWY_OS_EMAIL_DAILY_LIMIT", "3");
    const rows = Array.from({ length: 45 }, (_, i) => ({
      id: String(i), organization_id: "org", booking_id: "booking", rule_id: "arrival",
      recipient: "test@example.com", subject: "Test", rendered_body: "Test", idempotency_key: `key-${i}`,
    }));
    const offsets: number[] = [];
    const json = (data: unknown, count?: number) => new Response(JSON.stringify(data), {
      status: 200, headers: { "content-type": "application/json", ...(count === undefined ? {} : { "content-range": `0-0/${count}` }) },
    });
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (init?.method === "HEAD") return new Response(null, { headers: { "content-range": "*/0" } });
      if (url.pathname.endsWith("scheduled_messages")) {
        const offset = Number(url.searchParams.get("offset") ?? 0);
        offsets.push(offset);
        if (failSecondPage && offset > 0) return new Response(JSON.stringify({ message: "failed" }), { status: 400 });
        return json(rows.slice(offset, offset + 20), rows.length);
      }
      if (init?.method === "POST" && url.pathname.endsWith("outbound_messages")) {
        const inserted = JSON.parse(String(init.body));
        return json({ id: inserted.idempotency_key, attempts: 0, status: "processing" });
      }
      if (init?.method === "PATCH" || url.pathname.includes("/rpc/")) return json(null);
      const key = url.searchParams.get("idempotency_key")?.replace("eq.key-", "");
      return json(Number(key) < 40 ? { id: `outbound-${key}`, status: "error", attempts: 1, next_attempt_at: null } : null);
    });
    mocks.createServiceClient.mockReturnValue(createClient("https://test.supabase.co", "test", {
      global: { fetch: fetcher }, auth: { persistSession: false },
    }));
    mocks.sendResendEmail.mockResolvedValue({ ok: true, providerMessageId: "provider-test" });
    const response = await POST(new Request("http://localhost/api/automations/process", {
      method: "POST", headers: { authorization: "Bearer test" },
    }));
    if (failSecondPage) {
      expect(response.status).toBe(503);
      expect(mocks.sendResendEmail).not.toHaveBeenCalled();
    } else {
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ sent: 3, skipped: 40, processed: 43 });
      expect(offsets).toEqual([0, 20, 40]);
      expect(mocks.sendResendEmail).toHaveBeenCalledTimes(3);
      expect(mocks.sendResendEmail.mock.calls.map(([message]) => message.idempotencyKey)).toEqual(["key-40", "key-41", "key-42"]);
    }
  });
});
