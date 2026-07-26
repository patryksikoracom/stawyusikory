import { describe, expect, it } from "vitest";
import type { UserRole } from "@/lib/types";
import { appPermissions, hasPermission, rolePermissions } from "./permissions";

describe("macierz uprawnień organizacji", () => {
  const roles: UserRole[] = ["owner", "admin", "manager", "cleaning", "marketing", "accounting", "viewer"];

  it("jawnie opisuje każdą rolę i każde uprawnienie", () => {
    expect(Object.keys(rolePermissions).sort()).toEqual([...roles].sort());
    for (const role of roles) {
      expect(Object.keys(rolePermissions[role]).sort()).toEqual([...appPermissions].sort());
    }
  });

  it("ogranicza role specjalistyczne zgodnie z zasadą najmniejszych uprawnień", () => {
    expect(rolePermissions.cleaning).toEqual({
      read: true, write: true, pii: false, finance: false, send: false, export: false,
    });
    expect(rolePermissions.accounting).toMatchObject({ finance: true, export: true, send: false });
    expect(rolePermissions.marketing).toMatchObject({ pii: false, finance: false, send: false });
    expect(rolePermissions.viewer).toMatchObject({ write: false, send: false, export: false });
  });

  it("nie przyznaje uprawnienia bez poprawnej roli", () => {
    expect(hasPermission(null, "read")).toBe(false);
    expect(hasPermission(undefined, "write")).toBe(false);
  });
});
