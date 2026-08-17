import manifest from "../../release-manifest.json";

export const releaseManifest = manifest;

export type DatabaseReleaseManifest = {
  schema_version: string;
  required_migration: string;
  applied_at: string;
};

export function releaseIdentity() {
  return {
    releaseId: releaseManifest.releaseId,
    schemaVersion: releaseManifest.schemaVersion,
    requiredMigration: releaseManifest.requiredMigration,
    sourceCommit: process.env.VERCEL_GIT_COMMIT_SHA ?? "local-working-tree",
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
  };
}

export function isCompatibleDatabaseRelease(value: DatabaseReleaseManifest | null) {
  return value?.schema_version === releaseManifest.schemaVersion
    && value.required_migration === releaseManifest.requiredMigration;
}
