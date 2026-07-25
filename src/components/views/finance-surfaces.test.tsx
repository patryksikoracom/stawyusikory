// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initialData } from "@/lib/demo-data";
import type { AppData } from "@/lib/types";
import {
  createFinanceReport,
  financeMetricValue,
  financePeriodForPreset,
} from "@/lib/metrics/finance-report";
import { BookingsView } from "./bookings-view";
import { DashboardView } from "./dashboard-view";

const store = vi.hoisted(() => ({
  data: null as unknown as AppData,
  lastSavedAt: "2026-07-25T12:00:00.000Z",
  updateTask: vi.fn(),
  prepareDepartureDebriefs: vi.fn(),
  markDeparturePrompted: vi.fn(),
  cancelBooking: vi.fn(),
  updateBooking: vi.fn(),
  restoreBooking: vi.fn(),
  addPayment: vi.fn(),
  addMessage: vi.fn(),
  updateScheduledMessage: vi.fn(),
}));

vi.mock("@/components/layout/app-store", () => ({
  useAppStore: () => store,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

describe("finance presentation across surfaces", () => {
  beforeEach(() => {
    store.data = initialData;
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-25T10:00:00.000Z"));
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("uses the same report labels, values and evidence links on Dashboard", () => {
    const report = createFinanceReport({
      data: initialData,
      period: financePeriodForPreset("month", "2026-07-25"),
      calculatedAt: store.lastSavedAt,
    });

    render(<DashboardView />);

    const financeSection = screen
      .getByRole("heading", { name: "Te same liczby, które otworzysz w Finansach" })
      .closest("section")!;

    for (const metric of report.metrics) {
      const link = within(financeSection).getByRole("link", {
        name: (accessibleName) => accessibleName.startsWith(`${metric.label} `),
      });
      expect(link.textContent?.replace(/\s/g, "")).toContain(
        financeMetricValue(metric).replace(/\s/g, ""),
      );
      expect(link).toHaveAttribute("href", `/finances#${metric.id}`);
    }
  });

  it("gives booking value, guest postings and balance equal weight", () => {
    render(<BookingsView initialId="G002" />);

    const expected = [
      ["Wartość pobytu", /1350.*zł/],
      ["Zaksięgowano od gościa", /300.*zł/],
      ["Pozostało", /1050.*zł/],
    ] as const;

    for (const [label, value] of expected) {
      const dataPoint = screen.getByText(label).parentElement!;
      expect(within(dataPoint).getByText(value)).toBeInTheDocument();
    }
    expect(screen.queryByText("Wartość rezerwacji")).not.toBeInTheDocument();
  });
});
