import "server-only";

import { cache } from "react";
import { anonymousAppIdentity, buildAppIdentity } from "@/lib/auth/identity";
import { createClient } from "@/lib/supabase/server";

export const getCurrentAppIdentity = cache(async () => {
  const supabase = await createClient();
  if (!supabase) return anonymousAppIdentity();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return anonymousAppIdentity();

  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("organization_id,role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

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
    email: user.email,
    metadata: user.user_metadata,
    organizationName,
    role: membership?.role,
  });
});
