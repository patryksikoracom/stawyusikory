import { addLocalDays, formatPolishDate } from "@/lib/date";
import {
  calculateFinanceOverview,
  type FinanceCompleteness,
  type FinanceOverview,
} from "@/lib/metrics/finance";
import {
  calculateManagementResult,
  type ManagementCompleteness,
  type ManagementResult,
} from "@/lib/metrics/management-result";
import type { AppData, Currency, PaymentTransaction, PlatformImport } from "@/lib/types";

export type FinancePeriodPreset = "today" | "next14" | "month" | "ytd" | "custom";

export type FinanceMetricId =
  | "sales_booking_value_v1"
  | "receivables_guest_balance_v1"
  | "cashflow_posted_transactions_v1"
  | "management_result_v1";

export type FinancePeriod = {
  from: string;
  toExclusive: string;
  label: string;
  preset: FinancePeriodPreset;
};

export type FinanceEvidenceRow = {
  recordId: string;
  recordType: "booking" | "transaction" | "management-line";
  label: string;
  date: string | null;
  currency: Currency | null;
  contribution: number | null;
  source: string;
  detail: string;
  href: string | null;
};

export type FinanceReportMetric = {
  id: FinanceMetricId;
  label: string;
  definition: string;
  source: string;
  note: string;
  completeness: FinanceCompleteness | ManagementCompleteness;
  values: Array<{ currency: Currency; value: number | null }>;
  evidence: FinanceEvidenceRow[];
};

export type FinanceReport = {
  period: FinancePeriod;
  calculatedAt: string;
  overview: FinanceOverview;
  management: ManagementResult;
  metrics: FinanceReportMetric[];
};

export const FINANCE_METRIC_DEFINITIONS: Record<
  FinanceMetricId,
  Pick<FinanceReportMetric, "label" | "definition" | "source">
> = {
  sales_booking_value_v1: {
    label: "Sprzedaż",
    definition: "Pełna wartość aktywnych rezerwacji, których przyjazd przypada w wybranym okresie.",
    source: "Aktywne rezerwacje · data przyjazdu · uzgodniona wartość pobytu",
  },
  receivables_guest_balance_v1: {
    label: "Należności gości",
    definition: "Wartość pobytów pomniejszona o zaksięgowane wpłaty i zaliczki, powiększona o zwroty.",
    source: "Rezerwacje · saldo otwarcia · ledger zaksięgowanych transakcji",
  },
  cashflow_posted_transactions_v1: {
    label: "Wpłynęło na konto",
    definition: "Faktyczne wypłaty Airbnb i Booking oraz zaksięgowane wpłaty bezpośrednie, pomniejszone o zaksięgowane zwroty i koszty. Liczy się data przepływu pieniędzy, nie data pobytu.",
    source: "Rozliczenia OTA · data wypłaty · ledger zaksięgowanych transakcji",
  },
  management_result_v1: {
    label: "Wynik zarządczy",
    definition: "Sprzedaż minus koszty i prowizje faktyczne lub jawnie modelowane.",
    source: "Rezerwacje · ledger kosztów · importy OTA · aktywne założenia kosztowe",
  },
};

function monthPeriod(today: string) {
  const [year, month] = today.split("-").map(Number);
  const nextMonth = month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  return { from: `${year}-${String(month).padStart(2, "0")}-01`, toExclusive: nextMonth };
}

function periodLabel(from: string, toExclusive: string) {
  const inclusiveTo = addLocalDays(toExclusive, -1);
  if (from === inclusiveTo) return formatPolishDate(from);
  return `${formatPolishDate(from)} – ${formatPolishDate(inclusiveTo)}`;
}

