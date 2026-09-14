import type { SupabaseClient } from "@supabase/supabase-js";
import { isOutboundClaimable } from "./delivery-queue";

type SmsCandidate = {
  id: string;
  organization_id: string;
  recipient: string;
  body: string;
  attempts: number;
  important: boolean;
  status: string;
  next_attempt_at: string | null;
};

// Apply eligibility before the batch limit, so terminal errors cannot starve
// newer messages. No delivery occurs until all required pages are read.
export async function readSmsQueue(service: SupabaseClient, now: Date, limit = 20) {
  const eligible: SmsCandidate[] = [];
  let offset = 0;
  while (eligible.length < limit) {
    const { data, error, count } = await service.from("outbound_messages")
      .select("id,organization_id,recipient,body,attempts,important,status,next_attempt_at", { count: "exact" })
      .eq("channel", "SMS")
      .in("status", ["queued", "error"])
      .lt("attempts", 5)
      .or(`next_attempt_at.is.null,next_attempt_at.lte.${now.toISOString()}`)
      .order("created_at", { ascending: true }).order("id", { ascending: true })
      .range(offset, offset + 99);
    if (error) throw error;
    if (count === null) throw new Error("Nie udało się potwierdzić kolejki SMS.");
    if (!data?.length) {
      if (offset < count) throw new Error("Kolejka SMS zmieniła się podczas odczytu.");
      break;
    }
    for (const row of data as SmsCandidate[]) {
      if (row.attempts < (row.important ? 5 : 3) && isOutboundClaimable(row, now)) eligible.push(row);
      if (eligible.length === limit) break;
    }
    offset += data.length;
    if (offset >= count) break;
  }
  return eligible;
}
