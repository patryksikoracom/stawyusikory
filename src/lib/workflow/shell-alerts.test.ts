import { describe, expect, it } from "vitest";
import { initialData } from "@/lib/demo-data";
import type { AppData, Booking } from "@/lib/types";
import { deriveShellAlerts } from "./shell-alerts";

const today = "2026-07-17";

function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: "B-1",
    bookingDate: "2026-07-01",
    source: "Telefon",
    platform: "Telefon",
    unitId: "domek-4",
    checkIn: "2026-07-20",
    checkOut: "2026-07-23",
    adults: 2,
    children: 0,
    guestLabel: "Test",
    paymentStatus: "Opłacone",
    workflowStatus: "Potwierdzona",
    createdBy: "test",
    ...overrides,
  };
}

function fixture(overrides: Partial<AppData> = {}): AppData {
  return {
    ...initialData,
    bookings: [],
    sourceConnections: [],
    tasks: [],
    ...overrides,
  };
}

describe("alerty powłoki aplikacji", () => {
  it("pokazuje uczciwy stan pusty, gdy dane nie wymagają uwagi", () => {
    expect(deriveShellAlerts(fixture(), today)).toEqual([]);
  });

  it("wylicza alerty wyłącznie z aktualnych danych", () => {
    const alerts = deriveShellAlerts(fixture({
      sourceConnections: [{
        id: "AIR",
        platform: "Airbnb",
        connectionType: "iCal",
        status: "Błąd",
        coverage: 0,
        nextStep: "Połącz ponownie.",
        notes: "",
        priority: "Teraz",
        lastError: "Kanał zwrócił błąd.",
      }],
      bookings: [
        booking({ id: "review", needsReview: true }),
        booking({ id: "payment-1", paymentStatus: "Do dopłaty" }),
        booking({ id: "payment-2", paymentStatus: "Częściowo" }),
      ],
      tasks: [{
        id: "blocked",
        bookingId: "payment-1",
        type: "Sprzątanie",
        priority: "Wysoki",
        status: "Zablokowane",
        owner: "Zespół",
        title: "Brak dostępu",
      }],
    }), today);

    expect(alerts.map((alert) => alert.title)).toEqual([
      "Airbnb: błąd",
      "1 rezerwacja do sprawdzenia",
      "2 płatności do sprawdzenia",
      "1 zadanie zablokowane",
    ]);
    expect(alerts[0].body).toBe("Kanał zwrócił błąd.");
  });

  it("pomija płatności historyczne, anulowane i usunięte", () => {
    const alerts = deriveShellAlerts(fixture({
      bookings: [
        booking({ id: "old", checkIn: "2025-01-01", checkOut: "2025-01-03", paymentStatus: "Do dopłaty", historicalImport: true }),
        booking({ id: "cancelled", paymentStatus: "Do dopłaty", workflowStatus: "Anulowana" }),
        booking({ id: "trash", paymentStatus: "Do dopłaty", deletedAt: "2026-07-16T10:00:00.000Z" }),
      ],
    }), today);

    expect(alerts).toEqual([]);
  });
});
