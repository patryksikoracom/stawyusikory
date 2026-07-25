// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
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
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

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

  it("pokazuje konflikt z porównaniem, kopią i świadomym odświeżeniem", () => {
    const reloadAfterConflict = vi.fn();
    const copyConflictChanges = vi.fn().mockResolvedValue(true);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mocks.store.current = {
      data: initialData,
      dataStatus: "ready" as const,
      syncMode: "conflict" as const,
      syncConflict: {
        source: "server-rejection",
        detectedAt: "2026-07-25T18:00:00.000Z",
        expectedVersion: 4,
        currentVersion: 5,
        requestId: "request-test-123",
        changes: [{ key: "bookings", label: "Rezerwacje", localChanges: 1, remoteChanges: 2 }],
      },
      lastSavedAt: undefined,
      retryDataLoad: vi.fn(),
      reloadAfterConflict,
      copyConflictChanges,
    };

    render(<AppShell identity={identity}><div>Treść aplikacji</div></AppShell>);

    const dialog = screen.getByRole("alertdialog", { name: "Inna karta zapisała nowszą wersję" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Skopiuj moje zmiany" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Porównaj zmiany" }));
    expect(within(dialog).getByText("Rezerwacje")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Wczytaj z chmury" }));
    expect(reloadAfterConflict).toHaveBeenCalledOnce();
  });
});
