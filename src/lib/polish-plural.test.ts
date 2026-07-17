import { describe, expect, it } from "vitest";
import { formatPolishCount, polishPlural } from "./polish-plural";

describe("polska odmiana liczebników", () => {
  it.each([
    [1, "dzień"],
    [2, "dni"],
    [5, "dni"],
    [12, "dni"],
    [22, "dni"],
  ])("odmienia %i poprawnie", (count, expected) => {
    expect(polishPlural(count, "dzień", "dni", "dni")).toBe(expected);
  });

  it("formatuje liczbę razem z rzeczownikiem", () => {
    expect(formatPolishCount(1, "płatność", "płatności", "płatności")).toBe("1 płatność");
    expect(formatPolishCount(3, "płatność", "płatności", "płatności")).toBe("3 płatności");
  });
});
