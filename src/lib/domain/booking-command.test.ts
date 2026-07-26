import { describe, expect, it } from "vitest";
import { updateBookingCommandSchema } from "./booking-command";

const booking = {
  id: "BOOKING-1",
  bookingDate: "2026-07-25",
  source: "Telefon",
  platform: "Telefon",
  unitId: "domek-4",
  checkIn: "2026-08-11",
  checkOut: "2026-08-14",
  adults: 2,
  children: 0,
  guestLabel: "Anna Testowa",
  paymentStatus: "Zaliczka",
  workflowStatus: "Potwierdzona",
  createdBy: "Patryk",
  version: 4,
};
const contact = {
  bookingId: booking.id,
  email: "anna@example.com",
  marketingConsent: "Do dopytania",
  photoFbConsent: "Nie",
  photoSiteAdsConsent: "Nie",
  version: 3,
};
const task = {
  id: "TASK-1",
  bookingId: booking.id,
  type: "Sprzątanie",
  priority: "Wysoki",
  status: "Do zrobienia",
  owner: "Pani Ewa",
  title: "Turnover",
  version: 6,
};
const message = {
  id: "SCH-1",
  bookingId: booking.id,
  ruleId: "RULE-1",
  templateId: "TPL-1",
  templateVersion: 1,
  dueAt: "2026-08-09T10:00:00",
  channel: "E-mail",
  renderedBody: "Dzień dobry",
  status: "Wersja robocza",
  idempotencyKey: "scheduled-booking-1",
  bookingFingerprint: "fingerprint",
  createdAt: "2026-07-25T20:00:00.000Z",
  version: 2,
};

function command(overrides: Record<string, unknown> = {}) {
  return {
    aggregate: {
      booking,
      contact,
      tasks: [task],
      scheduledMessages: [message],
    },
    expectedRecordVersion: 3,
    requestId: "request-booking-update-123",
    clientSentAt: "2026-07-25T20:00:00.000Z",
    tabId: "tab-booking-update-123",
    ...overrides,
  };
}

describe("komenda aktualizacji rezerwacji", () => {
  it("akceptuje spójne wersje całego agregatu", () => {
    expect(updateBookingCommandSchema.safeParse(command()).success).toBe(true);
  });

  it("odrzuca wersję rezerwacji niepasującą do blokady optymistycznej", () => {
    const parsed = updateBookingCommandSchema.safeParse(command({
      expectedRecordVersion: 2,
    }));

    expect(parsed.success).toBe(false);
  });

  it.each([
    ["booking", {
      ...command().aggregate,
      booking: { ...booking, version: undefined },
    }],
    ["contact", {
      ...command().aggregate,
      contact: { ...contact, version: undefined },
    }],
    ["task", {
      ...command().aggregate,
      tasks: [{ ...task, version: undefined }],
    }],
    ["message", {
      ...command().aggregate,
      scheduledMessages: [{ ...message, version: undefined }],
    }],
  ])("odrzuca brak wersji rekordu: %s", (_label, aggregate) => {
    expect(updateBookingCommandSchema.safeParse(command({ aggregate })).success).toBe(false);
  });
});
