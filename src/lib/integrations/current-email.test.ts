import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initialData } from "@/lib/demo-data";
import { defaultAutomationRules, defaultMessageTemplates, reconcileScheduledMessages, type CommunicationData } from "@/lib/workflow/communications";
import { isCurrentEmail } from "./current-email";

function fixture() {
  const data: CommunicationData = {
    ...initialData,
    bookings: [{ ...initialData.bookings[0], id: "test-stay", bookingDate: "2026-09-30", checkIn: "2026-10-01", checkOut: "2026-10-04", workflowStatus: "Potwierdzona", historicalImport: false, importRef: undefined }],
    guests: [], people: [], payments: [], consentLedger: [],
    consents: [{ bookingId: "test-stay", preferredLanguage: "pl", email: "guest@example.com", marketingConsent: "Nie", photoFbConsent: "Nie", photoSiteAdsConsent: "Nie" }],
    communicationConfigs: [{ id: "communication", senderName: "Stawy u Sikory", bankAccountNumber: "TEST", copyUserIds: [], travelGuides: [] }],
    messageTemplates: defaultMessageTemplates,
    automationRules: defaultAutomationRules,
    scheduledMessages: [],
  };
  data.scheduledMessages = reconcileScheduledMessages(data);
  const saved = data.scheduledMessages.find(item => item.ruleId === "RULE-CONFIRM")!;
  const queued = { id: saved.id, booking_id: saved.bookingId, recipient: saved.recipient!, subject: saved.subject!, rendered_body: saved.renderedBody, idempotency_key: saved.idempotencyKey };
  return { data, queued };
}

describe("email preflight against current records", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-30T12:00:00Z")); });
  afterEach(() => vi.useRealTimers());
  it("permits the currently approved email", () => { const { data, queued } = fixture(); expect(isCurrentEmail(data, queued)).toBe(true); });
  it("uses the same upgraded definitions as the browser for legacy production records", () => {
    const { data, queued } = fixture();
    data.automationRules = data.automationRules.filter(rule => rule.id === "RULE-CONFIRM")
      .map(rule => ({ ...rule, definitionVersion: undefined, mode: "Wersja robocza" as const }));
    data.messageTemplates = data.messageTemplates.filter(template => template.id === "TPL-CONFIRM")
      .map(template => ({ ...template, version: 1, body: "Stare potwierdzenie" }));
    expect(isCurrentEmail(data, queued)).toBe(true);
    data.automationRules[0].active = false;
    expect(isCurrentEmail(data, queued)).toBe(false);
  });
  it("blocks cancellation, contact edits and price changes before a queued send", () => {
    for (const change of ["cancel", "contact", "price"] as const) {
      const { data, queued } = fixture();
      if (change === "cancel") data.bookings[0].workflowStatus = "Anulowana";
      if (change === "contact") data.consents[0].email = "changed@example.com";
      if (change === "price") data.bookings[0].grossPrice = 9876;
      expect(isCurrentEmail(data, queued)).toBe(false);
    }
  });
  it("blocks a disabled rule and an expired confirmation", () => {
    const { data, queued } = fixture();
    data.automationRules = data.automationRules.map(rule => ({ ...rule, active: false }));
    expect(isCurrentEmail(data, queued)).toBe(false);
    const fresh = fixture();
    vi.setSystemTime(new Date("2026-10-05T12:00:00Z"));
    expect(isCurrentEmail(fresh.data, fresh.queued)).toBe(false);
  });
  it("does not retry an already delivered message", () => {
    const { data, queued } = fixture();
    data.scheduledMessages = data.scheduledMessages.map(item => ({ ...item, status: "Dostarczona" }));
    expect(isCurrentEmail(data, queued)).toBe(false);
  });
});
