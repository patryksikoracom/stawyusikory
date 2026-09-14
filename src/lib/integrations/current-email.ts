import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppData } from "@/lib/types";
import { readOperationalState } from "@/lib/supabase/read-operational-state";
import { reconcileScheduledMessages } from "@/lib/workflow/communications";

export type CommunicationData = Pick<AppData, "bookings" | "units" | "payments" | "communicationConfigs" | "guests" | "people" | "consents" | "consentLedger" | "messageTemplates" | "automationRules" | "scheduledMessages">;

export function isCurrentEmail(data: CommunicationData, queued: {
  id: string; booking_id: string; recipient: string | null; subject: string | null;
  rendered_body: string; idempotency_key: string;
}) {
  const booking = data.bookings.find(item => item.id === queued.booking_id);
  const saved = data.scheduledMessages.find(item => item.id === queued.id);
  if (!booking || booking.deletedAt || booking.workflowStatus === "Anulowana" || !saved
    || saved.bookingId !== booking.id || saved.channel !== "E-mail" || saved.blockedReason
    || !["Zatwierdzona", "Błąd"].includes(saved.status)
    || !["manual_send", "auto_send"].includes(saved.deliveryPolicy ?? "")) return false;
  // A retry must pass the same approval invalidation checks as a first attempt.
  const scheduledMessages = data.scheduledMessages.map(item => item.id === saved.id
    ? { ...item, status: "Zatwierdzona" as const } : item);
  const current = reconcileScheduledMessages({ ...data, scheduledMessages }).find(item => item.id === saved.id);
  return Boolean(current && current.status === "Zatwierdzona" && !current.blockedReason
    && current.bookingFingerprint === saved.bookingFingerprint
    && current.recipient === queued.recipient && current.subject === queued.subject
    && current.renderedBody === queued.rendered_body && current.idempotencyKey === queued.idempotency_key);
}

export async function readCommunicationData(service: SupabaseClient, organizationId: string): Promise<CommunicationData> {
  const { records } = await readOperationalState(service, organizationId);
  const collections = ["bookings", "units", "payments", "communicationConfigs", "guests", "people", "consents", "consentLedger", "messageTemplates", "automationRules", "scheduledMessages"] as const;
  return Object.fromEntries(collections.map(key => [key, records.filter(record => record.entity_type === key).map(record => record.payload)])) as CommunicationData;
}
