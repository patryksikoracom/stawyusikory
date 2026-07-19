import fs from "node:fs";
import { fileURLToPath } from "node:url";

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

export function inspectAuthConfig(config, { requireHibp = false } = {}) {
  const failures = [];
  const warnings = [];
  if (config.disable_signup !== true) failures.push("Publiczne tworzenie kont musi pozostać wyłączone (disable_signup=true).");
  if (!Number.isFinite(config.password_min_length) || config.password_min_length < 12) failures.push("Minimalna długość hasła musi wynosić co najmniej 12 znaków.");
  if (config.password_hibp_enabled !== true) {
    const message = "Ochrona przed hasłami z wycieków (HIBP) jest wyłączona.";
    if (requireHibp) failures.push(message);
    else warnings.push(`${message} Wymaga planu Supabase Pro.`);
  }
  return { failures, warnings };
}

function projectRef(env) {
  if (env.SUPABASE_PROJECT_REF?.trim()) return env.SUPABASE_PROJECT_REF.trim();
  try {
    return new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
  } catch {
    return "";
  }
}

export async function verifyAuthConfig(env = loadLocalEnv(), fetchImpl = fetch) {
  const ref = projectRef(env);
  const token = env.SUPABASE_ACCESS_TOKEN?.trim();
  if (!ref || !token) throw new Error("Brak SUPABASE_PROJECT_REF/NEXT_PUBLIC_SUPABASE_URL lub SUPABASE_ACCESS_TOKEN.");

  const response = await fetchImpl(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Nie udało się pobrać konfiguracji Auth (HTTP ${response.status}).`);
  const config = await response.json();
  return inspectAuthConfig(config, { requireHibp: env.REQUIRE_SUPABASE_HIBP === "1" });
}

async function main() {
  const result = await verifyAuthConfig();
  for (const warning of result.warnings) console.warn(`OSTRZEŻENIE: ${warning}`);
  if (result.failures.length) {
    for (const failure of result.failures) console.error(`BŁĄD: ${failure}`);
    process.exitCode = 1;
    return;
  }
  console.log("Konfiguracja Supabase Auth spełnia dostępne bramki bezpieczeństwa.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Nieznany błąd kontroli Supabase Auth.");
    process.exitCode = 1;
  });
}
