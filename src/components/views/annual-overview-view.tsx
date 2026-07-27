"use client";

import Link from "next/link";
import { useMemo, useState, type KeyboardEvent } from "react";
import { useAppStore } from "@/components/layout/app-store";
import { Badge, Card } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icons";
import { formatPolishDate, todayInPoland } from "@/lib/date";
import type { Currency } from "@/lib/types";
import {
  buildAnnualOverview,
  detectAnnualGaps,
  type AnnualGap,
  type AnnualMetric,
  type AnnualMonthSummary,
  type GapClass,
} from "@/lib/workflow/annual-overview";

const metrics: { id: AnnualMetric; label: string }[] = [
  { id: "occupancy", label: "Obłożenie" },
  { id: "revenue", label: "Wartość rezerwacji" },
  { id: "adr", label: "ADR" },
  { id: "leadTime", label: "Lead time" },
];
const gapClasses: GapClass[] = ["1 noc", "2–3 noce", "4–6 nocy", "7+ nocy"];
const monthNames = Array.from({ length: 12 }, (_, month) =>
  new Intl.DateTimeFormat("pl-PL", { month: "long" }).format(new Date(2026, month, 1)));

function money(value: number, currency: Currency) {
  return `${Math.round(value).toLocaleString("pl-PL")} ${currency}`;
}

function currencyLines(values: AnnualMonthSummary["revenue"]) {
  return (Object.entries(values) as [Currency, number][]).sort(([a], [b]) => a.localeCompare(b));
}

function metricValue(summary: AnnualMonthSummary, metric: AnnualMetric) {
  if (metric === "occupancy") return summary.occupancyPercent == null ? ["Brak podstawy"] : [`${summary.occupancyPercent.toLocaleString("pl-PL", { maximumFractionDigits: 1 })}%`];
  if (metric === "leadTime") return summary.leadTimeDays == null ? ["Brak danych"] : [`${summary.leadTimeDays.toLocaleString("pl-PL", { maximumFractionDigits: 1 })} dni`];
  const values = metric === "revenue" ? summary.revenue : summary.adr;
  const lines = currencyLines(values);
  return lines.length ? lines.map(([currency, value]) => money(value, currency)) : ["Brak danych"];
}

function comparisonCopy(current: AnnualMonthSummary, previous: AnnualMonthSummary | undefined, metric: AnnualMetric, previousYear: number) {
  if (!previous) return `Brak porównania ${previousYear}`;
  if (metric === "occupancy" && current.occupancyPercent != null && previous.occupancyPercent != null) {
    const delta = current.occupancyPercent - previous.occupancyPercent;
    return `${delta >= 0 ? "+" : ""}${delta.toLocaleString("pl-PL", { maximumFractionDigits: 1 })} pp vs ${previousYear}`;
  }
  if (metric === "leadTime" && current.leadTimeDays != null && previous.leadTimeDays != null) {
    const delta = current.leadTimeDays - previous.leadTimeDays;
    return `${delta >= 0 ? "+" : ""}${delta.toLocaleString("pl-PL", { maximumFractionDigits: 1 })} dni vs ${previousYear}`;
  }
  const currentValues = metric === "adr" ? current.adr : current.revenue;
  const previousValues = metric === "adr" ? previous.adr : previous.revenue;
  const currencies = (Object.keys(currentValues) as Currency[]).filter((currency) => previousValues[currency] != null);
  if (!currencies.length) return `Brak porównywalnej waluty ${previousYear}`;
  return currencies.map((currency) => {
    const before = previousValues[currency] ?? 0;
    const delta = before ? ((currentValues[currency] ?? 0) - before) / before * 100 : 0;
    return `${currency} ${delta >= 0 ? "+" : ""}${delta.toLocaleString("pl-PL", { maximumFractionDigits: 0 })}%`;
  }).join(" · ") + ` vs ${previousYear}`;
}

function tone(summary: AnnualMonthSummary) {
  const value = summary.occupancyPercent ?? 0;
  if (value >= 75) return "border-[#8aaa85] bg-[#dfeadb]";
  if (value >= 45) return "border-[#b9c69d] bg-[#edf0dd]";
  if (value > 0) return "border-[#ddc995] bg-[#f5ecd2]";
  return "border-[#ded7ca] bg-[#fffdf8]";
}

function onEnter(event: KeyboardEvent<HTMLButtonElement>, action: () => void) {
  if (event.key !== "Enter") return;
  event.preventDefault();
  action();
}

