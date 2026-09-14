import { readEmailQueue, type DueMessage } from "@/lib/integrations/read-email-queue";
import { isCurrentEmail, readCommunicationData } from "@/lib/integrations/current-email";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { deliveryRetry, isOutboundClaimable, normalizeDeliveryEmail } from "@/lib/integrations/delivery-queue";
import {
  defaultResendFromEmail,
  emailDeliveryDisabledMessage,
  isEmailDeliveryEnabled,
  sendResendEmail,
} from "@/lib/integrations/resend";

type OutboundMessage = {
  id: string;
  status: string;
  attempts: number;
  next_attempt_at: string | null;
  provider_message_id: string | null;
};

function configuredDailyLimit(value = process.env.STAWY_OS_EMAIL_DAILY_LIMIT) {
  const parsed = Number(value ?? "80");
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 80;
}

async function recordDelivery(
  service: NonNullable<ReturnType<typeof createServiceClient>>,
  message: DueMessage,
  status: "Zatwierdzona" | "Wysłana" | "Dostarczona" | "Błąd",
  providerResult: string,
  action: string,
) {
  return service.rpc("record_email_delivery_event", {
    p_organization_id: message.organization_id,
    p_scheduled_message_id: message.id,
    p_status: status,
    p_provider_result: providerResult.slice(0, 5_000),
    p_action: action,
  });
}

async function claimOutbound(
  service: NonNullable<ReturnType<typeof createServiceClient>>,
  message: DueMessage,
  important: boolean,
  now: Date,
) {
  const table = service.from("outbound_messages");
  const { data: existing, error: existingError } = await table
    .select("id,status,attempts,next_attempt_at,provider_message_id")
    .eq("organization_id", message.organization_id)
    .eq("idempotency_key", message.idempotency_key)
    .maybeSingle<OutboundMessage>();
  if (existingError) return { error: existingError.message };
  if (existing?.status === "sent" || existing?.status === "delivered") return { duplicate: true };
  if (existing && deliveryRetry({ attempts: existing.attempts, now, important }).exhausted) return { deferred: true };
  if (!isOutboundClaimable(existing, now)) return { deferred: true };

  if (existing) {
    const leaseUntil = new Date(now.getTime() + 10 * 60_000).toISOString();
    let claimQuery = service.from("outbound_messages")
      .update({ status: "processing", next_attempt_at: leaseUntil, updated_at: now.toISOString() })
      .eq("id", existing.id).eq("status", existing.status).eq("attempts", existing.attempts);
    claimQuery = existing.next_attempt_at === null
      ? claimQuery.is("next_attempt_at", null)
      : claimQuery.eq("next_attempt_at", existing.next_attempt_at);
    const { data: claimed, error } = await claimQuery
      .select("id,status,attempts,next_attempt_at,provider_message_id")
      .maybeSingle<OutboundMessage>();
    if (error) return { error: error.message };
    return claimed ? { row: claimed } : { deferred: true };
  }

  const { data: created, error } = await service.from("outbound_messages")
    .insert({
      organization_id: message.organization_id,
      booking_id: message.booking_id,
      scheduled_message_id: message.id,
      channel: "E-mail",
      recipient: message.recipient,
      subject: message.subject,
      sender: process.env.RESEND_FROM_EMAIL ?? defaultResendFromEmail,
      body: message.rendered_body,
      status: "processing",
      idempotency_key: message.idempotency_key,
      provider_response: { provider: "resend" },
      attempts: 0,
      next_attempt_at: new Date(now.getTime() + 10 * 60_000).toISOString(),
      important,
    })
    .select("id,status,attempts,next_attempt_at,provider_message_id")
    .single<OutboundMessage>();
  if (error?.code === "23505") return { deferred: true };
  if (error || !created) return { error: error?.message ?? "Nie udało się utworzyć kolejki e-mail." };
  return { row: created };
}

