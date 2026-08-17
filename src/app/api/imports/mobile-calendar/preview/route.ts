import { NextResponse } from "next/server";
import { z } from "zod";
import { parsePlatformFinances } from "@/lib/import/platform-finances";
import { isOrganizationEditor, requireOrganization } from "@/lib/supabase/auth-context";

export async function POST(request: Request) {
  const context = await requireOrganization(request);
  if (context.error) return context.error;
  if (!isOrganizationEditor(context.role)) return NextResponse.json({ error: "Brak uprawnień do importu." }, { status: 403 });
  const parsed = z.object({
    raw: z.string().max(1_000_000),
    airbnbRaw: z.string().max(1_000_000).optional(),
    bookingRaw: z.string().max(1_000_000).optional(),
  }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Nieprawidłowe dane importu." }, { status: 400 });
  return NextResponse.json(parsePlatformFinances({
    mobileCalendarRaw: parsed.data.raw,
    airbnbRaw: parsed.data.airbnbRaw,
    bookingRaw: parsed.data.bookingRaw,
  }));
}
