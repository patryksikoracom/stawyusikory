import { describe, expect, it } from "vitest";
import type { ConsentRecord } from "@/lib/types";
import { initialData } from "@/lib/demo-data";
import { ensureGuestPeople } from "@/lib/crm/guest-identity";
import { currentConsent, hasActiveConsent, mediaConsentDecision, withdrawConsent } from "./consent-ledger";

const granted: ConsentRecord = {
  id: "CONSENT-1",
  personId: "PERSON-1",
  purpose: "marketing_email",
  decision: "granted",
  textVersion: "marketing-email-v1",
  consentText: "Zgadzam się na marketing e-mail.",
  source: "formularz",
  recordedAt: "2026-07-27T10:00:00.000Z",
  recordedBy: "owner",
};

describe("consent ledger", () => {
  it("requires the exact purpose instead of treating marketing as one blanket consent", () => {
    expect(hasActiveConsent([granted], "PERSON-1", "marketing_email")).toBe(true);
    expect(hasActiveConsent([granted], "PERSON-1", "marketing_sms")).toBe(false);
    expect(hasActiveConsent([granted], "PERSON-1", "paid_ads")).toBe(false);
  });

  it("blocks the purpose immediately after a later withdrawal", () => {
    const ledger = withdrawConsent([granted], {
      id: "CONSENT-2",
      personId: "PERSON-1",
      purpose: "marketing_email",
      consentText: "Wycofanie zgody marketingowej e-mail.",
      textVersion: "withdrawal-v1",
      source: "e-mail",
      recordedAt: "2026-07-27T11:00:00.000Z",
      recordedBy: "owner",
    });
    expect(currentConsent(ledger, "PERSON-1", "marketing_email")?.decision).toBe("withdrawn");
    expect(hasActiveConsent(ledger, "PERSON-1", "marketing_email")).toBe(false);
  });

  it("does not copy consent to another person or purpose", () => {
    expect(hasActiveConsent([granted], "PERSON-2", "marketing_email")).toBe(false);
  });

  it("blocks media publication immediately after the exact consent is withdrawn", () => {
    const data = ensureGuestPeople(initialData);
    const asset = {
      ...data.media[0],
      bookingId: data.guests[0].bookingId,
      publishChannel: "Facebook" as const,
      usageStatus: "Można użyć" as const,
    };
    const personId = data.guests[0].personId!;
    const mediaGranted = {
      ...granted,
      id: "CONSENT-GRANTED",
      personId,
      purpose: "social_media" as const,
      decision: "granted" as const,
      recordedAt: "2026-07-01T10:00:00.000Z",
    };
    const withdrawn = {
      ...mediaGranted,
      id: "CONSENT-WITHDRAWN",
      decision: "withdrawn" as const,
      recordedAt: "2026-07-02T10:00:00.000Z",
      withdrawnAt: "2026-07-02T10:00:00.000Z",
    };

    expect(mediaConsentDecision({ ...data, consentLedger: [mediaGranted] }, asset).canPublish).toBe(true);
    expect(mediaConsentDecision({ ...data, consentLedger: [withdrawn, mediaGranted] }, asset).canPublish).toBe(false);
  });
});
