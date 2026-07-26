import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20260726193626_pr9c_minor_protection.sql"),
  "utf8",
);

describe("migracja PR-9c", () => {
  it("wiąże mutacje z jawną organizacją i członkostwem", () => {
    expect(migration).toContain("p_organization_id uuid");
    expect(migration).toContain("membership.organization_id = p_organization_id");
    expect(migration).toContain("membership.user_id = p_actor");
  });

  it("uzgadnia zadanie wewnętrzne także po zmianie liczby dzieci", () => {
    expect(migration).toContain("create trigger reconcile_minor_protection_task");
    expect(migration).toContain("'complianceKind', 'minor-protection'");
    expect(migration).toContain("after update of payload on public.operational_records");
    expect(migration).toContain("payload ->> 'status' = 'Nie dotyczy'");
  });

  it("przechowuje tylko wersję SOP i minimalny dowód wykonania", () => {
    for (const field of [
      "'required', true",
      "'performed', true",
      "'performedAt'",
      "'performedBy'",
      "'standardVersion'",
      "'outcome'",
    ]) {
      expect(migration).toContain(field);
    }
    for (const forbidden of ["childName", "childDocument", "documentScan", "dateOfBirth", "pesel"]) {
      expect(migration.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });

  it("tworzy reakcję bez opisu incydentu i rozdziela jej przyjęcie od zamknięcia", () => {
    expect(migration).toContain("'minorProtectionReactions'");
    expect(migration).toContain("p_action in ('acknowledge_reaction', 'close_reaction')");
    expect(migration).toContain("'resolutionReference'");
    expect(migration).not.toContain("'incidentDescription'");
  });

  it("pozostawia RPC wyłącznie dla service role i ustawia search_path", () => {
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toMatch(/revoke all on function[\s\S]+from public, anon, authenticated/);
    expect(migration).toMatch(/grant execute on function[\s\S]+to service_role/);
  });
});
