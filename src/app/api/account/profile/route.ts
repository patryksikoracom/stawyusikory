import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOrganization } from "@/lib/supabase/auth-context";
import { buildAppIdentity } from "@/lib/auth/identity";

const schema = z.object({ displayName: z.string().trim().min(2).max(100).refine(value => Array.from(value).every(character => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127)) }).strict();

export async function GET(request: Request) {
  const context = await requireOrganization(request);
  if (context.error) return context.error;
  const identity = buildAppIdentity({ email: context.user.email, metadata: context.user.user_metadata, role: context.role, userId: context.user.id });
  return NextResponse.json({ displayName: identity.displayName, email: identity.email, role: identity.roleLabel }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request) {
  const context = await requireOrganization(request);
  if (context.error) return context.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Podaj nazwę konta o długości od 2 do 100 znaków." }, { status: 400 });
  const { error } = await context.supabase.auth.updateUser({ data: { display_name: parsed.data.displayName } });
  if (error) return NextResponse.json({ error: "Nie udało się zapisać nazwy konta." }, { status: 503 });
  return NextResponse.json({ ok: true, displayName: parsed.data.displayName }, { headers: { "Cache-Control": "private, no-store" } });
}
