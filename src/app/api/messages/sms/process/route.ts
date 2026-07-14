import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendSmsApi } from "@/lib/integrations/smsapi";

export async function POST(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Brak autoryzacji harmonogramu." }, { status: 401 });
  }
  const token = process.env.SMSAPI_TOKEN;
  const service = createServiceClient();
  if (!token || !service) return NextResponse.json({ error: "Brak konfiguracji SMSAPI lub Supabase." }, { status: 503 });

  const { data: messages, error } = await service
    .from("outbound_messages")
    .select("id,recipient,body,attempts")
    .in("status", ["queued", "error"])
    .lt("attempts", 3)
    .order("created_at", { ascending: true })
    .limit(20);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let sent = 0;
  let failed = 0;
  for (const message of messages ?? []) {
    const result = await sendSmsApi(token, message.recipient, message.body);
    await service.from("outbound_messages").update({
      status: result.ok ? "sent" : "error",
      provider_response: result.provider,
      attempts: message.attempts + 1,
      updated_at: new Date().toISOString(),
    }).eq("id", message.id);
    if (result.ok) sent += 1;
    else failed += 1;
  }
  return NextResponse.json({ ok: failed === 0, processed: (messages ?? []).length, sent, failed });
}

