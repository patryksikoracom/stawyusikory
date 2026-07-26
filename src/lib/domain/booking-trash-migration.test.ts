import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260726154158_mutate_operational_booking.sql",
  ),
  "utf8",
);

describe("migracja komendy kosza rezerwacji", () => {
  it("pozostaje komendą SECURITY INVOKER z zawężonym EXECUTE", () => {
    expect(migration).toContain("security invoker");
    expect(migration).toContain("set search_path = ''");
    expect(migration).not.toContain("security definer");
    expect(migration).toMatch(
      /revoke all on function public\.mutate_operational_booking[\s\S]+from public, anon;/,
    );
    expect(migration).toMatch(
      /grant execute on function public\.mutate_operational_booking[\s\S]+to authenticated;/,
    );
  });

  it("deleguje do atomowej komendy PR-8d i zapisuje prawdziwy rodzaj operacji", () => {
    expect(migration).toContain("public.update_operational_booking(");
    expect(migration).toContain("p_operation not in ('update', 'cancel', 'trash', 'restore')");
    expect(migration).toContain("'lifecycle_committed'");
    expect(migration).toMatch(
      /create policy "editors insert booking command audit"[\s\S]+and action in \([\s\S]+'related_record_conflict'[\s\S]+'lifecycle_committed'/,
    );
    expect(migration).toContain("'command_kind', p_operation");
    expect(migration).not.toContain("update public.audit_events");
    expect(migration).toContain("p_booking ->> 'purgeAfter'");
    expect(migration).toContain("substring(p_booking ->> 'deletedAt' from 1 for 10)::date + 30");
  });
});
