import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { initialData } from "../demo-data";
import type { AppData, Booking } from "../types";
import { defaultAutomationRules, defaultMessageTemplates, reconcileScheduledMessages, renderTemplate } from "./communications";

const booking: Booking = {
  id: "COMM-1", bookingDate: "2026-07-01", source: "test", platform: "Bezpośrednio", unitId: "domek-rybaka",
  checkIn: "2026-08-10", checkOut: "2026-08-13", adults: 2, children: 0, guestLabel: "Anna Kowalska",
  grossPrice: 1200, currency: "PLN", paymentStatus: "Do dopłaty", workflowStatus: "Potwierdzona", createdBy: "test",
};

function fixture(overrides: Partial<AppData> = {}): AppData {
  return { ...initialData, bookings: [booking], consents: [{ bookingId: booking.id, email: "anna@example.com", phone: "+48123123123", marketingConsent: "Nie", photoFbConsent: "Nie", photoSiteAdsConsent: "Nie" }], messageTemplates: defaultMessageTemplates, automationRules: defaultAutomationRules, scheduledMessages: [], ...overrides };
}

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-02T10:00:00.000Z"));
});

afterAll(() => {
  vi.useRealTimers();
});

describe("draft-first communication", () => {
  it("renders reservation variables and payment balance", () => {
    const rendered = renderTemplate(defaultMessageTemplates[0], booking, fixture({
      communicationConfigs: [{
        id: "communication",
        bankAccountNumber: "PL00 0000 0000 0000 0000 0000 0000",
        senderName: "Stawy u Sikory",
        copyUserIds: [],
        travelGuides: [],
      }],
    }));
    expect(rendered.body).toContain("Anna");
    expect(rendered.body).toContain("Domek Rybaka");
    expect(rendered.unresolved).toEqual([]);
  });

  it("materializes one idempotent draft per matching rule and booking", () => {
    const first = reconcileScheduledMessages(fixture());
    const second = reconcileScheduledMessages({ ...fixture(), scheduledMessages: first });
    expect(first).toHaveLength(defaultAutomationRules.filter((rule) => (
      !rule.paymentStatuses?.length || rule.paymentStatuses.includes(booking.paymentStatus)
    )).length);
    expect(new Set(second.map((item) => item.idempotencyKey)).size).toBe(second.length);
    expect(second.map((item) => item.id)).toEqual(first.map((item) => item.id));
  });

  it("reschedules unapproved drafts after a date change", () => {
    const first = reconcileScheduledMessages(fixture());
    const changed = { ...booking, checkIn: "2026-08-12", checkOut: "2026-08-15" };
    const second = reconcileScheduledMessages({ ...fixture(), bookings: [changed], scheduledMessages: first });
    expect(second.find((item) => item.ruleId === "RULE-PREARRIVAL")?.dueAt).toBe("2026-08-07T10:00:00");
  });

  it("freezes a manually approved draft and invalidates approval on a material change", () => {
    const manualRules = defaultAutomationRules.map((rule) => rule.id === "RULE-PREARRIVAL"
      ? { ...rule, mode: "Wersja robocza" as const }
      : rule);
    const first = reconcileScheduledMessages(fixture({ automationRules: manualRules }));
    const original = first.find((item) => item.ruleId === "RULE-PREARRIVAL")!;
    const approved = { ...original, renderedBody: "Treść zatwierdzona", recipient: "locked@example.com", status: "Zatwierdzona" as const, approvedAt: "2026-07-02T10:00:00Z" };
    const unchanged = reconcileScheduledMessages({ ...fixture({ automationRules: manualRules }), scheduledMessages: first.map((item) => item.id === approved.id ? approved : item) }).find((item) => item.id === approved.id)!;
    expect(unchanged.renderedBody).toBe("Treść zatwierdzona");
    const changedBooking = { ...booking, checkIn: "2026-08-11", checkOut: "2026-08-14" };
    const changed = reconcileScheduledMessages({ ...fixture({ automationRules: manualRules }), bookings: [changedBooking], scheduledMessages: first.map((item) => item.id === approved.id ? approved : item) }).find((item) => item.id === approved.id)!;
    expect(changed.status).toBe("Wymaga sprawdzenia");
    expect(changed.approvedAt).toBeUndefined();
  });

  it("re-renders an automatic future message after booking dates change", () => {
    const initial = reconcileScheduledMessages(fixture({
      guests: [{ bookingId: booking.id, personId: "PERSON-1" }],
      people: [{ id: "PERSON-1", displayName: "Anna", preferredLanguage: "pl", createdAt: "2026-07-01T00:00:00.000Z", createdBy: "owner" }],
      communicationConfigs: [{ id: "communication", bankAccountNumber: "PL00", senderName: "Stawy u Sikory", copyUserIds: [], travelGuides: [{ id: "G-1", language: "pl", unitIds: [booking.unitId], version: 1, body: "Dojazd", routeWarning: "Uwaga", approvedAt: "2026-07-01T00:00:00.000Z" }] }],
    }));
    const changedBooking = { ...booking, checkIn: "2026-08-12", checkOut: "2026-08-15" };
    const changed = reconcileScheduledMessages({
      ...fixture({
        bookings: [changedBooking],
        scheduledMessages: initial,
        guests: [{ bookingId: booking.id, personId: "PERSON-1" }],
        people: [{ id: "PERSON-1", displayName: "Anna", preferredLanguage: "pl", createdAt: "2026-07-01T00:00:00.000Z", createdBy: "owner" }],
        communicationConfigs: [{ id: "communication", bankAccountNumber: "PL00", senderName: "Stawy u Sikory", copyUserIds: [], travelGuides: [{ id: "G-1", language: "pl", unitIds: [booking.unitId], version: 1, body: "Dojazd", routeWarning: "Uwaga", approvedAt: "2026-07-01T00:00:00.000Z" }] }],
      }),
    }).find((item) => item.ruleId === "RULE-PREARRIVAL");
    expect(changed).toMatchObject({ status: "Zatwierdzona", deliveryPolicy: "auto_send", dueAt: "2026-08-07T10:00:00" });
    expect(changed?.renderedBody).toContain("2026-08-12");
  });

  it("schedules the deposit confirmation on the recorded payment date", () => {
    const paidBooking = { ...booking, paymentStatus: "Zaliczka" as const };
    const message = reconcileScheduledMessages(fixture({
      bookings: [paidBooking],
      payments: [{ id: "PAY-1", bookingId: booking.id, occurredAt: "2026-07-05", type: "Zaliczka", amount: 400, currency: "PLN", status: "Zaksięgowana" }],
    })).find((item) => item.ruleId === "RULE-DEPOSIT-CONFIRMED");
    expect(message?.dueAt).toBe("2026-07-05T12:00:00");
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

  it("selects the explicit guest language and enables the automatic transactional rule", () => {
    const data = fixture({
      guests: [{ bookingId: booking.id, personId: "PERSON-1" }],
      people: [{
        id: "PERSON-1",
        displayName: "Anna Kowalska",
        preferredLanguage: "de",
        createdAt: "2026-07-01T00:00:00.000Z",
        createdBy: "owner",
      }],
      communicationConfigs: [{
        id: "communication",
        bankAccountNumber: "PL00 0000 0000 0000 0000 0000 0000",
        senderName: "Stawy u Sikory",
        copyUserIds: [],
        travelGuides: [],
      }],
    });
    const messages = reconcileScheduledMessages(data);
    const confirmation = messages.find((item) => item.ruleId === "RULE-CONFIRM");
    expect(confirmation).toMatchObject({
      templateId: "TPL-CONFIRM-DE",
      deliveryPolicy: "auto_send",
      status: "Zatwierdzona",
    });
    expect(confirmation?.renderedBody).toContain("Guten Tag");
  });

  it("blocks approval when language was not explicitly selected", () => {
    expect(reconcileScheduledMessages(fixture())[0]?.blockedReason).toContain(
      "Brak jawnie wybranego języka",
    );
  });

  it("automatically queues a transactional draft after the guest profile removes its blocker", () => {
    const beforeProfile = reconcileScheduledMessages(fixture());
    const blockedConfirmation = beforeProfile.find((item) => item.ruleId === "RULE-CONFIRM");
    expect(blockedConfirmation).toMatchObject({
      status: "Wersja robocza",
      deliveryPolicy: "auto_send",
    });

    const afterProfile = reconcileScheduledMessages(fixture({
      scheduledMessages: beforeProfile,
      guests: [{ bookingId: booking.id, personId: "PERSON-1" }],
      people: [{
        id: "PERSON-1",
        displayName: "Anna Kowalska",
        preferredLanguage: "pl",
        createdAt: "2026-07-01T00:00:00.000Z",
        createdBy: "owner",
      }],
      communicationConfigs: [{
        id: "communication",
        bankAccountNumber: "PL00 0000 0000 0000 0000 0000 0000",
        senderName: "Stawy u Sikory",
        copyUserIds: [],
        travelGuides: [],
      }],
    }));
    expect(afterProfile.find((item) => item.ruleId === "RULE-CONFIRM")).toMatchObject({
      status: "Zatwierdzona",
      deliveryPolicy: "auto_send",
      blockedReason: undefined,
    });
  });

  it("blocks review e-mails without active marketing consent", () => {
    const data = fixture({
      guests: [{ bookingId: booking.id, personId: "PERSON-1" }],
      people: [{
        id: "PERSON-1",
        displayName: "Anna Kowalska",
        preferredLanguage: "pl",
        createdAt: "2026-07-01T00:00:00.000Z",
        createdBy: "owner",
      }],
    });
    expect(reconcileScheduledMessages(data).find((item) => item.ruleId === "RULE-REVIEW-REMINDER")?.blockedReason)
      .toContain("Brak aktywnej zgody marketingowej");
  });

  it("does not create communication backlog for historical imports", () => {
    const historical = { ...booking, checkIn: "2024-07-10", checkOut: "2024-07-13", historicalImport: true, workflowStatus: "Zamknięta" as const, importRef: { source: "mobile-calendar" as const, key: "1" } };
    expect(reconcileScheduledMessages(fixture({ bookings: [historical] }))).toEqual([]);
  });
});
