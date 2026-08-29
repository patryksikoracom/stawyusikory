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

    const timeline = screen.getByText("Domki").closest(".min-w-max")?.parentElement?.parentElement;
    const timelineRegion = screen.getByRole("region", { name: /Oś czasu rezerwacji/ });
    const legend = screen.getByText("Legenda i obsługa").closest("details");
    expect(timeline).toBeTruthy();
    expect(timeline).toHaveClass("order-[-1]");
    expect(legend).toBeTruthy();
    expect(timelineRegion.compareDocumentPosition(legend as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("Praca z kalendarzem")).toBeInTheDocument();
  });

  it("oszczędza szerokość krótką nazwą i odróżnia domki kolorem", () => {
    render(<CalendarView />);

    const compactName = screen.getByText("Rybaka");
    expect(compactName).toHaveClass("sm:hidden");
    expect(screen.getByText("6 os.")).toHaveClass("sm:hidden");
    expect(compactName.closest(".calendar-unit-label")?.querySelector(".calendar-unit-marker")).toBeInTheDocument();
  });

  it("utrzymuje nazwę miesiąca przy lewej krawędzi osi", () => {
    render(<CalendarView />);

    const monthLabel = screen.getAllByText(/\p{L}+\s+\d{4}/u)[0];
    expect(monthLabel).toHaveClass("sticky", "left-[80px]", "sm:left-[146px]", "whitespace-nowrap");
  });

  it("ukrywa skrót do importów przed Operatorem", () => {
    render(<CalendarView role="manager" />);

    expect(screen.getByRole("link", { name: "Arkusz rezerwacji" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Import danych" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dodaj blokadę" })).not.toBeInTheDocument();
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

  it("odróżnia bufor sprzątania od rezerwacji oczekującej na szczegóły", () => {
    const today = todayInPoland();
    mocks.store.current = {
      ...createStore(),
      data: {
        ...createStore().data,
        blocks: [
          {
            id: "ICAL-SRC-BOOKING-1",
            unitId: initialData.units[0]!.id,
            dateFrom: today,
            dateTo: addLocalDays(today, 2),
            blockType: "Inne" as const,
            reason: "[Booking] CLOSED - Not available",
            status: "Aktywna" as const,
          },
          {
            id: "ICAL-SRC-AIRBNB-1",
            unitId: initialData.units[1]!.id,
            dateFrom: addLocalDays(today, 1),
            dateTo: addLocalDays(today, 4),
            blockType: "Inne" as const,
            reason: "[Airbnb] Reserved",
            status: "Aktywna" as const,
          },
        ],
      },
    };
    render(<CalendarView />);

    expect(screen.getByRole("button", { name: /Bufor sprzątania · Booking, sprawdź lub zastąp rezerwacją/ })).toHaveClass("bg-[#f5e8c5]/95");
    expect(screen.getByRole("button", { name: /Airbnb · nowa rezerwacja, uzupełnij szczegóły/ })).toHaveClass("bg-[#f8ddd5]/95");
    expect(screen.queryByText("Inne")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Airbnb · nowa rezerwacja, uzupełnij szczegóły/ }));
    expect(screen.getByRole("dialog", { name: "Dodaj rezerwację" })).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Zastąp tę blokadę rezerwacją/));
    fireEvent.click(screen.getByRole("button", { name: /Dalej/ }));
    expect(screen.getByRole("combobox", { name: "Kanał zawarcia rezerwacji" })).toHaveValue("Airbnb");
  });

  it("pozwala otworzyć także szarą blokadę iCal do ręcznego zastąpienia", () => {
    const today = todayInPoland();
    mocks.store.current = {
      ...createStore(),
      data: {
        ...createStore().data,
        blocks: [{
          id: "ICAL-SRC-AIRBNB-CLOSED",
          unitId: initialData.units[1]!.id,
          dateFrom: today,
          dateTo: addLocalDays(today, 4),
          blockType: "Inne" as const,
          reason: "[Airbnb] Airbnb (Not available)",
          status: "Aktywna" as const,
        }],
      },
    };
    render(<CalendarView role="manager" />);

    fireEvent.click(screen.getByRole("button", { name: /Airbnb · zamknięte, sprawdź lub zastąp rezerwacją/ }));

    expect(screen.getByRole("dialog", { name: "Dodaj rezerwację" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Zastąp tę blokadę rezerwacją/)).toBeInTheDocument();
  });

  it("nie rozpycha wiersza domku przy wielu blokach iCal", () => {
    const today = todayInPoland();
    mocks.store.current = {
      ...createStore(),
      data: {
        ...createStore().data,
        blocks: Array.from({ length: 5 }, (_, index) => ({
          id: `ICAL-SRC-BOOKING-${index}`,
          unitId: initialData.units[1]!.id,
          dateFrom: addLocalDays(today, index * 2),
          dateTo: addLocalDays(today, index * 2 + 1),
          blockType: "Inne" as const,
          reason: "[Booking] CLOSED - Not available",
          status: "Aktywna" as const,
        })),
      },
    };
    render(<CalendarView />);

    expect(screen.getAllByRole("button", { name: /Bufor sprzątania · Booking/ }).map((bar) => bar.style.marginBottom))
      .toEqual(["8px", "32px", "8px", "32px", "8px"]);
  });

  it("nie maluje rezerwacji na czerwono przez jej odbicie iCal", () => {
    const today = todayInPoland();
    const booking = {
      ...initialData.bookings[0]!,
      id: "VISIBLE-BOOKING",
      unitId: initialData.units[0]!.id,
      checkIn: today,
      checkOut: addLocalDays(today, 3),
      platform: "Booking" as const,
    };
    mocks.store.current = {
      ...createStore(),
      data: {
        ...createStore().data,
        bookings: [booking],
        blocks: [{
          id: "ICAL-SRC-BOOKING-DUPLICATE",
          unitId: booking.unitId,
          dateFrom: booking.checkIn,
          dateTo: booking.checkOut,
          blockType: "Inne" as const,
          reason: "[Booking] CLOSED - Not available",
          status: "Aktywna" as const,
        }],
      },
    };
    render(<CalendarView />);

    const bar = screen.getByRole("link", { name: /VISIBLE-BOOKING|kanał Booking/ });
    expect(bar).toHaveClass("bg-[#27727d]");
    expect(bar).not.toHaveClass("bg-[#c94e37]");
    expect(screen.queryByRole("button", { name: /Booking · nowa rezerwacja/ })).not.toBeInTheDocument();
  });
});
