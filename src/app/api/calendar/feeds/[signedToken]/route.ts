import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { initialData } from "@/lib/demo-data";
import type { AppData } from "@/lib/types";

function escapeIcs(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function icsDate(value: string) {
  return value.replaceAll("-", "");
}

function renderCalendar(data: AppData, unitId: string) {
  const unit = data.units.find((item) => item.id === unitId);
  const events = [
    ...data.bookings
      .filter((item) => item.unitId === unitId && item.workflowStatus !== "Anulowana")
      .map((item) => ({ id: `booking-${item.id}`, from: item.checkIn, to: item.checkOut, label: "Zajęte — Stawy OS" })),
    ...data.blocks
      .filter((item) => item.unitId === unitId && item.status !== "Anulowana")
      .map((item) => ({ id: `block-${item.id}`, from: item.dateFrom, to: item.dateTo, label: "Niedostępne — Stawy OS" })),
  ];
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Stawy OS//Availability//PL",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeIcs(unit?.name ?? "Stawy OS")}`,
    ...events.flatMap((event) => [
      "BEGIN:VEVENT",
      `UID:${escapeIcs(event.id)}@stawy-os`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`,
      `DTSTART;VALUE=DATE:${icsDate(event.from)}`,
      `DTEND;VALUE=DATE:${icsDate(event.to)}`,
      `SUMMARY:${escapeIcs(event.label)}`,
      "TRANSP:OPAQUE",
      "END:VEVENT",
    ]),
    "END:VCALENDAR",
  ];
  return `${lines.join("\r\n")}\r\n`;
}

export async function GET(_request: Request, context: { params: Promise<{ signedToken: string }> }) {
  const { signedToken } = await context.params;
  if (process.env.NODE_ENV !== "production" && signedToken.startsWith("demo-")) {
    const unitId = signedToken.replace("demo-", "");
    return new NextResponse(renderCalendar(initialData, unitId), { headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "no-store" } });
  }
  const supabase = createServiceClient();
  if (!supabase) return NextResponse.json({ error: "Eksport iCal nie jest skonfigurowany." }, { status: 503 });
  const { data: token } = await supabase.from("calendar_feed_tokens").select("organization_id, unit_id, active").eq("token", signedToken).maybeSingle();
  if (!token?.active) return NextResponse.json({ error: "Nieprawidłowy lub wyłączony link kalendarza." }, { status: 404 });
  const { data: snapshot } = await supabase.from("operational_snapshots").select("state").eq("organization_id", token.organization_id).maybeSingle();
  if (!snapshot?.state) return NextResponse.json({ error: "Brak danych kalendarza." }, { status: 404 });
  return new NextResponse(renderCalendar(snapshot.state as AppData, token.unit_id), {
    headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "private, max-age=60" },
  });
}
