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
  const { data: outbound, error } = await service
    .from("outbound_messages")
    .select("id,organization_id,scheduled_message_id,status")
    .eq("provider_message_id", event.data.email_id)
    .maybeSingle<{
      id: string;
      organization_id: string;
      scheduled_message_id: string | null;
      status: string;
    }>();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!outbound) return NextResponse.json({ ok: true, unmatched: true }, { status: 202 });

  const reason = failureReason(event);
  const { error: eventError } = await service.from("email_webhook_events").insert({
    id: verified.eventId,
    organization_id: outbound.organization_id,
    provider_message_id: event.data.email_id,
    event_type: event.type,
    occurred_at: event.created_at,
    reason,
  });
  if (eventError?.code === "23505") return NextResponse.json({ ok: true, duplicate: true });
  if (eventError) return NextResponse.json({ error: eventError.message }, { status: 500 });

  const isFailure = ["email.bounced", "email.complained", "email.failed", "email.suppressed"].includes(event.type);
  const isDelivered = event.type === "email.delivered";
  const isSent = event.type === "email.sent";
  if (!isFailure && !isDelivered && !isSent) return NextResponse.json({ ok: true, recorded: true });

  const nextStatus = isFailure ? "error" : isDelivered ? "delivered" : outbound.status === "delivered" ? "delivered" : "sent";
  const { error: updateError } = await service.from("outbound_messages").update({
    status: nextStatus,
    delivered_at: isDelivered ? event.created_at : undefined,
    last_error: isFailure ? event.type : null,
    provider_response: { provider: "resend", event: event.type, reason },
    updated_at: new Date().toISOString(),
  }).eq("id", outbound.id);
  if (updateError) {
    await service.from("email_webhook_events").delete().eq("id", verified.eventId);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (outbound.scheduled_message_id) {
    const { error: rpcError } = await service.rpc("record_email_delivery_event", {
      p_organization_id: outbound.organization_id,
      p_scheduled_message_id: outbound.scheduled_message_id,
      p_status: isFailure ? "Błąd" : isDelivered ? "Dostarczona" : "Wysłana",
      p_provider_result: `${event.type}:${event.data.email_id}${reason ? `:${reason}` : ""}`.slice(0, 5_000),
      p_action: event.type.replaceAll(".", "_"),
    });
    if (rpcError) {
      await service.from("email_webhook_events").delete().eq("id", verified.eventId);
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, status: nextStatus });
}
