// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppData } from "@/lib/types";

describe("AppStoreProvider w trybie chmurowym", () => {
  afterEach(() => {
    cleanup();
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

  it("zatrzymuje zapis z brudnej karty po sygnale z drugiej sesji i zachowuje lokalne zmiany", async () => {
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

    class FakeBroadcastChannel {
      static instances: FakeBroadcastChannel[] = [];
      onmessage: ((event: MessageEvent) => void) | null = null;
      constructor(public name: string) {
        FakeBroadcastChannel.instances.push(this);
      }
      close() {}
      postMessage() {}
      emit(data: unknown) {
        this.onmessage?.({ data } as MessageEvent);
      }
    }
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);

    const cloudData = {
      settings: {
        organizationName: "Stan bazowy",
        timezone: "Europe/Warsaw",
        cleaningContactName: "",
        cleaningPhone: "",
        defaultCheckIn: "16:00",
        defaultCheckOut: "11:00",
        aiApprovalRequired: true,
      },
    };
    let resolveComparison: ((value: {
      ok: boolean;
      status: number;
      json: () => Promise<unknown>;
    }) => void) | undefined;
    const comparisonResponse = new Promise<{
      ok: boolean;
      status: number;
      json: () => Promise<unknown>;
    }>((resolve) => {
      resolveComparison = resolve;
    });
    const latestCloudResponse = {
      ok: true,
      status: 200,
      json: async () => ({
        data: { settings: { ...cloudData.settings, organizationName: "Zmiana z drugiej karty" } },
        version: 5,
        updatedAt: "2026-07-25T18:20:00.000Z",
      }),
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: cloudData, version: 4 }),
      })
      .mockImplementationOnce(() => comparisonResponse)
      .mockResolvedValueOnce(latestCloudResponse);
    vi.stubGlobal("fetch", fetchMock);

    const { AppStoreProvider, useAppStore } = await import("./app-store");
    let store: ReturnType<typeof useAppStore> | undefined;

    function Probe() {
      store = useAppStore();
      return (
        <button onClick={() => store?.updateSettings({
          ...store.data.settings,
          organizationName: "Moja niezapisana zmiana",
        })}>
          Zmień lokalnie
        </button>
      );
    }

    render(<AppStoreProvider><Probe /></AppStoreProvider>);
    await act(async () => {
      vi.advanceTimersByTime(0);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(store?.dataStatus).toBe("ready");

    fireEvent.click(screen.getByRole("button", { name: "Zmień lokalnie" }));
    expect(store?.data.settings.organizationName).toBe("Moja niezapisana zmiana");

    await act(async () => {
      FakeBroadcastChannel.instances[0]?.emit({
        type: "state-committed",
        tabId: "inna-karta",
        requestId: "request-z-innej-karty",
        version: 5,
        savedAt: "2026-07-25T18:20:00.000Z",
      });
      await Promise.resolve();
      await Promise.resolve();
      vi.advanceTimersByTime(800);
      await Promise.resolve();
    });

    expect(store?.syncMode).toBe("conflict");
    expect(store?.data.settings.organizationName).toBe("Moja niezapisana zmiana");
    expect(store?.syncConflict).toMatchObject({
      source: "another-tab",
      expectedVersion: 4,
      currentVersion: 5,
    });
    expect(store?.syncConflict?.changes).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "settings", localChanges: 1 }),
    ]));
    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === "PUT")).toHaveLength(0);

    await act(async () => {
      store?.reloadAfterConflict();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(store?.data.settings.organizationName).toBe("Zmiana z drugiej karty");
    expect(store?.syncConflict).toBeUndefined();

    await act(async () => {
      resolveComparison?.(latestCloudResponse);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(store?.syncMode).toBe("cloud");
    expect(store?.syncConflict).toBeUndefined();
  });

  it("aktualizuje zadanie komendą rekordową bez pełnego PUT stanu", async () => {
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

    const task = {
      id: "TASK-RECORD-1",
      bookingId: "BOOKING-1",
      type: "Sprzątanie" as const,
      priority: "Wysoki" as const,
      status: "Do zrobienia" as const,
      owner: "Tata",
      title: "Przygotuj domek",
      version: 3,
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { tasks: [task] }, version: 8 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          task: {
            ...task,
            status: "W toku",
            version: 4,
            updatedAt: "2026-07-25T20:00:01.000Z",
          },
          recordVersion: 4,
          stateVersion: 9,
          savedAt: "2026-07-25T20:00:01.000Z",
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const { AppStoreProvider, useAppStore } = await import("./app-store");
    let store: ReturnType<typeof useAppStore> | undefined;

    function Probe() {
      store = useAppStore();
      const current = store.data.tasks[0];
      return (
        <button onClick={() => current && store?.updateTask({ ...current, status: "W toku" })}>
          Rozpocznij zadanie
        </button>
      );
    }

    render(<AppStoreProvider><Probe /></AppStoreProvider>);
    await act(async () => {
      vi.advanceTimersByTime(0);
      await Promise.resolve();
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole("button", { name: "Rozpocznij zadanie" }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      vi.advanceTimersByTime(800);
      await Promise.resolve();
    });

    expect(store?.data.tasks[0]).toMatchObject({ status: "W toku", version: 4 });
    expect(fetchMock).toHaveBeenCalledWith("/api/tasks/TASK-RECORD-1", expect.objectContaining({
      method: "PATCH",
    }));
    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === "PUT")).toHaveLength(0);
    const commandBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(commandBody).toMatchObject({
      expectedRecordVersion: 3,
      task: { id: "TASK-RECORD-1", status: "W toku", version: 4 },
    });
  });

  it("aktualizuje punkt checklisty komendą rekordową bez pełnego PUT stanu", async () => {
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

    const checklistItem = {
      id: "CHECK-RECORD-1",
      taskId: "TASK-RECORD-1",
      label: "Sprawdź czujnik dymu",
      done: false,
      version: 5,
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { checklistItems: [checklistItem] }, version: 8 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          item: {
            ...checklistItem,
            done: true,
            completedAt: "2026-07-25T20:00:01.000Z",
            version: 6,
            updatedAt: "2026-07-25T20:00:01.000Z",
          },
          recordVersion: 6,
          stateVersion: 9,
          savedAt: "2026-07-25T20:00:01.000Z",
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const { AppStoreProvider, useAppStore } = await import("./app-store");
    let store: ReturnType<typeof useAppStore> | undefined;

    function Probe() {
      store = useAppStore();
      const current = store.data.checklistItems[0];
      return (
        <button onClick={() => current && store?.toggleChecklistItem({ ...current, done: true })}>
          Ukończ punkt
        </button>
      );
    }

    render(<AppStoreProvider><Probe /></AppStoreProvider>);
    await act(async () => {
      vi.advanceTimersByTime(0);
      await Promise.resolve();
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole("button", { name: "Ukończ punkt" }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      vi.advanceTimersByTime(800);
      await Promise.resolve();
    });

    expect(store?.data.checklistItems[0]).toMatchObject({ done: true, version: 6 });
    expect(fetchMock).toHaveBeenCalledWith("/api/checklist-items/CHECK-RECORD-1", expect.objectContaining({
      method: "PATCH",
    }));
    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === "PUT")).toHaveLength(0);
    const commandBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(commandBody).toMatchObject({
      expectedRecordVersion: 5,
      item: { id: "CHECK-RECORD-1", done: true, version: 6 },
    });
  });

  it("nie nadpisuje nowszego kliknięcia starszą odpowiedzią komendy checklisty", async () => {
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

    const checklistItem = {
      id: "CHECK-RAPID-1",
      taskId: "TASK-RAPID-1",
      label: "Zamknij okna",
      done: false,
      version: 5,
    };
    type FetchResponse = {
      ok: boolean;
      status: number;
      json: () => Promise<unknown>;
    };
    let resolveFirst: ((response: FetchResponse) => void) | undefined;
    let resolveSecond: ((response: FetchResponse) => void) | undefined;
    const firstCommand = new Promise<FetchResponse>((resolve) => { resolveFirst = resolve; });
    const secondCommand = new Promise<FetchResponse>((resolve) => { resolveSecond = resolve; });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { checklistItems: [checklistItem] }, version: 8 }),
      })
      .mockImplementationOnce(() => firstCommand)
      .mockImplementationOnce(() => secondCommand);
    vi.stubGlobal("fetch", fetchMock);

    const { AppStoreProvider, useAppStore } = await import("./app-store");
    let store: ReturnType<typeof useAppStore> | undefined;

    function Probe() {
      store = useAppStore();
      const current = store.data.checklistItems[0];
      return (
        <button onClick={() => current && store?.toggleChecklistItem({ ...current, done: !current.done })}>
          Przełącz punkt
        </button>
      );
    }

    render(<AppStoreProvider><Probe /></AppStoreProvider>);
    await act(async () => {
      vi.advanceTimersByTime(0);
      await Promise.resolve();
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole("button", { name: "Przełącz punkt" }));
    await act(async () => { await Promise.resolve(); });
    expect(store?.data.checklistItems[0]).toMatchObject({ done: true, version: 6 });

    fireEvent.click(screen.getByRole("button", { name: "Przełącz punkt" }));
    await act(async () => { await Promise.resolve(); });
    expect(store?.data.checklistItems[0]).toMatchObject({ done: false, version: 7 });

    await act(async () => {
      resolveFirst?.({
        ok: true,
        status: 200,
        json: async () => ({
          item: { ...checklistItem, done: true, version: 6, updatedAt: "2026-07-25T20:00:01.000Z" },
          recordVersion: 6,
          stateVersion: 9,
          savedAt: "2026-07-25T20:00:01.000Z",
        }),
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(store?.data.checklistItems[0]).toMatchObject({ done: false, version: 7 });
    expect(fetchMock).toHaveBeenCalledTimes(3);

    await act(async () => {
      resolveSecond?.({
        ok: true,
        status: 200,
        json: async () => ({
          item: { ...checklistItem, done: false, version: 7, updatedAt: "2026-07-25T20:00:02.000Z" },
          recordVersion: 7,
          stateVersion: 10,
          savedAt: "2026-07-25T20:00:02.000Z",
        }),
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(store?.data.checklistItems[0]).toMatchObject({ done: false, version: 7 });
    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === "PUT")).toHaveLength(0);
    const secondBody = JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body));
    expect(secondBody).toMatchObject({
      expectedRecordVersion: 6,
      item: { id: "CHECK-RAPID-1", done: false, version: 7 },
    });
  });

  it("odkłada odświeżenie z drugiej karty do zakończenia komendy rekordowej", async () => {
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

    class FakeBroadcastChannel {
      static instances: FakeBroadcastChannel[] = [];
      onmessage: ((event: MessageEvent) => void) | null = null;
      constructor(public name: string) { FakeBroadcastChannel.instances.push(this); }
      close() {}
      postMessage() {}
      emit(data: unknown) { this.onmessage?.({ data } as MessageEvent); }
    }
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);

    const checklistItem = {
      id: "CHECK-EXTERNAL-1",
      taskId: "TASK-EXTERNAL-1",
      label: "Sprawdź drzwi",
      done: false,
      version: 2,
    };
    type FetchResponse = {
      ok: boolean;
      status: number;
      json: () => Promise<unknown>;
    };
    let resolveCommand: ((response: FetchResponse) => void) | undefined;
    const commandResponse = new Promise<FetchResponse>((resolve) => { resolveCommand = resolve; });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { checklistItems: [checklistItem] }, version: 4 }),
      })
      .mockImplementationOnce(() => commandResponse)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            checklistItems: [{
              ...checklistItem,
              done: true,
              completedAt: "2026-07-25T20:00:01.000Z",
              version: 3,
            }],
          },
          version: 6,
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const { AppStoreProvider, useAppStore } = await import("./app-store");
    let store: ReturnType<typeof useAppStore> | undefined;

    function Probe() {
      store = useAppStore();
      const current = store.data.checklistItems[0];
      return (
        <button onClick={() => current && store?.toggleChecklistItem({ ...current, done: true })}>
          Zapisz punkt
        </button>
      );
    }

    render(<AppStoreProvider><Probe /></AppStoreProvider>);
    await act(async () => {
      vi.advanceTimersByTime(0);
      await Promise.resolve();
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole("button", { name: "Zapisz punkt" }));
    await act(async () => { await Promise.resolve(); });
    FakeBroadcastChannel.instances[0]?.emit({
      type: "state-committed",
      tabId: "another-tab",
      requestId: "external-request",
      version: 5,
      savedAt: "2026-07-25T20:00:00.000Z",
    });
    await act(async () => { await Promise.resolve(); });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(store?.data.checklistItems[0]).toMatchObject({ done: true, version: 3 });

    await act(async () => {
      resolveCommand?.({
        ok: true,
        status: 200,
        json: async () => ({
          item: {
            ...checklistItem,
            done: true,
            completedAt: "2026-07-25T20:00:01.000Z",
            version: 3,
          },
          recordVersion: 3,
          stateVersion: 6,
          savedAt: "2026-07-25T20:00:01.000Z",
        }),
      });
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2]?.[0]).toBe("/api/state");
    expect(store?.dataStatus).toBe("ready");
    expect(store?.data.checklistItems[0]).toMatchObject({ done: true, version: 3 });
  });

  it("tworzy rezerwację z zadaniami, checklistą i komunikacją bez pełnego PUT", async () => {
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

    const booking = {
      id: "BOOKING-AGGREGATE-1",
      bookingDate: "2099-07-25",
      source: "Panel Stawy OS",
      platform: "Bezpośrednio" as const,
      unitId: "domek-4",
      checkIn: "2099-08-10",
      checkOut: "2099-08-13",
      arrivalTime: "16:00",
      departureTime: "11:00",
      adults: 2,
      children: 1,
      guestLabel: "Anna Testowa",
      grossPrice: 2100,
      paymentStatus: "Zaliczka" as const,
      workflowStatus: "Nowa" as const,
      createdBy: "Stawy OS",
    };
    const contact = {
      bookingId: booking.id,
      phone: "+48 600 000 000",
      email: "anna@example.com",
      marketingConsent: "Do dopytania" as const,
      photoFbConsent: "Do dopytania" as const,
      photoSiteAdsConsent: "Do dopytania" as const,
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { bookings: [] }, version: 20 }),
      })
      .mockImplementationOnce(async (_url: string, options?: RequestInit) => {
        const body = JSON.parse(String(options?.body));
        return {
          ok: true,
          status: 200,
          json: async () => ({
            aggregate: body.aggregate,
            stateVersion: 21,
            savedAt: "2099-07-25T20:00:01.000Z",
          }),
        };
      });
    vi.stubGlobal("fetch", fetchMock);

    const { AppStoreProvider, useAppStore } = await import("./app-store");
    let store: ReturnType<typeof useAppStore> | undefined;

    function Probe() {
      store = useAppStore();
      return (
        <button onClick={() => store?.addBooking(booking, contact)}>
          Dodaj agregat
        </button>
      );
    }

    render(<AppStoreProvider><Probe /></AppStoreProvider>);
    await act(async () => {
      vi.advanceTimersByTime(0);
      await Promise.resolve();
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole("button", { name: "Dodaj agregat" }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      vi.advanceTimersByTime(800);
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/bookings", expect.objectContaining({ method: "POST" }));
    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === "PUT")).toHaveLength(0);
    const commandBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(commandBody.aggregate).toMatchObject({
      booking: { id: booking.id, version: 1 },
      contact: { bookingId: booking.id },
    });
    expect(commandBody.aggregate.tasks).toHaveLength(5);
    expect(commandBody.aggregate.tasks.every((task: { bookingId: string }) => task.bookingId === booking.id)).toBe(true);
    expect(commandBody.aggregate.checklistItems).toHaveLength(4);
    expect(commandBody.aggregate.scheduledMessages).toHaveLength(8);
    expect(store?.data.bookings[0]).toMatchObject({ id: booking.id, version: 1 });
    expect(store?.data.tasks.filter((task) => task.bookingId === booking.id)).toHaveLength(5);
    expect(store?.data.scheduledMessages.filter((message) => message.bookingId === booking.id)).toHaveLength(8);
    expect(store?.syncMode).toBe("cloud");
  });
});
