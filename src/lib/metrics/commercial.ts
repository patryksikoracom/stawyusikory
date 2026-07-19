import type { Booking, CalendarBlock, Unit } from "@/lib/types";

export type DatePeriod = {
  from: string;
  toExclusive: string;
};

export type MetricCompleteness = "complete" | "partial" | "unavailable";
export type MetricCurrency = "PLN" | "EUR";

export type MetricIssueCode =
  | "invalid_period"
  | "invalid_booking_dates"
  | "unknown_booking_unit"
  | "booking_needs_review"
  | "invalid_block_dates"
  | "unknown_block_unit"
  | "overlapping_active_bookings"
  | "booking_overlaps_technical_block"
  | "currency_assumed_pln"
  | "gross_price_prorated"
  | "missing_lodging_value";

export type MetricIssue = {
  code: MetricIssueCode;
  recordId?: string;
};

export type MetricMetadata = {
  metricId: string;
  period: DatePeriod;
  source: "operational_records_v2";
  calculatedAt: string;
  completeness: MetricCompleteness;
  sampleSize: number;
  filters: string[];
};

export type CurrencyMetric = {
  currency: MetricCurrency;
  soldNights: number;
  lodgingValue: number | null;
  adr: number | null;
  revPar: number | null;
  completeness: MetricCompleteness;
  issues: MetricIssue[];
};

export type CommercialMetrics = {
  period: DatePeriod;
  realizedPeriod: DatePeriod;
  soldNights: number;
  technicalBlockedNights: number;
  availableNights: number;
  realizedAvailableNights: number;
  occupancyPercent: number | null;
  currencies: CurrencyMetric[];
  occupancyMetadata: MetricMetadata;
  valueMetadata: MetricMetadata;
  occupancyIssues: MetricIssue[];
  valueIssues: MetricIssue[];
  issues: MetricIssue[];
  evidence: {
    bookings: Array<{
      bookingId: string;
      unitId: string;
      soldNights: number;
      realizedNights: number;
      currency: MetricCurrency;
      lodgingValue: number | null;
      valueSource: "price_per_night" | "gross_price_prorated" | "missing";
    }>;
    technicalBlocks: Array<{ blockId: string; unitId: string; blockedNights: number }>;
  };
};

const DAY_MS = 86_400_000;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const ACTIVE_BOOKING_STATUSES = new Set<Booking["workflowStatus"]>([
  "Potwierdzona",
  "Przed przyjazdem",
  "W trakcie",
  "Po pobycie",
  "Zamknięta",
]);
const CAPACITY_BLOCK_TYPES = new Set<CalendarBlock["blockType"]>(["Serwis", "Remont"]);

export function dateOrdinal(value: string) {
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null;
  return Math.floor(date.getTime() / DAY_MS);
}

export function dateFromOrdinal(ordinal: number) {
  return new Date(ordinal * DAY_MS).toISOString().slice(0, 10);
}

export function addDateDays(value: string, amount: number) {
  const ordinal = dateOrdinal(value);
  return ordinal == null ? null : dateFromOrdinal(ordinal + amount);
}

export function validPeriod(period: DatePeriod) {
  const from = dateOrdinal(period.from);
  const to = dateOrdinal(period.toExclusive);
  return from != null && to != null && to > from;
}

export function periodNights(period: DatePeriod) {
  const from = dateOrdinal(period.from);
  const to = dateOrdinal(period.toExclusive);
  return from == null || to == null || to <= from ? 0 : to - from;
}

export function intersectPeriods(first: DatePeriod, second: DatePeriod): DatePeriod | null {
  if (!validPeriod(first) || !validPeriod(second)) return null;
  const from = first.from > second.from ? first.from : second.from;
  const toExclusive = first.toExclusive < second.toExclusive ? first.toExclusive : second.toExclusive;
  return from < toExclusive ? { from, toExclusive } : null;
}

