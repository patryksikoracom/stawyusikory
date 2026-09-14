import { afterEach, expect, it, vi } from "vitest";
import { sendSmsApi } from "./smsapi";
afterEach(() => vi.unstubAllGlobals());
it("requires a provider message ID rather than an HTTP 200 alone", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 13, message: "No correct phone numbers" }))));
  expect(await sendSmsApi("test", "+48123123123", "Test")).toMatchObject({ ok: false, retryable: false });
});
it("accepts a documented successful response", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ count: 1, list: [{ id: "sms-1", status: "QUEUE" }] }))));
  expect(await sendSmsApi("test", "+48123123123", "Test")).toMatchObject({ ok: true, retryable: false });
});
it("does not automatically resend after an ambiguous network failure", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
  expect(await sendSmsApi("test", "+48123123123", "Test")).toMatchObject({ ok: false, retryable: false, provider: { error: "delivery_unknown" } });
});
it("allows a rate-limited request to be retried", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "rate_limit" }), { status: 429 })));
  expect(await sendSmsApi("test", "+48123123123", "Test")).toMatchObject({ ok: false, retryable: true });
});
