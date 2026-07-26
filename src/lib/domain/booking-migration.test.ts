import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260726140440_update_operational_booking_commands.sql",
  ),
  "utf8",
);

describe("migracja komendy aktualizacji rezerwacji", () => {
  it("utrzymuje bezpieczny kontrakt funkcji RPC", () => {
    expect(migration).toContain("security invoker");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toMatch(
      /revoke all on function public\.update_operational_booking[\s\S]+from public, anon;/,
    );
    expect(migration).toMatch(
      /grant execute on function public\.update_operational_booking[\s\S]+to authenticated;/,
    );
    expect(migration).not.toContain("security definer");
  });

  it("serializuje dostępność, wyklucza bieżącą rezerwację i wersjonuje rekord", () => {
    expect(migration).toContain("pg_catalog.pg_advisory_xact_lock");
    expect(migration).toContain("entity_id <> p_booking_id");
    expect(migration).toContain("record_version = record_version + 1");
    expect(migration).toContain("p_booking ->> 'workflowStatus' <> 'Anulowana'");
  });

  it("uzgadnia zadania, wiadomości wykonawcze i audyt w tej samej funkcji", () => {
    expect(migration).toContain("entity_type = 'tasks'");
    expect(migration).toContain("insert into public.scheduled_messages");
    expect(migration).toContain("'related_record_conflict'");
    expect(migration).toContain("'command_committed'");
    expect(migration).toContain("'command_conflict'");
  });
});
