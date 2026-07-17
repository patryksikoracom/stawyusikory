import { describe, expect, it } from "vitest";
import { initialData } from "@/lib/demo-data";
import { deriveGuestInsightSummary } from "./guest-insights";

describe("guest insight summary", () => {
  it("nie tworzy segmentów ani procentów bez rekordów źródłowych", () => {
    const summary = deriveGuestInsightSummary({
      ...initialData,
      bookings: [],
      guests: [],
      consents: [],
    });

    expect(summary.segments).toEqual([]);
    expect(summary.profileCount).toBe(0);
    expect(summary.contactCoverage).toBeNull();
    expect(summary.averageNps).toBeNull();
  });

  it("liczy wyłącznie segmenty zapisane przy widocznych rezerwacjach", () => {
    const [first, second] = initialData.bookings;
    const summary = deriveGuestInsightSummary({
      ...initialData,
      bookings: [first, second],
      guests: [
        { bookingId: first.id, segment: "Rodziny" },
        { bookingId: second.id, segment: "rodziny" },
        { bookingId: "NIEISTNIEJACA", segment: "Fałszywy segment" },
      ],
      consents: [],
    });

    expect(summary.segments).toEqual([{ label: "Rodziny", count: 2 }]);
    expect(summary.profileCount).toBe(2);
    expect(summary.missingSegmentBookingIds).toEqual([]);
  });

  it("oddziela brak danych od wartości zero", () => {
    const booking = initialData.bookings[0];
    const summary = deriveGuestInsightSummary({
      ...initialData,
      bookings: [booking],
      guests: [{ bookingId: booking.id, discoveryMethod: "Nie wiadomo" }],
      consents: [],
    });

    expect(summary.discoveryMethodSample).toBe(0);
    expect(summary.browsingCount).toBe(0);
    expect(summary.missingDiscoveryBookingIds).toEqual([booking.id]);
  });
});
