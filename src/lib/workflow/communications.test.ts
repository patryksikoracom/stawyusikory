import { describe, expect, it } from "vitest";
import { initialData } from "../demo-data";
import type { AppData, Booking } from "../types";
import { defaultAutomationRules, defaultMessageTemplates, reconcileScheduledMessages, renderTemplate } from "./communications";

const booking: Booking = {
  id: "COMM-1", bookingDate: "2026-07-01", source: "test", platform: "Bezpośrednio", unitId: "domek-rybaka",
  checkIn: "2026-08-10", checkOut: "2026-08-13", adults: 2, children: 0, guestLabel: "Anna Kowalska",
  grossPrice: 1200, paymentStatus: "Do dopłaty", workflowStatus: "Potwierdzona", createdBy: "test",
};

function fixture(overrides: Partial<AppData> = {}): AppData {
  return { ...initialData, bookings: [booking], consents: [{ bookingId: booking.id, email: "anna@example.com", phone: "+48123123123", marketingConsent: "Nie", photoFbConsent: "Nie", photoSiteAdsConsent: "Nie" }], messageTemplates: defaultMessageTemplates, automationRules: defaultAutomationRules, scheduledMessages: [], ...overrides };
}

describe("draft-first communication", () => {
  it("renders reservation variables and payment balance", () => {
    const rendered = renderTemplate(defaultMessageTemplates[0], booking, fixture());
    expect(rendered.body).toContain("Anna");
    expect(rendered.body).toContain("Domek Rybaka");
    expect(rendered.unresolved).toEqual([]);
  });

  it("materializes one idempotent draft per matching rule and booking", () => {
    const first = reconcileScheduledMessages(fixture());
    const second = reconcileScheduledMessages({ ...fixture(), scheduledMessages: first });
    expect(first).toHaveLength(defaultAutomationRules.length);
    expect(new Set(second.map((item) => item.idempotencyKey)).size).toBe(second.length);
    expect(second.map((item) => item.id)).toEqual(first.map((item) => item.id));
  });

  it("reschedules unapproved drafts after a date change", () => {
    const first = reconcileScheduledMessages(fixture());
    const changed = { ...booking, checkIn: "2026-08-12", checkOut: "2026-08-15" };
    const second = reconcileScheduledMessages({ ...fixture(), bookings: [changed], scheduledMessages: first });
    expect(second.find((item) => item.ruleId === "RULE-PREARRIVAL")?.dueAt).toBe("2026-08-10T10:00:00");
  });

  it("freezes an approved draft and invalidates approval on a material change", () => {
    const first = reconcileScheduledMessages(fixture());
    const original = first.find((item) => item.ruleId === "RULE-PREARRIVAL")!;
    const approved = { ...original, renderedBody: "Treść zatwierdzona", recipient: "locked@example.com", status: "Zatwierdzona" as const, approvedAt: "2026-07-02T10:00:00Z" };
    const unchanged = reconcileScheduledMessages({ ...fixture(), scheduledMessages: first.map((item) => item.id === approved.id ? approved : item) }).find((item) => item.id === approved.id)!;
    expect(unchanged.renderedBody).toBe("Treść zatwierdzona");
    const changedBooking = { ...booking, checkIn: "2026-08-11", checkOut: "2026-08-14" };
    const changed = reconcileScheduledMessages({ ...fixture(), bookings: [changedBooking], scheduledMessages: first.map((item) => item.id === approved.id ? approved : item) }).find((item) => item.id === approved.id)!;
    expect(changed.status).toBe("Wymaga sprawdzenia");
    expect(changed.approvedAt).toBeUndefined();
  });

  it("cancels every pending message when the reservation is cancelled", () => {
    const first = reconcileScheduledMessages(fixture());
    const cancelled = reconcileScheduledMessages({ ...fixture(), bookings: [{ ...booking, workflowStatus: "Anulowana" }], scheduledMessages: first });
    expect(cancelled.every((item) => item.status === "Anulowana")).toBe(true);
  });

  it("blocks channels with missing contact details", () => {
    const messages = reconcileScheduledMessages(fixture({ consents: [] }));
    expect(messages.find((item) => item.channel === "SMS")?.blockedReason).toContain("Brak kontaktu");
  });
});
