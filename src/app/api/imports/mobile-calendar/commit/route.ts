import { NextResponse } from "next/server";
import { z } from "zod";
import { isOrganizationEditor, requireOrganization } from "@/lib/supabase/auth-context";

const schema = z.object({
  rows: z.array(z.object({ id: z.string(), checkIn: z.string(), checkOut: z.string(), guestLabel: z.string() }).passthrough()).max(5000),
  contacts: z.array(z.object({ bookingId: z.string(), phone: z.string().optional(), email: z.string().optional() }).passthrough()).max(5000).default([]),
  imports: z.array(z.object({
    id: z.string(),
    platform: z.enum(["Booking", "Airbnb"]),
    transferStatus: z.string(),
  }).passthrough()).max(5000).default([]),
  costSettings: z.array(z.object({
    id: z.string(),
    label: z.string(),
    value: z.number(),
    unit: z.string(),
  }).passthrough()).max(100).default([]),
});

export async function POST(request: Request) {
  const context = await requireOrganization(request);
  if (context.error) return context.error;
  if (!isOrganizationEditor(context.role)) return NextResponse.json({ error: "Brak uprawnień do importu." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Import zawiera nieprawidłowe rekordy." }, { status: 400 });
  return NextResponse.json({
    ok: true,
    accepted: parsed.data.rows.length,
    acceptedImports: parsed.data.imports.length,
  });
}
