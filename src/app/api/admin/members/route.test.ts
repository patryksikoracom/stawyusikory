import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ context: vi.fn(), service: vi.fn(), eq: vi.fn(), getUser: vi.fn(), response: { data: [{ user_id: "member", role: "viewer" }], count: 1, error: null } }));
vi.mock("@/lib/supabase/auth-context", () => ({ requireOrganization: mocks.context, isOrganizationEditor: (role: string) => ["owner", "admin"].includes(role) }));
vi.mock("@/lib/supabase/server", () => ({ createServiceClient: mocks.service }));
import { GET } from "./route";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.response.count = 1;
  mocks.context.mockResolvedValue({ role: "owner", organizationId: "own-org" });
  const query = { select: vi.fn(), eq: mocks.eq, order: vi.fn(), limit: vi.fn(async () => mocks.response) };
  query.select.mockReturnValue(query); query.eq.mockReturnValue(query); query.order.mockReturnValue(query);
  mocks.getUser.mockResolvedValue({ data: { user: { id: "member", email: "member@example.com", user_metadata: { display_name: "Member", privateField: "must-not-leak" } } }, error: null });
  mocks.service.mockReturnValue({ from: () => query, auth: { admin: { getUserById: mocks.getUser } } });
});
it.each(["viewer", "manager", "cleaning", "accounting", "marketing"])("denies %s before service-role access", async role => {
  mocks.context.mockResolvedValue({ role, organizationId: "own-org" });
  expect((await GET(new Request("https://example.com/api/admin/members"))).status).toBe(403);
  expect(mocks.service).not.toHaveBeenCalled();
});
it("returns only members of the selected organization without arbitrary auth metadata", async () => {
  const response = await GET(new Request("https://example.com/api/admin/members"));
  expect(response.status).toBe(200);
  expect(mocks.eq).toHaveBeenCalledWith("organization_id", "own-org");
  expect(mocks.getUser).toHaveBeenCalledWith("member");
  expect(await response.text()).not.toContain("must-not-leak");
  expect(response.headers.get("cache-control")).toContain("no-store");
});
it("does not present a truncated roster as complete", async () => {
  mocks.response.count = 101;
  expect((await GET(new Request("https://example.com/api/admin/members"))).status).toBe(503);
  expect(mocks.getUser).not.toHaveBeenCalled();
});
