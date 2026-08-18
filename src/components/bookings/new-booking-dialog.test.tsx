// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initialData } from "@/lib/demo-data";
import type { AppData } from "@/lib/types";
import { NewBookingDialog } from "./new-booking-dialog";

const store = vi.hoisted(() => ({
  data: null as unknown as AppData,
  addBooking: vi.fn(),
  updateBooking: vi.fn(),
  deleteBooking: vi.fn(),
  saveGuestProfile: vi.fn(),
}));

vi.mock("@/components/layout/app-store", () => ({
  useAppStore: () => store,
}));

describe("NewBookingDialog — PR-10c", () => {
  beforeEach(() => {
    store.data = initialData;
    vi.clearAllMocks();
    store.addBooking.mockResolvedValue({ ok: true });
    store.updateBooking.mockResolvedValue({ ok: true });
    store.deleteBooking.mockResolvedValue({ ok: true });
    store.saveGuestProfile.mockResolvedValue({ ok: true });
  });

  afterEach(cleanup);

  function renderDialog(onAdded = vi.fn()) {
    render(
      <NewBookingDialog
        defaults={{
          unitId: initialData.units[0].id,
          checkIn: "2027-01-10",
          checkOut: "2027-01-12",
        }}
        onAdded={onAdded}
        onClose={vi.fn()}
      />,
    );
  }

  function goToFinances() {
    fireEvent.click(screen.getByRole("button", { name: /Dalej/ }));
    fireEvent.change(screen.getByLabelText("Imię"), { target: { value: "Anna" } });
    fireEvent.click(screen.getByRole("button", { name: /Dalej/ }));
  }

  it("pokazuje wycenę podczas wyboru terminu i domki jako proste kafelki", () => {
    renderDialog();

    expect(screen.getByRole("button", { name: "Wybierz domek Rybak" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Wycena")).toBeInTheDocument();
    expect(screen.getAllByText(/2 nocy/).length).toBeGreaterThan(0);
  });

  it("izoluje poziome przewijanie wyłącznie do osi dat", () => {
    renderDialog();

    const dialog = screen.getByRole("dialog", { name: "Dodaj rezerwację" });
    const form = dialog.querySelector("form");
    const content = dialog.querySelector(".mobile-dialog-scroll");
    const timeline = screen.getByRole("region", { name: /Daty pobytu/ });

    expect(dialog).toHaveClass("mobile-dialog-surface");
    expect(form).toHaveClass("mobile-dialog-form");
    expect(content).toHaveClass("mobile-dialog-scroll");
    expect(content).toHaveClass("grid-cols-[minmax(0,1fr)]");
    expect(screen.getByRole("button", { name: "Anuluj" })).toHaveClass("mobile-dialog-cancel");
    expect(screen.getByLabelText("Przyjazd")).toHaveClass("min-w-0", "max-w-full");
    expect(screen.getByLabelText("Przyjazd").closest("label")).toHaveClass("grid-cols-[minmax(0,1fr)]");
    expect(timeline).toHaveClass("overflow-x-auto");
    expect(timeline).toHaveClass("max-w-full");
  });

  it("czeka na potwierdzenie serwera przed zamknięciem formularza", async () => {
    let confirmSave!: (value: { ok: true }) => void;
    store.addBooking.mockReturnValue(new Promise((resolve) => { confirmSave = resolve; }));
    const onAdded = vi.fn();
    renderDialog(onAdded);
    goToFinances();

    fireEvent.click(screen.getByRole("button", { name: "Dodaj rezerwację" }));

    expect(screen.getByRole("button", { name: /Zapisywanie/ })).toBeDisabled();
    expect(onAdded).not.toHaveBeenCalled();
    confirmSave({ ok: true });
    await waitFor(() => expect(onAdded).toHaveBeenCalledOnce());
  });

  it("zostawia formularz otwarty i pokazuje błąd zapisu", async () => {
    store.addBooking.mockResolvedValue({ ok: false, message: "Brak uprawnień do zapisu." });
    const onAdded = vi.fn();
    renderDialog(onAdded);
    goToFinances();

    fireEvent.click(screen.getByRole("button", { name: "Dodaj rezerwację" }));

    expect(await screen.findByText("Brak uprawnień do zapisu.")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Dodaj rezerwację" })).toBeInTheDocument();
    expect(onAdded).not.toHaveBeenCalled();
  });

  it("ukrywa domyślne godziny i pola dzieci do chwili jawnego wyjątku", () => {
    renderDialog();

    expect(screen.getByText(/Godziny standardowe:/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Wyjątkowa godzina przyjazdu")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Liczba dzieci")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Zmień godziny/ }));
    fireEvent.click(screen.getByRole("button", { name: "Dodaj dzieci" }));

    expect(screen.getByLabelText("Wyjątkowa godzina przyjazdu")).toBeInTheDocument();
    expect(screen.getByLabelText("Liczba dzieci")).toBeInTheDocument();
  });

  it("pozwala wybrać pobyt wizualnie i synchronizuje pola dat", () => {
    renderDialog();

    expect(screen.getByRole("region", { name: "Wizualny wybór terminu pobytu" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Ustaw przyjazd.*14.*2027/ }));
    fireEvent.click(screen.getByRole("button", { name: /Ustaw wyjazd.*17.*2027/ }));

    expect(screen.getByLabelText("Przyjazd")).toHaveValue("2027-01-14");
    expect(screen.getByLabelText("Wyjazd")).toHaveValue("2027-01-17");
    expect(screen.getAllByText(/3 nocy/).length).toBeGreaterThan(0);
  });

  it("nadal pozwala wpisać daty ręcznie i pokazuje je na osi", () => {
    renderDialog();

    fireEvent.change(screen.getByLabelText("Przyjazd"), { target: { value: "2027-01-11" } });
    fireEvent.change(screen.getByLabelText("Wyjazd"), { target: { value: "2027-01-15" } });

    expect(screen.getByRole("button", { name: /Ustaw przyjazd.*11.*2027/ })).toHaveTextContent("przyjazd");
    expect(screen.getByRole("button", { name: /Ustaw przyjazd.*15.*2027/ })).toHaveTextContent("wyjazd");
  });

  it("oddziela kanał, kontakt i odkrycie oraz stosuje zadatek 33% z jawnym wyjątkiem", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: /Dalej/ }));

    fireEvent.change(screen.getByLabelText("Imię"), { target: { value: "Anna" } });
    fireEvent.change(screen.getByLabelText("Kanał zawarcia rezerwacji"), {
      target: { value: "Booking" },
    });
    fireEvent.change(screen.getByLabelText("Jak gość odkrył obiekt?"), {
      target: { value: "Google" },
    });

    expect(screen.getByLabelText(/Numer rezerwacji OTA/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Prowizja OTA/)).toBeInTheDocument();
    expect(screen.getByText(/Zwierzęta: zasada i dopłata nie są jeszcze zatwierdzone/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Dalej/ }));

    expect(screen.getByText("Zadatek domyślny · 33%")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Wyjątkowa kwota zadatku/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ustaw wyjątek" }));
    expect(screen.getByLabelText(/Wyjątkowa kwota zadatku/)).toBeInTheDocument();
    expect(screen.getByText("Dane opcjonalne: faktura i adres")).toBeInTheDocument();
  });

  it("materializuje wskazany wpis iCal bez konfliktu z nim samym", async () => {
    const blockId = "ICAL-SRC-AIRBNB-RESERVED";
    store.data = {
      ...initialData,
      bookings: [],
      blocks: [{
        id: blockId,
        unitId: initialData.units[0].id,
        dateFrom: "2027-01-10",
        dateTo: "2027-01-12",
        blockType: "Inne",
        reason: "[Airbnb] Reserved",
        status: "Aktywna",
      }],
    };
    render(
      <NewBookingDialog
        defaults={{
          unitId: initialData.units[0].id,
          checkIn: "2027-01-10",
          checkOut: "2027-01-12",
          platform: "Airbnb",
          importRef: { source: "ical", key: blockId },
        }}
        onAdded={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("Termin wolny")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Dalej/ }));
    expect(screen.getByLabelText("Kanał zawarcia rezerwacji")).toHaveValue("Airbnb");
    fireEvent.change(screen.getByLabelText("Imię"), { target: { value: "Anna" } });
    fireEvent.click(screen.getByRole("button", { name: /Dalej/ }));
    fireEvent.click(screen.getByRole("button", { name: "Dodaj rezerwację" }));

    await waitFor(() => expect(store.addBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: "Airbnb",
        importRef: { source: "ical", key: blockId },
      }),
      expect.any(Object),
    ));
  });

  it("nie blokuje edycji wpisem iCal reprezentującym tę samą rezerwację", () => {
    const booking = {
      ...initialData.bookings[0]!,
      id: "BOOKING-EDIT-1",
      unitId: initialData.units[0].id,
      checkIn: "2027-01-10",
      checkOut: "2027-01-14",
      platform: "Booking" as const,
    };
    store.data = {
      ...initialData,
      bookings: [booking],
      blocks: [{
        id: "ICAL-SRC-BOOKING-EDIT-1",
        unitId: booking.unitId,
        dateFrom: booking.checkIn,
        dateTo: booking.checkOut,
        blockType: "Inne",
        reason: "[Booking] CLOSED - Not available",
        status: "Aktywna",
      }],
    };

    render(<NewBookingDialog booking={booking} onAdded={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByText("Termin wolny")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Dalej/ }));
    expect(screen.getByRole("heading", { name: "Gość i kontakt" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Usuń do kosza" })).toHaveClass("mobile-dialog-delete-late");
  });

  it("pozwala świadomie zastąpić bufor sprzątania, ale wymaga planu", async () => {
    const bufferId = "ICAL-SRC-AIRBNB-BUFFER";
    store.data = {
      ...initialData,
      bookings: [],
      blocks: [{
        id: bufferId,
        unitId: initialData.units[0].id,
        dateFrom: "2027-01-10",
        dateTo: "2027-01-11",
        blockType: "Inne",
        reason: "[Airbnb] Not available",
        status: "Aktywna",
      }],
    };
    renderDialog();

    expect(screen.getByText("Termin dostępny warunkowo · bufor sprzątania")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Dalej/ }));
    expect(screen.getByText("Wybierz sposób sprzątania i potwierdź świadome obejście buforu.")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Posprzątamy samodzielnie"));
    fireEvent.click(screen.getByLabelText(/Potwierdzam, że sprawdziłem termin/));
    fireEvent.click(screen.getByRole("button", { name: /Dalej/ }));
    fireEvent.change(screen.getByLabelText("Imię"), { target: { value: "Anna" } });
    fireEvent.click(screen.getByRole("button", { name: /Dalej/ }));
    fireEvent.click(screen.getByRole("button", { name: "Dodaj rezerwację" }));

    await waitFor(() => expect(store.addBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        availabilityOverride: expect.objectContaining({
          kind: "cleaning-buffer",
          blockIds: [bufferId],
          plan: "self-cleaning",
        }),
      }),
      expect.any(Object),
    ));
  });
});
