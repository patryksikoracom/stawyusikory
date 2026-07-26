import { describe, expect, it, vi } from "vitest";
import { createMiddlewareClient } from "./middleware-client";

describe("createMiddlewareClient", () => {
  it("reads the same project-specific session cookie as createBrowserClient", () => {
    const { client } = createMiddlewareClient(
      "https://crfrxrudohpcmcadltbx.supabase.co",
      "test-key",
      {
        getAll: vi.fn().mockReturnValue([]),
        setAll: vi.fn(),
      },
    );

    expect((client as unknown as { storageKey: string }).storageKey).toBe(
      "sb-crfrxrudohpcmcadltbx-auth-token",
    );
  });
});
