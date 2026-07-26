import type { UserRole } from "@/lib/types";

export type AppIdentity = {
  availableOrganizations: Array<{
    id: string;
    name: string;
    role: UserRole;
  }>;
  authenticated: boolean;
  displayName: string;
  email: string | null;
  initials: string;
  organizationId: string | null;
  organizationName: string | null;
  role: UserRole | null;
  roleLabel: string;
  userId: string | null;
};

type IdentityInput = {
  availableOrganizations?: AppIdentity["availableOrganizations"];
  email?: string | null;
  metadata?: Record<string, unknown> | null;
  organizationId?: string | null;
  organizationName?: string | null;
  role?: string | null;
  userId?: string | null;
};

const roleLabels: Record<UserRole, string> = {
  owner: "Właściciel",
  admin: "Administrator",
  manager: "Manager",
  viewer: "Podgląd",
  cleaning: "Sprzątanie",
  marketing: "Marketing",
  accounting: "Księgowość",
};

export function isUserRole(value: unknown): value is UserRole {
  return value === "owner"
    || value === "admin"
    || value === "manager"
    || value === "viewer"
    || value === "cleaning"
    || value === "marketing"
    || value === "accounting";
}

export function roleLabel(role: UserRole | null) {
  return role ? roleLabels[role] : "Rola nieustalona";
}

export function initialsFor(value: string) {
  const parts = value
    .trim()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  if (!parts.length) return "K";
  if (parts.length === 1) return parts[0].slice(0, 2).toLocaleUpperCase("pl-PL");
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toLocaleUpperCase("pl-PL");
}

function metadataName(metadata?: Record<string, unknown> | null) {
  for (const key of ["display_name", "full_name", "name"]) {
    const value = metadata?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export function buildAppIdentity({
  availableOrganizations = [],
  email,
  metadata,
  organizationId,
  organizationName,
  role,
  userId,
}: IdentityInput): AppIdentity {
  const normalizedEmail = email?.trim() || null;
  const emailName = normalizedEmail?.split("@")[0]?.trim() || null;
  const displayName = metadataName(metadata) ?? emailName ?? "Konto";
  const validRole = isUserRole(role) ? role : null;

  return {
    availableOrganizations,
    authenticated: Boolean(normalizedEmail),
    displayName,
    email: normalizedEmail,
    initials: initialsFor(displayName),
    organizationId: organizationId?.trim() || null,
    organizationName: organizationName?.trim() || null,
    role: validRole,
    roleLabel: roleLabel(validRole),
    userId: userId?.trim() || null,
  };
}

export function anonymousAppIdentity(): AppIdentity {
  return buildAppIdentity({});
}
