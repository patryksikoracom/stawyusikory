import type { AppData, ScheduledMessage } from "@/lib/types";
import { hasActiveConsent } from "@/lib/compliance/consent-ledger";
import { normalizeGuestPhone } from "@/lib/crm/guest-identity";

export type ProviderDeliveryStatus = "queued" | "sent" | "delivered" | "error" | "rejected";

export function normalizeE164(value?: string) {
  const normalized = normalizeGuestPhone(value);
  return normalized?.startsWith("+") && /^\+[1-9]\d{8,14}$/.test(normalized)
    ? normalized
    : undefined;
}

export function normalizeDeliveryEmail(value?: string) {
  const email = value?.trim().toLowerCase();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return undefined;
  return email;
}

export function deliveryRetry(input: { attempts: number; now: Date; important: boolean }) {
  const maxAttempts = input.important ? 5 : 3;
  const exhausted = input.attempts >= maxAttempts;
  const backoffMinutes = Math.min(2 ** Math.max(0, input.attempts) * 5, 360);
  return {
    exhausted,
    maxAttempts,
    nextAttemptAt: exhausted
      ? undefined
      : new Date(input.now.getTime() + backoffMinutes * 60_000).toISOString(),
    alertOwner: exhausted && input.important,
  };
}

export function deliveryIdempotencyKey(message: ScheduledMessage) {
  return [
    message.id,
    message.bookingFingerprint,
    message.templateId,
    message.templateVersion,
    message.channel,
    message.recipient ?? "",
  ].join(":");
}

export function preflightDelivery(data: AppData, message: ScheduledMessage) {
  const blockers: string[] = [];
  const booking = data.bookings.find((item) => item.id === message.bookingId);
  const template = data.messageTemplates.find((item) => item.id === message.templateId);
  const profile = data.guests.find((item) => item.bookingId === message.bookingId);
  const person = data.people.find((item) => item.id === profile?.personId);

  if (!booking || booking.deletedAt || booking.workflowStatus === "Anulowana") blockers.push("rezerwacja nie jest aktywna");
  if (message.status !== "Zatwierdzona") blockers.push("wiadomość nie jest zatwierdzona");
  if (message.deliveryPolicy === "draft_only") blockers.push("polityka dostawy pozostaje draft_only");
  if (!template || template.version !== message.templateVersion) blockers.push("wersja szablonu nie jest aktualna");
  if (!message.bookingFingerprint) blockers.push("brak fingerprintu wersji rezerwacji");
  if (booking && booking.platform !== "Bezpośrednio" && !booking.importRef) {
    blockers.push("brak potwierdzenia zapisu w źródle OTA");
  }
  if (message.channel === "SMS" && !normalizeE164(message.recipient)) blockers.push("telefon nie jest poprawnym E.164");
  if (message.channel === "E-mail" && !normalizeDeliveryEmail(message.recipient)) blockers.push("adres e-mail jest niepoprawny");
  if (message.channel === "OTA" && booking?.platform === "Bezpośrednio") blockers.push("rezerwacja direct nie ma kanału OTA");
  if (template?.language && person?.preferredLanguage && template.language !== person.preferredLanguage) {
    blockers.push("język szablonu różni się od preferencji gościa");
  }
  if (template?.family === "review") {
    const hasPurpose = message.channel === "SMS"
      ? hasActiveConsent(data.consentLedger, profile?.personId, "marketing_sms")
      : message.channel === "E-mail"
        ? hasActiveConsent(data.consentLedger, profile?.personId, "marketing_email")
        : true;
    if (!hasPurpose) blockers.push("brak aktywnej zgody dla celu i kanału");
  }
  return { ready: blockers.length === 0, blockers, idempotencyKey: deliveryIdempotencyKey(message) };
}
