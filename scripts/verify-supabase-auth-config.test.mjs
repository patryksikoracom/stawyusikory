import { describe, expect, it, vi } from "vitest";
import { inspectAuthConfig, verifyAuthConfig } from "./verify-supabase-auth-config.mjs";

describe("Supabase Auth config gate", () => {
  it("blokuje przypadkowe włączenie publicznego signup", () => {
    const result = inspectAuthConfig({ disable_signup: false, password_min_length: 12, password_hibp_enabled: true });
    expect(result.failures).toContain("Publiczne tworzenie kont musi pozostać wyłączone (disable_signup=true).");
  });

  it("na planie Free raportuje HIBP jako jawne ostrzeżenie", () => {
    const result = inspectAuthConfig({ disable_signup: true, password_min_length: 12, password_hibp_enabled: false });
    expect(result.failures).toEqual([]);
    expect(result.warnings[0]).toMatch(/Supabase Pro/);
  });

  it("może wymagać HIBP jako twardej bramki po podniesieniu planu", () => {
    const result = inspectAuthConfig(
      { disable_signup: true, password_min_length: 12, password_hibp_enabled: false },
      { requireHibp: true },
    );
    expect(result.failures[0]).toMatch(/HIBP/);
  });

  it("nie ujawnia tokenu w żądaniu ani wyniku", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ disable_signup: true, password_min_length: 12, password_hibp_enabled: true }),
    });
    const result = await verifyAuthConfig({ SUPABASE_PROJECT_REF: "project-ref", SUPABASE_ACCESS_TOKEN: "secret-token" }, fetchMock);

    expect(result).toEqual({ failures: [], warnings: [] });
    expect(fetchMock).toHaveBeenCalledWith("https://api.supabase.com/v1/projects/project-ref/config/auth", {
      headers: { authorization: "Bearer secret-token" },
    });
  });
});
