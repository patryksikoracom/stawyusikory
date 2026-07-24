// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ManagementScenarioLab } from "./management-scenario-lab";

describe("ManagementScenarioLab", () => {
  it("lets the owner verify profit, loss and direct commission behavior without saved data", () => {
    render(<ManagementScenarioLab/>);

    expect(screen.getByText("600 zł")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Pokaż stratę" }));
    expect(screen.getByText("-350 zł")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Kanał" }), {
      target: { value: "Bezpośrednio" },
    });
    expect(screen.getByRole("spinbutton", { name: /Prowizja OTA PLN/ })).toBeDisabled();
    expect(screen.getByText("-200 zł")).toBeInTheDocument();
    expect(screen.getByText("sprzedaż − koszt; bez prowizji OTA")).toBeInTheDocument();
  });
});
