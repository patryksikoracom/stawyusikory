// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { initialData } from "@/lib/demo-data";
import { GuestsView } from "./guests-view";

const mocks = vi.hoisted(() => ({
  store: { current: null as unknown },
}));

vi.mock("@/components/layout/app-store", () => ({
  useAppStore: () => mocks.store.current,
}));

function storeWithData(overrides: Partial<typeof initialData>) {
  return {
    data: { ...initialData, ...overrides },
    updateGuest: vi.fn(),
    updateConsent: vi.fn(),
  };
}

describe("GuestsView — uczciwe insighty", () => {
  beforeEach(() => {
    mocks.store.current = storeWithData({
      bookings: [initialData.bookings[0]],
      guests: [],
      consents: [],
      tasks: [],
      media: [],
      issues: [],
      departureDebriefs: [],
    });
  });

  it("nie pokazuje stałych segmentów ani sugestii bez danych", () => {
    render(<GuestsView />);

    expect(screen.getByText("Nie ma jeszcze danych do segmentacji")).toBeInTheDocument();
    expect(screen.getByText("0/1")).toBeInTheDocument();
    expect(screen.getAllByText("Brak danych")).toHaveLength(4);
    expect(screen.getByText("Rekomendacje biznesowe wyłączone")).toBeInTheDocument();
    expect(screen.queryByText("Rodziny i wędkarze")).not.toBeInTheDocument();
    expect(screen.queryByText(/Rodziny rezerwują wcześniej/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Edytuj profil/ }));
    expect(screen.getByRole("combobox", { name: "Kanał odkrycia" })).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "Sposób odkrycia" })).toHaveValue("");
  });

  it("pokazuje wyłącznie segment zapisany w profilu i opisuje granicę wniosku", () => {
    const booking = initialData.bookings[0];
    mocks.store.current = storeWithData({
      bookings: [booking],
      guests: [{ bookingId: booking.id, segment: "Wędkarze" }],
      consents: [],
      tasks: [],
      media: [],
      issues: [],
      departureDebriefs: [],
    });

    render(<GuestsView />);

    const segmentSection = screen.getByRole("region", { name: "Segmenty zapisane w profilach" });
    expect(within(segmentSection).getByRole("heading", { name: "Wędkarze" })).toBeInTheDocument();
    expect(within(segmentSection).getByText(/To liczebność, nie wniosek/)).toBeInTheDocument();
  });

  it("odróżnia brak rezerwacji od wyniku zero", () => {
    mocks.store.current = storeWithData({
      bookings: [],
      guests: [],
      consents: [],
      tasks: [],
      media: [],
      issues: [],
      departureDebriefs: [],
    });

    render(<GuestsView />);

    expect(screen.getByText("0/0")).toBeInTheDocument();
    expect(screen.getByText("Brak rezerwacji, na podstawie których można utworzyć profile gości.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Przejdź do rezerwacji/ })).toHaveAttribute("href", "/bookings");
  });
});
