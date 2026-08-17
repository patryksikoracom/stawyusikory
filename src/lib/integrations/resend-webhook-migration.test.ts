import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260817164427_fix_resend_webhook_service_role_auth.sql",
  ),
  "utf8",
);

describe("Resend webhook service-role hotfix migration", () => {
  it("reads the PostgREST JWT role from auth.jwt", () => {
    expect(migration).toContain("auth.jwt() ->> 'role'");
    expect(migration).not.toContain("request.jwt.claim.role");
    expect(migration).toContain("claim_role <> 'service_role'");
  });

  it("keeps the delivery RPC unavailable to browser roles", () => {
    expect(migration).toMatch(
      /revoke all on function public\.record_email_delivery_event[\s\S]+from public, anon, authenticated;/,
    );
    expect(migration).toMatch(
      /grant execute on function public\.record_email_delivery_event[\s\S]+to service_role;/,
    );
  });
});
