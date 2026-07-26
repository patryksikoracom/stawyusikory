import { NextResponse } from "next/server";
import { isGeneralStateReader } from "@/lib/auth/permissions";
import { visibleOperationalRecord } from "@/lib/auth/state-visibility";
import { requireOrganization } from "@/lib/supabase/auth-context";
import { createServiceClient } from "@/lib/supabase/server";

const entityTypes = [
  "units", "bookings", "guests", "consents", "tasks", "media", "blocks",
  "rates", "costSettings", "imports", "sourceConnections", "payments", "invoices",
  "checklistItems", "issues", "messages", "departureDebriefs", "messageTemplates",
  "automationRules", "scheduledMessages", "marketingTouchpoints", "auditLog", "settings",
] as const;

type EntityType = (typeof entityTypes)[number];

function isBundledDemoState(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const bookings = (value as { bookings?: unknown }).bookings;
  if (!Array.isArray(bookings)) return false;
  const ids = new Set(bookings.map((booking) => String((booking as { id?: unknown })?.id ?? "")));
  return ["G001", "G002", "G003", "G004"].every((id) => ids.has(id));
}


export async function GET(request: Request) {
  const result = await requireOrganization(request);
  if (result.error) return result.error;
  if (!isGeneralStateReader(result.role)) {
    return NextResponse.json({ error: "To konto korzysta wyłącznie z panelu sprzątania." }, { status: 403 });
  }
  const service = createServiceClient();
  if (!service) return NextResponse.json({ error: "Bezpieczny odczyt danych nie jest skonfigurowany." }, { status: 503 });

  const [{ data: records, error: recordsError }, { data: revision, error: revisionError }] = await Promise.all([
    service
      .from("operational_records")
      .select("entity_type,entity_id,payload,record_version,updated_at")
      .eq("organization_id", result.organizationId),
    service
      .from("operational_state_versions")
      .select("version,updated_at")
      .eq("organization_id", result.organizationId)
      .maybeSingle(),
  ]);

  if (recordsError || revisionError) {
    const missingTable = recordsError?.code === "42P01" || revisionError?.code === "42P01";
    if (!missingTable) return NextResponse.json({ error: recordsError?.message ?? revisionError?.message }, { status: 500 });
  }

  const visibleRecords = (records ?? [])
    .map((record) => visibleOperationalRecord(record, result.role))
    .filter((record): record is NonNullable<typeof record> => Boolean(record));

  if (visibleRecords.length) {
    const state = Object.fromEntries(entityTypes.map((type) => [type, type === "settings" ? null : []])) as Record<EntityType, unknown>;
    for (const record of visibleRecords) {
      const type = record.entity_type as EntityType;
      if (!entityTypes.includes(type)) continue;
      if (type === "settings") {
        state.settings = {
          ...(record.payload as Record<string, unknown>),
          version: record.record_version,
          updatedAt: record.updated_at,
        };
      }
      else if (
        type === "bookings"
        || type === "consents"
        || type === "tasks"
        || type === "checklistItems"
        || type === "payments"
        || type === "scheduledMessages"
        || type === "blocks"
      ) {
        (state[type] as unknown[]).push({
          ...(record.payload as Record<string, unknown>),
          version: record.record_version,
          updatedAt: record.updated_at,
        });
      } else (state[type] as unknown[]).push(record.payload);
    }
    return NextResponse.json({
      data: state,
      version: revision?.version ?? 0,
      updatedAt: revision?.updated_at,
      source: "records",
      recordVersions: Object.fromEntries(
        visibleRecords.map((record) => [
          `${record.entity_type}:${record.entity_id}`,
          Number(record.record_version),
        ]),
      ),
    }, { headers: { "cache-control": "private, no-store" } });
  }

  if (result.role !== "owner" && result.role !== "admin") {
    return NextResponse.json({
      data: null,
      version: revision?.version ?? 0,
      updatedAt: revision?.updated_at,
      source: "empty",
    }, { headers: { "cache-control": "private, no-store" } });
  }

  const { data: legacy, error: legacyError } = await service
    .from("operational_snapshots")
    .select("state,updated_at")
    .eq("organization_id", result.organizationId)
    .maybeSingle();
  if (legacyError) return NextResponse.json({ error: legacyError.message }, { status: 500 });

  if (isBundledDemoState(legacy?.state)) {
    return NextResponse.json({
      data: null,
      version: revision?.version ?? 0,
      updatedAt: legacy?.updated_at,
      source: "empty",
      quarantinedDemo: true,
    }, { headers: { "cache-control": "private, no-store" } });
  }

  return NextResponse.json({
    data: legacy?.state ?? null,
    version: revision?.version ?? 0,
    updatedAt: legacy?.updated_at,
    source: legacy?.state ? "legacy_snapshot" : "empty",
  }, { headers: { "cache-control": "private, no-store" } });
}
