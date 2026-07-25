import { describe, expect, it } from "vitest";
import { isInvalidRefreshTokenError, isSupabaseAuthCookie } from "./auth-errors";

describe("Supabase auth error handling", () => {
  it("recognizes a missing refresh token by error code", () => {
    expect(
      isInvalidRefreshTokenError({
        code: "refresh_token_not_found",
        message: "Invalid Refresh Token: Refresh Token Not Found",
        status: 400,
      }),
    ).toBe(true);
  });

  it("recognizes compatible 400 refresh-token errors without a code", () => {
    expect(
      isInvalidRefreshTokenError({
        message: "Invalid Refresh Token",
        status: 400,
      }),
    ).toBe(true);
  });

  it("does not hide unrelated authentication failures", () => {
    expect(isInvalidRefreshTokenError({ code: "unexpected_failure", status: 500 })).toBe(false);
    expect(isInvalidRefreshTokenError(new Error("network failure"))).toBe(false);
  });

  it("only selects Supabase authentication cookies for cleanup", () => {
    expect(isSupabaseAuthCookie("sb-project-auth-token")).toBe(true);
    expect(isSupabaseAuthCookie("sb-project-auth-token.0")).toBe(true);
    expect(isSupabaseAuthCookie("sb-project-code-verifier")).toBe(false);
    expect(isSupabaseAuthCookie("app-preferences")).toBe(false);
  });
});
