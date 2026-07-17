// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { initialData } from "@/lib/demo-data";
import { AppDataGate } from "@/components/layout/app-data-gate";
import { SettingsView } from "./settings-view";

const mocks = vi.hoisted(() => ({
  store: { current: null as unknown },
  updateSettings: vi.fn(),
}));

vi.mock("@/components/layout/app-store", () => ({
  useAppStore: () => mocks.store.current,
}));

function storeWithSettings(organizationName: string, dataStatus: "loading" | "ready") {
  const noop = vi.fn();
  return {
    data: {
      ...initialData,
      settings: { ...initialData.settings, organizationName },
    },
    dataStatus,
    syncMode: dataStatus === "ready" ? "cloud" : "checking",
    updateSettings: mocks.updateSettings,
    exportSnapshot: noop,
    resetDemo: noop,
    updateUnit: noop,
    upsertRate: noop,
    deleteRate: noop,
    upsertCostSetting: noop,
    deleteCostSetting: noop,
  };
}

describe("SettingsView po twardym odświeżeniu", () => {
  beforeEach(() => {
    mocks.updateSettings.mockReset();
  });

  it("nie montuje formularza na danych startowych i zapisuje dopiero dane z chmury", () => {
    mocks.store.current = storeWithSettings("Nazwa startowa", "loading");
    const { rerender } = render(
      <AppDataGate onRetry={vi.fn()} status="loading">
        <SettingsView currentRole="admin" />
      </AppDataGate>,
    );

    expect(screen.queryByRole("button", { name: "Zapisz ustawienia" })).not.toBeInTheDocument();

    mocks.store.current = storeWithSettings("Stawy u Sikory — chmura", "ready");
    rerender(
      <AppDataGate onRetry={vi.fn()} status="ready">
        <SettingsView currentRole="admin" />
      </AppDataGate>,
    );

    expect(screen.getByRole("textbox", { name: "Nazwa obiektu" })).toHaveValue("Stawy u Sikory — chmura");
    expect(screen.getByText("Administrator")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pobierz zaszyfrowany backup" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Zapisz ustawienia" }));

    expect(mocks.updateSettings).toHaveBeenCalledOnce();
    expect(mocks.updateSettings).toHaveBeenCalledWith(expect.objectContaining({
      organizationName: "Stawy u Sikory — chmura",
    }));
  });
});
