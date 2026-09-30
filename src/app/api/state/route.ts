import { readOperationalState } from "@/lib/supabase/read-operational-state";
import { NextResponse } from "next/server";
import { isGeneralStateReader } from "@/lib/auth/permissions";
import { visibleOperationalRecord } from "@/lib/auth/state-visibility";
import { requireOrganization } from "@/lib/supabase/auth-context";
import { createServiceClient } from "@/lib/supabase/server";
import { calculateBookingFinance } from "@/lib/metrics/finance";
import type { Booking, PaymentTransaction } from "@/lib/types";
import {
  isCompatibleDatabaseRelease,
  releaseIdentity,
  type DatabaseReleaseManifest,
} from "@/lib/release";

const entityTypes = [
  "units", "bookings", "people", "guests", "consents", "consentLedger", "reviewRequests", "communicationConfigs", "adSpend", "growthExperiments", "investmentModels", "meterReadings", "tasks", "media", "blocks",
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

  const { data: databaseRelease, error: releaseError } = await service
    .from("app_release_manifest")
    .select("schema_version,required_migration,applied_at")
    .eq("singleton", true)
    .maybeSingle();
  if (releaseError || !isCompatibleDatabaseRelease(databaseRelease as DatabaseReleaseManifest | null)) {
    return NextResponse.json({
      error: "Wersja aplikacji nie jest zgodna ze schematem bazy. Dane nie zostały otwarte.",
      release: releaseIdentity(),
    }, { status: 503, headers: { "cache-control": "private, no-store" } });
  }

  let snapshot: Awaited<ReturnType<typeof readOperationalState>>;
  try {
    snapshot = await readOperationalState(service, result.organizationId);
  } catch {
    return NextResponse.json({ error: "Nie udało się pobrać kompletnego, spójnego stanu. Spróbuj ponownie." }, { status: 503 });
  }
  const { records, revision } = snapshot;

  const operatorPaymentSummaries = new Map<string, Record<string, unknown>>();
  if (result.role === "manager") {
    const payments = (records ?? [])
      .filter((record) => record.entity_type === "payments")
      .map((record) => record.payload as PaymentTransaction);
    for (const record of records ?? []) {
      if (record.entity_type !== "bookings") continue;
      const finance = calculateBookingFinance(record.payload as Booking, payments);
      operatorPaymentSummaries.set(record.entity_id, {
        currency: finance.currency,
        bookingValue: finance.bookingValue,
        paid: finance.guestPaidNet,
        balance: finance.balance,
        amountDue: finance.amountDue,
        overpayment: finance.overpayment,
        balanceStatus: finance.balanceStatus,
        completeness: finance.perspectives.receivables.completeness,
      });
    }
  }

  const visibleRecords = (records ?? [])
    .map((record) => visibleOperationalRecord(
      record,
      result.role,
      operatorPaymentSummaries.get(record.entity_id),
    ))
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
        || type === "people"
        || type === "consents"
        || type === "consentLedger"
        || type === "reviewRequests"
        || type === "communicationConfigs"
        || type === "adSpend"
        || type === "growthExperiments"
        || type === "investmentModels"
        || type === "meterReadings"
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
      release: releaseIdentity(),
    }, { headers: { "cache-control": "private, no-store" } });
  }

  if (result.role !== "owner" && result.role !== "admin") {
    return NextResponse.json({
      data: null,
      version: revision?.version ?? 0,
      updatedAt: revision?.updated_at,
      source: "empty",
      release: releaseIdentity(),
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
    release: releaseIdentity(),
  }, { headers: { "cache-control": "private, no-store" } });
}