export function AnnualOverviewView() {
  const { data } = useAppStore();
  const today = todayInPoland();
  const currentYear = Number(today.slice(0, 4));
  const [year, setYear] = useState(currentYear);
  const [metric, setMetric] = useState<AnnualMetric>("occupancy");
  const [gapFilter, setGapFilter] = useState<GapClass | "Wszystkie">("4–6 nocy");
  const overview = useMemo(() => buildAnnualOverview(data, year, today), [data, today, year]);
  const previous = useMemo(() => buildAnnualOverview(data, year - 1, today), [data, today, year]);
  const gaps = useMemo(() => detectAnnualGaps(data, year, today), [data, today, year]);
  const visibleGaps = gaps.filter((gap) => gapFilter === "Wszystkie" || gap.classification === gapFilter).slice(0, 16);

  return <div className="grid gap-5">
    <section className="flex flex-col gap-4 rounded-[22px] border border-[#cfd7bd] bg-[linear-gradient(135deg,#eef2e2_0%,#fffaf0_55%,#e9efea_100%)] p-4 sm:p-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2"><Link className="inline-flex min-h-9 items-center gap-1 rounded-xl border border-[#c7cfb7] bg-white px-3 text-xs font-black text-[#365948]" href="/calendar"><Icon className="size-3.5 rotate-180" name="arrow"/>Kalendarz 42 dni</Link><Badge tone="lake">Stan sprzedaży na dziś</Badge><Badge tone="neutral">bez prognozy końcowej</Badge></div>
        <h2 className="mt-3 font-display text-2xl font-semibold sm:text-3xl">Rok w jednym spojrzeniu</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-[#5f6e67]">Miesiące i domki są porównane według danych znanych do {formatPolishDate(overview.cutoff)}. Rok poprzedni używa tego samego dnia sprzedaży.</p>
      </div>
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-[#d2cabb] bg-white/85 p-1.5">
        <button aria-label="Poprzedni rok" className="grid size-11 place-items-center rounded-xl hover:bg-[#ecefe3]" onClick={() => setYear((value) => value - 1)} onKeyDown={(event) => onEnter(event, () => setYear((value) => value - 1))}><Icon className="size-4 rotate-180" name="chevron"/></button>
        <p aria-live="polite" className="min-w-24 text-center font-display text-2xl font-semibold">{year}</p>
        <button aria-label="Następny rok" className="grid size-11 place-items-center rounded-xl hover:bg-[#ecefe3]" onClick={() => setYear((value) => value + 1)} onKeyDown={(event) => onEnter(event, () => setYear((value) => value + 1))}><Icon className="size-4" name="chevron"/></button>
      </div>
    </section>

    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div aria-label="Metryka widoku rocznego" className="grid grid-cols-2 gap-1 rounded-2xl bg-[#e9e5dc] p-1 sm:flex" role="group">
        {metrics.map((item) => <button aria-pressed={metric === item.id} className={`min-h-11 rounded-xl px-3 text-xs font-black ${metric === item.id ? "bg-[#174d3b] text-white shadow-sm" : "text-[#5f6d66] hover:bg-white/70"}`} key={item.id} onClick={() => setMetric(item.id)} onKeyDown={(event) => onEnter(event, () => setMetric(item.id))}>{item.label}</button>)}
      </div>
      <p className="text-xs font-semibold leading-5 text-[#68756f]">PLN i EUR pozostają osobnymi liniami. Brak ceny nie staje się zerem.</p>
    </div>

    {data.units.map((unit) => <section aria-labelledby={`annual-unit-${unit.id}`} className="grid gap-3" key={unit.id}>
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-[10px] font-black uppercase tracking-[.15em] text-[#7c894e]">Domek</p><h3 className="font-display text-2xl font-semibold" id={`annual-unit-${unit.id}`}>{unit.name}</h3></div>
        <span className="text-xs font-bold text-[#69766f]">12 miesięcy · {metrics.find((item) => item.id === metric)?.label}</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {overview.months.filter((item) => item.unitId === unit.id).map((summary) => {
          const previousSummary = previous.months.find((item) => item.unitId === unit.id && item.month === summary.month);
          return <article className={`min-w-0 rounded-[18px] border p-4 ${tone(summary)}`} key={summary.month}>
            <div className="flex items-start justify-between gap-2"><p className="font-display text-lg font-semibold capitalize">{monthNames[summary.month - 1]}</p><span className="rounded-full bg-white/75 px-2 py-1 text-[9px] font-black">{summary.soldNights}/{summary.availableNights} nocy</span></div>
            <div className="mt-3 grid gap-0.5">{metricValue(summary, metric).map((value) => <p className="break-words font-display text-xl font-semibold" key={value}>{value}</p>)}</div>
            <p className="mt-2 text-[10px] font-bold leading-4 text-[#65736c]">{comparisonCopy(summary, previousSummary, metric, year - 1)}</p>
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-black/10 pt-3">
              <Badge tone={!summary.bookingsCount ? "neutral" : summary.pricedBookingsCount === summary.bookingsCount ? "good" : "warn"}>{summary.pricedBookingsCount}/{summary.bookingsCount} cen</Badge>
              <Badge tone={summary.targetPercent ? "neutral" : "warn"}>{summary.targetPercent ? `cel ${summary.targetPercent}%` : "cel nieustalony"}</Badge>
            </div>
          </article>;
        })}
      </div>
    </section>)}

    <Card className="overflow-hidden">
      <div className="grid gap-4 border-b border-[#ded7ca] p-5 lg:grid-cols-[1fr_auto] lg:items-end">
        <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#7d8b4d]">Deterministyczne luki</p><h2 className="font-display text-2xl font-semibold">Wolne ciągi z dowodem</h2><p className="mt-1 text-xs leading-5 text-[#68756f]">Klasyfikacja wynika wyłącznie z liczby kolejnych wolnych nocy. System niczego nie publikuje, nie uruchamia reklamy i nie zmienia ceny.</p></div>
        <div aria-label="Klasa długości luki" className="flex flex-wrap gap-1" role="group">{(["Wszystkie", ...gapClasses] as const).map((item) => <button aria-pressed={gapFilter === item} className={`min-h-10 rounded-xl px-3 text-xs font-black ${gapFilter === item ? "bg-[#174d3b] text-white" : "bg-[#efebe2] text-[#596960]"}`} key={item} onClick={() => setGapFilter(item)} onKeyDown={(event) => onEnter(event, () => setGapFilter(item))}>{item}</button>)}</div>
      </div>
      <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
        {visibleGaps.map((gap) => <GapCard data={data} gap={gap} key={`${gap.unitId}-${gap.dateFrom}-${gap.dateTo}`}/>)}
        {!visibleGaps.length ? <p className="p-8 text-center text-sm font-bold text-[#68756f] md:col-span-2 xl:col-span-3">Brak luk w tej klasie dla wybranego roku.</p> : null}
      </div>
      {gaps.filter((gap) => gapFilter === "Wszystkie" || gap.classification === gapFilter).length > visibleGaps.length ? <p className="border-t p-4 text-center text-xs font-bold text-[#68756f]">Pokazano pierwsze 16 luk. Zawęź klasę, aby zobaczyć właściwy priorytet operacyjny.</p> : null}
    </Card>

    <section className="flex flex-col gap-4 rounded-[20px] border border-[#dfcda2] bg-[#f8efd6] p-5 sm:flex-row sm:items-center">
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#8a6a21] text-white"><Icon className="size-5" name="warning"/></span>
      <div className="flex-1"><p className="text-sm font-black">Cele są hipotezą, nie automatycznym sterowaniem</p><p className="mt-1 text-xs leading-5 text-[#6d5b31]">Cel obłożenia, sezon i minimum pobytu konfiguruje się per domek w regule sezonowej. Zmiana wymaga decyzji człowieka.</p></div>
      <Link className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#bca86f] bg-white px-4 text-sm font-black text-[#5d4b22]" href="/settings">Ustaw sezony i cele</Link>
    </section>
  </div>;
}

function GapCard({ data, gap }: { data: ReturnType<typeof useAppStore>["data"]; gap: AnnualGap }) {
  const unit = data.units.find((item) => item.id === gap.unitId);
  const priority = gap.classification === "7+ nocy" ? "wysoki priorytet ręczny" : gap.classification === "4–6 nocy" ? "okazja do ręcznej oceny" : "sprawdź ograniczenia operacyjne";
  return <article className="rounded-2xl border border-[#ddd4c5] bg-[#fffdf8] p-4">
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black">{unit?.name ?? gap.unitId}</p><p className="mt-0.5 text-[10px] font-bold text-[#78827d]">{formatPolishDate(gap.dateFrom)} – {formatPolishDate(gap.dateTo)}</p></div><Badge tone={gap.nights >= 7 ? "bad" : gap.nights >= 4 ? "warn" : "neutral"}>{gap.classification}</Badge></div>
    <dl className="mt-4 grid grid-cols-2 gap-2 text-xs"><Evidence label="Sezon" value={gap.season}/><Evidence label="Min. pobytu" value={gap.minNights ? `${gap.minNights} noce` : "brak reguły"}/><Evidence label="Do startu" value={gap.daysUntilStart < 0 ? "termin historyczny" : gap.daysUntilStart === 0 ? "dzisiaj" : `${gap.daysUntilStart} dni`}/><Evidence label="Cel obłożenia" value={gap.occupancyTargetPercent ? `${gap.occupancyTargetPercent}% · hipoteza` : "nieustalony"}/></dl>
    <p className="mt-3 rounded-xl bg-[#f1eee6] p-3 text-xs font-bold leading-5 text-[#52635a]">Podstawa: {gap.nights} kolejnych wolnych nocy · {priority}. Brak automatycznej akcji.</p>
  </article>;
}

function Evidence({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-[9px] font-black uppercase tracking-[.11em] text-[#818984]">{label}</dt><dd className="mt-0.5 font-bold text-[#41564d]">{value}</dd></div>;
}
