import { NextResponse } from "next/server";
import { isOrganizationEditor, requireOrganization } from "@/lib/supabase/auth-context";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const context = await requireOrganization(request);
  if (context.error) return context.error;
  if (!isOrganizationEditor(context.role)) return NextResponse.json({ error: "Brak dostępu do listy kont." }, { status: 403 });
  const service = createServiceClient();
  if (!service) return NextResponse.json({ error: "Brak konfiguracji serwera." }, { status: 503 });
  const { data, error, count } = await service.from("organization_memberships")
    .select("user_id,role", { count: "exact" }).eq("organization_id", context.organizationId)
    .order("user_id").limit(100);
  if (error || count == null || count > (data?.length ?? 0)) {
    return NextResponse.json({ error: "Nie udało się pobrać kompletnej listy kont." }, { status: 503 });
  }
  const members = await Promise.all((data ?? []).map(async membership => {
    const result = await service.auth.admin.getUserById(membership.user_id);
    const user = result.data.user;
    return {
      userId: membership.user_id,
      role: membership.role,
      email: user?.email ?? null,
      displayName: typeof user?.user_metadata?.display_name === "string" ? user.user_metadata.display_name : user?.email ?? membership.user_id,
      accountAvailable: !result.error && Boolean(user),
    };
  }));
  return NextResponse.json({ members }, { headers: { "Cache-Control": "private, no-store" } });
}
