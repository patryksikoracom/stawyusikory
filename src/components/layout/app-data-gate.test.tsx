// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppDataGate } from "./app-data-gate";

describe("AppDataGate", () => {
  it("nie renderuje formularzy ani metryk przed gotowością danych", () => {
    const { rerender } = render(
      <AppDataGate onRetry={vi.fn()} status="loading">
        <button>Zapisz ustawienia</button>
      </AppDataGate>,
    );

    expect(screen.getByRole("status", { name: "Ładowanie danych aplikacji" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Zapisz ustawienia" })).not.toBeInTheDocument();

    rerender(
      <AppDataGate onRetry={vi.fn()} status="ready">
        <button>Zapisz ustawienia</button>
      </AppDataGate>,
    );

    expect(screen.getByRole("button", { name: "Zapisz ustawienia" })).toBeInTheDocument();
  });

  it("pokazuje jawny błąd i pozwala ponowić pobieranie", () => {
    const onRetry = vi.fn();
    render(
      <AppDataGate onRetry={onRetry} status="error">
        <div>Dane</div>
      </AppDataGate>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Nie udało się pobrać danych");
    fireEvent.click(screen.getByRole("button", { name: "Pobierz dane ponownie" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
