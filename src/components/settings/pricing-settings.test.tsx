// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initialData } from "@/lib/demo-data";
import type { AppData, RateRule } from "@/lib/types";
import { PricingSettings } from "./pricing-settings";

const store = vi.hoisted(() => ({
  data: null as unknown as AppData,
  updateUnit: vi.fn().mockResolvedValue({ ok: true }),
  upsertRate: vi.fn().mockResolvedValue({ ok: true }),
  deleteRate: vi.fn().mockResolvedValue({ ok: true }),
  upsertCostSetting: vi.fn().mockResolvedValue({ ok: true }),
  deleteCostSetting: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("@/components/layout/app-store", () => ({ useAppStore: () => store }));

function completeRateForm() {
  fireEvent.change(screen.getByLabelText("Od"), { target: { value: "2030-06-01" } });
  fireEvent.change(screen.getByLabelText("Do — włącznie"), { target: { value: "2030-06-10" } });
  fireEvent.change(screen.getByLabelText("Cena / noc"), { target: { value: "620" } });
}

describe("PricingSettings — trwałe reguły cenowe", () => {
  beforeEach(() => {
    store.data = { ...initialData, rates: [] };
    vi.clearAllMocks();
    store.updateUnit.mockResolvedValue({ ok: true });
    store.upsertRate.mockResolvedValue({ ok: true });
    store.deleteRate.mockResolvedValue({ ok: true });
    store.upsertCostSetting.mockResolvedValue({ ok: true });
    store.deleteCostSetting.mockResolvedValue({ ok: true });
  });
  afterEach(cleanup);

  it("używa pierwszego domku także wtedy, gdy dane dotarły po pierwszym renderze", async () => {
    store.data = { ...initialData, units: [], rates: [] };
    const view = render(<PricingSettings />);
    store.data = { ...initialData, rates: [] };
    view.rerender(<PricingSettings />);

    completeRateForm();
    fireEvent.click(screen.getByRole("button", { name: "Dodaj sezon" }));

    await waitFor(() => expect(store.upsertRate).toHaveBeenCalledOnce());
    expect(store.upsertRate).toHaveBeenCalledWith(expect.objectContaining({
      unitId: initialData.units[0]!.id,
      dateFrom: "2030-06-01",
      dateTo: "2030-06-10",
      pricePerNight: 620,
    }));
    expect(screen.getByText("Reguła cenowa została potwierdzona przez serwer.")).toBeInTheDocument();
  });

  it("pokazuje błąd przy konkretnym polu i blokuje nakładającą się regułę", async () => {
    store.data = {
      ...initialData,
      rates: [{
        id: "RATE-EXISTING",
        unitId: initialData.units[0]!.id,
        season: "Wysoki",
        dateFrom: "2030-06-05",
        dateTo: "2030-06-20",
        pricePerNight: 600,
        minNights: 2,
        active: true,
      }],
    };
    render(<PricingSettings />);
    completeRateForm();
    fireEvent.click(screen.getByRole("button", { name: "Dodaj sezon" }));

    expect(await screen.findByText(/Zakres nakłada się na aktywną regułę/)).toBeInTheDocument();
    expect(store.upsertRate).not.toHaveBeenCalled();
  });

  it("potwierdza wyłączenie i wymaga potwierdzenia przed usunięciem", async () => {
    const rule: RateRule = {
      id: "RATE-CONTROL",
      unitId: initialData.units[0]!.id,
      season: "Specjalny",
      dateFrom: "2030-08-01",
      dateTo: "2030-08-10",
      pricePerNight: 700,
      minNights: 2,
      active: true,
    };
    store.data = { ...initialData, rates: [rule] };
    render(<PricingSettings />);

    fireEvent.click(screen.getByRole("button", { name: "Wyłącz" }));
    await waitFor(() => expect(store.upsertRate).toHaveBeenCalledWith({ ...rule, active: false }));
    expect(screen.getByText("Reguła została wyłączona.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Usuń sezon Specjalny" }));
    expect(screen.getByRole("dialog", { name: "Usunąć regułę cenową?" })).toBeInTheDocument();
    expect(store.deleteRate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Tak, usuń" }));
    await waitFor(() => expect(store.deleteRate).toHaveBeenCalledWith("RATE-CONTROL"));
    expect(screen.getByText("Reguła cenowa została usunięta i zapis potwierdzony.")).toBeInTheDocument();
  });
});
