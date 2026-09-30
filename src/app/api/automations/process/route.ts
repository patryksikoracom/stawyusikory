import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { deliveryRetry, isOutboundClaimable, normalizeDeliveryEmail } from "@/lib/integrations/delivery-queue";
import { readEmailQueue } from "@/lib/integrations/read-email-queue";
import { isCurrentEmail, readCommunicationData } from "@/lib/integrations/current-email";
import {
  defaultResendFromEmail,
  emailDeliveryDisabledMessage,
  isEmailDeliveryEnabled,
  sendResendEmail,
} from "@/lib/integrations/resend";

type DueMessage = {
  id: string;
  organization_id: string;
  booking_id: string;
  rule_id: string;
  due_at: string;
  recipient: string | null;
  subject: string | null;
  rendered_body: string;
  status: "Zatwierdzona" | "Błąd";
  blocked_reason: string | null;
  idempotency_key: string;
};

type OutboundMessage = {
  id: string;
  status: string;
  attempts: number;
  next_attempt_at: string | null;
  provider_message_id: string | null;
  created_at: string;
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
    .select("id,status,attempts,next_attempt_at,provider_message_id,created_at")
    .eq("organization_id", message.organization_id)
    .eq("idempotency_key", message.idempotency_key)
    .maybeSingle<OutboundMessage>();
  if (existingError) return { error: existingError.message };
  if (existing?.status === "sent" || existing?.status === "delivered") return { duplicate: true };
  // null means a terminal failure, not an immediate retry.
  if (existing?.status === "error" && (!existing.next_attempt_at || existing.attempts >= (important ? 5 : 3))) return { deferred: true };
  if (!isOutboundClaimable(existing, now)) return { deferred: true };
  // Resend deduplicates for 24h. Stop uncertain retries before that window expires.
  if (existing && now.getTime() - new Date(existing.created_at).getTime() >= 23 * 60 * 60_000) {
    await service.from("outbound_messages").update({ status: "error", next_attempt_at: null,
      last_error: "retry_window_expired: sprawdź dostarczenie w Resend przed ponowną wysyłką" })
      .eq("id", existing.id).eq("status", existing.status);
    await recordDelivery(service, message, "Błąd", "Wygasło bezpieczne okno ponowień. Sprawdź dostarczenie w Resend.", "email_retry_window_expired");
    return { error: "email_retry_window_expired" };
  }


  if (existing) {
    const leaseUntil = new Date(now.getTime() + 10 * 60_000).toISOString();
    let update = service.from("outbound_messages")
      .update({ status: "processing", next_attempt_at: leaseUntil, updated_at: now.toISOString() })
      .eq("id", existing.id)
      .eq("status", existing.status)
      .eq("attempts", existing.attempts);
    update = existing.next_attempt_at === null ? update.is("next_attempt_at", null)
      : update.eq("next_attempt_at", existing.next_attempt_at);
    const { data: claimed, error } = await update
      .select("id,status,attempts,next_attempt_at,provider_message_id,created_at")
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
    .select("id,status,attempts,next_attempt_at,provider_message_id,created_at")
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
  try { due = await readEmailQueue(service, now); }
  catch { return NextResponse.json({ error: "Nie udało się odczytać kompletnej kolejki." }, { status: 503 }); }

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (const message of due) {
    if (sent + failed >= remaining) break;
    const recipient = normalizeDeliveryEmail(message.recipient ?? undefined);
    if (!recipient || !message.subject?.trim()) {
      skipped += 1;
      continue;
    }
    const important = !/review|opini/i.test(message.rule_id);
    // Re-read the authoritative booking and consent before every attempt.
    // Cancellation, edits and expired arrival messages invalidate old queue rows.
    try {
      if (!isCurrentEmail(await readCommunicationData(service, message.organization_id), message)) {
        skipped += 1;
        continue;
      }
    } catch {
      failed += 1;
      continue;
    }
    const claim = await claimOutbound(service, message, important, now);
    if (claim.error) {
      failed += 1;
      continue;
    }
    if (!claim.row) {
      skipped += 1;
      continue;
    }

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
      const saved = await service.rpc("complete_email_send", {
        p_outbound_id: claim.row.id,
        p_provider_message_id: result.providerMessageId,
        p_attempts: attempts,
      });
      if (saved.error) { failed += 1; continue; }
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

  return NextResponse.json({ ok: failed === 0, processed: sent + failed + skipped, sent, failed, skipped, dailyLimit }, { status: failed ? 503 : 200 });
}
