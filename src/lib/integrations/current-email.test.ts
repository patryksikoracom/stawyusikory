import { describe, expect, it } from "vitest";
import { initialData } from "@/lib/demo-data";
import { reconcileScheduledMessages } from "@/lib/workflow/communications";
import { isCurrentEmail } from "./current-email";

function fixture() {
  const booking = { ...initialData.bookings[0]!, id: "booking", bookingDate: "2099-01-01", checkIn: "2099-08-10", checkOut: "2099-08-15", workflowStatus: "Potwierdzona" as const, paymentStatus: "Do dopłaty" as const, grossPrice: 1000, currency: "PLN" as const, historicalImport: false, importRef: undefined };
  const data = { ...initialData, bookings: [booking], payments: [], scheduledMessages: [],
    consents: [{ bookingId: booking.id, email: "guest@example.com", preferredLanguage: "pl" as const, marketingConsent: "Do dopytania" as const, photoFbConsent: "Do dopytania" as const, photoSiteAdsConsent: "Do dopytania" as const }],
    messageTemplates: [{ id: "template", name: "Saldo", purpose: "Płatność" as const, channel: "E-mail" as const, language: "pl" as const, body: "Saldo: {{balance_due}}", subject: "Pobyt", version: 1, active: true, allowedVariables: ["balance_due"] }],
    automationRules: [{ id: "rule", name: "Saldo", templateId: "template", trigger: "Przed przyjazdem" as const, offsetDays: -2, sendTime: "10:00", mode: "Automatycznie" as const, active: true }],
  };
  const scheduledMessages = reconcileScheduledMessages(data);
  const saved = scheduledMessages[0]!;
  const queued = { id: saved.id, booking_id: booking.id, recipient: saved.recipient!, subject: saved.subject!, rendered_body: saved.renderedBody, idempotency_key: saved.idempotencyKey };
  return { data: { ...data, scheduledMessages }, queued };
}

describe("fresh email approval", () => {
  it("accepts an unchanged approved projection", () => {
    const { data, queued } = fixture();
    expect(isCurrentEmail(data, queued)).toBe(true);
  });
  it("rejects a stale balance even when the payment status label is unchanged", () => {
    const { data, queued } = fixture();
    data.bookings[0].grossPrice = 1500;
    expect(isCurrentEmail(data, queued)).toBe(false);
  });
  it("rejects changed contact information", () => {
    const { data, queued } = fixture();
    data.consents[0].email = "new@example.com";
    expect(isCurrentEmail(data, queued)).toBe(false);
  });
  it("rejects a removed reservation", () => {
    const { data, queued } = fixture();
    expect(isCurrentEmail({ ...data, bookings: [] }, queued)).toBe(false);
  });
  it("keeps delivered history unchanged after the booking has ended", () => {
    const { data } = fixture();
    const message = { ...data.scheduledMessages[0], status: "Dostarczona" as const, renderedBody: "Actually delivered" };
    data.bookings[0].checkOut = "2020-01-01";
    expect(reconcileScheduledMessages({ ...data, scheduledMessages: [message] })).toEqual([message]);
  });
  it("rejects an inactive automation", () => {
    const { data, queued } = fixture();
    data.automationRules[0].active = false;
    expect(isCurrentEmail(data, queued)).toBe(false);
  });
  it("rejects stale queue content and disabled delivery policy", () => {
    const { data, queued } = fixture();
    expect(isCurrentEmail(data, { ...queued, rendered_body: "Old balance" })).toBe(false);
    data.scheduledMessages[0].deliveryPolicy = "draft_only";
    expect(isCurrentEmail(data, queued)).toBe(false);
  });
});
