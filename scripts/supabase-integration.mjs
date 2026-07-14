import fs from "node:fs";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function loadLocalEnv() {
  const env = { ...process.env };
  if (!fs.existsSync(".env.local")) return env;
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    env[match[1]] = value;
  }
  return env;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const env = loadLocalEnv();
if (env.RUN_SUPABASE_INTEGRATION !== "1" || env.SUPABASE_INTEGRATION_TEST_PROJECT !== "1") {
  console.log("Supabase integration test skipped. Run only against a dedicated test project with RUN_SUPABASE_INTEGRATION=1 and SUPABASE_INTEGRATION_TEST_PROJECT=1.");
  process.exit(0);
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
assert(url && anonKey && serviceKey, "Missing Supabase integration test configuration.");

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const userClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const suffix = crypto.randomUUID();
const email = `stawy-e2e-${suffix}@example.invalid`;
const password = `T-${crypto.randomBytes(20).toString("base64url")}!`;
const ownOrg = crypto.randomUUID();
const otherOrg = crypto.randomUUID();
let userId;

try {
  console.log("Integration: creating isolated user and organizations…");
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  userId = created.data.user.id;

  const organizations = await admin.from("organizations").insert([
    { id: ownOrg, name: "Stawy OS integration test" },
    { id: otherOrg, name: "Stawy OS isolated test" },
  ]);
  if (organizations.error) throw organizations.error;
  const membership = await admin.from("organization_memberships").insert({ organization_id: ownOrg, user_id: userId, role: "owner" });
  if (membership.error) throw membership.error;

  const login = await userClient.auth.signInWithPassword({ email, password });
  if (login.error) throw login.error;
  console.log("Integration: authenticated; checking RLS isolation…");

  const visibleOrganizations = await userClient.from("organizations").select("id");
  if (visibleOrganizations.error) throw visibleOrganizations.error;
  assert(visibleOrganizations.data.length === 1 && visibleOrganizations.data[0].id === ownOrg, "RLS organization isolation failed.");

  const state = {
    units: [{ id: "test-unit", name: "Test", maxPeople: 2, bedrooms: 1, defaultCleaningCost: 0, notes: "" }],
    bookings: [], guests: [], consents: [], tasks: [], media: [], blocks: [], rates: [], imports: [],
    sourceConnections: [], payments: [], invoices: [], checklistItems: [], issues: [], messages: [], auditLog: [],
    settings: { organizationName: "Test", timezone: "Europe/Warsaw", cleaningContactName: "", cleaningPhone: "", defaultCheckIn: "16:00", defaultCheckOut: "11:00", aiApprovalRequired: true },
  };
  const firstCommit = await userClient.rpc("replace_operational_state", { p_expected_version: 0, p_state: state });
  if (firstCommit.error) throw firstCommit.error;
  assert(Number(firstCommit.data) === 1, "Initial state version was not created.");

  const staleCommit = await userClient.rpc("replace_operational_state", { p_expected_version: 0, p_state: state });
  console.log("Integration: stale-write result", { code: staleCommit.error?.code ?? null, returnedVersion: staleCommit.data ?? null });
  assert(Boolean(staleCommit.error), "Stale write was not rejected.");

  const records = await userClient.from("operational_records").select("entity_type,entity_id");
  if (records.error) throw records.error;
  assert(records.data.some((record) => record.entity_type === "units" && record.entity_id === "test-unit"), "Normalized records were not persisted.");
  console.log("Supabase integration test passed: Auth, RLS, record persistence and conflict protection.");
} finally {
  console.log("Integration: cleaning temporary data…");
  await userClient.auth.signOut().catch(() => undefined);
  if (userId) await admin.auth.admin.deleteUser(userId).catch(() => undefined);
  await admin.from("organizations").delete().in("id", [ownOrg, otherOrg]);
}
