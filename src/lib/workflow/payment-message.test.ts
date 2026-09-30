import { describe, expect, it } from "vitest";
import { initialData } from "../demo-data";
import { defaultMessageTemplates, reconcileScheduledMessages, renderTemplate, defaultAutomationRules } from "./communications";
import { transferDateRange } from "./payment-message";
import type { Booking } from "../types";

const booking: Booking = { id: "EXAMPLE", guestLabel: "Jan Kowalski", bookingDate: "2026-05-01", checkIn: "2026-06-12", checkOut: "2026-06-19", unitId: "domek-rybaka", adults: 2, children: 0, source: "test", platform: "Bezpośrednio", grossPrice: 2000, currency: "PLN", depositAmount: 600, depositDueDate: "2026-05-08", paymentStatus: "Do dopłaty", workflowStatus: "Nowa", createdBy: "test" };
const data = { ...initialData, bookings: [booking], payments: [], guests: [], people: [], consentLedger: [], consents: [{ bookingId: booking.id, preferredLanguage: "pl" as const, email: "example@example.com", marketingConsent: "Nie" as const, photoFbConsent: "Nie" as const, photoSiteAdsConsent: "Nie" as const }], scheduledMessages: [], messageTemplates: defaultMessageTemplates, automationRules: defaultAutomationRules, communicationConfigs: [{ id: "communication", bankAccountNumber: "KONTO TESTOWE", bankAccountRecipient: "Odbiorca testowy", senderName: "Stawy u Sikory", copyUserIds: [], travelGuides: [] }] };
const template = defaultMessageTemplates.find(t => t.id === "TPL-CONFIRM")!;

describe("payment copy follows the actual stay and payment state", () => {
  it.each([
    ["2026-06-12", "2026-06-19", "12-19.06/26"],
    ["2026-06-30", "2026-07-02", "30.06-02.07/26"],
    ["2026-12-30", "2027-01-02", "30.12/26-02.01/27"],
  ])("uses unambiguous short transfer dates", (from, to, expected) => expect(transferDateRange(from, to)).toBe(expected));
  it("uses booking identity and compact dates, never the booking ID, in the transfer title", () => {
    const rendered = renderTemplate(template, booking, data);
    expect(rendered.body).toContain("Tytuł przelewu:\nJan Kowalski 12-19.06/26");
    expect(rendered.body).not.toContain("EXAMPLE");
    expect(rendered.body).toContain("Termin wpłaty: 08.05.2026");
    expect(rendered.unresolved).toEqual([]);
  });
  it("blocks missing deposit terms instead of sending 'do do ustalenia'", () => {
    const incomplete = { ...booking, depositDueDate: undefined };
    const rendered = renderTemplate(template, incomplete, data);
    expect(rendered.unresolved).toContain("deposit_due");
    expect(rendered.body).not.toContain("do ustalenia");
    const messages = reconcileScheduledMessages({ ...data, bookings: [incomplete] }, new Date("2026-05-01T12:00:00Z"));
    expect(messages.find(m => m.ruleId === "RULE-CONFIRM")?.blockedReason).toContain("deposit_due");
  });
  it("asks only for the unpaid part of a deposit", () => {
    const rendered = renderTemplate(template, booking, { ...data, payments: [{ id: "P", bookingId: booking.id, type: "Zaliczka", amount: 200, currency: "PLN", status: "Zaksięgowana", occurredAt: "2026-05-01" }] });
    expect(rendered.body).toContain("Do wpłaty na poczet zaliczki: 400 PLN");
  });
  it("does not ask for another deposit after full payment", () => {
    const rendered = renderTemplate(template, booking, { ...data, payments: [{ id: "P", bookingId: booking.id, type: "Wpłata", amount: 2000, currency: "PLN", status: "Zaksięgowana", occurredAt: "2026-05-01" }] });
    expect(rendered.body).toContain("Pobyt jest opłacony");
    expect(rendered.body).not.toContain("KONTO TESTOWE");
  });
  it("does not request an off-platform transfer for an OTA booking", () => {
    const rendered = renderTemplate(template, { ...booking, platform: "Airbnb" }, data);
    expect(rendered.body).toContain("nie jest prośbą o dodatkową wpłatę");
    expect(rendered.body).not.toContain("KONTO TESTOWE");
  });
  it("does not confirm a payment solely from a manually selected status", () => {
    const messages = reconcileScheduledMessages({ ...data, bookings: [{ ...booking, paymentStatus: "Zaliczka" }] }, new Date("2026-05-01T12:00:00Z"));
    expect(messages.find(m => m.ruleId === "RULE-DEPOSIT-CONFIRMED")?.blockedReason).toContain("Brak potwierdzonej wpłaty");
  });
  it("avoids a second arrival reminder for a booking made the day before arrival", () => {
    const messages = reconcileScheduledMessages({ ...data, bookings: [{ ...booking, bookingDate: "2026-06-11" }] }, new Date("2026-06-11T12:00:00Z"));
    expect(messages.find(m => m.ruleId === "RULE-ARRIVAL-REMINDER")?.blockedReason).toContain("Przy późnej rezerwacji");
  });
});
