import { NextResponse } from "next/server";
import {
  createPaymentCommandSchema,
  operationalPaymentSchema,
  type CreatePaymentCommandResult,
} from "@/lib/domain/payment-command";
import { isOrganizationEditor, requireOrganization } from "@/lib/supabase/auth-context";

const maxPayloadBytes = 32_000;

export async function POST(request: Request) {
  const context = await requireOrganization(request);
  if (context.error) return context.error;
  if (!isOrganizationEditor(context.role)) {
    return NextResponse.json({ error: "Konto nie ma dostępu do księgowania płatności." }, { status: 403 });
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > maxPayloadBytes) {
    return NextResponse.json({ error: "Transakcja jest zbyt duża." }, { status: 413 });
  }

  let body: unknown = null;
  try {
    body = JSON.parse(rawBody);
  } catch {
    // Walidacja poniżej zwraca wspólny, bezpieczny komunikat.
  }
  const parsed = createPaymentCommandSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Nieprawidłowe dane transakcji." }, { status: 400 });
  }

  const { payment } = parsed.data;
  const { data, error } = await context.supabase.rpc("create_operational_payment", {
    p_organization_id: context.organizationId,
    p_payment_id: payment.id,
    p_payment: payment,
    p_request_id: parsed.data.requestId,
    p_client_sent_at: parsed.data.clientSentAt,
    p_tab_id: parsed.data.tabId,
  });

  if (error) {
    if (error.code === "42501") {
      return NextResponse.json({ error: "Konto nie ma dostępu do księgowania płatności." }, { status: 403 });
    }
    if (error.code === "22023" || error.code === "22007" || error.code === "22003") {
      return NextResponse.json({ error: "Transakcja narusza reguły finansowe." }, { status: 422 });
    }
    return NextResponse.json({ error: "Nie udało się zaksięgować transakcji." }, { status: 500 });
  }

  const result = data as CreatePaymentCommandResult | null;
  if (!result) {
    return NextResponse.json({ error: "Baza zwróciła niepełny wynik zapisu." }, { status: 500 });
  }
  if (result.status === "booking_not_found") {
    return NextResponse.json({ error: "Powiązana rezerwacja nie istnieje." }, { status: 422 });
  }
  if (result.status === "cost_setting_not_found") {
    return NextResponse.json({ error: "Powiązane założenie kosztowe nie istnieje." }, { status: 422 });
  }
  if (result.status === "conflict") {
    return NextResponse.json({
      error: "Transakcja o tym identyfikatorze ma już inną treść.",
      requestId: parsed.data.requestId,
      conflictType: "payment_id",
      conflictId: payment.id,
      currentRecordVersion: result.recordVersion,
      detectedAt: new Date().toISOString(),
    }, { status: 409 });
  }

  const committedPayment = operationalPaymentSchema.safeParse(result.payment);
  if (
    !["committed", "already_committed"].includes(result.status)
    || !committedPayment.success
    || typeof result.recordVersion !== "number"
    || typeof result.stateVersion !== "number"
  ) {
    return NextResponse.json({ error: "Baza zwróciła niepełny wynik zapisu." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    idempotentReplay: result.status === "already_committed",
    requestId: parsed.data.requestId,
    payment: committedPayment.data,
    recordVersion: result.recordVersion,
    stateVersion: result.stateVersion,
    savedAt: result.savedAt,
  });
}
