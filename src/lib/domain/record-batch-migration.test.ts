import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260726171329_mutate_operational_record_batch.sql",
  ),
  "utf8",
);
const appStore = fs.readFileSync(
  path.join(process.cwd(), "src/components/layout/app-store.tsx"),
  "utf8",
);
const stateRoute = fs.readFileSync(
  path.join(process.cwd(), "src/app/api/state/route.ts"),
  "utf8",
);

describe("migracja kończąca zapis rekordowy PR-8", () => {
  it("używa invoker rights, pustego search_path i zawężonego execute", () => {
    expect(migration).toContain("security invoker");
    expect(migration).toContain("set search_path = ''");
    expect(migration).not.toContain("security definer");
    expect(migration).toMatch(/revoke all on function public\.mutate_operational_record_batch[\s\S]+from public, anon;/);
    expect(migration).toMatch(/grant execute on function public\.mutate_operational_record_batch[\s\S]+to authenticated;/);
  });

  it("whitelistuje typy, blokuje rekordy w stałej kolejności i sprawdza każdą wersję przed zapisem", () => {
    expect(migration).toContain("allowed_types constant text[]");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("order by item ->> 'entityType', item ->> 'entityId'");
    expect(migration).toContain("expected_record_version");
    expect(migration).toContain("'command_conflict'");
  });

  it("wersjonuje paczkę atomowo i nie zapisuje pełnego snapshotu", () => {
    expect(migration).toContain("insert into public.operational_records");
    expect(migration).toContain("update public.operational_state_versions");
    expect(migration).toContain("'command_committed'");
    expect(migration).toContain("'already_committed'");
    expect(migration).not.toContain("operational_snapshots");
    expect(migration).toContain("revoke execute on function public.replace_operational_state");
    expect(migration).not.toContain("perform public.replace_operational_state");
  });

  it("utrzymuje wykonawcze tabele komunikacji, debriefu i atrybucji", () => {
    expect(migration).toContain("public.scheduled_messages");
    expect(migration).toContain("public.departure_debriefs");
    expect(migration).toContain("public.marketing_touchpoints");
    expect(migration).toContain("grant select, insert, update, delete");
  });

  it("usuwa pełny PUT stanu z klienta i API", () => {
    expect(appStore).not.toContain('method: "PUT"');
    expect(appStore).not.toContain('fetch("/api/state", {\n            method:');
    expect(stateRoute).not.toContain("export async function PUT");
    expect(stateRoute).not.toContain("replace_operational_state_v2");
  });
});
