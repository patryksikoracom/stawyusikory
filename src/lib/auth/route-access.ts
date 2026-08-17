import type { UserRole } from "@/lib/types";

const operatorRootPaths = new Set(["/calendar", "/bookings"]);

export function canAccessAppPath(role: UserRole | null | undefined, pathname: string) {
  if (role !== "manager") return true;
  return operatorRootPaths.has(pathname) || pathname.startsWith("/bookings/");
}
