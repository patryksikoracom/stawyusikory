// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initialData } from "@/lib/demo-data";
import { FinancesView } from "./finances-view";

const mocks = vi.hoisted(() => ({
  createObjectUrl: vi.fn(() => "blob:finance-export"),
  revokeObjectUrl: vi.fn(),
  anchorClick: vi.fn(),
}));

vi.mock("@/components/layout/app-store", () => ({
  useAppStore: () => ({
    data: initialData,
    addInvoice: vi.fn(),
    lastSavedAt: "2026-07-25T12:00:00.000Z",
  }),
}));

describe("FinancesView — PR-6c evidence flow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-25T10:00:00.000Z"));
    vi.stubGlobal("URL", {
      createObjectURL: mocks.createObjectUrl,
      revokeObjectURL: mocks.revokeObjectUrl,
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(mocks.anchorClick);
    window.history.replaceState(null, "", "/finances");
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("shows four named perspectives and opens the selected source records", () => {
    render(<FinancesView />);
    const region = screen.getByRole("region", { name: "Cztery perspektywy finansowe" });
    const cards = within(region).getAllByRole("button");

    expect(cards).toHaveLength(4);
    expect(cards.every((card) => card.getAttribute("aria-controls") === "finance-evidence-panel")).toBe(true);
    expect(within(region).getByText("Sprzedaż")).toBeInTheDocument();
    expect(within(region).getByText("Należności gości")).toBeInTheDocument();
    expect(within(region).getByText("Cashflow netto")).toBeInTheDocument();
    expect(within(region).getByText("Wynik zarządczy")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Sprzedaż ·/ })).toBeInTheDocument();

    fireEvent.click(within(region).getByText("Należności gości").closest("button")!);

    expect(screen.getByRole("heading", { name: /Należności gości ·/ })).toHaveAttribute("aria-live", "polite");
    expect(document.querySelector("#finance-evidence-panel")).toBeInTheDocument();
    expect(within(region).getByText("Nadpłaty: 0 PLN")).toBeInTheDocument();
  });

  it("supports a custom inclusive date range without showing a global historical total", () => {
    render(<FinancesView />);

    fireEvent.click(screen.getByRole("button", { name: "Własny" }));
    fireEvent.change(screen.getByLabelText("Początek własnego okresu"), {
      target: { value: "2026-07-01" },
    });
    fireEvent.change(screen.getByLabelText("Koniec własnego okresu"), {
      target: { value: "2026-07-31" },
    });

    expect(screen.getByLabelText("Początek własnego okresu")).toHaveValue("2026-07-01");
    expect(screen.getByLabelText("Koniec własnego okresu")).toHaveValue("2026-07-31");
    expect(screen.getAllByText(/1 lip 2026.*31 lip 2026/).length).toBeGreaterThan(0);
  });

  it("uses a metric deep link and creates an evidence CSV download", async () => {
    window.history.replaceState(null, "", "/finances#cashflow_posted_transactions_v1");
    render(<FinancesView />);
    const region = screen.getByRole("region", { name: "Cztery perspektywy finansowe" });
    const cashflowCard = within(region).getByText("Cashflow netto").closest("button")!;

    await act(async () => { vi.runOnlyPendingTimers(); });
    expect(cashflowCard).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Eksport z dowodami" }));

    expect(mocks.createObjectUrl).toHaveBeenCalledTimes(1);
    expect(mocks.anchorClick).toHaveBeenCalledTimes(1);
    expect(mocks.revokeObjectUrl).toHaveBeenCalledWith("blob:finance-export");
  });
});
