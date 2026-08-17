import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
const icalMigrationName = "20260810114739_harden_safe_ical_sync.sql";
const serviceKeyMigrationName = "20260810123732_allow_service_key_ical_sync.sql";

describe("utwardzenie atomowego zapisu iCal", () => {
  const migration = readFileSync(
    join(process.cwd(), "supabase/migrations", icalMigrationName),
    "utf8",
  );
  const serviceKeyMigration = readFileSync(
    join(process.cwd(), "supabase/migrations", serviceKeyMigrationName),
    "utf8",
  );

  it("ma pusty search_path i wykonanie wyłącznie dla service_role", () => {
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = ''");
    expect(migration).not.toContain("auth.role()");
    expect(migration).toMatch(/revoke all on function public\.apply_ical_sync[\s\S]+from public, anon, authenticated;/);
    expect(migration).toMatch(/grant execute on function public\.apply_ical_sync[\s\S]+to service_role;/);
  });

  it("kwalifikuje tabele i aktualizuje znacznik wydania", () => {
    for (const table of ["operational_state_versions", "operational_records", "audit_events"]) {
      expect(migration).toContain(`public.${table}`);
    }
    expect(migration).toContain("2026-08-10.2");
    expect(migration).toContain(icalMigrationName);
  });

  it("autoryzuje nowy secret key przez ACL zamiast legacy claimu JWT", () => {
    expect(serviceKeyMigration).toContain("legacy_claim_gate");
    expect(serviceKeyMigration).toContain("pg_catalog.replace(function_definition, legacy_claim_gate, '')");
    expect(serviceKeyMigration).toMatch(/revoke all on function public\.apply_ical_sync[\s\S]+from public, anon, authenticated;/);
    expect(serviceKeyMigration).toMatch(/grant execute on function public\.apply_ical_sync[\s\S]+to service_role;/);
  });
});
