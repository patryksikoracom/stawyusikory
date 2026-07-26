import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20260726183544_pr9b_team_operations.sql"),
  "utf8",
);

describe("migracja PR-9b", () => {
  it("wiąże każdą mutację z jawną organizacją i dokładnym członkostwem", () => {
    expect(migration).toContain("p_organization_id uuid");
    expect(migration).toContain("membership.organization_id = p_organization_id");
    expect(migration).toContain("membership.user_id = p_actor");
    expect(migration).not.toContain("order by created_at");
    expect(migration).not.toContain("limit 1");
  });

  it("implementuje pełny przepływ przyjęcia, odrzucenia i gotowości", () => {
    for (const action of ["accept", "reject", "start", "checklist", "complete", "report"]) {
      expect(migration).toContain(`p_action = '${action}'`);
    }
    expect(migration).toContain("'{readinessEvidence}'");
    expect(migration).toContain("'source', 'checklist'");
  });

  it("pozostawia RPC wyłącznie dla service role i ustawia search_path", () => {
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toMatch(/revoke all on function[\s\S]+from public, anon, authenticated/);
    expect(migration).toMatch(/grant execute on function[\s\S]+to service_role/);
  });
});
