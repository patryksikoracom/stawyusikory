import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendSmsApi } from "@/lib/integrations/smsapi";
import { isSmsDeliveryEnabled, smsDeliveryDisabledMessage } from "@/lib/integrations/outbound-delivery";
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

  const { data: messages, error } = await service
    .from("outbound_messages")
    .select("id,organization_id,recipient,body,attempts,important")
    .in("status", ["queued", "error"])
    .lt("attempts", 5)
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${new Date().toISOString()}`)
    .order("created_at", { ascending: true })
    .limit(20);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let sent = 0;
  let failed = 0;
  const eligible = (messages ?? []).filter((message) => message.attempts < (message.important ? 5 : 3));
  for (const message of eligible) {
    const result = await sendSmsApi(token, message.recipient, message.body);
    const attempts = message.attempts + 1;
    const retry = deliveryRetry({ attempts, now: new Date(), important: message.important });
    await service.from("outbound_messages").update({
      status: result.ok ? "sent" : "error",
      provider_response: result.provider,
      attempts,
      next_attempt_at: result.ok ? null : retry.nextAttemptAt ?? null,
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
