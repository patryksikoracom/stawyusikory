import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  context: { role: "owner", organizationId: "org-test" } as { role: string; organizationId: string; error?: Response },
  inviteUserByEmail: vi.fn(),
  deleteUser: vi.fn(),
  insertMembership: vi.fn(),
  createServiceClient: vi.fn(),
}));

vi.mock("@/lib/supabase/auth-context", () => ({
  requireOrganization: vi.fn(async () => mocks.context),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: mocks.createServiceClient,
}));

function request(body: unknown) {
  return new Request("https://app.example.com/api/admin/invitations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/invitations", () => {
  beforeEach(() => {
    mocks.context = { role: "owner", organizationId: "org-test" };
    mocks.inviteUserByEmail.mockReset().mockResolvedValue({ data: { user: { id: "user-invited" } }, error: null });
    mocks.deleteUser.mockReset().mockResolvedValue({ data: {}, error: null });
    mocks.insertMembership.mockReset().mockResolvedValue({ error: null });
    mocks.createServiceClient.mockReset().mockReturnValue({
      auth: { admin: { inviteUserByEmail: mocks.inviteUserByEmail, deleteUser: mocks.deleteUser } },
      from: vi.fn(() => ({ insert: mocks.insertMembership })),
    });
  });

  it("nie dopuszcza roli owner nawet dla właściciela", async () => {
    const response = await POST(request({ email: "nowy@example.com", role: "owner" }));

    expect(response.status).toBe(400);
    expect(mocks.inviteUserByEmail).not.toHaveBeenCalled();
  });

  it("przekazuje błąd uwierzytelnienia bez uruchamiania klienta administracyjnego", async () => {
    mocks.context = {
      role: "viewer",
      organizationId: "",
      error: Response.json({ error: "Wymagane logowanie" }, { status: 401 }),
    };
    const response = await POST(request({ email: "nowy@example.com", role: "viewer" }));

    expect(response.status).toBe(401);
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
  });

  it("blokuje zaproszenia dla roli viewer", async () => {
    mocks.context = { role: "viewer", organizationId: "org-test" };
    const response = await POST(request({ email: "nowy@example.com", role: "viewer" }));

    expect(response.status).toBe(403);
    expect(mocks.inviteUserByEmail).not.toHaveBeenCalled();
  });

  it("pozwala administratorowi zaprosić tylko rolę viewer", async () => {
    mocks.context = { role: "admin", organizationId: "org-test" };
    const forbidden = await POST(request({ email: "admin@example.com", role: "admin" }));
    const allowed = await POST(request({ email: "viewer@example.com", role: "viewer" }));

    expect(forbidden.status).toBe(403);
    expect(allowed.status).toBe(201);
    expect(mocks.insertMembership).toHaveBeenCalledWith({
      organization_id: "org-test",
      user_id: "user-invited",
      role: "viewer",
    });
  });

  it("pozwala właścicielowi utworzyć ograniczone konto sprzątania", async () => {
    const response = await POST(request({ email: "jadzia@example.com", role: "cleaning" }));

    expect(response.status).toBe(201);
    expect(mocks.insertMembership).toHaveBeenCalledWith({
      organization_id: "org-test",
      user_id: "user-invited",
      role: "cleaning",
    });
  });

  it("wycofuje nowo utworzone konto, gdy członkostwo nie może zostać zapisane", async () => {
    mocks.insertMembership.mockResolvedValue({ error: { message: "database rejected membership" } });
    const response = await POST(request({ email: "nowy@example.com", role: "admin" }));

    expect(response.status).toBe(500);
    expect(mocks.deleteUser).toHaveBeenCalledWith("user-invited");
  });

  it("kończy się bezpiecznie, gdy service role nie jest skonfigurowane", async () => {
    mocks.createServiceClient.mockReturnValue(null);
    const response = await POST(request({ email: "nowy@example.com", role: "viewer" }));

    expect(response.status).toBe(503);
    expect(mocks.inviteUserByEmail).not.toHaveBeenCalled();
  });

  it("nie ujawnia błędu dostawcy zaproszeń", async () => {
    mocks.inviteUserByEmail.mockResolvedValue({ data: { user: null }, error: { message: "SMTP credentials rejected: sensitive details" } });
    const response = await POST(request({ email: "nowy@example.com", role: "viewer" }));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "Nie udało się wysłać zaproszenia." });
  });

  it("zwraca konflikt bez ujawniania komunikatu dostawcy dla istniejącego konta", async () => {
    mocks.inviteUserByEmail.mockResolvedValue({ data: { user: null }, error: { message: "User already registered" } });
    const response = await POST(request({ email: "istnieje@example.com", role: "viewer" }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Konto z tym adresem już istnieje. Sprawdź obecnych użytkowników." });
    expect(mocks.insertMembership).not.toHaveBeenCalled();
  });
});
