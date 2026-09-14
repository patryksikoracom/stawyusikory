import type { SupabaseClient } from "@supabase/supabase-js";

export type DueMessage = {
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

// Read before mutations so changing delivery statuses cannot shift later pages.
export async function readEmailQueue(service: SupabaseClient, now: Date) {
  const messages: DueMessage[] = [];
  while (true) {
    const offset = messages.length;
    const { data, error, count } = await service.from("scheduled_messages")
      .select("id,organization_id,booking_id,rule_id,due_at,recipient,subject,rendered_body,status,blocked_reason,idempotency_key", { count: "exact" })
      .eq("channel", "E-mail")
      .in("status", ["Zatwierdzona", "Błąd"])
      .is("blocked_reason", null)
      .lte("due_at", now.toISOString())
      .order("due_at", { ascending: true }).order("id", { ascending: true })
      .range(offset, offset + 99)
      .returns<DueMessage[]>();
    if (error) throw error;
    if (count == null) throw new Error("Nie udało się potwierdzić kolejki e-mail.");
    if (!data?.length) {
      if (offset < count) throw new Error("Niepełny odczyt kolejki e-mail.");
      return messages;
    }
    messages.push(...data);
    if (messages.length >= count) return messages;
  }
}
