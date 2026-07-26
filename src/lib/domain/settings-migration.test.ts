import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260726163800_update_operational_settings.sql",
  ),
  "utf8",
);

describe("migracja komendy ustawień", () => {
  it("utrzymuje SECURITY INVOKER i zawężone EXECUTE", () => {
    expect(migration).toContain("security invoker");
    expect(migration).toContain("set search_path = ''");
    expect(migration).not.toContain("security definer");
    expect(migration).toMatch(
      /revoke all on function public\.update_operational_settings[\s\S]+from public, anon;/,
    );
    expect(migration).toMatch(
      /grant execute on function public\.update_operational_settings[\s\S]+to authenticated;/,
    );
  });

  it("zmienia jeden rekord bez pełnego snapshotu i wersjonuje stan", () => {
    expect(migration).toContain("'settings'");
    expect(migration).toContain("'organization'");
    expect(migration).toContain("update public.operational_records");
    expect(migration).toContain("insert into public.operational_records");
    expect(migration).toContain("update public.operational_state_versions");
    expect(migration).not.toContain("operational_snapshots");
    expect(migration).not.toContain("replace_operational_state");
  });

  it("waliduje dane, rozpoznaje konflikt i zapisuje audyt", () => {
    expect(migration).toContain("'Europe/Warsaw'");
    expect(migration).toContain("defaultCheckIn");
    expect(migration).toContain("defaultCheckOut");
    expect(migration).toContain("'command_committed'");
    expect(migration).toContain("'command_conflict'");
    expect(migration).toContain("'conflict'");
    expect(migration).not.toContain("update public.audit_events");
  });
});
