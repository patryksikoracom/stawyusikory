import type { UserRole } from "@/lib/types";

export const appPermissions = ["read", "write", "pii", "finance", "send", "export"] as const;
export type AppPermission = (typeof appPermissions)[number];

export const rolePermissions: Record<UserRole, Readonly<Record<AppPermission, boolean>>> = {
  owner: { read: true, write: true, pii: true, finance: true, send: true, export: true },
  admin: { read: true, write: true, pii: true, finance: true, send: true, export: true },
  manager: { read: true, write: false, pii: true, finance: false, send: false, export: false },
  cleaning: { read: true, write: true, pii: false, finance: false, send: false, export: false },
  marketing: { read: true, write: false, pii: false, finance: false, send: false, export: false },
  accounting: { read: true, write: false, pii: true, finance: true, send: false, export: true },
  viewer: { read: true, write: false, pii: false, finance: false, send: false, export: false },
};

export function hasPermission(role: UserRole | null | undefined, permission: AppPermission) {
  return role ? rolePermissions[role][permission] : false;
}

export function isGeneralStateReader(role: UserRole | null | undefined) {
  return role !== "cleaning" && hasPermission(role, "read");
}

export function isGeneralStateEditor(role: UserRole | null | undefined) {
  return hasPermission(role, "write");
}
