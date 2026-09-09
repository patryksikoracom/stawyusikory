import { describe, expect, it } from "vitest";
import { formatCurrency } from "./money";

describe("formatCurrency", () => {
  it("keeps grosze when the amount is not an integer", () => {
    expect(formatCurrency(3245.25).replaceAll(/\s/g, " ")).toBe("3245,25 zł");
  });

  it("does not add visual noise to whole amounts", () => {
    expect(formatCurrency(600).replaceAll(/\s/g, " ")).toBe("600 zł");
  });
});
