import { describe, expect, it } from "vitest";
import { requestedOrganizationId, resolveOrganizationMembership } from "./organization-context";

describe("aktywny kontekst organizacji", () => {
  const memberships = [
    { organization_id: "org-a", role: "owner" },
    { organization_id: "org-b", role: "accounting" },
  ];

  it("automatycznie wybiera wyłącznie jedno członkostwo", () => {
    expect(resolveOrganizationMembership([memberships[0]])).toEqual({
      ok: true,
      membership: memberships[0],
    });
    expect(resolveOrganizationMembership(memberships)).toEqual({
      ok: false,
      reason: "selection_required",
    });
  });

  it("nigdy nie akceptuje organizacji spoza członkostw", () => {
    expect(resolveOrganizationMembership(memberships, "org-b")).toEqual({
      ok: true,
      membership: memberships[1],
    });
    expect(resolveOrganizationMembership(memberships, "org-c")).toEqual({
      ok: false,
      reason: "not_a_member",
    });
  });

  it("odrzuca nieznaną rolę zamiast podnosić uprawnienia", () => {
    expect(resolveOrganizationMembership([{ organization_id: "org-a", role: "superadmin" }])).toEqual({
      ok: false,
      reason: "invalid_role",
    });
  });

  it("czyta jawny identyfikator z nagłówka przed cookie", () => {
    const request = new Request("https://example.test", {
      headers: {
        cookie: "stawy-active-organization=org-cookie",
        "x-stawy-organization-id": "org-header",
      },
    });
    expect(requestedOrganizationId(request)).toBe("org-header");
    expect(requestedOrganizationId(new Request("https://example.test", {
      headers: { cookie: "other=1; stawy-active-organization=org-cookie" },
    }))).toBe("org-cookie");
  });
});
