import { describe, expect, it } from "vitest";
import { BOOKING_TRASH_RETENTION_DAYS, daysLeftInTrash, isTrashExpired, trashExpiryDate } from "./booking-trash";
import type { Booking } from "./types";

const booking: Booking = {
  id: "SUS-1", bookingDate: "2026-07-15", source: "Panel", platform: "Telefon", unitId: "unit-1",
  checkIn: "2026-08-01", checkOut: "2026-08-03", adults: 2, children: 0, guestLabel: "Anna Kowalska",
  paymentStatus: "Do uzupełnienia", workflowStatus: "Anulowana", createdBy: "Stawy OS", deletedAt: "2026-07-15T10:00:00.000Z", purgeAfter: "2026-08-14",
};

describe("kosz rezerwacji", () => {
  it("przechowuje rezerwację przez 30 dni", () => {
    expect(BOOKING_TRASH_RETENTION_DAYS).toBe(30);
    expect(trashExpiryDate("2026-07-15")).toBe("2026-08-14");
    expect(daysLeftInTrash(booking, "2026-07-15")).toBe(30);
  });

  it("wygasa dopiero po dacie usunięcia", () => {
    expect(isTrashExpired(booking, "2026-08-14")).toBe(false);
    expect(isTrashExpired(booking, "2026-08-15")).toBe(true);
  });
});
