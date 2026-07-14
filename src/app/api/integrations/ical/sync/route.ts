import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { CalendarBlock, SourceConnection } from "@/lib/types";
import { validateExternalCalendarUrl } from "@/lib/integrations/ical-security";

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
  if (!cronAuthorized && !user) return NextResponse.json({ error: "Brak autoryzacji harmonogramu." }, { status: 401 });

  const service = createServiceClient();
  if (!service) return NextResponse.json({ error: "Supabase service role nie jest skonfigurowane." }, { status: 503 });

  let organizationIds: string[] = [];
  if (userClient && user) {
    const { data: membership } = await userClient.from("organization_memberships").select("organization_id").eq("user_id", user.id).limit(1).maybeSingle();
    if (!membership) return NextResponse.json({ error: "Brak organizacji użytkownika." }, { status: 403 });
    organizationIds = [membership.organization_id];
  } else {
    const { data: organizations, error } = await service.from("operational_state_versions").select("organization_id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    organizationIds = (organizations ?? []).map((item) => item.organization_id);
  }

  let feeds = 0;
  let blocks = 0;
  let failures = 0;

  for (const organizationId of organizationIds) {
    const { data: records, error } = await service
      .from("operational_records")
      .select("entity_type,payload")
      .eq("organization_id", organizationId)
      .in("entity_type", ["sourceConnections", "blocks"]);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const connections = (records ?? [])
      .filter((record) => record.entity_type === "sourceConnections")
      .map((record) => record.payload as SourceConnection);
    const importedBlocks: CalendarBlock[] = [];

    for (const connection of connections.filter((item) => item.connectionType === "iCal" && item.importUrl && item.unitId)) {
      feeds += 1;
      const startedAt = new Date().toISOString();
      try {
        const validated = validateExternalCalendarUrl(connection.importUrl!);
        if (!validated.ok) throw new Error(validated.error);
        const response = await fetch(validated.url, {
          headers: { "user-agent": "Stawy-OS/1.0" },
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const events = parseIcsEvents(await response.text());
        const prefix = `ICAL-${connection.id}-`;
        const imported = events.map((event): CalendarBlock => ({
          id: `${prefix}${safeId(event.uid!)}`,
          unitId: connection.unitId!,
          dateFrom: event.start!,
          dateTo: event.end!,
          blockType: "Inne",
          reason: `[${connection.platform}] ${event.summary}`,
          status: "Aktywna",
        }));
        blocks += imported.length;
        importedBlocks.push(...imported);
        Object.assign(connection, { status: "Aktywne", lastSyncAt: new Date().toISOString(), coverage: 100, lastError: undefined });
        await service.from("integration_sync_runs").insert({ organization_id: organizationId, connection_id: connection.id, status: "success", imported_count: imported.length, started_at: startedAt, finished_at: new Date().toISOString() });
      } catch (syncError) {
        failures += 1;
        const message = syncError instanceof Error ? syncError.message : "Nieznany błąd";
        Object.assign(connection, { status: "Błąd", lastError: message });
        await service.from("integration_sync_runs").insert({ organization_id: organizationId, connection_id: connection.id, status: "error", error_message: message, started_at: startedAt, finished_at: new Date().toISOString() });
      }
    }

    if (connections.length) {
      const { error: commitError } = await service.rpc("apply_ical_sync", {
        p_organization_id: organizationId,
        p_connections: connections,
        p_blocks: importedBlocks,
        p_summary: { feeds: connections.length, blocks: importedBlocks.length, failures },
      });
      if (commitError) return NextResponse.json({ error: commitError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: failures === 0, feeds, blocks, failures });
}
