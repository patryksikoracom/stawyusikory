import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOrganization } from "@/lib/supabase/auth-context";
import { sendSmsApi } from "@/lib/integrations/smsapi";

const schema = z.object({
  to: z.string().min(9).max(20),
  message: z.string().min(1).max(480),
  idempotencyKey: z.string().min(8).max(160),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Sprawdź numer telefonu i treść SMS." }, { status: 400 });
  const context = await requireOrganization();
  if (context.error) return context.error;
  if (context.role === "viewer") return NextResponse.json({ error: "Brak uprawnień do wysyłania wiadomości." }, { status: 403 });

  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await context.supabase!
    .from("outbound_messages")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", context.organizationId)
    .gte("created_at", since);
  if ((count ?? 0) >= 50) return NextResponse.json({ error: "Osiągnięto dzienny limit 50 wiadomości." }, { status: 429 });

  const { data: existing } = await context.supabase!
    .from("outbound_messages")
    .select("id,status,provider_response")
    .eq("organization_id", context.organizationId)
    .eq("idempotency_key", parsed.data.idempotencyKey)
    .maybeSingle();
  if (existing) return NextResponse.json({ ok: existing.status === "sent" || existing.status === "delivered", duplicate: true, status: existing.status });

  const { data: queued, error: queueError } = await context.supabase!
    .from("outbound_messages")
    .insert({
      organization_id: context.organizationId,
      channel: "SMS",
      recipient: parsed.data.to,
      body: parsed.data.message,
      status: "queued",
      idempotency_key: parsed.data.idempotencyKey,
      attempts: 0,
    })
    .select("id")
    .single();
  if (queueError) {
    if (queueError.code === "23505") return NextResponse.json({ ok: true, duplicate: true });
    return NextResponse.json({ error: "Nie udało się zapisać wiadomości w kolejce." }, { status: 500 });
  }

  const token = process.env.SMSAPI_TOKEN;
  if (!token) {
    await context.supabase!.from("outbound_messages").update({ status: "error", provider_response: { error: "missing_token" } }).eq("id", queued.id);
    return NextResponse.json({ error: "Dodaj SMSAPI_TOKEN w ustawieniach środowiska." }, { status: 503 });
  }

  const result = await sendSmsApi(token, parsed.data.to, parsed.data.message);
  await context.supabase!.from("outbound_messages").update({
    status: result.ok ? "sent" : "error",
    provider_response: result.provider,
    attempts: 1,
    updated_at: new Date().toISOString(),
  }).eq("id", queued.id);
  if (!result.ok) return NextResponse.json({ error: "SMSAPI odrzuciło wiadomość.", provider: result.provider }, { status: 502 });
  return NextResponse.json({ ok: true, provider: result.provider });
}
