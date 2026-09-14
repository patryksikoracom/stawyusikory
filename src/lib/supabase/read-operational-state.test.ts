import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { readOperationalState } from "./read-operational-state";

function fixture(options: { cap?: number; failPage?: number; revisions?: number[] } = {}) {
  const records = Array.from({ length: 1603 }, (_, index) => ({
    entity_type: index < 800 ? "bookings" : "payments",
    entity_id: String(index).padStart(4, "0"),
    payload: { id: String(index) }, record_version: 1, updated_at: "2026-09-14",
  }));
  let revisions = 0;
  let pages = 0;
  const fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    expect(url.searchParams.get("organization_id")).toBe("eq.org-test");
    if (url.pathname.endsWith("operational_state_versions")) {
      const version = options.revisions?.[revisions++] ?? 1;
      return new Response(JSON.stringify({ version, updated_at: `revision-${version}` }));
    }
    expect(url.searchParams.get("order")).toBe("entity_type.asc,entity_id.asc");
    pages += 1;
    if (pages === options.failPage) return new Response(JSON.stringify({ message: "read failed" }), { status: 500 });
    const offset = Number(url.searchParams.get("offset"));
    const limit = Math.min(Number(url.searchParams.get("limit")), options.cap ?? 500);
    const data = records.slice(offset, offset + limit);
    return new Response(JSON.stringify(data), {
      status: 206,
      headers: { "content-range": `${offset}-${offset + data.length - 1}/${records.length}` },
    });
  });
  const service = createClient("https://test.supabase.co", "test-key", {
    global: { fetch }, auth: { persistSession: false, autoRefreshToken: false },
  });
  return { service, fetch, records };
}

describe("complete operational snapshot", () => {
  it.each([500, 200])("loads 1603 mixed records with server cap %i", async (cap) => {
    const { service, records } = fixture({ cap });
    const result = await readOperationalState(service, "org-test");
    expect(result.records).toEqual(records);
    expect(new Set(result.records.map((record) => `${record.entity_type}:${record.entity_id}`)).size).toBe(1603);
  });

  it("rejects the entire snapshot when a later page fails", async () => {
    const { service } = fixture({ failPage: 2 });
    await expect(readOperationalState(service, "org-test")).rejects.toMatchObject({ message: "read failed" });
  });

  it("restarts the read when another writer commits between pages", async () => {
    const { service, records } = fixture({ revisions: [1, 2, 2, 2] });
    const result = await readOperationalState(service, "org-test");
    expect(result.revision?.version).toBe(2);
    expect(result.records).toEqual(records);
  });

  it("bounds retries when the data keeps changing", async () => {
    const { service, fetch } = fixture({ revisions: [1, 2, 3, 4, 5, 6] });
    await expect(readOperationalState(service, "org-test")).rejects.toThrow("Dane zmieniły się");
    expect(fetch).toHaveBeenCalledTimes(18);
  });
});
