import type { AppData, Booking, Currency } from "@/lib/types";
import { nightsBetween } from "@/lib/workflow/rules";
import { hasActiveConsent } from "@/lib/compliance/consent-ledger";

export const GROWTH_MIN_SAMPLE = 20;
export const GROWTH_MIN_COMPLETENESS = 0.7;

export type GrowthMetric = {
  id: string;
  label: string;
  value?: number;
  unit: "%" | "dni" | "PLN" | "EUR" | "nocy";
  sample: number;
  period: { from: string; to: string };
  completeness: number;
  baseline?: number;
  evidenceBookingIds: string[];
  status: "ready" | "collecting";
};

function active(bookings: Booking[]) {
  return bookings.filter((booking) => booking.workflowStatus !== "Anulowana" && !booking.deletedAt);
}

function metric(input: Omit<GrowthMetric, "status">): GrowthMetric {
  return {
    ...input,
    status: input.sample >= GROWTH_MIN_SAMPLE && input.completeness >= GROWTH_MIN_COMPLETENESS
      ? "ready"
      : "collecting",
  };
}

export function calculateGrowthMetrics(data: AppData, period: { from: string; to: string }) {
  const bookings = active(data.bookings).filter((booking) => booking.bookingDate >= period.from && booking.bookingDate <= period.to);
  const ids = bookings.map((booking) => booking.id);
  const direct = bookings.filter((booking) => booking.platform === "Bezpośrednio");
  const leadTimes = bookings.flatMap((booking) => {
    const days = nightsBetween(booking.bookingDate, booking.checkIn);
    return days >= 0 ? [days] : [];
  });
  const priced = bookings.filter(
    (booking) => booking.grossPrice != null
      && booking.currency === "PLN"
      && nightsBetween(booking.checkIn, booking.checkOut) > 0,
  );
  const nights = bookings.map((booking) => nightsBetween(booking.checkIn, booking.checkOut)).filter((value) => value > 0);
  const knownPeople = new Map<string, number>();
  for (const profile of data.guests) {
    if (profile.personId && ids.includes(profile.bookingId)) knownPeople.set(profile.personId, (knownPeople.get(profile.personId) ?? 0) + 1);
  }
  const returningStays = [...knownPeople.values()].filter((count) => count > 1).reduce((sum, count) => sum + count, 0);
  const completeness = (count: number) => bookings.length ? count / bookings.length : 0;
  return [
    metric({ id: "direct-share", label: "Udział direct", value: bookings.length ? direct.length / bookings.length * 100 : undefined, unit: "%", sample: bookings.length, period, completeness: 1, evidenceBookingIds: ids }),
    metric({ id: "lead-time", label: "Lead time", value: leadTimes.length ? leadTimes.reduce((sum, value) => sum + value, 0) / leadTimes.length : undefined, unit: "dni", sample: leadTimes.length, period, completeness: completeness(leadTimes.length), evidenceBookingIds: ids }),
    metric({ id: "adr-pln", label: "ADR", value: priced.length ? priced.reduce((sum, booking) => sum + (booking.grossPrice ?? 0), 0) / priced.reduce((sum, booking) => sum + nightsBetween(booking.checkIn, booking.checkOut), 0) : undefined, unit: "PLN", sample: priced.length, period, completeness: completeness(priced.length), evidenceBookingIds: priced.map((booking) => booking.id) }),
    metric({ id: "stay-length", label: "Długość pobytu", value: nights.length ? nights.reduce((sum, value) => sum + value, 0) / nights.length : undefined, unit: "nocy", sample: nights.length, period, completeness: completeness(nights.length), evidenceBookingIds: ids }),
    metric({ id: "return-share", label: "Pobyty powracających", value: bookings.length ? returningStays / bookings.length * 100 : undefined, unit: "%", sample: knownPeople.size, period, completeness: completeness(knownPeople.size), evidenceBookingIds: data.guests.filter((profile) => profile.personId && (knownPeople.get(profile.personId) ?? 0) > 1).map((profile) => profile.bookingId) }),
  ];
}

export function paybackByUnit(data: AppData, unitId: string, currency: Currency) {
  const model = data.investmentModels.find((item) => item.unitId === unitId && item.currency === currency);
  if (!model) return { ready: false as const, missing: ["kapitał i nakłady"] };
  const revenue = active(data.bookings)
    .filter((booking) => booking.unitId === unitId && booking.currency === currency)
    .reduce((sum, booking) => sum + (booking.grossPrice ?? 0), 0);
  const costs = data.payments
    .filter((payment) => payment.unitId === unitId && payment.currency === currency && payment.type === "Koszt" && payment.status === "Zaksięgowana")
    .reduce((sum, payment) => sum + payment.amount, 0);
  const invested = model.initialCapital + model.additionalCapex + model.sharedCostAllocation;
  const recovered = revenue - costs - model.ownerWithdrawals;
  return { ready: true as const, invested, recovered, remaining: invested - recovered, source: model.source };
}

export function returnReminderEligibility(data: AppData, personId: string) {
  const bookingIds = data.guests.filter((profile) => profile.personId === personId).map((profile) => profile.bookingId);
  const stays = data.bookings.filter((booking) => bookingIds.includes(booking.id) && booking.workflowStatus !== "Anulowana");
  const leadTimes = stays.map((booking) => nightsBetween(booking.bookingDate, booking.checkIn)).filter((days) => days >= 0);
  const email = hasActiveConsent(data.consentLedger, personId, "marketing_email");
  const sms = hasActiveConsent(data.consentLedger, personId, "marketing_sms");
  return {
    eligible: stays.length > 0 && leadTimes.length > 0 && (email || sms),
    channel: email ? "E-mail" as const : sms ? "SMS" as const : undefined,
    daysBeforePreviousDecision: leadTimes.length
      ? Math.ceil(leadTimes.reduce((sum, days) => sum + days, 0) / leadTimes.length) + 7
      : undefined,
    evidenceBookingIds: stays.map((booking) => booking.id),
  };
}
