import { NextResponse } from "next/server";
import { createClient } from "./server";

export function isOrganizationEditor(role: unknown): role is "owner" | "admin" {
  return role === "owner" || role === "admin";
}

export async function requireOrganization() {
  const supabase = await createClient();
  if (!supabase) {
    return { error: NextResponse.json({ error: "Supabase nie jest skonfigurowany" }, { status: 503 }) };
  }
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { error: NextResponse.json({ error: "Wymagane logowanie" }, { status: 401 }) };
  }
  const { data: membership, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("organization_id,role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (membershipError || !membership) {
    return { error: NextResponse.json({ error: "Brak organizacji użytkownika" }, { status: 403 }) };
  }
  return { supabase, user, organizationId: membership.organization_id, role: membership.role };
}
