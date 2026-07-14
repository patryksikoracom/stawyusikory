import { NextResponse } from "next/server";
import { z } from "zod";
import { parseMobileCalendar } from "@/lib/import/mobile-calendar";

export async function POST(request: Request) {
  const parsed = z.object({ raw: z.string().max(1_000_000) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Nieprawidłowe dane importu." }, { status: 400 });
  return NextResponse.json(parseMobileCalendar(parsed.data.raw));
}
