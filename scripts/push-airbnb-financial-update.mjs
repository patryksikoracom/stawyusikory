import fs from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const targetBookingIds = ["MC-8299115", "MC-8329511", "MC-8516953", "MC-8333167", "MC-8232821"];
const inputPath = new URL("../outputs/stawy_finanse_20260727/stawy-os-import-finanse-2026-07-27.json", import.meta.url);

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Brak zmiennej ${name}.`);
  return value;
}

function summarize(record) {
  return {
    entityType: record.entity_type,
    id: record.entity_id,
    version: record.record_version,
    gross: record.payload?.grossPrice,
    guestPaid: record.payload?.guestPaidTotal,
    guestFee: record.payload?.guestServiceFee,
    payout: record.payload?.payout,
    paymentStatus: record.payload?.paymentStatus,
  };
}

const service = createClient(
  required("NEXT_PUBLIC_SUPABASE_URL"),
  required("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const data = JSON.parse(await fs.readFile(inputPath, "utf8"));
const desiredBookings = data.rows.filter((row) => targetBookingIds.includes(row.id));
const desiredImports = data.imports.filter((row) => targetBookingIds.includes(row.matchedBookingId));
if (desiredBookings.length !== targetBookingIds.length || desiredImports.length !== targetBookingIds.length) {
  throw new Error("Plik źródłowy nie zawiera kompletu pięciu rezerwacji i rozliczeń Airbnb.");
}

const [{ data: currentRows, error: currentError }, { data: state, error: stateError }] = await Promise.all([
  service
    .from("operational_records")
    .select("entity_type,entity_id,payload,record_version,updated_at,updated_by")
    .eq("organization_id", organizationId)
    .in("entity_type", ["bookings", "imports"]),
  service
    .from("operational_state_versions")
    .select("version,updated_at,updated_by")
    .eq("organization_id", organizationId)
    .single(),
]);
if (currentError || stateError) throw new Error(currentError?.message ?? stateError?.message);

const relevantRows = (currentRows ?? []).filter((row) => (
  (row.entity_type === "bookings" && targetBookingIds.includes(row.entity_id))
  || (row.entity_type === "imports" && targetBookingIds.includes(row.payload?.matchedBookingId))
));
const bookingCurrent = new Map(relevantRows.filter((row) => row.entity_type === "bookings").map((row) => [row.entity_id, row]));
const importCurrent = new Map(relevantRows.filter((row) => row.entity_type === "imports").map((row) => [row.payload.matchedBookingId, row]));
if (bookingCurrent.size !== targetBookingIds.length) {
  throw new Error("Preflight: w bazie brakuje jednej z pięciu rezerwacji.");
}

const now = new Date().toISOString();
const desired = [
  ...desiredBookings.map((payload) => ({ entity_type: "bookings", entity_id: payload.id, payload })),
  ...desiredImports.map((payload) => {
    const current = importCurrent.get(payload.matchedBookingId);
    return {
      entity_type: "imports",
      entity_id: current?.entity_id ?? `AIRBNB-FINANCE-${payload.matchedBookingId}`,
      payload: { ...payload, syncSource: "Ręcznie" },
    };
  }),
];

if (process.argv[2] !== "--apply") {
  console.log(JSON.stringify({
    dryRun: true,
    stateVersion: state.version,
    bookings: desired.filter((row) => row.entity_type === "bookings").map((row) => summarize(bookingCurrent.get(row.entity_id))),
    importsPresent: importCurrent.size,
    plannedWrites: desired.map((row) => ({ entityType: row.entity_type, id: row.entity_id })),
  }, null, 2));
  process.exit(0);
}

const priorRows = new Map(relevantRows.map((row) => [`${row.entity_type}:${row.entity_id}`, row]));
const changed = [];
try {
  for (const item of desired) {
    const previous = priorRows.get(`${item.entity_type}:${item.entity_id}`);
    const nextVersion = Number(previous?.record_version ?? 0) + 1;
    const nextPayload = { ...item.payload, version: nextVersion, updatedAt: now };
    const query = previous
      ? service.from("operational_records").update({ payload: nextPayload, record_version: nextVersion, updated_at: now, updated_by: null }).eq("organization_id", organizationId).eq("entity_type", item.entity_type).eq("entity_id", item.entity_id).eq("record_version", previous.record_version)
      : service.from("operational_records").insert({ organization_id: organizationId, entity_type: item.entity_type, entity_id: item.entity_id, payload: nextPayload, record_version: nextVersion, updated_at: now, updated_by: null });
    const { error } = await query;
    if (error) throw new Error(`${item.entity_type}:${item.entity_id}: ${error.message}`);
    changed.push({ ...item, previous, nextVersion });
  }

  const { error: versionError } = await service
    .from("operational_state_versions")
    .update({ version: Number(state.version) + 1, updated_at: now, updated_by: null })
    .eq("organization_id", organizationId)
    .eq("version", state.version);
  if (versionError) throw new Error(`Wersja stanu: ${versionError.message}`);

  const { error: auditError } = await service.from("audit_events").insert({
    organization_id: organizationId,
    actor_id: null,
    entity_type: "import",
    entity_id: "AIRBNB-FINANCE-UPDATE-20260727",
    action: "financial_details_updated",
    payload: { bookingIds: targetBookingIds, source: "Airbnb upcoming earnings screens + reconciled workbook", stateVersion: Number(state.version) + 1 },
  });
  if (auditError) throw new Error(`Audit: ${auditError.message}`);

  const { data: verification, error: verificationError } = await service
    .from("operational_records")
    .select("entity_type,entity_id,payload,record_version")
    .eq("organization_id", organizationId)
    .in("entity_type", ["bookings", "imports"]);
  if (verificationError) throw new Error(`Weryfikacja: ${verificationError.message}`);
  const verified = (verification ?? []).filter((row) => targetBookingIds.includes(row.entity_id) || targetBookingIds.includes(row.payload?.matchedBookingId));
  const bookingVerified = verified.filter((row) => row.entity_type === "bookings");
  const importVerified = verified.filter((row) => row.entity_type === "imports");
  if (bookingVerified.length !== 5 || importVerified.length !== 5 || bookingVerified.some((row) => !row.payload.guestServiceFee || row.payload.paymentStatus !== "Opłacone")) {
    throw new Error("Weryfikacja: zapisane dane finansowe są niekompletne.");
  }
  console.log(JSON.stringify({ ok: true, stateVersion: Number(state.version) + 1, bookings: bookingVerified.map(summarize), imports: importVerified.map(summarize) }, null, 2));
} catch (error) {
  for (const item of changed.reverse()) {
    const key = `${item.entity_type}:${item.entity_id}`;
    const previous = priorRows.get(key);
    if (previous) {
      await service.from("operational_records").update({ payload: previous.payload, record_version: previous.record_version, updated_at: previous.updated_at, updated_by: previous.updated_by }).eq("organization_id", organizationId).eq("entity_type", item.entity_type).eq("entity_id", item.entity_id);
    } else {
      await service.from("operational_records").delete().eq("organization_id", organizationId).eq("entity_type", item.entity_type).eq("entity_id", item.entity_id);
    }
  }
  throw error;
}
