import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const payloadSchema = z.object({
  data: z.record(z.string(), z.unknown()),
  expectedVersion: z.number().int().nonnegative(),
});

const entityTypes = [
  "units", "bookings", "guests", "consents", "tasks", "media", "blocks",
  "rates", "imports", "sourceConnections", "payments", "invoices",
  "checklistItems", "issues", "messages", "settings",
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
  return NextResponse.json({ ok: true, version: Number(data) });
}
