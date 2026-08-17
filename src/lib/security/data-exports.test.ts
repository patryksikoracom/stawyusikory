import { describe, expect, it } from "vitest";
import { initialData } from "@/lib/demo-data";
import { buildPricingAnalysisDataset } from "./data-exports";

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
