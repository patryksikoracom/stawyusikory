import { isBookingInTrash } from "@/lib/booking-trash";
import type { AppData, Booking, ContactConsent, GuestProfile } from "@/lib/types";

export type GuestSegmentSummary = {
  label: string;
  count: number;
};

export type GuestInsightSummary = {
  visibleBookings: Booking[];
  profiles: GuestProfile[];
  consents: ContactConsent[];
  segments: GuestSegmentSummary[];
  profileCount: number;
  contactCount: number;
  marketingConsentCount: number;
  reviewCount: number;
  contactCoverage: number | null;
  missingProfileBookingIds: string[];
  missingSegmentBookingIds: string[];
  missingDiscoveryBookingIds: string[];
  discoveryCounts: Array<{ source: string; count: number }>;
  discoveryMethodSample: number;
  browsingCount: number;
  averageNps: number | null;
};

function visibleRecords(data: AppData) {
  const visibleBookings = data.bookings.filter((booking) => !isBookingInTrash(booking));
  const bookingIds = new Set(visibleBookings.map((booking) => booking.id));
  return {
    visibleBookings,
    profiles: data.guests.filter((profile) => bookingIds.has(profile.bookingId)),
    consents: data.consents.filter((consent) => bookingIds.has(consent.bookingId)),
  };
}

export function deriveGuestInsightSummary(data: AppData): GuestInsightSummary {
  const { visibleBookings, profiles, consents } = visibleRecords(data);
  const profileByBooking = new Map(profiles.map((profile) => [profile.bookingId, profile]));
  const segmentsByKey = new Map<string, GuestSegmentSummary>();
  const discoveryBySource = new Map<string, number>();

  for (const profile of profiles) {
    const segment = profile.segment?.trim();
    if (segment) {
      const key = segment.toLocaleLowerCase("pl-PL");
      const current = segmentsByKey.get(key);
      segmentsByKey.set(key, { label: current?.label ?? segment, count: (current?.count ?? 0) + 1 });
    }

    const source = profile.discoveryChannel?.trim();
    if (source) discoveryBySource.set(source, (discoveryBySource.get(source) ?? 0) + 1);
  }

  const reviewedProfiles = profiles.filter((profile) => profile.nps != null);
  const discoveryProfiles = profiles.filter((profile) => profile.discoveryMethod && profile.discoveryMethod !== "Nie wiadomo");

  return {
    visibleBookings,
    profiles,
    consents,
    segments: [...segmentsByKey.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pl-PL")),
    profileCount: profiles.length,
    contactCount: consents.filter((consent) => consent.email || consent.phone).length,
    marketingConsentCount: consents.filter((consent) => consent.marketingConsent === "Tak").length,
    reviewCount: reviewedProfiles.length,
    contactCoverage: visibleBookings.length
      ? Math.round((consents.filter((consent) => consent.email || consent.phone).length / visibleBookings.length) * 100)
      : null,
    missingProfileBookingIds: visibleBookings.filter((booking) => !profileByBooking.has(booking.id)).map((booking) => booking.id),
    missingSegmentBookingIds: visibleBookings.filter((booking) => !profileByBooking.get(booking.id)?.segment?.trim()).map((booking) => booking.id),
    missingDiscoveryBookingIds: visibleBookings.filter((booking) => !profileByBooking.get(booking.id)?.discoveryChannel).map((booking) => booking.id),
    discoveryCounts: [...discoveryBySource.entries()].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count || a.source.localeCompare(b.source, "pl-PL")),
    discoveryMethodSample: discoveryProfiles.length,
    browsingCount: discoveryProfiles.filter((profile) => profile.discoveryMethod === "Przeglądanie ofert").length,
    averageNps: reviewedProfiles.length
      ? reviewedProfiles.reduce((sum, profile) => sum + (profile.nps ?? 0), 0) / reviewedProfiles.length
      : null,
  };
}
