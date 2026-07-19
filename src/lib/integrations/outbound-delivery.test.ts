import { describe, expect, it } from "vitest";
import { isSmsDeliveryEnabled } from "./outbound-delivery";

describe("outbound delivery gate", () => {
  it("jest domyślnie zamknięta", () => {
    expect(isSmsDeliveryEnabled(undefined)).toBe(false);
    expect(isSmsDeliveryEnabled("")).toBe(false);
    expect(isSmsDeliveryEnabled("false")).toBe(false);
    expect(isSmsDeliveryEnabled("TRUE")).toBe(false);
  });

  it("otwiera wysyłkę wyłącznie dla jawnej wartości true", () => {
    expect(isSmsDeliveryEnabled("true")).toBe(true);
  });
});
