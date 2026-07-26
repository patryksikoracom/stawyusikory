import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { anonymousAppIdentity, buildAppIdentity } from "@/lib/auth/identity";
import {
  activeOrganizationCookie,
  resolveOrganizationMembership,
} from "@/lib/auth/organization-context";
import { createClient } from "@/lib/supabase/server";

export const getCurrentAppIdentity = cache(async () => {
  const supabase = await createClient();
  if (!supabase) return anonymousAppIdentity();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return anonymousAppIdentity();

  const { data: memberships } = await supabase
    .from("organization_memberships")
    .select("organization_id,role")
    .eq("user_id", user.id);
  const cookieStore = await cookies();
  const resolution = resolveOrganizationMembership(
    memberships ?? [],
    cookieStore.get(activeOrganizationCookie)?.value,
  );
  const membership = resolution.ok ? resolution.membership : null;
  const availableOrganizations = await Promise.all(
    (memberships ?? []).map(async (item) => {
      const valid = resolveOrganizationMembership([item]);
      if (!valid.ok) return null;
      const { data: organization } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", valid.membership.organization_id)
        .maybeSingle();
      return {
        id: valid.membership.organization_id,
        name: organization?.name ?? "Organizacja",
        role: valid.membership.role,
      };
    }),
  );

  let organizationName: string | null = null;
  if (membership?.organization_id) {
    const { data: organization } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", membership.organization_id)
      .maybeSingle();
    organizationName = organization?.name ?? null;
  }

  return buildAppIdentity({
    availableOrganizations: availableOrganizations.filter(
      (item): item is NonNullable<typeof item> => Boolean(item),
    ),
    email: user.email,
    metadata: user.user_metadata,
    organizationId: membership?.organization_id,
    organizationName,
    role: membership?.role,
    userId: user.id,
  });
});
