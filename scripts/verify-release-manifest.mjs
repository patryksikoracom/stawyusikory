import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const manifest = JSON.parse(readFileSync(join(root, "release-manifest.json"), "utf8"));
const migrations = readdirSync(join(root, "supabase", "migrations"))
  .filter((name) => name.endsWith(".sql"))
  .sort();

if (!manifest.releaseId || !manifest.schemaVersion || !manifest.requiredMigration) {
  throw new Error("release-manifest.json nie zawiera releaseId, schemaVersion lub requiredMigration.");
}
// Additive policies can be deployed without changing the data schema marker.
// Every migration after that marker must be explicitly reviewed as compatible.
const compatibleMigrations = manifest.compatibleMigrations ?? [];
const laterMigrations = migrations.filter((name) => name > manifest.requiredMigration);
if (!migrations.includes(manifest.requiredMigration)
  || JSON.stringify(laterMigrations) !== JSON.stringify(compatibleMigrations)) {
  throw new Error(
    `Migracje nie odpowiadają znacznikowi ${manifest.requiredMigration} i liście compatibleMigrations. `
      + "Zaktualizuj znacznik schematu lub jawnie potwierdź zgodność dodatkowych migracji przed buildem.",
  );
}

const migration = readFileSync(
  join(root, "supabase", "migrations", manifest.requiredMigration),
  "utf8",
);
for (const expected of [manifest.schemaVersion, manifest.requiredMigration, "app_release_manifest"]) {
  if (!migration.includes(expected)) {
    throw new Error(`Migracja manifestu nie zawiera wymaganego znacznika: ${expected}.`);
  }
}

process.stdout.write(
  `Manifest wydania OK: ${manifest.releaseId} / schema ${manifest.schemaVersion} / ${manifest.requiredMigration}\n`,
);
