import type { UserRole } from "@/lib/types";

export type AppIdentity = {
  authenticated: boolean;
  displayName: string;
  email: string | null;
  initials: string;
  organizationName: string | null;
  role: UserRole | null;
  roleLabel: string;
};

type IdentityInput = {
  email?: string | null;
  metadata?: Record<string, unknown> | null;
  organizationName?: string | null;
  role?: string | null;
};

const roleLabels: Record<UserRole, string> = {
  owner: "Właściciel",
  admin: "Administrator",
  viewer: "Podgląd",
};

export function isUserRole(value: unknown): value is UserRole {
  return value === "owner" || value === "admin" || value === "viewer";
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

export function buildAppIdentity({ email, metadata, organizationName, role }: IdentityInput): AppIdentity {
  const normalizedEmail = email?.trim() || null;
  const emailName = normalizedEmail?.split("@")[0]?.trim() || null;
  const displayName = metadataName(metadata) ?? emailName ?? "Konto";
  const validRole = isUserRole(role) ? role : null;

  return {
    authenticated: Boolean(normalizedEmail),
    displayName,
    email: normalizedEmail,
    initials: initialsFor(displayName),
    organizationName: organizationName?.trim() || null,
    role: validRole,
    roleLabel: roleLabel(validRole),
  };
}

export function anonymousAppIdentity(): AppIdentity {
  return buildAppIdentity({});
}
