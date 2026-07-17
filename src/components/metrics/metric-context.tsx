import { Badge } from "@/components/ui/primitives";
import { addDateDays, type MetricIssue, type MetricIssueCode, type MetricMetadata } from "@/lib/metrics/commercial";

const completenessCopy = {
  complete: { label: "Pełne", tone: "good" as const },
  partial: { label: "Częściowe", tone: "warn" as const },
  unavailable: { label: "Brak danych", tone: "bad" as const },
};

function shortDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}

export function formatMetricPeriod(metadata: MetricMetadata) {
  const lastDay = addDateDays(metadata.period.toExclusive, -1);
  if (!lastDay || lastDay < metadata.period.from) return "brak zamkniętych nocy";
  return `${shortDate(metadata.period.from)}–${shortDate(lastDay)}`;
}

const issueLabels: Partial<Record<MetricIssueCode, string>> = {
  invalid_booking_dates: "błędne daty rezerwacji",
  unknown_booking_unit: "nieznany domek rezerwacji",
  booking_needs_review: "rezerwacje do weryfikacji",
  invalid_block_dates: "błędne daty blokady",
  unknown_block_unit: "nieznany domek blokady",
  overlapping_active_bookings: "nakładające się rezerwacje",
  booking_overlaps_technical_block: "konflikt rezerwacja–blokada",
  currency_assumed_pln: "waluta domyślnie PLN",
  gross_price_prorated: "wartość rozłożona z ceny pobytu",
  missing_lodging_value: "brak wartości noclegu",
};

function issueSummary(issues: MetricIssue[]) {
  const counts = new Map<MetricIssueCode, number>();
  issues.forEach((issue) => counts.set(issue.code, (counts.get(issue.code) ?? 0) + 1));
  return [...counts.entries()]
    .filter(([code]) => issueLabels[code])
    .map(([code, count]) => `${issueLabels[code]}: ${count}`)
    .join(" · ");
}

export function MetricContext({ metadata, issues = [] }: { metadata: MetricMetadata; issues?: MetricIssue[] }) {
  const completeness = completenessCopy[metadata.completeness];
  const issuesCopy = issueSummary(issues);
  return (
    <div className="mt-3 border-t border-[#e8e1d5] pt-3 text-[10px] font-bold leading-4 text-[#78837d]">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Badge className="px-2 py-0.5 text-[9px]" tone={completeness.tone}>{completeness.label}</Badge>
        <span>{formatMetricPeriod(metadata)}</span>
        <span aria-hidden="true">·</span>
        <span>rekordy operacyjne v2</span>
      </div>
      {issuesCopy ? <p className="mt-1 text-[#8a6233]" title={issuesCopy}>Do sprawdzenia: {issuesCopy}</p> : null}
    </div>
  );
}
