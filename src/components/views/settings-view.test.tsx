// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
    upsertCommunicationConfig: noop,
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
  afterEach(cleanup);

  beforeEach(() => {
    mocks.updateSettings.mockReset();
    mocks.updateSettings.mockResolvedValue(true);
    vi.stubGlobal("fetch", vi.fn());
  });

  it("nie montuje formularza na danych startowych i zapisuje dopiero dane z chmury", async () => {
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
    expect(await screen.findByText("Ustawienia zostały zapisane.")).toBeInTheDocument();
  });

  it("nie pokazuje sukcesu bez potwierdzenia zapisu", async () => {
    mocks.updateSettings.mockResolvedValue(false);
    mocks.store.current = storeWithSettings("Stawy u Sikory", "ready");
    render(<SettingsView currentRole="owner" />);

    fireEvent.click(screen.getByRole("button", { name: "Zapisz ustawienia" }));

    expect(await screen.findByText(/Nie potwierdzono zapisu/)).toBeInTheDocument();
    expect(screen.queryByText("Ustawienia zostały zapisane.")).not.toBeInTheDocument();
  });

  it("odrzuca pustą nazwę przed wywołaniem store", async () => {
    mocks.store.current = storeWithSettings("Stawy u Sikory", "ready");
    render(<SettingsView currentRole="owner" />);

    fireEvent.change(screen.getByRole("textbox", { name: "Nazwa obiektu" }), {
      target: { value: " " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Zapisz ustawienia" }));

    expect(await screen.findByText(/Nie potwierdzono zapisu/)).toBeInTheDocument();
    expect(mocks.updateSettings).not.toHaveBeenCalled();
  });

  it("renderuje ustawienia dla starszych rekordów komunikacji bez nowych pól", () => {
    const store = storeWithSettings("Stawy u Sikory", "ready");
    store.data = {
      ...store.data,
      communicationConfigs: [{ id: "legacy", senderName: "Stawy u Sikory" }],
      messageTemplates: [{
        id: "legacy-template",
        name: "Stary szablon",
        purpose: "Potwierdzenie",
        channel: "E-mail",
        subject: "Rezerwacja",
        body: "Treść",
        version: 1,
        active: true,
      }],
    } as typeof store.data;
    mocks.store.current = store;

    expect(() => render(<SettingsView currentRole="owner" />)).not.toThrow();
    expect(screen.getByText("Stary szablon")).toBeInTheDocument();
    expect(screen.getByText("0 dozwolonych zmiennych · PL")).toBeInTheDocument();
  });

  it("pozwala właścicielowi wysłać izolowany test e-mail", async () => {
    mocks.store.current = storeWithSettings("Stawy u Sikory", "ready");
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      providerMessageId: "email_test_123",
    }), { status: 200, headers: { "content-type": "application/json" } }));
    render(<SettingsView currentRole="owner" />);

    expect(screen.getByRole("textbox", { name: "Adres testowego e-maila" })).toHaveValue("PatrykSikora98@gmail.com");
    fireEvent.click(screen.getByRole("button", { name: "Wyślij test e-mail" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/admin/email-test", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ email: "PatrykSikora98@gmail.com" }),
    })));
    expect(await screen.findByText(/email_test_123/)).toBeInTheDocument();
  });

  it("ukrywa test e-mail przed rolą tylko do odczytu", () => {
    mocks.store.current = storeWithSettings("Stawy u Sikory", "ready");
    render(<SettingsView currentRole="viewer" />);

    expect(screen.queryByRole("button", { name: "Wyślij test e-mail" })).not.toBeInTheDocument();
  });
  it("zachowuje instrukcję po odrzuceniu zapisu i czyści ją po potwierdzeniu", async () => {
    const store=storeWithSettings("Stawy u Sikory", "ready");
    store.upsertCommunicationConfig.mockResolvedValueOnce({ok:false,message:"Konflikt konfiguracji"}).mockResolvedValueOnce({ok:true});
    mocks.store.current=store;
    render(<SettingsView currentRole="owner"/>);
    fireEvent.change(screen.getByLabelText("Instrukcja dojazdu"),{target:{value:"Jedź od głównej drogi."}});
    fireEvent.change(screen.getByLabelText("Ostrzeżenie o trasie"),{target:{value:"Nie wjeżdżaj w las."}});
    fireEvent.click(screen.getByRole("button",{name:"Zatwierdź instrukcję dla domku"}));
    expect(await screen.findByText("Konflikt konfiguracji")).toBeInTheDocument();
    expect(screen.getByLabelText("Instrukcja dojazdu")).toHaveValue("Jedź od głównej drogi.");
    fireEvent.click(screen.getByRole("button",{name:"Zatwierdź instrukcję dla domku"}));
    expect(await screen.findByText("Instrukcja została zapisana.")).toBeInTheDocument();
    expect(screen.getByLabelText("Instrukcja dojazdu")).toHaveValue("");
    const first=store.upsertCommunicationConfig.mock.calls[0][0];
    const retry=store.upsertCommunicationConfig.mock.calls[1][0];
    expect(retry.travelGuides.length).toBe(first.travelGuides.length);
  });

});
