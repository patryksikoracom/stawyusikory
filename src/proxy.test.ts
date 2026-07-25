import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMiddlewareClient } from "@/lib/supabase/middleware-client";
import { proxy } from "./proxy";

vi.mock("@/lib/supabase/middleware-client", () => ({
  createMiddlewareClient: vi.fn(),
}));

describe("auth proxy", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";
    vi.mocked(createMiddlewareClient).mockReturnValue({
      client: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: {
            code: "refresh_token_not_found",
            message: "Invalid Refresh Token: Refresh Token Not Found",
            status: 400,
          },
        }),
      },
      flushCookies: vi.fn().mockResolvedValue(undefined),
    } as unknown as ReturnType<typeof createMiddlewareClient>);
  });

  it("redirects, disables caching, and expires a rejected session cookie", async () => {
    const request = new NextRequest("https://stawyusikory.vercel.app/dashboard", {
      headers: {
        cookie: "sb-test-auth-token=invalid",
      },
    });

    const response = await proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://stawyusikory.vercel.app/login");
    expect(response.headers.get("cache-control")).toContain("private");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("set-cookie")).toContain("sb-test-auth-token=");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});
