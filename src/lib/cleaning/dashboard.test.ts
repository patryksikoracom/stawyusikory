import { describe, expect, it } from "vitest";
import { buildCleaningDashboard } from "./dashboard";

describe("panel sprzątania", () => {
  it("zwraca wyłącznie dane operacyjne potrzebne sprzątającej", () => {
    const dashboard = buildCleaningDashboard([
      { entity_type: "settings", entity_id: "organization", payload: { organizationName: "Stawy u Sikory", defaultCheckIn: "16:00", defaultCheckOut: "11:00", cleaningPhone: "+48111222333" } },
      { entity_type: "units", entity_id: "u1", payload: { id: "u1", name: "Dom Rybaka", bedrooms: 2, notes: "kod alarmu 1234" } },
      { entity_type: "tasks", entity_id: "t1", payload: { id: "t1", bookingId: "old", unitId: "u1", type: "Sprzątanie", status: "Do zrobienia", priority: "Wysoki", title: "Jan Kowalski" } },
      { entity_type: "tasks", entity_id: "t2", payload: { id: "t2", bookingId: "old", unitId: "u1", type: "Płatność", status: "Do zrobienia", priority: "Wysoki", title: "Dopłata 1000 zł" } },
      { entity_type: "bookings", entity_id: "old", payload: { id: "old", unitId: "u1", checkOut: "2026-07-20", departureTime: "10:00", guestLabel: "Jan Kowalski", grossPrice: 9000 } },
      { entity_type: "bookings", entity_id: "next", payload: { id: "next", unitId: "u1", checkIn: "2026-07-20", arrivalTime: "15:30", adults: 2, children: 1, guestLabel: "Anna Nowak", phone: "+48123456789" } },
      { entity_type: "checklistItems", entity_id: "c1", payload: { id: "c1", taskId: "t1", label: "Pościel", done: false } },
      { entity_type: "departureDebriefs", entity_id: "d1", payload: { id: "d1", bookingId: "old", cleaningHandoff: "Sprawdź lampkę przy łóżku", paymentOrDamageNote: "Nie zapłacił" } },
    ]);

    expect(dashboard.jobs).toHaveLength(1);
    expect(dashboard.jobs[0]).toMatchObject({
      id: "t1",
      unit: { name: "Dom Rybaka" },
      departureTime: "10:00",
      nextArrival: { time: "15:30", people: 3 },
      bedsToPrepare: 3,
      handoffNote: "Sprawdź lampkę przy łóżku",
    });
    const serialized = JSON.stringify(dashboard);
    for (const secret of ["Jan Kowalski", "Anna Nowak", "9000", "+48123456789", "+48111222333", "Nie zapłacił", "kod alarmu 1234", "Dopłata 1000 zł"]) {
      expect(serialized).not.toContain(secret);
    }
  });
});
