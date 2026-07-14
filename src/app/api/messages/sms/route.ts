import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  to: z.string().min(9).max(20),
  message: z.string().min(1).max(480),
  idempotencyKey: z.string().min(8).max(160),
});
const sent = new Map<string, { at: number; response: unknown }>();

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Sprawdź numer telefonu i treść SMS." }, { status: 400 });
  const supabase = await createClient();
  let organizationId: string | undefined;
  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Wymagane logowanie" }, { status: 401 });
    const { data: membership } = await supabase.from("organization_memberships").select("organization_id").eq("user_id", user.id).limit(1).maybeSingle();
    if (!membership) return NextResponse.json({ error: "Brak organizacji użytkownika" }, { status: 403 });
    organizationId = membership.organization_id;
    const { data: existing } = await supabase.from("outbound_messages").select("status,provider_response").eq("organization_id", organizationId).eq("idempotency_key", parsed.data.idempotencyKey).maybeSingle();
    if (existing) return NextResponse.json({ ok: existing.status !== "error", duplicate: true, provider: existing.provider_response });
    const { error: queueError } = await supabase.from("outbound_messages").insert({ organization_id: organizationId, channel: "SMS", recipient: parsed.data.to, body: parsed.data.message, status: "queued", idempotency_key: parsed.data.idempotencyKey, attempts: 1 });
    if (queueError) return NextResponse.json({ error: "Nie udało się zapisać wiadomości w kolejce." }, { status: 500 });
  }
  const previous = sent.get(parsed.data.idempotencyKey);
  if (previous) return NextResponse.json({ ok: true, duplicate: true, provider: previous.response });
  const token = process.env.SMSAPI_TOKEN;
  if (!token) {
    if (supabase && organizationId) await supabase.from("outbound_messages").update({ status: "error", provider_response: { error: "missing_token" } }).eq("organization_id", organizationId).eq("idempotency_key", parsed.data.idempotencyKey);
    return NextResponse.json({ error: "Dodaj SMSAPI_TOKEN w ustawieniach środowiska." }, { status: 503 });
  }
  const body = new URLSearchParams({ to: parsed.data.to.replace(/\s/g, ""), message: parsed.data.message, format: "json" });
  const response = await fetch("https://api.smsapi.pl/sms.do", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const provider = await response.json().catch(() => ({ status: response.status }));
  if (!response.ok) {
    if (supabase && organizationId) await supabase.from("outbound_messages").update({ status: "error", provider_response: provider }).eq("organization_id", organizationId).eq("idempotency_key", parsed.data.idempotencyKey);
    return NextResponse.json({ error: "SMSAPI odrzuciło wiadomość.", provider }, { status: 502 });
  }
  if (supabase && organizationId) await supabase.from("outbound_messages").update({ status: "sent", provider_response: provider }).eq("organization_id", organizationId).eq("idempotency_key", parsed.data.idempotencyKey);
  sent.set(parsed.data.idempotencyKey, { at: Date.now(), response: provider });
  return NextResponse.json({ ok: true, provider });
}
