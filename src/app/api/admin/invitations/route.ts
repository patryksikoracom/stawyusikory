import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOrganization } from "@/lib/supabase/auth-context";
import { createServiceClient } from "@/lib/supabase/server";

const invitationSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  role: z.enum(["admin", "viewer"]),
});

function invitationRedirect(request: Request) {
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim()
    || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
  const origin = configuredOrigin || new URL(request.url).origin;
  const redirect = new URL("/auth/callback", origin);
  redirect.searchParams.set("next", "/reset-password");
  return redirect.toString();
}

export async function POST(request: Request) {
  const context = await requireOrganization();
  if (context.error) return context.error;
  if (context.role !== "owner" && context.role !== "admin") {
    return NextResponse.json({ error: "Brak uprawnień do zapraszania użytkowników." }, { status: 403 });
  }

  const parsed = invitationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Podaj prawidłowy e-mail i dozwoloną rolę." }, { status: 400 });
  }
  if (context.role === "admin" && parsed.data.role !== "viewer") {
    return NextResponse.json({ error: "Administrator może zaprosić wyłącznie użytkownika z rolą podglądu." }, { status: 403 });
  }

  const service = createServiceClient();
  if (!service) {
    return NextResponse.json({ error: "Zaproszenia nie są skonfigurowane po stronie serwera." }, { status: 503 });
  }

  const invited = await service.auth.admin.inviteUserByEmail(parsed.data.email, {
    redirectTo: invitationRedirect(request),
  });
  if (invited.error || !invited.data.user) {
    const duplicate = /already|registered|exists/i.test(invited.error?.message ?? "");
    return NextResponse.json(
      { error: duplicate ? "Konto z tym adresem już istnieje. Sprawdź obecnych użytkowników." : "Nie udało się wysłać zaproszenia." },
      { status: duplicate ? 409 : 502 },
    );
  }

  const userId = invited.data.user.id;
  const membership = await service.from("organization_memberships").insert({
    organization_id: context.organizationId,
    user_id: userId,
    role: parsed.data.role,
  });
  if (membership.error) {
    await service.auth.admin.deleteUser(userId).catch(() => undefined);
    return NextResponse.json({ error: "Nie udało się bezpiecznie przypisać dostępu. Zaproszenie zostało wycofane." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, email: parsed.data.email, role: parsed.data.role }, { status: 201 });
}
