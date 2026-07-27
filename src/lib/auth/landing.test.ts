import { describe, expect, it } from "vitest";
import { landingPathForRole } from "./landing";

describe("landingPathForRole", () => {
  it("ustawia kalendarz jako ekran startowy managera", () => {
    expect(landingPathForRole("manager")).toBe("/calendar");
  });

  it("ustawia Dzisiaj jako ekran startowy właściciela i administratora", () => {
    expect(landingPathForRole("owner")).toBe("/dashboard");
    expect(landingPathForRole("admin")).toBe("/dashboard");
  });

  it("nie blokuje bezpośredniego dostępu do żadnego z ekranów", () => {
    expect(landingPathForRole(null)).toBe("/dashboard");
  });
});
