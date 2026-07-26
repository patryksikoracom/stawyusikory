// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "./login-form";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  signInWithPassword: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
    refresh: mocks.refresh,
    replace: mocks.replace,
  }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      resetPasswordForEmail: mocks.resetPasswordForEmail,
      signInWithPassword: mocks.signInWithPassword,
    },
  }),
}));

function fillCredentials(email = " OWNER@EXAMPLE.COM ") {
  fireEvent.change(screen.getByRole("textbox", { name: "E-mail" }), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText("Hasło"), {
    target: { value: "bezpieczne-haslo" },
  });
}

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.signInWithPassword.mockResolvedValue({ error: null });
    mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    cleanup();
  });

  it("normalizuje e-mail i po sukcesie odświeża chronioną trasę", async () => {
    render(<LoginForm />);
    fillCredentials();

    fireEvent.click(screen.getByRole("button", { name: "Zaloguj się" }));

    await waitFor(() => expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: "owner@example.com",
      password: "bezpieczne-haslo",
    }));
    expect(mocks.replace).toHaveBeenCalledWith("/dashboard");
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("pokazuje bezpieczny komunikat przy odrzuceniu danych", async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: new Error("invalid credentials") });
    render(<LoginForm />);
    fillCredentials("konto@example.com");

    fireEvent.click(screen.getByRole("button", { name: "Zaloguj się" }));

    expect(await screen.findByText("Nie udało się zalogować. Sprawdź e-mail i hasło.")).toBeInTheDocument();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("wychodzi ze stanu oczekiwania i wyjaśnia awarię połączenia", async () => {
    mocks.signInWithPassword.mockRejectedValue(new Error("network unavailable"));
    render(<LoginForm />);
    fillCredentials("konto@example.com");

    fireEvent.click(screen.getByRole("button", { name: "Zaloguj się" }));

    expect(await screen.findByText("Nie udało się połączyć z logowaniem. Sprawdź internet i spróbuj ponownie.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zaloguj się" })).toBeEnabled();
  });

  it("wysyła reset hasła na znormalizowany adres i właściwy callback", async () => {
    render(<LoginForm />);
    fireEvent.change(screen.getByRole("textbox", { name: "E-mail" }), {
      target: { value: " KONTO@EXAMPLE.COM " },
    });

    fireEvent.click(screen.getByRole("button", { name: "Nie pamiętam hasła" }));

    await waitFor(() => expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith(
      "konto@example.com",
      { redirectTo: `${window.location.origin}/auth/callback?next=/reset-password` },
    ));
    expect(await screen.findByText("Link do zmiany hasła został wysłany.")).toBeInTheDocument();
  });
});
