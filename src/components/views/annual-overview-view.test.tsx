// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { initialData } from "@/lib/demo-data";
import { AnnualOverviewView } from "./annual-overview-view";

vi.mock("@/components/layout/app-store", () => ({
  useAppStore: () => ({ data: initialData }),
}));

describe("AnnualOverviewView", () => {
  afterEach(cleanup);

  it("shows twelve months per unit and labels the sales snapshot honestly", () => {
    render(<AnnualOverviewView />);

    expect(screen.getByRole("heading", { name: "Rok w jednym spojrzeniu" })).toBeInTheDocument();
    expect(screen.getAllByText("styczeń")).toHaveLength(initialData.units.length);
    expect(screen.getAllByText("grudzień")).toHaveLength(initialData.units.length);
    expect(screen.getByText(/Rok poprzedni używa tego samego dnia sprzedaży/)).toBeInTheDocument();
  });

  it("switches all four metrics without merging currencies", () => {
    render(<AnnualOverviewView />);

    for (const name of ["Wartość rezerwacji", "ADR", "Lead time", "Obłożenie"]) {
      fireEvent.click(screen.getByRole("button", { name }));
      expect(screen.getByRole("button", { name })).toHaveAttribute("aria-pressed", "true");
    }
    expect(screen.getByText(/PLN i EUR pozostają osobnymi liniami/)).toBeInTheDocument();
  });

  it("shows deterministic gap evidence and no automatic campaign action", () => {
    render(<AnnualOverviewView />);
    fireEvent.click(screen.getByRole("button", { name: "Wszystkie" }));

    expect(screen.getByRole("heading", { name: "Wolne ciągi z dowodem" })).toBeInTheDocument();
    expect(screen.getAllByText(/Brak automatycznej akcji/).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /uruchom kampanię/i })).not.toBeInTheDocument();
  });
});
