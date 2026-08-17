import type { AppData, ConsentPurpose, ConsentRecord, MediaAsset } from "@/lib/types";

function byRecordedAt(left: ConsentRecord, right: ConsentRecord) {
  return right.recordedAt.localeCompare(left.recordedAt) || right.id.localeCompare(left.id);
}

export function currentConsent(
  ledger: ConsentRecord[],
  personId: string,
  purpose: ConsentPurpose,
) {
  return ledger
    .filter((record) => record.personId === personId && record.purpose === purpose)
    .sort(byRecordedAt)[0];
}

export function hasActiveConsent(
  ledger: ConsentRecord[],
  personId: string | undefined,
  purpose: ConsentPurpose,
) {
  if (!personId) return false;
  return currentConsent(ledger, personId, purpose)?.decision === "granted";
}

export function withdrawConsent(
  ledger: ConsentRecord[],
  input: {
    id: string;
    personId: string;
    bookingId?: string;
    purpose: ConsentPurpose;
    consentText: string;
    textVersion: string;
    source: ConsentRecord["source"];
    recordedAt: string;
    recordedBy: string;
  },
) {
  const withdrawal: ConsentRecord = {
    ...input,
    decision: "withdrawn",
    withdrawnAt: input.recordedAt,
    withdrawnBy: input.recordedBy,
  };
  return [withdrawal, ...ledger];
}

export function purposeForMediaChannel(channel: string): ConsentPurpose | undefined {
  if (channel === "Facebook" || channel === "Instagram") return "social_media";
  if (channel === "Strona" || channel === "Strona www") return "website_media";
  if (channel === "Reklama") return "paid_ads";
  return undefined;
}

export function mediaConsentDecision(data: AppData, asset: MediaAsset) {
  const personId = data.guests.find((profile) => profile.bookingId === asset.bookingId)?.personId;
  const purpose = purposeForMediaChannel(asset.publishChannel);
  const consent = personId && purpose
    ? currentConsent(data.consentLedger, personId, purpose)
    : undefined;

  return {
    personId,
    purpose,
    consent,
    canPublish: Boolean(
      personId
      && purpose
      && consent?.decision === "granted"
      && asset.usageStatus !== "Nie używać"
      && asset.usageStatus !== "Wygasło/wycofane",
    ),
  };
}
