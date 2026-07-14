import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const payloadSchema = z.object({ data: z.record(z.string(), z.unknown()) });

async function context() {
  const supabase = await createClient();
  if (!supabase) return { error: NextResponse.json({ error: "Supabase nie jest skonfigurowany" }, { status: 503 }) };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Wymagane logowanie" }, { status: 401 }) };
  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) return { error: NextResponse.json({ error: "Brak organizacji użytkownika" }, { status: 403 }) };
  return { supabase, organizationId: membership.organization_id };
}

export async function GET() {
  const result = await context();
  if (result.error) return result.error;
  const { data, error } = await result.supabase!
    .from("operational_snapshots")
    .select("state, updated_at, version")
    .eq("organization_id", result.organizationId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data?.state ?? null, updatedAt: data?.updated_at, version: data?.version ?? 0 });
}

export async function PUT(request: Request) {
  const result = await context();
  if (result.error) return result.error;
  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Nieprawidłowy stan aplikacji" }, { status: 400 });
  const { error } = await result.supabase!
    .from("operational_snapshots")
    .upsert({
      organization_id: result.organizationId,
      state: parsed.data.data,
      updated_at: new Date().toISOString(),
    }, { onConflict: "organization_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