export function financePeriodForPreset(
  preset: FinancePeriodPreset,
  today: string,
  custom?: { from?: string; toInclusive?: string },
): FinancePeriod {
  let from = today;
  let toExclusive = addLocalDays(today, 1);
  if (preset === "next14") toExclusive = addLocalDays(today, 14);
  if (preset === "month") ({ from, toExclusive } = monthPeriod(today));
  if (preset === "ytd") {
    from = `${today.slice(0, 4)}-01-01`;
    toExclusive = addLocalDays(today, 1);
  }
  if (preset === "custom") {
    const customFrom = custom?.from || today;
    const customTo = custom?.toInclusive || customFrom;
    from = customFrom <= customTo ? customFrom : customTo;
    toExclusive = addLocalDays(customFrom <= customTo ? customTo : customFrom, 1);
  }
  return { from, toExclusive, label: periodLabel(from, toExclusive), preset };
}

function managementCompleteness(management: ManagementResult): ManagementCompleteness {
  if (!management.currencies.length) return "unavailable";
  if (management.currencies.every((item) => item.completeness === "unavailable")) return "unavailable";
  return management.currencies.every((item) => item.completeness === "complete")
    ? "complete"
    : "partial";
}

function moneyValues(values: Record<Currency, number>, evidence: FinanceEvidenceRow[]) {
  const currencies = (["PLN", "EUR"] as const).filter((currency) => (
    values[currency] !== 0 || evidence.some((row) => row.currency === currency)
  ));
  return currencies.map((currency) => ({ currency, value: values[currency] }));
}

function plainMoneyValues(values: Record<Currency, number>) {
  const currencies = (["PLN", "EUR"] as const).filter((currency) => values[currency] !== 0);
  return currencies.length
    ? currencies.map((currency) => `${values[currency]} ${currency}`).join(" · ")
    : "0 PLN";
}

function transactionContribution(type: PaymentTransaction["type"], amount: number) {
  return ["Wpłata", "Zaliczka", "Wypłata OTA"].includes(type) ? amount : -amount;
}

function isInPeriod(date: string, period: FinancePeriod) {
  return date >= period.from && date < period.toExclusive;
}

function importCurrency(item: PlatformImport): Currency | null {
  return item.currency === "PLN" || item.currency === "EUR" ? item.currency : null;
}

export function confirmedOtaPayouts(input: {
  imports: PlatformImport[];
  payments: PaymentTransaction[];
  period: FinancePeriod;
  calculatedAt: string;
}) {
  const calculatedThrough = input.calculatedAt.slice(0, 10);
  const bookingIdsWithPostedPayout = new Set(input.payments
    .filter((payment) => payment.status === "Zaksięgowana" && payment.type === "Wypłata OTA")
    .map((payment) => payment.bookingId));

  return input.imports.filter((item) => (
    item.transferStatus === "Przeniesione"
    && item.matchedBookingId
    && !bookingIdsWithPostedPayout.has(item.matchedBookingId)
    && item.payout != null
    && Number.isFinite(item.payout)
    && item.payout >= 0
    && item.payoutDate
    && item.payoutDate <= calculatedThrough
    && isInPeriod(item.payoutDate, input.period)
    && importCurrency(item)
  ));
}

