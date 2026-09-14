import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ context: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/supabase/auth-context", () => ({ requireOrganization: mocks.context }));
import { GET, PATCH } from "./route";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.context.mockResolvedValue({ role: "manager", user: { id: "my-user", email: "me@example.com", user_metadata: { display_name: "Pat", privateField: "private" } }, supabase: { auth: { updateUser: mocks.update } } });
  mocks.update.mockResolvedValue({ error: null });
});
it("uses the signed-in account to change only the display name", async () => {
  const response = await PATCH(new Request("https://example.com/api/account/profile", { method: "PATCH", body: JSON.stringify({ displayName: " Patryk " }) }));
  expect(response.status).toBe(200);
  expect(mocks.update).toHaveBeenCalledWith({ data: { display_name: "Patryk" } });
});
it.each([{ displayName: "Pat", role: "owner" }, { displayName: "Pat", userId: "other-user" }, { displayName: "" }])("rejects extra identity fields or invalid names", async payload => {
  expect((await PATCH(new Request("https://example.com/api/account/profile", { method: "PATCH", body: JSON.stringify(payload) }))).status).toBe(400);
  expect(mocks.update).not.toHaveBeenCalled();
});
it("does not return arbitrary account metadata", async () => {
  const response = await GET(new Request("https://example.com/api/account/profile"));
  expect(await response.json()).toEqual({ displayName: "Pat", email: "me@example.com", role: "Operator" });
  expect(response.headers.get("cache-control")).toContain("no-store");
});
