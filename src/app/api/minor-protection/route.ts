import { NextResponse } from "next/server";
import { z } from "zod";
import {
  canExecuteMinorProtection,
  canManageMinorProtectionStandard,
} from "@/lib/compliance/minor-protection";
import { requireOrganization } from "@/lib/supabase/auth-context";
import { createServiceClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";
import { todayInPoland } from "@/lib/date";

const httpsUrl = z.string().url().refine((value) => value.startsWith("https://"));
const activateStandardSchema = z.object({
  action: z.literal("activate_standard"),
  standard: z.object({
    version: z.string().trim().min(1).max(40),
    approvedAt: z.iso.date(),
    effectiveFrom: z.iso.date(),
    reviewDueAt: z.iso.date(),
    fullDocumentUrl: httpsUrl,
    childFriendlyDocumentUrl: httpsUrl,
    reviewOwner: z.string().trim().min(2).max(120),
    staffPreparationReference: z.string().trim().min(2).max(160),
    publicationConfirmed: z.literal(true),
    premisesDisplayConfirmed: z.literal(true),
    steps: z.array(z.string().trim().min(2).max(300)).min(1).max(20),
  }),
});

const mutationSchema = z.discriminatedUnion("action", [
  activateStandardSchema,
  z.object({
    action: z.literal("complete"),
    bookingId: z.string().min(1).max(160),
    outcome: z.enum(["Bez uwag", "Wymaga reakcji"]),
  }),
  z.object({
    action: z.literal("acknowledge_reaction"),
    bookingId: z.string().min(1).max(160),
  }),
  z.object({
    action: z.literal("close_reaction"),
    bookingId: z.string().min(1).max(160),
    resolutionReference: z.string().trim().min(2).max(200),
  }),
]);

type OperationalRecord = {
  entity_type: string;
  entity_id: string;
  payload: Record<string, unknown>;
};

function forbidden() {
  return NextResponse.json(
    { error: "Brak uprawnień do procedury ochrony małoletnich." },
    { status: 403 },
  );
}

function recordsOf(records: OperationalRecord[], entityType: string) {
  return records.filter((record) => record.entity_type === entityType);
}

export async function GET(request: Request) {
  const context = await requireOrganization(request);
  if (context.error) return context.error;
  if (!canExecuteMinorProtection(context.role as UserRole)) return forbidden();
  const service = createServiceClient();
  if (!service) return NextResponse.json({ error: "Moduł zgodności nie jest skonfigurowany." }, { status: 503 });

  const { data, error } = await service
    .from("operational_records")
    .select("entity_type,entity_id,payload")
    .eq("organization_id", context.organizationId)
    .in("entity_type", [
      "bookings",
      "units",
      "minorProtectionStandards",
      "minorProtectionExecutions",
      "minorProtectionReactions",
    ]);
  if (error) return NextResponse.json({ error: "Nie udało się pobrać procedury." }, { status: 500 });

  const records = (data ?? []) as OperationalRecord[];
  const standards = recordsOf(records, "minorProtectionStandards")
    .map((record) => record.payload)
    .sort((left, right) => String(right.effectiveFrom ?? "").localeCompare(String(left.effectiveFrom ?? "")));
  const activeStandard = standards.find((standard) => standard.active === true) ?? null;
  const units = new Map(recordsOf(records, "units").map((record) => [
    record.entity_id,
    String(record.payload.name ?? "Domek"),
  ]));
  const executions = new Map(recordsOf(records, "minorProtectionExecutions").map((record) => [
    record.entity_id,
    record.payload,
  ]));
  const reactions = new Map(recordsOf(records, "minorProtectionReactions").map((record) => [
    record.entity_id,
    record.payload,
  ]));
  const today = todayInPoland();
  const stays = recordsOf(records, "bookings")
    .filter((record) =>
      Number(record.payload.children ?? 0) > 0
      && record.payload.workflowStatus !== "Anulowana"
      && !record.payload.deletedAt
      && String(record.payload.checkOut ?? "") >= today
    )
    .map((record) => ({
      bookingId: record.entity_id,
      unitId: String(record.payload.unitId ?? ""),
      unitName: units.get(String(record.payload.unitId ?? "")) ?? "Domek",
      checkIn: String(record.payload.checkIn ?? ""),
      checkOut: String(record.payload.checkOut ?? ""),
      execution: executions.get(record.entity_id) ?? null,
      reaction: reactions.get(record.entity_id) ?? null,
    }))
    .sort((left, right) => left.checkIn.localeCompare(right.checkIn));

  return NextResponse.json(
    { activeStandard, standards, stays },
    { headers: { "cache-control": "private, no-store", "x-content-type-options": "nosniff" } },
  );
}

export async function POST(request: Request) {
  const context = await requireOrganization(request);
  if (context.error) return context.error;
  const parsed = mutationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Nieprawidłowe dane procedury." }, { status: 400 });

  const payload = parsed.data;
  const role = context.role as UserRole;
  if (payload.action === "activate_standard") {
    if (!canManageMinorProtectionStandard(role)) return forbidden();
  } else if (!canExecuteMinorProtection(role)) {
    return forbidden();
  }
  if (
    (payload.action === "acknowledge_reaction" || payload.action === "close_reaction")
    && !canManageMinorProtectionStandard(role)
  ) {
    return forbidden();
  }

  const details = payload.action === "activate_standard"
    ? payload.standard
    : payload.action === "complete"
      ? { outcome: payload.outcome }
      : payload.action === "close_reaction"
        ? { resolutionReference: payload.resolutionReference }
        : {};
  const service = createServiceClient();
  if (!service) return NextResponse.json({ error: "Moduł zgodności nie jest skonfigurowany." }, { status: 503 });
  const { data, error } = await service.rpc("mutate_minor_protection", {
    p_organization_id: context.organizationId,
    p_actor: context.user.id,
    p_action: payload.action,
    p_booking_id: payload.action === "activate_standard" ? null : payload.bookingId,
    p_details: details,
  });
  if (error) {
    const status = error.code === "42501"
      ? 403
      : error.code === "22023" || error.code === "22007"
        ? 422
        : error.code === "23505"
          ? 409
          : 500;
    const safeMessage = error.message.includes("SOP")
      ? "Brak właściwego, aktywnego SOP dla tego pobytu."
      : error.code === "23505"
        ? "Procedura dla tego pobytu została już zapisana."
        : "Nie udało się zapisać procedury.";
    return NextResponse.json({ error: safeMessage }, { status });
  }
  return NextResponse.json({ ok: true, version: Number(data) });
}