function csvCell(value: string | number | null) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export function createFinanceReport(input: {
  data: AppData;
  period: FinancePeriod;
  calculatedAt: string;
}): FinanceReport {
  const overview = calculateFinanceOverview({
    bookings: input.data.bookings,
    payments: input.data.payments,
    period: input.period,
  });
  const management = calculateManagementResult({
    bookings: input.data.bookings,
    payments: input.data.payments,
    costSettings: input.data.costSettings,
    imports: input.data.imports,
    units: input.data.units,
    period: input.period,
  });
  const bookingById = new Map(input.data.bookings.map((booking) => [booking.id, booking]));

  const salesEvidence: FinanceEvidenceRow[] = overview.bookingFinances.map((finance) => {
    const booking = bookingById.get(finance.bookingId)!;
    return {
      recordId: booking.id,
      recordType: "booking",
      label: booking.guestLabel,
      date: booking.checkIn,
      currency: finance.currency,
      contribution: finance.bookingValue,
      source: booking.importRef ? `${booking.platform} · import` : `${booking.platform} · wpis operacyjny`,
      detail: `${booking.checkIn}–${booking.checkOut}`,
      href: `/bookings/${booking.id}`,
    };
  });

  const receivablesEvidence: FinanceEvidenceRow[] = overview.bookingFinances.map((finance) => {
    const booking = bookingById.get(finance.bookingId)!;
    const status = finance.balanceStatus === "overpaid"
      ? `nadpłata ${finance.overpayment ?? 0} ${finance.currency ?? ""}`
      : finance.balanceStatus === "settled"
        ? "rozliczona"
        : finance.balanceStatus === "unavailable"
          ? "brak podstawy"
          : `pozostało ${finance.amountDue ?? 0} ${finance.currency ?? ""}`;
    return {
      recordId: booking.id,
      recordType: "booking",
      label: booking.guestLabel,
      date: booking.checkIn,
      currency: finance.currency,
      contribution: finance.amountDue,
      source: finance.openingPaidSource || "Ledger rezerwacji",
      detail: `wartość ${finance.bookingValue ?? "—"} · zaksięgowano ${finance.guestPaidNet} · ${status}`,
      href: `/bookings/${booking.id}`,
    };
  });

  const cashflowEvidence: FinanceEvidenceRow[] = input.data.payments
    .filter((payment) => (
      payment.status === "Zaksięgowana"
      && payment.occurredAt >= input.period.from
      && payment.occurredAt < input.period.toExclusive
      && Number.isFinite(payment.amount)
      && payment.amount >= 0
    ))
    .map((payment) => {
      const booking = bookingById.get(payment.bookingId);
      return {
        recordId: payment.id,
        recordType: "transaction",
        label: booking?.guestLabel || payment.bookingId,
        date: payment.occurredAt,
        currency: payment.currency ?? booking?.currency ?? null,
        contribution: transactionContribution(payment.type, payment.amount),
        source: payment.source || payment.note || "Ledger transakcji",
        detail: payment.type,
        href: booking ? `/bookings/${booking.id}` : null,
      };
    });
  const importedPayouts = confirmedOtaPayouts({
    imports: input.data.imports,
    payments: input.data.payments,
    period: input.period,
    calculatedAt: input.calculatedAt,
  });
  for (const imported of importedPayouts) {
    const currency = importCurrency(imported)!;
    overview.cashflow[currency] += imported.payout!;
    overview.otaPayouts[currency] += imported.payout!;
    overview.transactionCount += 1;
    cashflowEvidence.push({
      recordId: imported.id,
      recordType: "transaction",
      label: imported.guestName || imported.reservationNo || imported.platform,
      date: imported.payoutDate!,
      currency,
      contribution: imported.payout!,
      source: `${imported.platform} · ${imported.sourceFile || "rozliczenie OTA"}`,
      detail: `wypłata na konto${imported.payoutReference ? ` · ${imported.payoutReference}` : ""}`,
      href: imported.matchedBookingId ? `/bookings/${imported.matchedBookingId}` : null,
    });
  }
  if (importedPayouts.length && overview.completeness.cashflow === "unavailable") {
    overview.completeness.cashflow = "complete";
  }

  const managementEvidence: FinanceEvidenceRow[] = [
    ...overview.bookingFinances.map((finance) => {
      const booking = bookingById.get(finance.bookingId)!;
      return {
        recordId: booking.id,
        recordType: "booking" as const,
        label: booking.guestLabel,
        date: booking.checkIn,
        currency: finance.currency,
        contribution: finance.bookingValue,
        source: booking.importRef ? `${booking.platform} · import` : `${booking.platform} · wpis operacyjny`,
        detail: "sprzedaż",
        href: `/bookings/${booking.id}`,
      };
    }),
    ...management.lines.map((line) => {
      const payment = input.data.payments.find((item) => item.id === line.id);
      const booking = payment ? bookingById.get(payment.bookingId) : undefined;
      return {
        recordId: line.id,
        recordType: "management-line" as const,
        label: line.label,
        date: payment?.occurredAt ?? null,
        currency: line.currency,
        contribution: -line.amount,
        source: line.source || "Brak źródła",
        detail: `${line.kind === "actual" ? "fakt" : "model"} · ${line.category}`,
        href: booking ? `/bookings/${booking.id}` : line.costSettingId ? "/settings" : null,
      };
    }),
  ];

  const definitions = FINANCE_METRIC_DEFINITIONS;
  const managementValues = management.currencies.map((item) => ({
    currency: item.currency,
    value: item.result,
  }));
  const metrics: FinanceReportMetric[] = [
    {
      id: "sales_booking_value_v1",
      ...definitions.sales_booking_value_v1,
      note: `${overview.bookingCount} aktywnych rezerwacji`,
      completeness: overview.completeness.sales,
      values: moneyValues(overview.sales, salesEvidence),
      evidence: salesEvidence,
    },
    {
      id: "receivables_guest_balance_v1",
      ...definitions.receivables_guest_balance_v1,
      note: `Nadpłaty: ${plainMoneyValues(overview.overpayments)}`,
      completeness: overview.completeness.receivables,
      values: moneyValues(overview.receivables, receivablesEvidence),
      evidence: receivablesEvidence,
    },
    {
      id: "cashflow_posted_transactions_v1",
      ...definitions.cashflow_posted_transactions_v1,
      note: `${overview.transactionCount} potwierdzonych przepływów`,
      completeness: overview.completeness.cashflow,
      values: moneyValues(overview.cashflow, cashflowEvidence),
      evidence: cashflowEvidence,
    },
    {
      id: "management_result_v1",
      ...definitions.management_result_v1,
      note: `${management.readiness.readyCount}/${management.readiness.totalCount} warstw danych gotowych`,
      completeness: managementCompleteness(management),
      values: managementValues,
      evidence: managementEvidence,
    },
  ];

  return {
    period: input.period,
    calculatedAt: input.calculatedAt,
    overview,
    management,
    metrics,
  };
}

