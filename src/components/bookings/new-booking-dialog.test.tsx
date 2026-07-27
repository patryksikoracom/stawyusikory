// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initialData } from "@/lib/demo-data";
import type { AppData } from "@/lib/types";
import { NewBookingDialog } from "./new-booking-dialog";

const store = vi.hoisted(() => ({
  data: null as unknown as AppData,
  addBooking: vi.fn(),
  updateBooking: vi.fn(),
  deleteBooking: vi.fn(),
}));

vi.mock("@/components/layout/app-store", () => ({
  useAppStore: () => store,
}));

describe("NewBookingDialog — PR-10c", () => {
  beforeEach(() => {
    store.data = initialData;
    vi.clearAllMocks();
  });

  afterEach(cleanup);

  function renderDialog() {
    render(
      <NewBookingDialog
        defaults={{
          unitId: initialData.units[0].id,
          checkIn: "2027-01-10",
          checkOut: "2027-01-12",
        }}
        onAdded={vi.fn()}
        onClose={vi.fn()}
      />,
    );
  }

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
});