export function stayNightsInPeriod(checkIn: string, checkOut: string, period: DatePeriod) {
  const intersection = intersectPeriods({ from: checkIn, toExclusive: checkOut }, period);
  return intersection ? periodNights(intersection) : 0;
}

export function monthPeriodContaining(value: string): DatePeriod | null {
  if (dateOrdinal(value) == null) return null;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return {
    from: `${year}-${String(month).padStart(2, "0")}-01`,
    toExclusive: `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`,
  };
}

export function calendarYearPeriod(year: number): DatePeriod {
  return { from: `${year}-01-01`, toExclusive: `${year + 1}-01-01` };
}

export function isActiveBooking(booking: Booking) {
  return !booking.deletedAt && ACTIVE_BOOKING_STATUSES.has(booking.workflowStatus);
}

function eachNight(period: DatePeriod, callback: (date: string) => void) {
  const from = dateOrdinal(period.from);
  const to = dateOrdinal(period.toExclusive);
  if (from == null || to == null) return;
  for (let ordinal = from; ordinal < to; ordinal += 1) callback(dateFromOrdinal(ordinal));
}

function uniqueIssues(issues: MetricIssue[]) {
  return issues.filter((issue, index) => issues.findIndex(
    (candidate) => candidate.code === issue.code && candidate.recordId === issue.recordId,
  ) === index);
}

function currencyFor(booking: Booking): { currency: MetricCurrency; assumed: boolean } {
  if (booking.currency === "EUR") return { currency: "EUR", assumed: false };
  return { currency: "PLN", assumed: booking.currency == null };
}

function valueForBooking(booking: Booking, realizedNights: number) {
  if (Number.isFinite(booking.pricePerNight) && (booking.pricePerNight ?? -1) >= 0) {
    return {
      value: (booking.pricePerNight ?? 0) * realizedNights,
      source: "price_per_night" as const,
      issue: null,
    };
  }
  const fullStayNights = stayNightsInPeriod(
    booking.checkIn,
    booking.checkOut,
    { from: booking.checkIn, toExclusive: booking.checkOut },
  );
  if (Number.isFinite(booking.grossPrice) && (booking.grossPrice ?? -1) >= 0 && fullStayNights > 0) {
    return {
      value: ((booking.grossPrice ?? 0) / fullStayNights) * realizedNights,
      source: "gross_price_prorated" as const,
      issue: { code: "gross_price_prorated" as const, recordId: booking.id },
    };
  }
  return {
    value: null,
    source: "missing" as const,
    issue: { code: "missing_lodging_value" as const, recordId: booking.id },
  };
}

