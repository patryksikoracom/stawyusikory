import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendSmsApi } from "@/lib/integrations/smsapi";
import { isSmsDeliveryEnabled, smsDeliveryDisabledMessage } from "@/lib/integrations/outbound-delivery";
import { readSmsQueue } from "@/lib/integrations/read-sms-queue";
import { deliveryRetry } from "@/lib/integrations/delivery-queue";

export async function POST(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Brak autoryzacji harmonogramu." }, { status: 401 });
  }
  if (!isSmsDeliveryEnabled()) return NextResponse.json({ error: smsDeliveryDisabledMessage, deliveryEnabled: false }, { status: 423 });
  const token = process.env.SMSAPI_TOKEN;
  const service = createServiceClient();
  if (!token || !service) return NextResponse.json({ error: "Brak konfiguracji SMSAPI lub Supabase." }, { status: 503 });

  let eligible;
  try {
    eligible = await readSmsQueue(service, new Date());
  } catch {
    return NextResponse.json({ error: "Nie udało się pobrać kolejki SMS." }, { status: 503 });
  }
  let sent = 0;
  let failed = 0;
  for (const message of eligible) {
    let claimQuery = service.from("outbound_messages")
      .update({ status: "processing", next_attempt_at: null, updated_at: new Date().toISOString() })
      .eq("id", message.id).eq("status", message.status).eq("attempts", message.attempts);
    claimQuery = message.next_attempt_at === null
      ? claimQuery.is("next_attempt_at", null)
      : claimQuery.eq("next_attempt_at", message.next_attempt_at);
    const { data: claimed, error: claimError } = await claimQuery.select("id").maybeSingle();
    if (claimError) { failed += 1; continue; }
    if (!claimed) continue;
    const result = await sendSmsApi(token, message.recipient, message.body);
    const attempts = message.attempts + 1;
    const retry = deliveryRetry({ attempts, now: new Date(), important: message.important });
    await service.from("outbound_messages").update({
      status: result.ok ? "sent" : "error",
      provider_response: result.provider,
      attempts,
      next_attempt_at: !result.ok && result.retryable ? retry.nextAttemptAt ?? null : null,
      last_error: result.ok ? null : "provider_rejected_or_unavailable",
      updated_at: new Date().toISOString(),
    }).eq("id", message.id);
    if (!result.ok && retry.alertOwner) {
      await service.from("audit_events").insert({
        organization_id: message.organization_id,
        entity_type: "outbound_message",
        entity_id: message.id,
        action: "delivery_retry_exhausted",
        payload: { attempts, important: true },
      });
    }
    if (result.ok) sent += 1;
    else failed += 1;
  }
  return NextResponse.json({ ok: failed === 0, processed: eligible.length, sent, failed });
}
