import { describe, expect, it } from "vitest";
import { canAccessAppPath } from "./route-access";

describe("canAccessAppPath", () => {
  it("ogranicza profil operatora do kalendarza i rezerwacji", () => {
    expect(canAccessAppPath("manager", "/calendar")).toBe(true);
    expect(canAccessAppPath("manager", "/bookings")).toBe(true);
    expect(canAccessAppPath("manager", "/bookings/RES-1")).toBe(true);
    expect(canAccessAppPath("manager", "/dashboard")).toBe(false);
    expect(canAccessAppPath("manager", "/calendar/year")).toBe(false);
    expect(canAccessAppPath("manager", "/finances")).toBe(false);
    expect(canAccessAppPath("manager", "/settings")).toBe(false);
  });

  it("nie ogranicza panelu właściciela ani administratora", () => {
    expect(canAccessAppPath("owner", "/finances")).toBe(true);
    expect(canAccessAppPath("admin", "/settings")).toBe(true);
  });
});
