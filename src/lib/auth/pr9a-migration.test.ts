import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260726180725_pr9a_organization_rbac.sql"),
  "utf8",
);

describe("migracja PR-9a", () => {
  it("definiuje wszystkie role i pełną macierz uprawnień", () => {
    for (const role of ["owner", "admin", "manager", "cleaning", "marketing", "accounting", "viewer"]) {
      expect(migration).toContain(`'${role}'`);
    }
    for (const permission of ["read", "write", "pii", "finance", "send", "export"]) {
      expect(migration).toContain(`'${permission}'`);
    }
  });

  it("opiera autoryzację o auth.uid i członkostwo, nie metadane użytkownika", () => {
    expect(migration).toContain("membership.user_id = (select auth.uid())");
    expect(migration).not.toMatch(/user_metadata|raw_user_meta_data/);
  });

  it("blokuje surowe rekordy dla ról ograniczonych", () => {
    expect(migration).toContain("unrestricted roles read raw operational records");
    expect(migration).toContain("in ('owner', 'admin')");
    expect(migration).toContain("service-only mutate_cleaning_task");
  });

  it("nie pozostawia btree_gist w public i dodaje indeksy FK", () => {
    expect(migration).toContain("alter extension btree_gist set schema extensions");
    expect(migration).toContain("organization_memberships_user_id_idx");
    expect(migration).toContain("audit_events_actor_id_idx");
  });
});