export function buildFinanceEvidenceCsv(report: FinanceReport) {
  const rows: Array<Array<string | number | null>> = [[
    "sekcja",
    "metryka_id",
    "metryka",
    "definicja",
    "uwaga",
    "okres_od",
    "okres_do_włącznie",
    "wyliczono",
    "kompletność",
    "źródło_metryki",
    "waluta",
    "wartość_karty",
    "typ_rekordu",
    "rekord_id",
    "etykieta",
    "data_rekordu",
    "wkład_do_wartości",
    "źródło_rekordu",
    "szczegół",
  ]];
  for (const metric of report.metrics) {
    const values = metric.values.length ? metric.values : [{ currency: null, value: null }];
    for (const value of values) {
      rows.push([
        "podsumowanie",
        metric.id,
        metric.label,
        metric.definition,
        metric.note,
        report.period.from,
        addLocalDays(report.period.toExclusive, -1),
        report.calculatedAt,
        metric.completeness,
        metric.source,
        value.currency,
        value.value,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
      ]);
    }
    for (const evidence of metric.evidence) {
      rows.push([
        "dowód",
        metric.id,
        metric.label,
        metric.definition,
        metric.note,
        report.period.from,
        addLocalDays(report.period.toExclusive, -1),
        report.calculatedAt,
        metric.completeness,
        metric.source,
        evidence.currency,
        null,
        evidence.recordType,
        evidence.recordId,
        evidence.label,
        evidence.date,
        evidence.contribution,
        evidence.source,
        evidence.detail,
      ]);
    }
  }
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\n")}`;
}

export function financeMetricValue(metric: FinanceReportMetric) {
  if (!metric.values.length) return "Brak danych";
  return metric.values.map(({ currency, value }) => (
    value == null
      ? `${currency}: brak podstawy`
      : new Intl.NumberFormat("pl-PL", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(value)
  )).join(" · ");
}

export function financeCompletenessLabel(value: FinanceCompleteness | ManagementCompleteness) {
  return value === "complete" ? "pełne" : value === "partial" ? "częściowe" : "brak danych";
}
