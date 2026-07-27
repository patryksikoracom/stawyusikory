import { NextResponse } from "next/server";
import {
  bookingAggregateSchema,
  createBookingCommandSchema,
  type CreateBookingCommandResult,
} from "@/lib/domain/booking-command";
import { isBookingOperator, requireOrganization } from "@/lib/supabase/auth-context";

const maxPayloadBytes = 512_000;

export async function POST(request: Request) {
  const context = await requireOrganization(request);
  if (context.error) return context.error;
  if (!isBookingOperator(context.role)) {
    return NextResponse.json({ error: "Konto nie ma dostępu do tworzenia rezerwacji." }, { status: 403 });
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > maxPayloadBytes) {
    return NextResponse.json({ error: "Rezerwacja jest zbyt duża." }, { status: 413 });
  }

  let body: unknown = null;
  try {
    body = JSON.parse(rawBody);
  } catch {
    // Walidacja poniżej zwraca jeden bezpieczny komunikat dla klienta.
  }
  const parsed = createBookingCommandSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Nieprawidłowe dane rezerwacji." }, { status: 400 });
  }

  const { aggregate } = parsed.data;
  const { data, error } = await context.supabase.rpc("create_operational_booking", {
    p_organization_id: context.organizationId,
    p_booking_id: aggregate.booking.id,
    p_booking: aggregate.booking,
    p_contact: aggregate.contact ?? null,
    p_tasks: aggregate.tasks,
    p_checklist_items: aggregate.checklistItems,
    p_scheduled_messages: aggregate.scheduledMessages,
    p_request_id: parsed.data.requestId,
    p_client_sent_at: parsed.data.clientSentAt,
    p_tab_id: parsed.data.tabId,
  });

  if (error) {
    if (error.code === "42501") {
      return NextResponse.json({ error: "Konto nie ma dostępu do tworzenia rezerwacji." }, { status: 403 });
    }
    if (error.code === "22023" || error.code === "22007") {
      return NextResponse.json({ error: "Rezerwacja narusza reguły operacyjne." }, { status: 422 });
    }
    return NextResponse.json({ error: "Nie udało się utworzyć rezerwacji." }, { status: 500 });
  }

  const result = data as CreateBookingCommandResult | null;
  if (!result) {
    return NextResponse.json({ error: "Baza zwróciła niepełny wynik zapisu." }, { status: 500 });
  }
  if (result.status === "unit_not_found") {
    return NextResponse.json({ error: "Wybrany domek nie istnieje." }, { status: 422 });
  }
  if (result.status === "exists") {
    return NextResponse.json({
      error: "Rezerwacja o tym identyfikatorze już istnieje.",
      requestId: parsed.data.requestId,
      conflictType: "booking_id",
      conflictId: aggregate.booking.id,
      detectedAt: new Date().toISOString(),
    }, { status: 409 });
  }
  if (result.status === "availability_conflict") {
    return NextResponse.json({
      error: result.conflictType === "block"
        ? "Termin koliduje z aktywną blokadą domku."
        : "Termin koliduje z inną rezerwacją.",
      requestId: parsed.data.requestId,
      conflictType: result.conflictType,
      conflictId: result.conflictId,
      detectedAt: new Date().toISOString(),
    }, { status: 409 });
  }
  const committedAggregate = bookingAggregateSchema.safeParse(result.aggregate);
  if (
    !["committed", "already_committed"].includes(result.status)
    || !committedAggregate.success
    || typeof result.stateVersion !== "number"
  ) {
    return NextResponse.json({ error: "Baza zwróciła niepełny wynik zapisu." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    idempotentReplay: result.status === "already_committed",
    requestId: parsed.data.requestId,
    aggregate: committedAggregate.data,
    stateVersion: result.stateVersion,
    savedAt: result.savedAt,
  });
}
