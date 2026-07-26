// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initialData } from "@/lib/demo-data";
import { addLocalDays, todayInPoland } from "@/lib/date";
import { CalendarView } from "./calendar-view";

const mocks = vi.hoisted(() => ({
  store: { current: null as unknown },
  addBlock: vi.fn(),
  updateBlock: vi.fn(),
}));

vi.mock("@/components/layout/app-store", () => ({
  useAppStore: () => mocks.store.current,
}));

function createStore(withBlock = false) {
  const today = todayInPoland();
  return {
    data: {
      ...initialData,
      bookings: [],
      tasks: [],
      scheduledMessages: [],
      blocks: withBlock
        ? [{
            id: "BLOCK-VIEW-1",
            unitId: initialData.units[0]!.id,
            dateFrom: today,
            dateTo: addLocalDays(today, 2),
            blockType: "Serwis" as const,
            reason: "Przegląd pompy",
            status: "Aktywna" as const,
            version: 3,
          }]
        : [],
    },
    addBlock: mocks.addBlock,
    updateBlock: mocks.updateBlock,
    prepareDepartureDebriefs: vi.fn(),
  };
}

describe("CalendarView — potwierdzane blokady", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    mocks.addBlock.mockReset();
    mocks.updateBlock.mockReset();
    mocks.addBlock.mockResolvedValue(true);
    mocks.updateBlock.mockResolvedValue(true);
    mocks.store.current = createStore();
  });

  it("czeka na potwierdzenie utworzenia i przypomina o Mobile Calendar", async () => {
    let resolveSave: ((saved: boolean) => void) | undefined;
    mocks.addBlock.mockReturnValue(new Promise<boolean>((resolve) => {
      resolveSave = resolve;
    }));
    render(<CalendarView />);

    fireEvent.click(screen.getByRole("button", { name: "Dodaj blokadę" }));
    expect(screen.getByRole("dialog", { name: "Dodaj blokadę terminu" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Powód" }), {
      target: { value: "  Serwis pompy  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Zapisz blokadę" }));

    expect(screen.getByRole("button", { name: "Zapisywanie…" })).toBeDisabled();
    expect(mocks.addBlock).toHaveBeenCalledWith(expect.objectContaining({
      id: expect.stringMatching(/^BLK-/),
      reason: "Serwis pompy",
      status: "Aktywna",
      version: 1,
    }));

    await act(async () => {
      resolveSave?.(true);
      await Promise.resolve();
    });

    expect(screen.queryByRole("dialog", { name: "Dodaj blokadę terminu" })).not.toBeInTheDocument();
    expect(screen.getByText(/Potwierdź ją jeszcze w Mobile Calendar/)).toBeInTheDocument();
  });

  it("nie zamyka formularza i nie pokazuje sukcesu po odrzuconym zapisie", async () => {
    mocks.addBlock.mockResolvedValue(false);
    render(<CalendarView />);

    fireEvent.click(screen.getByRole("button", { name: "Dodaj blokadę" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Powód" }), {
      target: { value: "Serwis pompy" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Zapisz blokadę" }));

    expect(await screen.findByText(/Nie potwierdzono zapisu blokady/)).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Dodaj blokadę terminu" })).toBeInTheDocument();
    expect(screen.queryByText(/Blokada została zapisana/)).not.toBeInTheDocument();
  });

  it("zamyka dialog klawiszem Escape, odblokowuje przewijanie i oddaje fokus", () => {
    render(<CalendarView />);
    const trigger = screen.getByRole("button", { name: "Dodaj blokadę" });

    fireEvent.click(trigger);
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "Dodaj blokadę terminu" })).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
    expect(trigger).toHaveFocus();
  });

  it("anuluje przez dostępny dialog i zachowuje blokadę po błędzie", async () => {
    mocks.store.current = createStore(true);
    mocks.updateBlock.mockResolvedValue(false);
    const confirm = vi.spyOn(window, "confirm");
    render(<CalendarView />);

    fireEvent.click(screen.getByTitle("Przegląd pompy · kliknij, aby anulować"));
    expect(screen.getByRole("alertdialog", { name: "Anulować blokadę?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Anuluj blokadę" }));

    expect(await screen.findByText(/Termin pozostaje zablokowany/)).toBeInTheDocument();
    expect(mocks.updateBlock).toHaveBeenCalledWith(expect.objectContaining({
      id: "BLOCK-VIEW-1",
      status: "Anulowana",
      version: 3,
    }));
    expect(screen.getByRole("alertdialog", { name: "Anulować blokadę?" })).toBeInTheDocument();
    expect(screen.getByTitle("Przegląd pompy · kliknij, aby anulować")).toBeInTheDocument();
    expect(confirm).not.toHaveBeenCalled();
  });
});
