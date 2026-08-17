import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const manifest = JSON.parse(readFileSync(join(root, "release-manifest.json"), "utf8"));
const migrations = readdirSync(join(root, "supabase", "migrations"))
  .filter((name) => name.endsWith(".sql"))
  .sort();
const latestMigration = migrations.at(-1);

if (!manifest.releaseId || !manifest.schemaVersion || !manifest.requiredMigration) {
  throw new Error("release-manifest.json nie zawiera releaseId, schemaVersion lub requiredMigration.");
}
if (latestMigration !== manifest.requiredMigration) {
  throw new Error(
    `Manifest wymaga ${manifest.requiredMigration}, ale najnowsza migracja to ${latestMigration ?? "brak"}. `
      + "Zaktualizuj migrację znacznika i release-manifest.json przed buildem.",
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
