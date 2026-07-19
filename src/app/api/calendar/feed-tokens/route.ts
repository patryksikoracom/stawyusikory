import { NextResponse } from "next/server";
import { isOrganizationEditor, requireOrganization } from "@/lib/supabase/auth-context";

export async function GET(request: Request) {
  const context = await requireOrganization();
  if (context.error) return context.error;
  if (!isOrganizationEditor(context.role)) return NextResponse.json({ error: "Brak uprawnień do kalendarzy." }, { status: 403 });
  const { data, error } = await context.supabase!
    .from("calendar_feed_tokens")
    .select("unit_id,token,active")
    .eq("organization_id", context.organizationId)
    .eq("active", true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const origin = new URL(request.url).origin;
  return NextResponse.json({
    feeds: (data ?? []).map((item) => ({
      unitId: item.unit_id,
      url: `${origin}/api/calendar/feeds/${item.token}.ics`,
    })),
  }, { headers: { "cache-control": "private, no-store" } });
}
