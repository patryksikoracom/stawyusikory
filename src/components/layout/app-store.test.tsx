// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppData } from "@/lib/types";

describe("AppStoreProvider w trybie chmurowym", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("nie pokazuje demo i nie wysyła PUT przed zakończeniem pobierania", async () => {
    vi.useFakeTimers();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        clear: vi.fn(),
        getItem: vi.fn(() => null),
        key: vi.fn(() => null),
        length: 0,
        removeItem: vi.fn(),
        setItem: vi.fn(),
      },
    });

    let resolveLoad: ((value: { ok: boolean; status: number; json: () => Promise<unknown> }) => void) | undefined;
    const loadResponse = new Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>((resolve) => {
      resolveLoad = resolve;
    });
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => loadResponse)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ version: 2 }) });
    vi.stubGlobal("fetch", fetchMock);

    const { AppStoreProvider, useAppStore } = await import("./app-store");
    let store: ReturnType<typeof useAppStore> | undefined;

    function Probe() {
      store = useAppStore();
      return (
        <button onClick={() => store?.updateSettings({
          ...store.data.settings,
          organizationName: "Zapis po gotowości",
        })}>
          Zmień ustawienia
        </button>
      );
    }

    render(<AppStoreProvider><Probe /></AppStoreProvider>);
    await act(async () => {
      vi.advanceTimersByTime(0);
      await Promise.resolve();
    });

    expect(store?.dataStatus).toBe("loading");
    expect(store?.data.bookings).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Zmień ustawienia" }));
    await act(async () => {
      vi.advanceTimersByTime(800);
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const cloudSettings: AppData["settings"] = {
      ...store!.data.settings,
      organizationName: "Stawy u Sikory — chmura",
    };
    await act(async () => {
      resolveLoad?.({
        ok: true,
        status: 200,
        json: async () => ({ data: { settings: cloudSettings }, version: 1 }),
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(store?.dataStatus).toBe("ready");
    expect(store?.data.settings.organizationName).toBe("Stawy u Sikory — chmura");
    expect(store?.data.bookings).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Zmień ustawienia" }));
    await act(async () => {
      vi.advanceTimersByTime(701);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith("/api/state", expect.objectContaining({ method: "PUT" }));
  });
});
