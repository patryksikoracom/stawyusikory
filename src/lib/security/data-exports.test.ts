import { describe, expect, it } from "vitest";
import { initialData } from "@/lib/demo-data";
import { buildPricingAnalysisDataset, encryptJson, decryptJson } from "./data-exports";

describe("encrypted backup recovery", () => {
  const password = "test-only-passphrase-2026";
  it("recovers every collection, including archived bookings, without changing identifiers", async () => {
    const data = { ...initialData, bookings: initialData.bookings.map(item => ({ ...item, deletedAt: "2020-01-01", purgeAfter: "2020-01-31" })) };
    const encrypted = await encryptJson(data, password);
    expect(encrypted).not.toContain(data.bookings[0].guestLabel);
    expect(await decryptJson(encrypted, password)).toEqual(data);
  });
  it("rejects an incorrect password", async () => {
    const encrypted = await encryptJson(initialData, password);
    await expect(decryptJson(encrypted, "different-password")).rejects.toThrow("Nieprawidłowe hasło");
  });
  it("detects modified ciphertext", async () => {
    const envelope = JSON.parse(await encryptJson(initialData, password));
    envelope.ciphertext = (envelope.ciphertext[0] === "A" ? "B" : "A") + envelope.ciphertext.slice(1);
    await expect(decryptJson(JSON.stringify(envelope), password)).rejects.toThrow("uszkodzona kopia");
  });
  it("rejects unsupported KDF parameters before executing them", async () => {
    const envelope = JSON.parse(await encryptJson({}, password));
    envelope.kdf.iterations = 2_000_000_000;
    await expect(decryptJson(JSON.stringify(envelope), password)).rejects.toThrow("Nieobsługiwany format");
  });
});

describe("pricing analysis export", () => {
  it("keeps pricing signals and excludes guest-identifying fields", () => {
    const dataset = buildPricingAnalysisDataset(initialData);
    const serialized = JSON.stringify(dataset);
    expect(dataset.bookings).toHaveLength(initialData.bookings.length);
    expect(dataset.bookings[0]).toHaveProperty("grossPrice");
    expect(dataset.bookings[0]).toHaveProperty("bookingLeadDays");
    expect(serialized).not.toContain(initialData.bookings[0].guestLabel);
    expect(serialized).not.toContain("guestLabel");
    expect(serialized).not.toContain("phone");
    expect(serialized).not.toContain("email");
    expect(serialized).not.toContain("specialRequests");
  });

  it("keeps commission and payment processing fees separate", () => {
    const booking = initialData.bookings[0]!;
    const dataset = buildPricingAnalysisDataset({
      ...initialData,
      bookings: [{ ...booking, platform: "Booking" }],
      imports: [{
        id: "IMP-OTA-FEES",
        platform: "Booking",
        reservationNo: "BOOKING-1",
        matchedBookingId: booking.id,
        grossPrice: 1_000,
        commission: 150,
        paymentProcessingFee: 25,
        totalOtaFees: 175,
        payout: 825,
        currency: "PLN",
        transferStatus: "Przeniesione",
        dataQuality: "Pełne",
        missingFields: [],
        rawSource: "booking-payout.csv",
        sourceFile: "booking-payout.csv",
        version: 1,
        updatedAt: "2026-07-27T00:00:00.000Z",
      }],
    });

    expect(dataset.bookings[0]).toMatchObject({
      commission: 150,
      paymentProcessingFee: 25,
      totalOtaFees: 175,
      payout: 825,
    });
  });
});
