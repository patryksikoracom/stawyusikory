import "server-only";

import { redirect } from "next/navigation";
import { getCurrentAppIdentity } from "@/lib/auth/current-identity";
import { landingPathForRole } from "@/lib/auth/landing";
import { canAccessAppPath } from "@/lib/auth/route-access";

export async function requirePageAccess(pathname: string) {
  const identity = await getCurrentAppIdentity();
  if (!canAccessAppPath(identity.role, pathname)) redirect(landingPathForRole(identity.role));
  return identity;
}
