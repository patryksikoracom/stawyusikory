// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { initialData } from "@/lib/demo-data";
import type { AppIdentity } from "@/lib/auth/identity";
import { AppShell } from "./app-shell";

const mocks = vi.hoisted(() => ({
  store: { current: null as unknown },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

vi.mock("./app-store", () => ({
  AppStoreProvider: ({ children }: { children: ReactNode }) => children,
  clearPersistedAppData: vi.fn(),
  useAppStore: () => mocks.store.current,
}));

const identity: AppIdentity = {
  authenticated: true,
  displayName: "Codex Test",
  email: "codex-test@stawyusikory.pl",
  initials: "CT",
  organizationName: "Stawy u Sikory",
  role: "admin",
  roleLabel: "Administrator",
};

describe("AppShell przed zakończeniem ładowania", () => {
  it("nie ujawnia alertów wyliczonych z danych startowych", () => {
    mocks.store.current = {
      data: initialData,
      dataStatus: "loading" as const,
      syncMode: "checking" as const,
      lastSavedAt: undefined,
      retryDataLoad: vi.fn(),
    };
    render(<AppShell identity={identity}><div>Treść aplikacji</div></AppShell>);

    expect(screen.getByRole("button", { name: "Powiadomienia: brak" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Powiadomienia: 4" })).not.toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Ładowanie danych aplikacji" })).toBeInTheDocument();
    expect(screen.queryByText("Treść aplikacji")).not.toBeInTheDocument();
  });
});
