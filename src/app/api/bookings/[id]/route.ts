import { NextResponse } from "next/server";
import {
  bookingMutationAggregateSchema,
  updateBookingCommandSchema,
  type UpdateBookingCommandResult,
} from "@/lib/domain/booking-command";
import { isOrganizationEditor, requireOrganization } from "@/lib/supabase/auth-context";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const maxPayloadBytes = 512_000;

export async function PATCH(request: Request, { params }: RouteContext) {
  const context = await requireOrganization();
  if (context.error) return context.error;
  if (!isOrganizationEditor(context.role)) {
    return NextResponse.json({ error: "Konto nie ma dostępu do zapisu rezerwacji." }, { status: 403 });
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > maxPayloadBytes) {
    return NextResponse.json({ error: "Zmiana rezerwacji jest zbyt duża." }, { status: 413 });
  }

  const { id } = await params;
  let body: unknown = null;
  try {
    body = JSON.parse(rawBody);
  } catch {
    // Walidacja poniżej zwraca jeden bezpieczny komunikat.
  }
  const parsed = updateBookingCommandSchema.safeParse(body);
  if (!parsed.success || parsed.data.aggregate.booking.id !== id) {
    return NextResponse.json({ error: "Nieprawidłowe dane rezerwacji." }, { status: 400 });
  }

  const { aggregate } = parsed.data;
  const { data, error } = await context.supabase.rpc("mutate_operational_booking", {
    p_organization_id: context.organizationId,
    p_booking_id: id,
    p_expected_record_version: parsed.data.expectedRecordVersion,
    p_booking: aggregate.booking,
    p_contact: aggregate.contact ?? null,
    p_tasks: aggregate.tasks,
    p_scheduled_messages: aggregate.scheduledMessages,
    p_operation: parsed.data.operation,
    p_request_id: parsed.data.requestId,
    p_client_sent_at: parsed.data.clientSentAt,
    p_tab_id: parsed.data.tabId,
  });

  if (error) {
    if (error.code === "42501") {
      return NextResponse.json({ error: "Konto nie ma dostępu do zapisu rezerwacji." }, { status: 403 });
    }
    if (error.code === "22023" || error.code === "22007") {
      return NextResponse.json({ error: "Rezerwacja narusza reguły operacyjne." }, { status: 422 });
    }
    return NextResponse.json({ error: "Nie udało się zapisać rezerwacji." }, { status: 500 });
  }

  const result = data as UpdateBookingCommandResult | null;
  if (!result || result.status === "not_found") {
    return NextResponse.json({ error: "Rezerwacja nie istnieje." }, { status: 404 });
  }
  if (result.status === "unit_not_found") {
    return NextResponse.json({ error: "Wybrany domek nie istnieje." }, { status: 422 });
  }
  if (result.status === "conflict" || result.status === "related_record_conflict") {
    return NextResponse.json({
      error: result.status === "conflict"
        ? "Ta rezerwacja zmieniła się na innym urządzeniu."
        : "Powiązane dane rezerwacji zmieniły się na innym urządzeniu.",
      requestId: parsed.data.requestId,
      expectedRecordVersion: parsed.data.expectedRecordVersion,
      currentRecordVersion: result.status === "conflict"
        ? result.recordVersion
        : result.conflictRecordVersion,
      conflictEntityType: result.conflictEntityType,
      conflictId: result.conflictId,
      detectedAt: new Date().toISOString(),
    }, { status: 409 });
  }
  if (result.status === "availability_conflict") {
    return NextResponse.json({
      error: result.conflictType === "block"
        ? "Termin koliduje z aktywną blokadą domku."
        : "Termin koliduje z inną rezerwacją.",
      requestId: parsed.data.requestId,
      expectedRecordVersion: parsed.data.expectedRecordVersion,
      currentRecordVersion: result.recordVersion,
      conflictType: result.conflictType,
      conflictId: result.conflictId,
      detectedAt: new Date().toISOString(),
    }, { status: 409 });
  }

  const committedAggregate = bookingMutationAggregateSchema.safeParse(result.aggregate);
  if (
    result.status !== "committed"
    || !committedAggregate.success
    || !result.recordVersion
    || typeof result.stateVersion !== "number"
  ) {
    return NextResponse.json({ error: "Baza zwróciła niepełny wynik zapisu." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    requestId: parsed.data.requestId,
    aggregate: committedAggregate.data,
    recordVersion: result.recordVersion,
    stateVersion: result.stateVersion,
    savedAt: result.savedAt,
  });
}
