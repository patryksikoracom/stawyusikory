import { NextResponse } from "next/server";
import type { WebhookEventPayload } from "resend";
import { verifyResendWebhook } from "@/lib/integrations/resend";
import { createServiceClient } from "@/lib/supabase/server";

function failureReason(event: WebhookEventPayload) {
  if (event.type === "email.bounced") return event.data.bounce.message;
  if (event.type === "email.failed") return event.data.failed.reason;
  if (event.type === "email.suppressed") return event.data.suppressed.message;
  if (event.type === "email.complained") return "Odbiorca oznaczył wiadomość jako spam.";
  if (event.type === "email.delivery_delayed") return "Dostawa została czasowo opóźniona.";
  return undefined;
}

export async function POST(request: Request) {
  const payload = await request.text();
  let verified: ReturnType<typeof verifyResendWebhook>;
  try {
    verified = verifyResendWebhook(payload, request.headers);
  } catch {
    return NextResponse.json({ error: "Nieprawidłowy podpis webhooka." }, { status: 401 });
  }
  const event = verified.event;
  if (!("email_id" in event.data)) return NextResponse.json({ ok: true, ignored: true });

  const service = createServiceClient();
  if (!service) return NextResponse.json({ error: "Brak konfiguracji Supabase." }, { status: 503 });
  const { data, error } = await service.rpc("apply_resend_webhook", {
    p_event_id: verified.eventId,
    p_provider_message_id: event.data.email_id,
    p_event_type: event.type,
    p_occurred_at: event.created_at,
    p_reason: failureReason(event) ?? null,
  });
  if (error) return NextResponse.json({ error: "Nie udało się zapisać zdarzenia dostawy." }, { status: 503 });
  if (!data || data.unmatched) {
    // The callback can beat persistence of the provider ID. Ask Resend to
    // retry instead of acknowledging and permanently losing the receipt.
    return NextResponse.json({ error: "Oczekiwanie na zapis wiadomości." }, { status: 503 });
  }
  return NextResponse.json(data);
}
