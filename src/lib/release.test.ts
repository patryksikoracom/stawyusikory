import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isCompatibleDatabaseRelease, releaseManifest } from "./release";

describe("manifest wydania", () => {
  it("akceptuje wyłącznie dokładnie zgodny znacznik bazy", () => {
    expect(isCompatibleDatabaseRelease({
      schema_version: releaseManifest.schemaVersion,
      required_migration: releaseManifest.requiredMigration,
      applied_at: "2026-08-10T11:47:39.000Z",
    })).toBe(true);
    expect(isCompatibleDatabaseRelease({
      schema_version: "starsza-wersja",
      required_migration: releaseManifest.requiredMigration,
      applied_at: "2026-08-10T11:47:39.000Z",
    })).toBe(false);
    expect(isCompatibleDatabaseRelease(null)).toBe(false);
  });

  it("chroni tabelę znacznika przed klientami publicznymi", () => {
    const migration = readFileSync(
      join(process.cwd(), "supabase/migrations/20260810113519_release_manifest.sql"),
      "utf8",
    );
    expect(migration).toContain("alter table public.app_release_manifest enable row level security");
    expect(migration).toContain("revoke all on table public.app_release_manifest from public, anon, authenticated");
    expect(migration).toContain("grant select on table public.app_release_manifest to service_role");
  });
});