export async function POST(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Brak autoryzacji harmonogramu." }, { status: 401 });
  }
  if (!isEmailDeliveryEnabled()) {
    return NextResponse.json({ error: emailDeliveryDisabledMessage, deliveryEnabled: false }, { status: 423 });
  }
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    return NextResponse.json({ error: "Brak RESEND_API_KEY lub RESEND_FROM_EMAIL." }, { status: 503 });
  }
  const service = createServiceClient();
  if (!service) return NextResponse.json({ error: "Brak konfiguracji Supabase." }, { status: 503 });

  const now = new Date();
  const since = new Date(now.getTime() - 86_400_000).toISOString();
  const dailyLimit = configuredDailyLimit();
  const { count: sentInWindow, error: countError } = await service
    .from("outbound_messages")
    .select("id", { count: "exact", head: true })
    .eq("channel", "E-mail")
    .in("status", ["processing", "sent", "delivered"])
    .gte("created_at", since);
  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });
  if ((sentInWindow ?? 0) >= dailyLimit) {
    return NextResponse.json({ ok: true, processed: 0, sent: 0, failed: 0, deferredByDailyLimit: true, dailyLimit });
  }

  const remaining = Math.min(20, dailyLimit - (sentInWindow ?? 0));
  let due: DueMessage[];
  try {
    due = await readEmailQueue(service, now);
  } catch {
    return NextResponse.json({ error: "Nie udało się odczytać pełnej kolejki e-mail." }, { status: 503 });
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let processed = 0;
  let claimed = 0;
  for (const message of due) {
    if (claimed >= remaining) break;
    processed += 1;
    const recipient = normalizeDeliveryEmail(message.recipient ?? undefined);
    if (!recipient || !message.subject?.trim()) {
      skipped += 1;
      continue;
    }
    try {
      const currentData = await readCommunicationData(service, message.organization_id);
      if (!isCurrentEmail(currentData, message)) {
        skipped += 1;
        continue;
      }
    } catch {
      // Never send using a partial snapshot or a stale queue projection.
      failed += 1;
      continue;
    }
    const important = !/review|opini/i.test(message.rule_id);
    const claim = await claimOutbound(service, message, important, now);
    if (claim.error) {
      failed += 1;
      continue;
    }
    if (!claim.row) {
      skipped += 1;
      continue;
    }

    claimed += 1;
    const result = await sendResendEmail({
      to: recipient,
      subject: message.subject,
      text: message.rendered_body,
      idempotencyKey: message.idempotency_key,
      bookingId: message.booking_id,
      category: message.rule_id,
    });
    const attempts = claim.row.attempts + 1;
    if (result.ok) {
      await service.from("outbound_messages").update({
        status: "sent",
        provider_message_id: result.providerMessageId,
        provider_response: { provider: "resend", id: result.providerMessageId },
        attempts,
        next_attempt_at: null,
        last_error: null,
        updated_at: new Date().toISOString(),
      }).eq("id", claim.row.id);
      await recordDelivery(service, message, "Wysłana", result.providerMessageId, "email_sent");
      sent += 1;
      continue;
    }

    const retry = deliveryRetry({ attempts, now: new Date(), important });
    const quotaDelay = result.error === "daily_quota_exceeded"
      ? new Date(Date.now() + 24 * 60 * 60_000).toISOString()
      : result.error === "monthly_quota_exceeded"
        ? new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString()
        : undefined;
    await service.from("outbound_messages").update({
      status: "error",
      provider_response: result,
      attempts,
      next_attempt_at: result.retryable && !retry.exhausted ? quotaDelay ?? retry.nextAttemptAt ?? null : null,
      last_error: result.error,
      updated_at: new Date().toISOString(),
    }).eq("id", claim.row.id);
    await recordDelivery(service, message, "Błąd", JSON.stringify(result), retry.exhausted ? "email_retry_exhausted" : "email_send_failed");
    failed += 1;
  }

  return NextResponse.json({ ok: failed === 0, processed, sent, failed, skipped, dailyLimit });
}
