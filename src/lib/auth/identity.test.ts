import { describe, expect, it } from "vitest";
import { anonymousAppIdentity, buildAppIdentity, initialsFor, roleLabel } from "./identity";

describe("tożsamość widoczna w aplikacji", () => {
  it("buduje nazwę i inicjały z bezpiecznych danych prezentacyjnych", () => {
    expect(buildAppIdentity({
      email: "codex-test@stawyusikory.pl",
      metadata: {},
      role: "admin",
      organizationName: "Stawy u Sikory",
    })).toEqual({
      authenticated: true,
      displayName: "codex-test",
      email: "codex-test@stawyusikory.pl",
      initials: "CT",
      organizationName: "Stawy u Sikory",
      role: "admin",
      roleLabel: "Administrator",
    });

    expect(initialsFor("Patryk Sikora")).toBe("PS");
  });

  it("używa metadanych tylko jako nazwy do wyświetlenia", () => {
    const identity = buildAppIdentity({
      email: "admin@example.com",
      metadata: { display_name: "Patryk Sikora", role: "owner" },
      role: "viewer",
    });

    expect(identity.displayName).toBe("Patryk Sikora");
    expect(identity.role).toBe("viewer");
    expect(identity.roleLabel).toBe("Podgląd");
  });

  it("nie zgaduje roli ani danych nieistniejącego użytkownika", () => {
    expect(anonymousAppIdentity()).toMatchObject({
      authenticated: false,
      displayName: "Konto",
      email: null,
      initials: "KO",
      role: null,
      roleLabel: "Rola nieustalona",
    });
    expect(roleLabel(null)).toBe("Rola nieustalona");
  });

  it("rozpoznaje konto sprzątania i pokazuje właściwą etykietę", () => {
    expect(buildAppIdentity({
      email: "jadzia@example.com",
      metadata: { display_name: "Jadzia" },
      role: "cleaning",
    })).toMatchObject({ displayName: "Jadzia", initials: "JA", role: "cleaning", roleLabel: "Sprzątanie" });
  });
});
