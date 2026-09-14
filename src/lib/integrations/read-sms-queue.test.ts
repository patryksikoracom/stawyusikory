import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { readSmsQueue } from "./read-sms-queue";

const now = new Date("2026-09-14T12:00:00Z");
function client(failSecond = false) {
  const rows = Array.from({ length: 45 }, (_, i) => ({
    id: String(i), organization_id: "org", recipient: "+48123456789", body: "Test",
    status: i < 40 ? "error" : "queued", attempts: 1, important: false, next_attempt_at: null,
  }));
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    const offset = Number(url.searchParams.get("offset") ?? 0);
    if (failSecond && offset > 0) return new Response(JSON.stringify({ message: "read failed" }), { status: 500 });
    const page = rows.slice(offset, offset + 20); // Server cap lower than requested page size.
    return new Response(JSON.stringify(page), { status: 200, headers: { "content-type": "application/json", "content-range": `${offset}-${offset + page.length - 1}/${rows.length}` } });
  });
  return { service: createClient("https://test.supabase.co", "test-key", { global: { fetch: fetcher }, auth: { persistSession: false } }), fetcher };
}

describe("SMS queue fairness", () => {
  it("reaches sendable messages after more than one page of terminal errors", async () => {
    const { service, fetcher } = client();
    const rows = await readSmsQueue(service, now);
    expect(rows.map(row => row.id)).toEqual(["40", "41", "42", "43", "44"]);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it("fails instead of delivering from an incomplete scan", async () => {
    const { service } = client(true);
    await expect(readSmsQueue(service, now)).rejects.toBeDefined();
  });
});
