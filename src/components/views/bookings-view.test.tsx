// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
    checkIn: "2026-08-01",
    checkOut: "2026-08-04",
    workflowStatus: "Potwierdzona",
  };
}

describe("BookingsView — fundament UX", () => {
  beforeEach(() => {
    store.data = initialData;
    sessionStorage.clear();
    vi.clearAllMocks();
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

  it("anuluje rezerwację przez opisany alertdialog bez window.confirm", () => {
    const nativeConfirm = vi.spyOn(window, "confirm");
    render(<BookingsView initialId={initialData.bookings[0]!.id} />);

    fireEvent.click(screen.getByRole("button", { name: "Akcje" }));
    fireEvent.click(screen.getByRole("button", { name: "Anuluj rezerwację" }));

    expect(screen.getByRole("alertdialog", { name: "Anulować rezerwację?" })).toBeInTheDocument();
    expect(screen.getByText(/Zewnętrzne kanały trzeba sprawdzić osobno/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tak, anuluj" }));

    expect(store.cancelBooking).toHaveBeenCalledWith(initialData.bookings[0]!.id);
    expect(nativeConfirm).not.toHaveBeenCalled();
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
});
