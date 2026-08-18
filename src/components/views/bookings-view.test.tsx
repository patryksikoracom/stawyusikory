// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initialData } from "@/lib/demo-data";
import type { AppData, Booking } from "@/lib/types";
import { BookingsView } from "./bookings-view";

const store = vi.hoisted(() => ({
  data: null as unknown as AppData,
  updateTask: vi.fn(),
  cancelBooking: vi.fn(),
  updateBooking: vi.fn(),
  restoreBooking: vi.fn(),
  addPayment: vi.fn(),
  addMessage: vi.fn(),
  updateScheduledMessage: vi.fn(),
  prepareDepartureDebriefs: vi.fn(),
  saveDepartureDebrief: vi.fn(),
  snoozeDepartureDebrief: vi.fn(),
  skipDepartureDebrief: vi.fn(),
}));
const router = vi.hoisted(() => ({
  back: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("@/components/layout/app-store", () => ({
  useAppStore: () => store,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

function bookingFixture(index: number): Booking {
  const source = initialData.bookings[0]!;
  return {
    ...source,
    id: `PERF-${String(index).padStart(4, "0")}`,
    guestLabel: `Wydajność ${String(index).padStart(4, "0")}`,
    platformReservationNo: undefined,
    importRef: undefined,
    checkIn: "2099-08-01",
    checkOut: "2099-08-04",
    workflowStatus: "Potwierdzona",
  };
}

describe("BookingsView — fundament UX", () => {
  beforeEach(() => {
    store.data = initialData;
    sessionStorage.clear();
    vi.clearAllMocks();
    store.cancelBooking.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("dla 1000 rekordów renderuje tylko jedną stronę po 40 pozycji", () => {
    store.data = {
      ...initialData,
      bookings: Array.from({ length: 1000 }, (_, index) => bookingFixture(index + 1)),
    };

    render(<BookingsView />);

    expect(screen.getByText("1000 wyników · 1–40")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Wydajność \d{4}/ })).toHaveLength(40);
    expect(screen.getByText("Strona 1 z 25")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Następna strona rezerwacji" }));

    expect(screen.getByText("1000 wyników · 41–80")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Wydajność \d{4}/ })).toHaveLength(40);
    expect(screen.getByText("Strona 2 z 25")).toBeInTheDocument();
  });

  it("anuluje rezerwację przez opisany alertdialog bez window.confirm", async () => {
    const nativeConfirm = vi.spyOn(window, "confirm");
    render(<BookingsView initialId={initialData.bookings[0]!.id} />);

    fireEvent.click(screen.getByRole("button", { name: "Akcje" }));
    fireEvent.click(screen.getByRole("button", { name: "Anuluj rezerwację" }));

    expect(screen.getByRole("alertdialog", { name: "Anulować rezerwację?" })).toBeInTheDocument();
    expect(screen.getByText(/Zewnętrzne kanały trzeba sprawdzić osobno/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tak, anuluj" }));

    expect(store.cancelBooking).toHaveBeenCalledWith(initialData.bookings[0]!.id);
    await waitFor(() => expect(screen.queryByRole("alertdialog", { name: "Anulować rezerwację?" })).not.toBeInTheDocument());
    expect(nativeConfirm).not.toHaveBeenCalled();
  });

  it("pozostawia dialog otwarty i pokazuje błąd, gdy anulowanie nie zostało zapisane", async () => {
    store.cancelBooking.mockResolvedValue({ ok: false, message: "Nie udało się pobrać najnowszej wersji rezerwacji." });
    render(<BookingsView initialId={initialData.bookings[0]!.id} />);

    fireEvent.click(screen.getByRole("button", { name: "Akcje" }));
    fireEvent.click(screen.getByRole("button", { name: "Anuluj rezerwację" }));
    fireEvent.click(screen.getByRole("button", { name: "Tak, anuluj" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Nie udało się pobrać najnowszej wersji rezerwacji.");
    expect(screen.getByRole("alertdialog", { name: "Anulować rezerwację?" })).toBeInTheDocument();
  });

  it("zachowuje filtry i udostępnia mobilny powrót do listy", () => {
    const view = render(<BookingsView />);
    fireEvent.change(screen.getByLabelText("Kanał rezerwacji"), {
      target: { value: "Booking" },
    });
    expect(JSON.parse(sessionStorage.getItem("stawy-os:booking-list-v1") ?? "{}")).toMatchObject({
      channel: "Booking",
    });

    view.unmount();
    render(<BookingsView initialId={initialData.bookings[0]!.id} />);

    fireEvent.click(screen.getByRole("button", {
      name: "Wróć do listy z zachowaniem filtrów",
    }));
    expect(router.back).toHaveBeenCalledOnce();
  });

  it("ukrywa przed operatorem niewydane zakładki i eksport", () => {
    render(<BookingsView initialId={initialData.bookings[0]!.id} role="manager" />);

    expect(screen.getByRole("button", { name: "Podsumowanie" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Historia" })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Płatności" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Wiadomości" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Eksport" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Napisz" })).not.toBeInTheDocument();
  });
});
