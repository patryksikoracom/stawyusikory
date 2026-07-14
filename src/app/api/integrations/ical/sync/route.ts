import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { AppData, CalendarBlock } from "@/lib/types";

function unfoldIcs(raw: string) {
  return raw.replace(/\r?\n[ \t]/g, "");
}

function parseIcsEvents(raw: string) {
  return unfoldIcs(raw).split("BEGIN:VEVENT").slice(1).map((chunk) => {
    const event = chunk.split("END:VEVENT")[0];
    const value = (key: string) => event.split(/\r?\n/).find((line) => line.startsWith(key))?.split(":").slice(1).join(":").trim();
    const cleanDate = (input?: string) => input?.slice(0, 8).replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
    return { uid: value("UID"), start: cleanDate(value("DTSTART")), end: cleanDate(value("DTEND")), summary: value("SUMMARY") ?? "Zajęte w kalendarzu zewnętrznym" };
  }).filter((event) => event.uid && event.start && event.end);
}

function safeId(value: string) {
  return Buffer.from(value).toString("base64url").slice(0, 48);
}

export async function POST(request: Request) {
  const expected = process.env.CRON_SECRET;
  const cronAuthorized = Boolean(expected && request.headers.get("authorization") === `Bearer ${expected}`);
  const userClient = cronAuthorized ? null : await createClient();
  const user = userClient ? (await userClient.auth.getUser()).data.user : null;
  if (!cronAuthorized && !user) {
    return NextResponse.json({ error: "Brak autoryzacji harmonogramu." }, { status: 401 });
  }
  const supabase = createServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase service role nie jest skonfigurowane." }, { status: 503 });
  let organizationId: string | undefined;
  if (userClient && user) {
    const { data: membership } = await userClient.from("organization_memberships").select("organization_id").eq("user_id", user.id).limit(1).maybeSingle();
    organizationId = membership?.organization_id;
    if (!organizationId) return NextResponse.json({ error: "Brak organizacji użytkownika." }, { status: 403 });
  }
  let snapshotQuery = supabase.from("operational_snapshots").select("organization_id,state");
  if (organizationId) snapshotQuery = snapshotQuery.eq("organization_id", organizationId);
  const { data: snapshots, error } = await snapshotQuery;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  let feeds = 0;
  let blocks = 0;
  for (const snapshot of snapshots ?? []) {
    const state = snapshot.state as AppData;
    for (const connection of state.sourceConnections.filter((item) => item.connectionType === "iCal" && item.importUrl && item.unitId)) {
      feeds += 1;
      try {
        const response = await fetch(connection.importUrl!, { headers: { "user-agent": "Stawy-OS/1.0" }, cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const events = parseIcsEvents(await response.text());
        const prefix = `ICAL-${connection.id}-`;
        const imported: CalendarBlock[] = events.map((event) => ({
          id: `${prefix}${safeId(event.uid!)}`,
          unitId: connection.unitId!,
          dateFrom: event.start!,
          dateTo: event.end!,
          blockType: "Inne",
          reason: `[${connection.platform}] ${event.summary}`,
          status: "Aktywna",
        }));
        blocks += imported.length;
        state.blocks = [...state.blocks.filter((item) => !item.id.startsWith(prefix)), ...imported];
        Object.assign(connection, { status: "Aktywne", lastSyncAt: new Date().toISOString(), coverage: 100, lastError: undefined });
      } catch (syncError) {
        Object.assign(connection, { status: "Błąd", lastError: syncError instanceof Error ? syncError.message : "Nieznany błąd" });
      }
    }
    await supabase.from("operational_snapshots").update({ state, updated_at: new Date().toISOString() }).eq("organization_id", snapshot.organization_id);
  }
  return NextResponse.json({ ok: true, feeds, blocks });
}
