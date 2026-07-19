// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TeamAccessSettings } from "./team-access-settings";

describe("TeamAccessSettings", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("nie pokazuje zaproszeń użytkownikowi viewer", () => {
    render(<TeamAccessSettings currentRole="viewer" />);
    expect(screen.queryByRole("heading", { name: "Dostęp do Stawy OS" })).not.toBeInTheDocument();
  });

  it("administrator może wybrać wyłącznie rolę podglądu", () => {
    render(<TeamAccessSettings currentRole="admin" />);
    expect(screen.getByRole("option", { name: /Podgląd/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Administrator/ })).not.toBeInTheDocument();
  });

  it("właściciel może wysłać jawne zaproszenie administratora", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<TeamAccessSettings currentRole="owner" />);

    fireEvent.change(screen.getByRole("textbox", { name: "E-mail osoby" }), { target: { value: "NOWY@example.com" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Poziom dostępu" }), { target: { value: "admin" } });
    fireEvent.click(screen.getByRole("button", { name: "Wyślij zaproszenie" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/invitations", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ email: "NOWY@example.com", role: "admin" }),
    })));
    expect(await screen.findByRole("status")).toHaveTextContent("nowy@example.com");
  });

  it("właściciel może wybrać ograniczoną rolę sprzątania", () => {
    render(<TeamAccessSettings currentRole="owner" />);
    expect(screen.getByRole("option", { name: /Sprzątanie/ })).toBeInTheDocument();
  });
});
