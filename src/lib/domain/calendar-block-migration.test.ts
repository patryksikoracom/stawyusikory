import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260726165207_mutate_operational_calendar_blocks.sql",
  ),
  "utf8",
);

describe("migracja komend blokad kalendarza", () => {
  it("utrzymuje SECURITY INVOKER i zawężone EXECUTE", () => {
    expect(migration).toContain("security invoker");
    expect(migration).toContain("set search_path = ''");
    expect(migration).not.toContain("security definer");
    expect(migration).toMatch(
      /revoke all on function public\.mutate_operational_calendar_block[\s\S]+from public, anon;/,
    );
    expect(migration).toMatch(
      /grant execute on function public\.mutate_operational_calendar_block[\s\S]+to authenticated;/,
    );
  });

  it("serializuje blokadę i rezerwację tym samym kluczem domku", () => {
    expect(migration).toContain("pg_catalog.pg_advisory_xact_lock");
    expect(migration).toContain("p_organization_id::text || ':' || unit_id");
    expect(migration).toContain("entity_type = 'bookings'");
    expect(migration).toContain("entity_type = 'blocks'");
    expect(migration).toContain("'availability_conflict'");
  });

  it("wersjonuje jeden rekord i nie dotyka pełnego snapshotu", () => {
    expect(migration).toContain("update public.operational_records");
    expect(migration).toContain("insert into public.operational_records");
    expect(migration).toContain("update public.operational_state_versions");
    expect(migration).not.toContain("operational_snapshots");
    expect(migration).not.toContain("replace_operational_state");
  });

  it("waliduje dane, rozpoznaje replay i audytuje wynik", () => {
    expect(migration).toContain("'already_committed'");
    expect(migration).toContain("'command_committed'");
    expect(migration).toContain("'command_conflict'");
    expect(migration).toContain("'block_id_exists'");
    expect(migration).toContain("dateTo");
    expect(migration).toContain("blockType");
  });
});
