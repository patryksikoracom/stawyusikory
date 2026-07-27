import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260727130702_pr12_integration_go_live_gates.sql",
  ),
  "utf8",
);

describe("PR-12 integration go-live migration", () => {
  it("stores contracts, daily evidence, cutover gates and replay-safe webhooks", () => {
    expect(migration).toContain("public.integration_contracts");
    expect(migration).toContain("public.integration_shadow_reports");
    expect(migration).toContain("unique (contract_id, report_date)");
    expect(migration).toContain("public.integration_cutover_gates");
    expect(migration).toContain("rollback_tested_at");
    expect(migration).toContain("owner_approved_at");
    expect(migration).toContain("unique (contract_id, provider_event_id)");
  });

  it("keeps provider writes behind server-side service-role paths", () => {
    expect(migration).toContain("enable row level security");
    expect(migration).toMatch(/revoke insert, update on table[\s\S]+from authenticated;/);
    expect(migration).not.toContain("for all to authenticated");
  });

  it("adds delivery tracking, bounded retry scheduling and an owner-alert signal", () => {
    expect(migration).toContain("provider_message_id");
    expect(migration).toContain("next_attempt_at");
    expect(migration).toContain("delivered_at");
    expect(migration).toContain("last_error");
    expect(migration).toContain("important boolean");
  });
});
