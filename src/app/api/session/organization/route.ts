import { NextResponse } from "next/server";
import { z } from "zod";
import { activeOrganizationCookie } from "@/lib/auth/organization-context";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ organizationId: z.uuid() });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Nieprawidłowa organizacja." }, { status: 400 });
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase nie jest skonfigurowany." }, { status: 503 });
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return NextResponse.json({ error: "Wymagane logowanie." }, { status: 401 });

  const { data: membership, error } = await supabase
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("organization_id", parsed.data.organizationId)
    .maybeSingle();
  if (error || !membership) {
    return NextResponse.json({ error: "Brak dostępu do wskazanej organizacji." }, { status: 403 });
  }

  const response = NextResponse.json({ ok: true, activeOrganizationId: membership.organization_id });
  response.cookies.set(activeOrganizationCookie, membership.organization_id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
