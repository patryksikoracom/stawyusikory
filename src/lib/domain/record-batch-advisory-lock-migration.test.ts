import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { releaseManifest } from "@/lib/release";

describe("naprawa blokady doradczej komendy batchowej", () => {
  const migration = [
    "20260810122616_fix_record_batch_advisory_lock.sql",
    "20260810123338_fix_record_batch_lock_operator_precedence.sql",
    releaseManifest.requiredMigration,
  ].map((name) => readFileSync(
    join(process.cwd(), "supabase/migrations", name),
    "utf8",
  )).join("\n");

  it("nadaje elementowi jsonb jednoznaczną nazwę kolumny", () => {
    expect(migration).toContain("as batch_change(value)");
    expect(migration).toContain("(batch_change.value ->> 'entityType')");
    expect(migration).toContain("(batch_change.value ->> 'entityId')");
  });

  it("zachowuje wąskie uprawnienia i aktualizuje manifest", () => {
    expect(migration).toMatch(/revoke execute on function public\.mutate_operational_record_batch[\s\S]+from public, anon;/);
    expect(migration).toMatch(/grant execute on function public\.mutate_operational_record_batch[\s\S]+to authenticated;/);
    expect(migration).toContain(releaseManifest.schemaVersion);
    expect(migration).toContain(releaseManifest.requiredMigration);
  });
});
