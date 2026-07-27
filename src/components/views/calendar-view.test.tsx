// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initialData } from "@/lib/demo-data";
import { addLocalDays, formatPolishDate, todayInPoland } from "@/lib/date";
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

  it("na telefonie startuje od osi czasu i ma jedną, zwartą nawigację", () => {
    render(<CalendarView />);

    expect(screen.getByRole("button", { name: "Oś czasu" })).toHaveClass("bg-white");
    expect(screen.getByRole("button", { name: "Przesuń kalendarz wstecz" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Przesuń kalendarz dalej" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /28 dni|42 dni|56 dni|Kompaktowy|Wygodny/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Przewiń kalendarz/ })).not.toBeInTheDocument();
  });

  it("pokazuje oś kalendarza przed instrukcjami i statystykami", () => {
    render(<CalendarView />);

    const timeline = screen.getByText("Domek").closest(".min-w-max")?.parentElement?.parentElement;
    expect(timeline).toBeTruthy();
    expect(timeline).toHaveClass("order-[-1]");
    expect(screen.getByText("Praca z kalendarzem")).toBeInTheDocument();
  });

  it("filtruje wyłącznie po kanałach rezerwacji, bez źródeł odkrycia", () => {
    mocks.store.current = {
      ...createStore(),
      data: {
        ...createStore().data,
        bookings: [
          { ...initialData.bookings[0]!, platform: "Booking" as const },
          { ...initialData.bookings[0]!, id: "FACEBOOK-SOURCE", platform: "Facebook" as const },
        ],
      },
    };
    render(<CalendarView />);

    const filter = screen.getByRole("combobox", { name: "Filtr kanału rezerwacji" });
    expect(filter).toHaveTextContent("Booking");
    expect(filter).not.toHaveTextContent("Facebook");
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

  it("tworzy ten sam draft po dwóch kliknięciach i zachowuje domek oraz daty", () => {
    render(<CalendarView />);
    const start = addLocalDays(todayInPoland(), 10);
    const end = addLocalDays(todayInPoland(), 13);
    const unit = initialData.units[0]!;

    fireEvent.click(screen.getByRole("button", {
      name: `Wybierz datę przyjazdu ${unit.name}, ${formatPolishDate(start)}`,
    }));
    expect(screen.getByText(/Wskaż datę wyjazdu/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", {
      name: `Wybierz datę wyjazdu ${unit.name}, ${formatPolishDate(end)}`,
    }));

    expect(screen.getByRole("dialog", { name: "Dodaj rezerwację" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Wybierz domek Rybak" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Przyjazd")).toHaveValue(start);
    expect(screen.getByLabelText("Wyjazd")).toHaveValue(end);
  });

  it("pokazuje konflikt przed otwarciem formularza", () => {
    const occupied = {
      ...initialData.bookings[0]!,
      id: "CALENDAR-CONFLICT",
      checkIn: addLocalDays(todayInPoland(), 10),
      checkOut: addLocalDays(todayInPoland(), 13),
      unitId: initialData.units[0]!.id,
    };
    mocks.store.current = {
      ...createStore(),
      data: { ...createStore().data, bookings: [occupied] },
    };
    render(<CalendarView />);

    fireEvent.click(screen.getByRole("button", {
      name: `Wybierz datę przyjazdu ${initialData.units[0]!.name}, ${formatPolishDate(occupied.checkIn)}`,
    }));
    fireEvent.click(screen.getByRole("button", {
      name: `Wybierz datę wyjazdu ${initialData.units[0]!.name}, ${formatPolishDate(occupied.checkOut)}`,
    }));

    expect(screen.getByText(/Nie można otworzyć wyceny/)).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Dodaj rezerwację" })).not.toBeInTheDocument();
  });

  it("otwiera ten sam draft po wyborze dat klawiszem Enter", () => {
    render(<CalendarView />);
    const start = addLocalDays(todayInPoland(), 15);
    const end = addLocalDays(todayInPoland(), 17);
    const unit = initialData.units[0]!;

    fireEvent.keyDown(screen.getByRole("button", {
      name: `Wybierz datę przyjazdu ${unit.name}, ${formatPolishDate(start)}`,
    }), { key: "Enter" });
    fireEvent.keyDown(screen.getByRole("button", {
      name: `Wybierz datę wyjazdu ${unit.name}, ${formatPolishDate(end)}`,
    }), { key: "Enter" });

    expect(screen.getByRole("dialog", { name: "Dodaj rezerwację" })).toBeInTheDocument();
    expect(screen.getByLabelText("Przyjazd")).toHaveValue(start);
    expect(screen.getByLabelText("Wyjazd")).toHaveValue(end);
  });

  it("otwiera wycenę po przeciągnięciu zakresu na desktopie", () => {
    render(<CalendarView />);
    const start = addLocalDays(todayInPoland(), 20);
    const end = addLocalDays(todayInPoland(), 23);
    const unit = initialData.units[0]!;
    const startButton = screen.getByRole("button", {
      name: `Wybierz datę przyjazdu ${unit.name}, ${formatPolishDate(start)}`,
    });
    const endButton = screen.getByRole("button", {
      name: `Wybierz datę przyjazdu ${unit.name}, ${formatPolishDate(end)}`,
    });

    fireEvent.pointerDown(startButton);
    fireEvent.pointerMove(endButton);
    fireEvent.pointerUp(endButton);

    expect(screen.getByRole("dialog", { name: "Dodaj rezerwację" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Wybierz domek Rybak" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Przyjazd")).toHaveValue(start);
    expect(screen.getByLabelText("Wyjazd")).toHaveValue(end);
  });

  it("pokazuje kanał tekstowo na pasku rezerwacji i jawny stan synchronizacji", () => {
    const visible = {
      ...initialData.bookings[0]!,
      checkIn: todayInPoland(),
      checkOut: addLocalDays(todayInPoland(), 3),
      platform: "Booking" as const,
    };
    mocks.store.current = {
      ...createStore(),
      data: { ...createStore().data, bookings: [visible] },
    };
    render(<CalendarView />);

    expect(screen.getByRole("link", {
      name: new RegExp(`${visible.guestLabel}, kanał Booking`),
    })).toBeInTheDocument();
    expect(screen.getByRole("region", {
      name: "Stan synchronizacji kalendarza",
    })).toBeInTheDocument();
  });
});
