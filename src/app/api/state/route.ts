import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const payloadSchema = z.object({
  data: z.record(z.string(), z.unknown()),
  expectedVersion: z.number().int().nonnegative(),
});

const entityTypes = [
  "units", "bookings", "guests", "consents", "tasks", "media", "blocks",
  "rates", "costSettings", "imports", "sourceConnections", "payments", "invoices",
  "checklistItems", "issues", "messages", "departureDebriefs", "messageTemplates",
  "automationRules", "scheduledMessages", "marketingTouchpoints", "auditLog", "settings",
] as const;

type EntityType = (typeof entityTypes)[number];

async function context() {
  const supabase = await createClient();
  if (!supabase) return { error: NextResponse.json({ error: "Supabase nie jest skonfigurowany" }, { status: 503 }) };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Wymagane logowanie" }, { status: 401 }) };
  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) return { error: NextResponse.json({ error: "Brak organizacji użytkownika" }, { status: 403 }) };
  return { supabase, organizationId: membership.organization_id };
}

function isBundledDemoState(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const bookings = (value as { bookings?: unknown }).bookings;
  if (!Array.isArray(bookings)) return false;
  const ids = new Set(bookings.map((booking) => String((booking as { id?: unknown })?.id ?? "")));
  return ["G001", "G002", "G003", "G004"].every((id) => ids.has(id));
}

function arrayOfRecords(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object") : [];
}

async function syncCommunicationRows(supabase: Awaited<ReturnType<typeof createClient>>, organizationId: string, state: Record<string, unknown>) {
  if (!supabase) return "Supabase nie jest skonfigurowany";
  const templates = arrayOfRecords(state.messageTemplates).map((item) => ({ organization_id: organizationId, id: item.id, name: item.name, purpose: item.purpose, channel: item.channel, language: item.language, subject: item.subject, body: item.body, allowed_variables: item.allowedVariables, version: item.version, active: item.active }));
  const rules = arrayOfRecords(state.automationRules).map((item) => ({ organization_id: organizationId, id: item.id, name: item.name, template_id: item.templateId, trigger_event: item.trigger, offset_days: item.offsetDays, send_time: item.sendTime, mode: item.mode, conditions: { channels: item.channels, unitIds: item.unitIds, paymentStatuses: item.paymentStatuses, minimumNights: item.minimumNights }, active: item.active }));
  const messages = arrayOfRecords(state.scheduledMessages).map((item) => ({ organization_id: organizationId, id: item.id, booking_id: item.bookingId, rule_id: item.ruleId, template_id: item.templateId, template_version: item.templateVersion, due_at: item.dueAt, channel: item.channel, recipient: item.recipient, subject: item.subject, rendered_body: item.renderedBody, status: item.status, blocked_reason: item.blockedReason, approved_at: item.approvedAt, provider_result: item.providerResult ? { result: item.providerResult } : null, idempotency_key: item.idempotencyKey, booking_fingerprint: item.bookingFingerprint, created_at: item.createdAt }));
  const debriefs = arrayOfRecords(state.departureDebriefs).map((item) => ({ organization_id: organizationId, id: item.id, booking_id: item.bookingId, status: item.status, payload: item, last_prompted_at: item.lastPromptedAt, snoozed_until: item.snoozedUntil, completed_at: item.completedAt }));
  const touchpoints = arrayOfRecords(state.marketingTouchpoints).map((item) => ({ organization_id: organizationId, id: item.id, booking_id: item.bookingId, recorded_at: item.recordedAt, source: item.source, method: item.method, utm_source: item.utmSource, utm_medium: item.utmMedium, utm_campaign: item.utmCampaign, utm_content: item.utmContent, landing_page: item.landingPage, note: item.note }));
  if (templates.length) { const { error } = await supabase.from("message_templates").upsert(templates, { onConflict: "organization_id,id" }); if (error) return `message_templates: ${error.message}`; }
  if (rules.length) { const { error } = await supabase.from("automation_rules").upsert(rules, { onConflict: "organization_id,id" }); if (error) return `automation_rules: ${error.message}`; }
  if (messages.length) { const { error } = await supabase.from("scheduled_messages").upsert(messages, { onConflict: "organization_id,id" }); if (error) return `scheduled_messages: ${error.message}`; }
  if (debriefs.length) { const { error } = await supabase.from("departure_debriefs").upsert(debriefs, { onConflict: "organization_id,id" }); if (error) return `departure_debriefs: ${error.message}`; }
  if (touchpoints.length) { const { error } = await supabase.from("marketing_touchpoints").upsert(touchpoints, { onConflict: "organization_id,id" }); if (error) return `marketing_touchpoints: ${error.message}`; }
}

export async function GET() {
  const result = await context();
  if (result.error) return result.error;

  const [{ data: records, error: recordsError }, { data: revision, error: revisionError }] = await Promise.all([
    result.supabase!
      .from("operational_records")
      .select("entity_type,entity_id,payload")
      .eq("organization_id", result.organizationId),
    result.supabase!
      .from("operational_state_versions")
      .select("version,updated_at")
      .eq("organization_id", result.organizationId)
      .maybeSingle(),
  ]);

  if (recordsError || revisionError) {
    const missingTable = recordsError?.code === "42P01" || revisionError?.code === "42P01";
    if (!missingTable) return NextResponse.json({ error: recordsError?.message ?? revisionError?.message }, { status: 500 });
  }

  if (records?.length) {
    const state = Object.fromEntries(entityTypes.map((type) => [type, type === "settings" ? null : []])) as Record<EntityType, unknown>;
    for (const record of records) {
      const type = record.entity_type as EntityType;
      if (!entityTypes.includes(type)) continue;
      if (type === "settings") state.settings = record.payload;
      else (state[type] as unknown[]).push(record.payload);
    }
    return NextResponse.json({
      data: state,
      version: revision?.version ?? 0,
      updatedAt: revision?.updated_at,
      source: "records",
    });
  }

  const { data: legacy, error: legacyError } = await result.supabase!
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
    });
  }

  return NextResponse.json({
    data: legacy?.state ?? null,
    version: revision?.version ?? 0,
    updatedAt: legacy?.updated_at,
    source: legacy?.state ? "legacy_snapshot" : "empty",
  });
}

export async function PUT(request: Request) {
  const result = await context();
  if (result.error) return result.error;
  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Nieprawidłowy stan aplikacji" }, { status: 400 });
  if (isBundledDemoState(parsed.data.data)) {
    return NextResponse.json({ error: "Dane demonstracyjne zostały zablokowane przed zapisem do chmury." }, { status: 422 });
  }

  const { data, error } = await result.supabase!.rpc("replace_operational_state", {
    p_expected_version: parsed.data.expectedVersion,
    p_state: parsed.data.data,
  });
  if (error) {
    if (error.code === "40001" || error.message.includes("Wersja danych uległa zmianie")) {
      return NextResponse.json({ error: "Dane zmieniły się na innym urządzeniu. Odśwież aplikację." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const workflowSyncWarning = await syncCommunicationRows(result.supabase!, result.organizationId, parsed.data.data);
  return NextResponse.json({ ok: true, version: Number(data), workflowSyncWarning });
}
