import type { UserRole } from "@/lib/types";

export function landingPathForRole(role: UserRole | null) {
  return role === "manager" ? "/calendar" : "/dashboard";
}
