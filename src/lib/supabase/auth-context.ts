import { NextResponse } from "next/server";
import {
  requestedOrganizationId,
  resolveOrganizationMembership,
} from "@/lib/auth/organization-context";
import { createClient } from "./server";

export function isOrganizationEditor(role: unknown): role is "owner" | "admin" {
  return role === "owner" || role === "admin";
}

export function isBookingOperator(role: unknown): role is "owner" | "admin" | "manager" {
  return role === "owner" || role === "admin" || role === "manager";
}

export async function requireOrganization(request?: Request) {
  const supabase = await createClient();
  if (!supabase) {
    return { error: NextResponse.json({ error: "Supabase nie jest skonfigurowany" }, { status: 503 }) };
  }
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { error: NextResponse.json({ error: "Wymagane logowanie" }, { status: 401 }) };
  }
  const { data: memberships, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("organization_id,role")
    .eq("user_id", user.id);
  if (membershipError) {
    return { error: NextResponse.json({ error: "Brak organizacji użytkownika" }, { status: 403 }) };
  }
  const resolution = resolveOrganizationMembership(
    memberships ?? [],
    requestedOrganizationId(request),
  );
  if (!resolution.ok) {
    const selectionRequired = resolution.reason === "selection_required";
    return {
      error: NextResponse.json(
        { error: selectionRequired ? "Wybierz aktywną organizację." : "Brak dostępu do wskazanej organizacji." },
        { status: selectionRequired ? 409 : 403 },
      ),
    };
  }
  return {
    supabase,
    user,
    organizationId: resolution.membership.organization_id,
    role: resolution.membership.role,
  };
}
