import type { UserRole } from "@/lib/types";
import { isUserRole } from "./identity";

export const activeOrganizationCookie = "stawy-active-organization";

export type OrganizationMembership = {
  organization_id: string;
  role: UserRole;
};

export type OrganizationResolution =
  | { ok: true; membership: OrganizationMembership }
  | { ok: false; reason: "missing" | "invalid_role" | "selection_required" | "not_a_member" };

export function resolveOrganizationMembership(
  memberships: Array<{ organization_id: string; role: unknown }>,
  requestedOrganizationId?: string | null,
): OrganizationResolution {
  const valid = memberships.filter(
    (membership): membership is OrganizationMembership =>
      Boolean(membership.organization_id) && isUserRole(membership.role),
  );
  if (!valid.length) {
    return { ok: false, reason: memberships.length ? "invalid_role" : "missing" };
  }
  if (requestedOrganizationId) {
    const membership = valid.find((item) => item.organization_id === requestedOrganizationId);
    return membership ? { ok: true, membership } : { ok: false, reason: "not_a_member" };
  }
  return valid.length === 1
    ? { ok: true, membership: valid[0] }
    : { ok: false, reason: "selection_required" };
}

export function requestedOrganizationId(request?: Request | null) {
  if (!request) return null;
  const header = request.headers.get("x-stawy-organization-id")?.trim();
  if (header) return header;
  const cookie = request.headers.get("cookie") ?? "";
  const value = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${activeOrganizationCookie}=`))
    ?.slice(activeOrganizationCookie.length + 1);
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
