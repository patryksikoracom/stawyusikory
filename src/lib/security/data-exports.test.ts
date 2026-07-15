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
});
