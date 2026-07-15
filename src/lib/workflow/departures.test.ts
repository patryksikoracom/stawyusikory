import { describe, expect, it } from "vitest";
import type { Booking, DepartureDebrief, GuestProfile, IssueReport } from "../types";
import { departurePromptQueue, guestInsightAfterDeparture, repairTaskForIssue } from "./departures";

const booking: Booking = { id: "STAY-1", bookingDate: "2026-07-01", source: "Rozmowa", platform: "Telefon", unitId: "u1", checkIn: "2026-07-12", checkOut: "2026-07-15", adults: 2, children: 0, guestLabel: "Gość", paymentStatus: "Opłacone", workflowStatus: "W trakcie", createdBy: "test" };
const debrief: DepartureDebrief = { id: "DEB-STAY-1", bookingId: booking.id, status: "Oczekuje", keysSettled: false, urgentNextArrivalRisk: false, publicQuotePermission: "Do dopytania" };

describe("departure workflow", () => {
  it("queues today's departure once and respects snooze and prompt date", () => {
    expect(departurePromptQueue([booking], [debrief], "2026-07-15", "2026-07-15T09:00:00Z")).toHaveLength(1);
    expect(departurePromptQueue([booking], [{ ...debrief, snoozedUntil: "2026-07-15T11:00:00Z" }], "2026-07-15", "2026-07-15T09:00:00Z")).toHaveLength(0);
    expect(departurePromptQueue([booking], [{ ...debrief, snoozedUntil: "2026-07-15T08:00:00Z", lastPromptedOn: "2026-07-15" }], "2026-07-15", "2026-07-15T09:00:00Z")).toHaveLength(1);
    expect(departurePromptQueue([booking], [{ ...debrief, lastPromptedAt: "2026-07-15T07:00:00Z" }], "2026-07-15", "2026-07-15T09:00:00Z")).toHaveLength(0);
  });

  it("keeps Slowhop discovery separate from the booking channel", () => {
    const profile: GuestProfile = { bookingId: booking.id, bookingChannel: "Telefon" };
    const updated = guestInsightAfterDeparture(profile, { ...debrief, status: "Ukończony", discoverySource: "Slowhop", discoveryMethod: "Przeglądanie ofert" });
    expect(updated.discoveryChannel).toBe("Slowhop");
    expect(updated.discoveryMethod).toBe("Przeglądanie ofert");
    expect(updated.bookingChannel).toBe("Telefon");
  });

  it("creates one linked repair task and preserves an after-season horizon", () => {
    const issue: IssueReport = { id: "ISS-DOOR", bookingId: booking.id, unitId: booking.unitId, debriefId: debrief.id, title: "Drzwi nie domykają się", category: "Dostęp/drzwi", severity: "Wysoka", source: "Gość", status: "Otwarte", planningHorizon: "Po sezonie", createdAt: "2026-07-15T10:00:00Z" };
    const task = repairTaskForIssue(issue, booking);
    expect(task.issueId).toBe(issue.id);
    expect(task.type).toBe("Naprawa");
    expect(task.planningHorizon).toBe("Po sezonie");
    expect(task.dueDate).toBeUndefined();
  });
});
