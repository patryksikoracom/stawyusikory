import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260810192240_cleaning_buffer_override.sql"),
  "utf8",
);

describe("migracja kontrolowanego obejścia buforu sprzątania", () => {
  it("wymaga operatora, jawnego planu i rozpoznanego buforu", () => {
    expect(migration).toContain("role in ('owner', 'admin', 'manager')");
    expect(migration).toContain("'self-cleaning', 'arranged-cleaning'");
    expect(migration).toContain("payload ->> 'blockType' = 'Bufor sprzątania'");
    expect(migration).toContain("!~* '(reserved|reservation|booked|rezerw)'");
  });

  it("nie otwiera funkcji dla anon ani public", () => {
    expect(migration).toContain("private.create_operational_booking_with_cleaning_buffer_override_impl");
    expect(migration).toContain("security definer");
    expect(migration).toContain("security invoker");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toMatch(/revoke all on function public\.create_operational_booking_with_cleaning_buffer_override[\s\S]+from public, anon;/);
    expect(migration).toMatch(/grant execute on function public\.create_operational_booking_with_cleaning_buffer_override[\s\S]+to authenticated;/);
  });
});
