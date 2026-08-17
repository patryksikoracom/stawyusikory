import { describe, expect, it } from "vitest";
import { initialData } from "@/lib/demo-data";
import { ensureGuestPeople } from "@/lib/crm/guest-identity";
import type { ScheduledMessage } from "@/lib/types";
import { defaultMessageTemplates } from "@/lib/workflow/communications";
import {
  deliveryIdempotencyKey,
  deliveryRetry,
  normalizeDeliveryEmail,
  normalizeE164,
  preflightDelivery,
} from "./delivery-queue";

describe("provider delivery queue", () => {
  it("normalizes E.164 and rejects malformed recipients", () => {
    expect(normalizeE164("501 234 567")).toBe("+48501234567");
    expect(normalizeE164("123")).toBeUndefined();
    expect(normalizeDeliveryEmail(" Guest@Example.com ")).toBe("guest@example.com");
    expect(normalizeDeliveryEmail("guest@localhost")).toBeUndefined();
  });

  it("uses bounded exponential retry and alerts after an important message is exhausted", () => {
    expect(deliveryRetry({ attempts: 1, now: new Date("2026-07-27T10:00:00Z"), important: true }))
      .toMatchObject({ exhausted: false, nextAttemptAt: "2026-07-27T10:10:00.000Z" });
    expect(deliveryRetry({ attempts: 5, now: new Date("2026-07-27T10:00:00Z"), important: true }))
      .toMatchObject({ exhausted: true, alertOwner: true, nextAttemptAt: undefined });
  });

  it("blocks delivery when the draft-only policy or source confirmation is missing", () => {
    const data = ensureGuestPeople({ ...initialData, messageTemplates: defaultMessageTemplates });
    const booking = data.bookings[0];
    const template = data.messageTemplates[0];
    const source: ScheduledMessage = {
      id: "MSG-TEST",
      bookingId: booking.id,
      ruleId: "RULE-TEST",
      templateId: template.id,
      templateVersion: template.version,
      dueAt: "2026-07-27T10:00:00Z",
      channel: "SMS",
      recipient: "+48501234567",
      renderedBody: "Test",
      status: "Wersja robocza",
      idempotencyKey: "legacy-key",
      bookingFingerprint: `${booking.id}:v1`,
      deliveryPolicy: "draft_only",
      createdAt: "2026-07-27T09:00:00Z",
    };
    expect(preflightDelivery(data, { ...source, status: "Zatwierdzona", recipient: "+48501234567" }))
      .toMatchObject({ ready: false, blockers: expect.arrayContaining(["polityka dostawy pozostaje draft_only"]) });
    const message = {
      ...source,
      status: "Zatwierdzona" as const,
      deliveryPolicy: "manual_send" as const,
      channel: "SMS" as const,
      recipient: "+48501234567",
    };
    const otaData = {
      ...data,
      bookings: data.bookings.map((item) => item.id === booking.id
        ? { ...item, platform: "Booking" as const, importRef: undefined }
        : item),
    };
    expect(preflightDelivery(otaData, message).blockers).toContain("brak potwierdzenia zapisu w źródle OTA");
    expect(deliveryIdempotencyKey({ ...message, recipient: "+48501234567" }))
      .not.toBe(deliveryIdempotencyKey({ ...message, recipient: "+48501234568" }));
  });
});
