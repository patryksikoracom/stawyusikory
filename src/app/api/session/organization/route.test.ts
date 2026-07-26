import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

function request(organizationId: string) {
  return new Request("https://app.example.com/api/session/organization", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ organizationId }),
  });
}

describe("POST /api/session/organization", () => {
  beforeEach(() => {
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: mocks.maybeSingle,
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    mocks.maybeSingle.mockReset();
    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-a" } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue(query),
    });
  });

  it("ustawia HttpOnly cookie tylko dla własnego członkostwa", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: { organization_id: "11111111-1111-4111-8111-111111111111" },
      error: null,
    });
    const response = await POST(request("11111111-1111-4111-8111-111111111111"));

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("stawy-active-organization=");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("SameSite=lax");
  });

  it("nie pozwala ustawić organizacji spoza członkostw", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    const response = await POST(request("22222222-2222-4222-8222-222222222222"));

    expect(response.status).toBe(403);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
