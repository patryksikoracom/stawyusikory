import { NextResponse } from "next/server";
import { z } from "zod";
import { parseMobileCalendar } from "@/lib/import/mobile-calendar";
import { isOrganizationEditor, requireOrganization } from "@/lib/supabase/auth-context";

export async function POST(request: Request) {
  const context = await requireOrganization();
  if (context.error) return context.error;
  if (!isOrganizationEditor(context.role)) return NextResponse.json({ error: "Brak uprawnień do importu." }, { status: 403 });
  const parsed = z.object({ raw: z.string().max(1_000_000) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Nieprawidłowe dane importu." }, { status: 400 });
  return NextResponse.json(parseMobileCalendar(parsed.data.raw));
}