export function calculateCommercialMetrics(input: {
  bookings: Booking[];
  units: Unit[];
  blocks: CalendarBlock[];
  period: DatePeriod;
  realizedToExclusive?: string;
  calculatedAt?: string;
}): CommercialMetrics {
  const calculatedAt = input.calculatedAt ?? new Date().toISOString();
  const period = input.period;
  const emptyPeriod = { from: period.from, toExclusive: period.from };
  const requestedRealizedPeriod = input.realizedToExclusive
    ? { from: period.from, toExclusive: input.realizedToExclusive }
    : period;
  const realizedPeriod = intersectPeriods(period, requestedRealizedPeriod) ?? emptyPeriod;
  const issues: MetricIssue[] = [];
  const unitIds = new Set(input.units.map((unit) => unit.id));
  const validRequestedPeriod = validPeriod(period);

  if (!validRequestedPeriod) issues.push({ code: "invalid_period" });

  const activeBookings = input.bookings.filter(isActiveBooking).filter((booking) => {
    if (!validPeriod({ from: booking.checkIn, toExclusive: booking.checkOut })) {
      issues.push({ code: "invalid_booking_dates", recordId: booking.id });
      return false;
    }
    if (!intersectPeriods({ from: booking.checkIn, toExclusive: booking.checkOut }, period)) {
      return false;
    }
    if (!unitIds.has(booking.unitId)) {
      issues.push({ code: "unknown_booking_unit", recordId: booking.id });
      return false;
    }
    if (booking.needsReview) issues.push({ code: "booking_needs_review", recordId: booking.id });
    return true;
  });

  const blockedNightKeys = new Set<string>();
  const blockEvidence: CommercialMetrics["evidence"]["technicalBlocks"] = [];
  input.blocks
    .filter((block) => block.status !== "Anulowana" && CAPACITY_BLOCK_TYPES.has(block.blockType))
    .forEach((block) => {
      if (!validPeriod({ from: block.dateFrom, toExclusive: block.dateTo })) {
        issues.push({ code: "invalid_block_dates", recordId: block.id });
        return;
      }
      const intersection = intersectPeriods(
        { from: block.dateFrom, toExclusive: block.dateTo },
        period,
      );
      if (!intersection) return;
      if (!unitIds.has(block.unitId)) {
        issues.push({ code: "unknown_block_unit", recordId: block.id });
        return;
      }
      const before = blockedNightKeys.size;
      eachNight(intersection, (date) => blockedNightKeys.add(`${block.unitId}|${date}`));
      blockEvidence.push({
        blockId: block.id,
        unitId: block.unitId,
        blockedNights: blockedNightKeys.size - before,
      });
    });

  let soldNights = 0;
  const soldNightKeys = new Set<string>();
  const bookingEvidence: CommercialMetrics["evidence"]["bookings"] = [];
  for (const booking of activeBookings) {
    const soldIntersection = intersectPeriods(
      { from: booking.checkIn, toExclusive: booking.checkOut },
      period,
    );
    const realizedIntersection = intersectPeriods(
      { from: booking.checkIn, toExclusive: booking.checkOut },
      realizedPeriod,
    );
    const bookingSoldNights = soldIntersection ? periodNights(soldIntersection) : 0;
    const realizedNights = realizedIntersection ? periodNights(realizedIntersection) : 0;
    soldNights += bookingSoldNights;
    if (soldIntersection) eachNight(soldIntersection, (date) => {
      const key = `${booking.unitId}|${date}`;
      if (soldNightKeys.has(key)) {
        issues.push({ code: "overlapping_active_bookings", recordId: booking.unitId });
      }
      soldNightKeys.add(key);
    });

    const { currency, assumed } = currencyFor(booking);
    if (assumed && realizedNights > 0) issues.push({ code: "currency_assumed_pln", recordId: booking.id });
    const lodging = valueForBooking(booking, realizedNights);
    if (realizedNights > 0 && lodging.issue) issues.push(lodging.issue);
    if (bookingSoldNights > 0 || realizedNights > 0) {
      bookingEvidence.push({
        bookingId: booking.id,
        unitId: booking.unitId,
        soldNights: bookingSoldNights,
        realizedNights,
        currency,
        lodgingValue: realizedNights > 0 ? lodging.value : null,
        valueSource: lodging.source,
      });
    }
  }

  for (const key of soldNightKeys) {
    if (blockedNightKeys.has(key)) {
      const [unitId] = key.split("|");
      issues.push({ code: "booking_overlaps_technical_block", recordId: unitId });
    }
  }

  const technicalBlockedNights = blockedNightKeys.size;
  const inventoryNights = validRequestedPeriod ? periodNights(period) * input.units.length : 0;
  const availableNights = Math.max(0, inventoryNights - technicalBlockedNights);
  const realizedTechnicalBlockedNights = validPeriod(realizedPeriod)
    ? [...blockedNightKeys].filter((key) => {
      const date = key.slice(key.indexOf("|") + 1);
      return date >= realizedPeriod.from && date < realizedPeriod.toExclusive;
    }).length
    : 0;
  const realizedAvailableNights = validPeriod(realizedPeriod)
    ? Math.max(0, periodNights(realizedPeriod) * input.units.length - realizedTechnicalBlockedNights)
    : 0;
  const occupancyPercent = availableNights > 0 ? (soldNights / availableNights) * 100 : null;
  const issueList = uniqueIssues(issues);
  const dataQualityIssueCodes = new Set<MetricIssueCode>([
    "invalid_booking_dates",
    "unknown_booking_unit",
    "booking_needs_review",
    "invalid_block_dates",
    "unknown_block_unit",
    "overlapping_active_bookings",
    "booking_overlaps_technical_block",
  ]);
  const occupancyCompleteness: MetricCompleteness = !validRequestedPeriod || input.units.length === 0
    ? "unavailable"
    : issueList.some((issue) => dataQualityIssueCodes.has(issue.code)) ? "partial" : "complete";
  const occupancyIssues = issueList.filter((issue) => dataQualityIssueCodes.has(issue.code));

  const currencies = (["PLN", "EUR"] as const).flatMap((currency) => {
    const rows = bookingEvidence.filter((row) => row.currency === currency && row.realizedNights > 0);
    if (!rows.length) return [];
    const currencyIssues = issueList.filter((issue) => {
      const row = rows.find((candidate) => candidate.bookingId === issue.recordId);
      return Boolean(row) && [
        "booking_needs_review",
        "currency_assumed_pln",
        "gross_price_prorated",
        "missing_lodging_value",
      ].includes(issue.code);
    });
    const hasMissingValue = rows.some((row) => row.lodgingValue == null);
    const lodgingValue = hasMissingValue
      ? null
      : rows.reduce((sum, row) => sum + (row.lodgingValue ?? 0), 0);
    const currencySoldNights = rows.reduce((sum, row) => sum + row.realizedNights, 0);
    const completeness: MetricCompleteness = hasMissingValue
      ? "unavailable"
      : currencyIssues.length ? "partial" : "complete";
    return [{
      currency,
      soldNights: currencySoldNights,
      lodgingValue,
      adr: lodgingValue == null || currencySoldNights === 0 ? null : lodgingValue / currencySoldNights,
      revPar: lodgingValue == null || realizedAvailableNights === 0 ? null : lodgingValue / realizedAvailableNights,
      completeness,
      issues: currencyIssues,
    }];
  });

  const valueCompleteness: MetricCompleteness = currencies.length === 0
    ? "unavailable"
    : currencies.some((metric) => metric.completeness === "unavailable")
      ? "unavailable"
      : currencies.some((metric) => metric.completeness === "partial") || occupancyCompleteness === "partial"
        ? "partial"
        : "complete";
  const valueIssueCodes = new Set<MetricIssueCode>([
    ...dataQualityIssueCodes,
    "currency_assumed_pln",
    "gross_price_prorated",
    "missing_lodging_value",
  ]);
  const valueIssues = issueList.filter((issue) => valueIssueCodes.has(issue.code));

  const commonFilters = [
    "status: Potwierdzona/Przed przyjazdem/W trakcie/Po pobycie/Zamknięta",
    "bez: Nowa/Anulowana/kosz",
    "okres: [od, do)",
  ];

  return {
    period,
    realizedPeriod,
    soldNights,
    technicalBlockedNights,
    availableNights,
    realizedAvailableNights,
    occupancyPercent,
    currencies,
    occupancyMetadata: {
      metricId: "commercial_occupancy_v2",
      period,
      source: "operational_records_v2",
      calculatedAt,
      completeness: occupancyCompleteness,
      sampleSize: soldNights,
      filters: [...commonFilters, "dostępność minus: Serwis/Remont"],
    },
    valueMetadata: {
      metricId: "lodging_value_adr_revpar_v2",
      period: realizedPeriod,
      source: "operational_records_v2",
      calculatedAt,
      completeness: valueCompleteness,
      sampleSize: bookingEvidence.reduce((sum, row) => sum + row.realizedNights, 0),
      filters: [...commonFilters, "waluty: osobno PLN/EUR"],
    },
    occupancyIssues,
    valueIssues,
    issues: issueList,
    evidence: { bookings: bookingEvidence, technicalBlocks: blockEvidence },
  };
}
