import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260726155815_create_operational_payment_command.sql",
  ),
  "utf8",
);

describe("migracja komendy płatności", () => {
  it("utrzymuje SECURITY INVOKER i zawężone EXECUTE", () => {
    expect(migration).toContain("security invoker");
    expect(migration).toContain("set search_path = ''");
    expect(migration).not.toContain("security definer");
    expect(migration).toMatch(
      /revoke all on function public\.create_operational_payment[\s\S]+from public, anon;/,
    );
    expect(migration).toMatch(
      /grant execute on function public\.create_operational_payment[\s\S]+to authenticated;/,
    );
  });

  it("zapisuje jeden rekord zamiast pełnego snapshotu i wersjonuje stan", () => {
    expect(migration).toContain("'payments'");
    expect(migration).toContain("insert into public.operational_records");
    expect(migration).toContain("update public.operational_state_versions");
    expect(migration).not.toContain("operational_snapshots");
    expect(migration).not.toContain("replace_operational_state");
  });

  it("jest idempotentna, waliduje relacje i zapisuje audyt", () => {
    expect(migration).toContain("on conflict (organization_id, entity_type, entity_id) do nothing");
    expect(migration).toContain("'already_committed'");
    expect(migration).toContain("'booking_not_found'");
    expect(migration).toContain("'cost_setting_not_found'");
    expect(migration).toContain("'command_committed'");
    expect(migration).toContain("'command_conflict'");
    expect(migration).toContain("payment_amount <> round(payment_amount, 2)");
    expect(migration).toContain("jsonb_typeof(p_payment -> 'amount') is distinct from 'number'");
    expect(migration).toContain("payment_amount is null");
    expect(migration).toContain("booking ->> 'currency' is distinct from payment_currency");
  });
});
