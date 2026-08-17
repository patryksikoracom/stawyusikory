import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const materializationMigration = "20260810185423_materialize_ical_booking.sql";

describe("materializacja rezerwacji z iCal", () => {
  const migration = readFileSync(
    join(process.cwd(), "supabase/migrations", materializationMigration),
    "utf8",
  );

  it("działa jako invoker i ma wąskie uprawnienia RPC", () => {
    expect(migration).toContain("security invoker");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toMatch(/revoke all on function public\.create_operational_booking_from_ical[\s\S]+from public, anon;/);
    expect(migration).toMatch(/grant execute on function public\.create_operational_booking_from_ical[\s\S]+to authenticated;/);
  });

  it("usuwa wyłącznie wskazany blok po sprawdzeniu organizacji, domku, kanału i dat", () => {
    expect(migration).toContain("entity_id = p_ical_block_id");
    expect(migration).toContain("block_record.payload ->> 'unitId' is distinct from p_booking ->> 'unitId'");
    expect(migration).toContain("not like ('[' || (p_booking ->> 'platform') || ']%')");
    expect(migration).toContain("public.create_operational_booking(");
    expect(migration).toContain("insert into public.operational_records");
  });

  it("aktualizuje handshake wydania", () => {
    expect(migration).toContain("2026-08-10.6");
    expect(migration).toContain(materializationMigration);
  });
});
