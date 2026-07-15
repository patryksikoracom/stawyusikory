import { describe, expect, it } from "vitest";
import { guestDisplayName, validateGuestStep } from "./booking-form";

describe("booking guest step", () => {
  it("allows moving to finances with either an individual name or reservation label", () => {
    expect(validateGuestStep("Bianka", "")).toBeUndefined();
    expect(validateGuestStep("", "Rodzina Kowalskich")).toBeUndefined();
    expect(guestDisplayName("Bianka", "Kowalska")).toBe("Bianka Kowalska");
  });

  it("returns a visible validation message only when both fields are empty", () => {
    expect(validateGuestStep(" ", " ")).toBe("Wpisz imię, nazwisko albo nazwę rezerwacji.");
  });
});
