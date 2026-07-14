import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({ rows: z.array(z.object({ id: z.string(), checkIn: z.string(), checkOut: z.string(), guestLabel: z.string() }).passthrough()).max(5000) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Import zawiera nieprawidłowe rekordy." }, { status: 400 });
  return NextResponse.json({ ok: true, accepted: parsed.data.rows.length });
}
