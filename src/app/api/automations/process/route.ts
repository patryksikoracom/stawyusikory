import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Brak autoryzacji harmonogramu." }, { status: 401 });
  }
  const service = createServiceClient();
  if (!service) return NextResponse.json({ error: "Brak konfiguracji Supabase." }, { status: 503 });

  const now = new Date().toISOString();
  const { data, error } = await service
    .from("scheduled_messages")
    .select("id,organization_id,booking_id,due_at,status,blocked_reason")
    .in("status", ["Wersja robocza", "Zatwierdzona", "Wymaga sprawdzenia"])
    .lte("due_at", now)
    .order("due_at", { ascending: true })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Draft-first release: report due work, but deliberately do not enqueue or send it.
  const actionable = (data ?? []).filter((item) => item.status === "Zatwierdzona" && !item.blocked_reason);
  const drafts = (data ?? []).filter((item) => item.status !== "Zatwierdzona" || item.blocked_reason);
  return NextResponse.json({ ok: true, due: data?.length ?? 0, readyForFutureDelivery: actionable.length, requiresHostAction: drafts.length });
}
