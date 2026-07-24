"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAppStore } from "@/components/layout/app-store";
import { Badge, Button, Card, Field, inputClass } from "@/components/ui/primitives";
import { Icon, type IconName } from "@/components/ui/icons";
import { unitName } from "@/lib/workflow/rules";
import type { InvoiceRecord } from "@/lib/types";
import { addLocalDays, formatPolishDate, todayInPoland } from "@/lib/date";
import { MetricContext } from "@/components/metrics/metric-context";
import {
  calculateCommercialMetrics,
  calendarYearPeriod,
  type CommercialMetrics,
  type CurrencyMetric,
  type MetricMetadata,
} from "@/lib/metrics/commercial";
import {
  buildBookingFinanceCsv,
  calculateFinanceOverview,
  type FinanceCompleteness,
  type MoneyByCurrency,
} from "@/lib/metrics/finance";
import {
  calculateManagementResult,
  type ManagementCurrencyResult,
} from "@/lib/metrics/management-result";
import { ManagementScenarioLab } from "@/components/finances/management-scenario-lab";

function money(value: number, currency: CurrencyMetric["currency"] = "PLN") { return new Intl.NumberFormat("pl-PL", { style: "currency", currency, maximumFractionDigits: 0 }).format(value); }
function metricMoney(value: number, currency: CurrencyMetric["currency"]) { return new Intl.NumberFormat("pl-PL", { style: "currency", currency, maximumFractionDigits: 0 }).format(value); }
function currencyMetricValues(metrics: CurrencyMetric[], key: "adr" | "revPar") {
  const values = metrics.filter((metric) => metric[key] != null);
  if (!values.length) return ["Brak danych"];
  return values.map((metric) => `${metric.currency} ${metricMoney(metric[key] ?? 0, metric.currency)}`);
}
const monthNames = ["sty","lut","mar","kwi","maj","cze","lip","sie","wrz","paź","lis","gru"];

function overviewMoney(values: MoneyByCurrency, completeness: FinanceCompleteness, sampleSize: number) {
  if (sampleSize === 0) return "Brak danych";
  const entries = (["PLN", "EUR"] as const).filter((currency) => values[currency] !== 0);
  if (!entries.length) return completeness === "unavailable" ? "Niepełne dane" : money(0);
  return entries.map((currency) => money(values[currency], currency)).join(" · ");
}

function completenessLabel(value: FinanceCompleteness) {
  return value === "complete" ? "pełne" : value === "partial" ? "częściowe" : "brak danych";
}

function managementMoney(results: ManagementCurrencyResult[]) {
  if (!results.length) return "Brak danych";
  return results.map((result) => (
    result.result == null
      ? `${result.currency}: brak podstawy`
      : money(result.result, result.currency)
  )).join(" · ");
}

export function FinancesView() {
  const { data, addInvoice } = useAppStore();
  const currentLocalDate = todayInPoland();
  const currentYear = Number(currentLocalDate.slice(0,4));
  const years = Array.from(new Set([currentYear, ...data.bookings.map((item) => Number(item.checkIn.slice(0,4))).filter(Boolean)])).sort((a,b)=>b-a);
  const [year,setYear]=useState(years[0]);
  const [showLedger,setShowLedger]=useState(false);
  const [showAssumptions,setShowAssumptions]=useState(false);
  const [showInvoice,setShowInvoice]=useState(false);
  const [questionsCopied,setQuestionsCopied]=useState(false);
  const managementPeriod = useMemo(() => {
    const fullYear = calendarYearPeriod(year);
    return year < currentYear
      ? fullYear
      : year === currentYear
        ? { ...fullYear, toExclusive: addLocalDays(currentLocalDate, 1) }
        : { ...fullYear, toExclusive: fullYear.from };
  }, [currentLocalDate, currentYear, year]);
  const commercial = useMemo(() => {
    return calculateCommercialMetrics({
      bookings: data.bookings,
      units: data.units,
      blocks: data.blocks,
      period: managementPeriod,
    });
  }, [data.blocks, data.bookings, data.units, managementPeriod]);
  const financeOverview = useMemo(() => calculateFinanceOverview({
    bookings: data.bookings,
    payments: data.payments,
    period: managementPeriod,
  }), [data.bookings, data.payments, managementPeriod]);
  const management = useMemo(() => calculateManagementResult({
    bookings: data.bookings,
    payments: data.payments,
    costSettings: data.costSettings,
    imports: data.imports,
    units: data.units,
    period: managementPeriod,
  }), [data.bookings, data.costSettings, data.imports, data.payments, data.units, managementPeriod]);
  const stays = data.bookings.filter((item)=>Number(item.checkIn.slice(0,4))===year && item.workflowStatus!=="Anulowana");
  const foreignBookings = stays.filter((item)=>(item.currency??"PLN")!=="PLN");
  const bookings = stays.filter((item)=>(item.currency??"PLN")==="PLN");
  const payments = data.payments.filter((item)=>Number(item.occurredAt.slice(0,4))===year && item.status==="Zaksięgowana");
  const bookingById = new Map(data.bookings.map((item) => [item.id, item]));
  const months = useMemo(() => monthNames.map((label,index)=>{
    const from=`${year}-${String(index+1).padStart(2,"0")}-01`;
    const toExclusive=index===11?`${year+1}-01-01`:`${year}-${String(index+2).padStart(2,"0")}-01`;
    if(year>currentYear||(year===currentYear&&from>currentLocalDate))return{label,revenue:0,net:null,completeness:"unavailable" as const};
    const effectiveToExclusive=year===currentYear&&currentLocalDate.startsWith(from.slice(0,7))?addLocalDays(currentLocalDate,1):toExclusive;
    const result=calculateManagementResult({bookings:data.bookings,payments:data.payments,costSettings:data.costSettings,imports:data.imports,units:data.units,period:{from,toExclusive:effectiveToExclusive}});
    const pln=result.currencies.find((item)=>item.currency==="PLN");
    return{label,revenue:pln?.sales??0,net:pln?.result??null,completeness:pln?.completeness??"unavailable"};
  }),[currentLocalDate,currentYear,data.bookings,data.costSettings,data.imports,data.payments,data.units,year]);
  const unsettled=financeOverview.bookingFinances.filter((finance)=>finance.balanceStatus!=="settled");
  const questionsForDad = Array.from(new Set([
    "Który ostatni pełny miesiąc możemy razem sprawdzić ręcznie jako próbkę?",
    ...management.readiness.questions,
  ]));

  function exportCsv(){const periodBookingIds=new Set(financeOverview.bookingFinances.map((item)=>item.bookingId));const csv=buildBookingFinanceCsv({bookings:data.bookings.filter((item)=>periodBookingIds.has(item.id)),payments:data.payments,units:data.units});const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));const link=document.createElement("a");link.href=url;link.download=`finanse-stawy-os-${year}.csv`;link.click();URL.revokeObjectURL(url);}
  async function copyQuestions(){
    const text=["Tato, żeby sprawdzić wynik finansowy potrzebuję tylko odpowiedzi na te pytania:",...questionsForDad.map((item,index)=>`${index+1}. ${item}`)].join("\n");
    try {
      if(!navigator.clipboard?.writeText)throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea=document.createElement("textarea");
      textarea.value=text;
      textarea.style.position="fixed";
      textarea.style.opacity="0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    setQuestionsCopied(true);
  }

  return <div className="grid gap-5">
    <div className="animate-rise-2 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#d9d1c1] bg-[#fffdf8] p-3"><div className="flex items-center gap-2"><span className="text-xs font-black uppercase tracking-[.13em] text-[#7b857f]">Okres</span><select className="min-h-10 rounded-xl border border-[#cec6b7] bg-white px-3 text-sm font-black" value={year} onChange={(event)=>setYear(Number(event.target.value))}>{years.map((item)=><option key={item}>{item}</option>)}</select></div><Button variant="secondary" onClick={exportCsv}><Icon className="size-4" name="download"/>Eksport CSV</Button></div>
    <div className="rounded-2xl border border-[#cddbc8] bg-[#edf3e8] p-4 text-sm leading-6 text-[#425d4e]"><strong className="font-black text-[#234b3b]">Nie musisz uzupełniać całej historii.</strong> Wybierz jeden zamknięty miesiąc, zbierz dla niego ceny, koszty i prowizje, a potem porównaj wynik z ręcznym rachunkiem. Backlog można uzupełniać później.</div>
    {foreignBookings.length ? <p className="rounded-xl border border-[#ecd39b] bg-[#fbf0d3] p-3 text-xs font-bold text-[#745815]">{foreignBookings.length} rezerwacji w EUR jest liczone osobno. System nie przelicza ani nie łączy EUR z PLN bez zapisanej reguły kursowej.</p> : null}
    <section className="animate-rise-2 grid gap-4 md:grid-cols-2 xl:grid-cols-4"><FinanceStat label="Sprzedaż" value={overviewMoney(financeOverview.sales,financeOverview.completeness.sales,financeOverview.bookingCount)} note={`${financeOverview.bookingCount} aktywnych rezerwacji · dane ${completenessLabel(financeOverview.completeness.sales)}`} icon="wallet" tone="forest"/><FinanceStat label="Należności gości" value={overviewMoney(financeOverview.receivables,financeOverview.completeness.receivables,financeOverview.bookingCount)} note={`nadpłaty ${overviewMoney(financeOverview.overpayments,financeOverview.completeness.receivables,financeOverview.bookingCount)} · dane ${completenessLabel(financeOverview.completeness.receivables)}`} icon="warning" tone="coral"/><FinanceStat label="Cashflow netto" value={overviewMoney(financeOverview.cashflow,financeOverview.completeness.cashflow,financeOverview.transactionCount)} note={`${financeOverview.transactionCount} zaksięgowanych transakcji według daty zdarzenia`} icon="plug" tone="sun"/><FinanceStat label="Wynik zarządczy" value={managementMoney(management.currencies)} note={`${management.readiness.readyCount}/${management.readiness.totalCount} warstw danych gotowych · fakt ma pierwszeństwo przed modelem`} icon="spark" tone="lake"/></section>
    <Card className="overflow-hidden border-[#dccb9f] bg-[#fffaf0]">
      <div className="grid gap-6 p-5 lg:grid-cols-[.9fr_1.1fr] sm:p-6">
        <div>
          <div className="flex items-center gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#f1dfad] text-[#755718]"><Icon className="size-5" name="warning"/></span><div><p className="text-[10px] font-black uppercase tracking-[.15em] text-[#846a2e]">Gotowość danych</p><h2 className="font-display text-2xl font-semibold">{management.readiness.readyCount}/{management.readiness.totalCount} obszarów gotowych</h2></div></div>
          <div className="mt-5 grid gap-2">{management.readiness.checks.map((check)=><div className="flex items-start gap-3 rounded-xl bg-white/75 p-3" key={check.id}><span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ${check.ready?"bg-[#4c8862] text-white":"bg-[#eee4ca] text-[#8a7442]"}`}>{check.ready?<Icon className="size-3.5" name="check"/>:"·"}</span><div><p className="text-sm font-black">{check.label}</p><p className="mt-0.5 text-xs leading-5 text-[#756f61]">{check.note}</p></div></div>)}</div>
        </div>
        <div className="rounded-2xl bg-[#173d35] p-5 text-white">
          <p className="text-[10px] font-black uppercase tracking-[.15em] text-[#d4dd9c]">Krótka rozmowa z tatą</p>
          <h3 className="mt-1 font-display text-2xl font-semibold">Zapytaj tylko o to, co blokuje wybrany okres</h3>
          <ol className="mt-4 grid gap-2.5">{questionsForDad.slice(0,5).map((question,index)=><li className="flex gap-3 text-sm leading-5 text-white/80" key={question}><span className="grid size-6 shrink-0 place-items-center rounded-full bg-white/10 text-[10px] font-black text-white">{index+1}</span><span>{question}</span></li>)}</ol>
          {questionsForDad.length>5?<details className="mt-3"><summary className="cursor-pointer text-xs font-black text-[#d4dd9c]">Pokaż jeszcze {questionsForDad.length-5}</summary><ol className="mt-3 grid gap-2 pl-9 text-xs leading-5 text-white/70">{questionsForDad.slice(5).map((question)=><li key={question}>{question}</li>)}</ol></details>:null}
          <div className="mt-5 flex flex-wrap gap-2"><Button variant="secondary" onClick={()=>void copyQuestions()}><Icon className="size-4" name={questionsCopied?"check":"download"}/>{questionsCopied?"Skopiowano":"Skopiuj pytania"}</Button><Link className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/20 px-4 text-sm font-black text-white" href="/settings"><Icon className="size-4" name="settings"/>Uzupełnij założenia</Link></div>
        </div>
      </div>
    </Card>
    <ManagementScenarioLab/>
    <section className="grid gap-3 sm:grid-cols-3">
      <Mini label="Obłożenie komercyjne" values={[commercial.occupancyPercent == null ? "Brak danych" : `${commercial.occupancyPercent.toLocaleString("pl-PL", { maximumFractionDigits: 1 })}%`]} note={`${commercial.soldNights} sprzedanych / ${commercial.availableNights} dostępnych nocy`} metadata={commercial.occupancyMetadata} issues={commercial.occupancyIssues}/>
      <Mini label="ADR zrealizowany" values={currencyMetricValues(commercial.currencies, "adr")} note={`${commercial.valueMetadata.sampleSize} nocy zrealizowanych · waluty osobno`} metadata={commercial.valueMetadata} issues={commercial.valueIssues}/>
      <Mini label="RevPAR zrealizowany" values={currencyMetricValues(commercial.currencies, "revPar")} note="wartość noclegów / dostępne noce" metadata={commercial.valueMetadata} issues={commercial.valueIssues}/>
    </section>
    {management.lines.length ? <Card className="overflow-hidden"><div className="border-b border-[#e2dbce] p-5"><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#7d8b4d]">Dowody i założenia</p><h2 className="font-display text-2xl font-semibold">Co składa się na wynik {year}</h2><p className="mt-1 text-xs text-[#68756f]">Fakt z rozliczenia ma pierwszeństwo przed powiązanym modelem. Każda linia zachowuje walutę, źródło i zakres.</p></div><div className="grid gap-px bg-[#e4ddd1] sm:grid-cols-2 xl:grid-cols-4">{management.lines.map((line)=><div className="bg-[#fffdf8] p-4" key={line.id}><div className="flex flex-wrap items-center gap-2"><Badge tone={line.kind==="actual"?"good":"neutral"}>{line.kind==="actual"?"fakt":"model"}</Badge><span className="text-[10px] font-black uppercase tracking-[.12em] text-[#858e88]">{line.category}</span></div><p className="mt-2 text-xs font-black">{line.label}</p><p className="mt-1 font-display text-xl font-semibold">{money(line.amount,line.currency)}</p><p className="mt-1 text-[10px] leading-4 text-[#6d7972]">{line.source??"brak źródła"}{line.sourceRef?` · ${line.sourceRef}`:""}{line.platform?` · ${line.platform}`:""}</p></div>)}</div></Card> : null}

    <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
      <Card className="overflow-hidden"><div className="border-b border-[#e2dbce] p-5 sm:p-6"><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#7d8b4d]">Wynik zarządczy</p><h2 className="font-display text-2xl font-semibold">Miesiąc po miesiącu</h2><p className="mt-1 text-xs text-[#68756f]">Strata pozostaje ujemna. „Brak podstawy” oznacza, że system nie udaje zysku przy brakujących kosztach.</p></div><div className="grid gap-px bg-[#e4ddd1] sm:grid-cols-2 xl:grid-cols-3">{months.map((item)=><div className="bg-[#fffdf8] p-4" key={item.label}><div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-[.14em] text-[#7b857f]">{item.label}</span><Badge tone={item.completeness==="complete"?"good":item.completeness==="partial"?"warn":"bad"}>{item.completeness==="complete"?"pełne":item.completeness==="partial"?"częściowe":"brak podstawy"}</Badge></div><div className="mt-3 flex items-end justify-between gap-3"><div><p className="text-[10px] font-bold text-[#7a847e]">Sprzedaż</p><p className="font-display text-lg font-semibold">{money(item.revenue)}</p></div><div className="text-right"><p className="text-[10px] font-bold text-[#7a847e]">Wynik</p><p className={`font-display text-xl font-semibold ${item.net!=null&&item.net<0?"text-[#a5442d]":"text-[#285f48]"}`}>{item.net==null?"—":money(item.net)}</p></div></div></div>)}</div></Card>
      <Card className="overflow-hidden"><div className="border-b border-[#e2dbce] p-5 sm:p-6"><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#7d8b4d]">Do działania</p><h2 className="font-display text-2xl font-semibold">Salda rezerwacji</h2></div><div className="grid gap-2 p-3">{unsettled.slice(0,6).map((finance)=>{const booking=bookingById.get(finance.bookingId);if(!booking)return null;const amount=finance.balanceStatus==="overpaid"?finance.overpayment:finance.amountDue;const label=finance.balanceStatus==="unavailable"?"brak danych":finance.balanceStatus==="overpaid"?"nadpłata":"do zapłaty";return <Link className="flex items-center gap-3 rounded-2xl p-3 transition hover:bg-[#f3f0e8]" href={`/bookings/${booking.id}`} key={booking.id}><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f7ebc9] text-[#806118]"><Icon className="size-5" name="wallet"/></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{booking.guestLabel}</p><p className="text-xs text-[#6d7972]">{unitName(data.units,booking.unitId)} · wpłacono {money(finance.guestPaidNet,finance.currency??"PLN")}</p></div><div className="text-right"><p className="font-display text-base font-semibold">{amount==null?"—":money(amount,finance.currency??"PLN")}</p><Badge tone={finance.balanceStatus==="unavailable"?"bad":finance.balanceStatus==="overpaid"?"good":"warn"}>{label}</Badge></div></Link>})}{!unsettled.length?<p className="p-8 text-center text-sm font-bold text-[#68756f]">Brak sald wymagających uwagi.</p>:null}</div><div className="border-t border-[#e2dbce] p-4"><Button className="w-full" variant="secondary" onClick={()=>setShowLedger((value)=>!value)}>{showLedger?"Ukryj rejestr":"Otwórz pełny rejestr"}</Button></div></Card>
    </div>

    {showLedger?<Card className="overflow-hidden"><div className="border-b p-5"><h2 className="font-display text-2xl font-semibold">Rejestr transakcji {year}</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-[#f3f0e8] text-[10px] font-black uppercase tracking-[.13em]"><tr><th className="p-4">Data</th><th>Rezerwacja</th><th>Typ</th><th>Status</th><th className="pr-4 text-right">Kwota</th></tr></thead><tbody>{payments.map((item)=>{const currency=item.currency??bookingById.get(item.bookingId)?.currency??"PLN";return <tr className="border-t" key={item.id}><td className="p-4">{formatPolishDate(item.occurredAt)}</td><td>{item.bookingId}</td><td>{item.type}</td><td><Badge tone="good">{item.status}</Badge></td><td className="pr-4 text-right font-black">{money(item.amount,currency)}</td></tr>})}{!payments.length?<tr><td className="p-8 text-center text-[#68756f]" colSpan={5}>Brak zaksięgowanych transakcji w wybranym roku.</td></tr>:null}</tbody></table></div></Card>:null}

    <Card className="overflow-hidden"><div className="flex items-start justify-between gap-3 border-b p-5"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#7d8b4d]">Dokumenty sprzedaży</p><h2 className="font-display text-2xl font-semibold">Rejestr faktur i rachunków</h2><p className="mt-1 text-xs text-[#68756f]">Rejestr operacyjny — nie zastępuje KSeF ani programu księgowego.</p></div><Button variant="secondary" onClick={()=>setShowInvoice(true)}><Icon className="size-4" name="plus"/>Dodaj dokument</Button></div><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-[#f3f0e8] text-[10px] font-black uppercase tracking-[.13em]"><tr><th className="p-4">Numer</th><th>Data</th><th>Rezerwacja</th><th>Status</th><th className="pr-4 text-right">Kwota</th></tr></thead><tbody>{data.invoices.filter((item)=>item.issuedAt.startsWith(String(year))).map((item)=><tr className="border-t" key={item.id}><td className="p-4 font-black">{item.number}</td><td>{item.issuedAt}</td><td>{item.bookingId??"—"}</td><td><Badge tone={item.status==="Opłacona"?"good":"neutral"}>{item.status}</Badge></td><td className="pr-4 text-right font-black">{money(item.amount)}</td></tr>)}{!data.invoices.some((item)=>item.issuedAt.startsWith(String(year)))?<tr><td className="p-8 text-center text-[#68756f]" colSpan={5}>Brak dokumentów w wybranym roku.</td></tr>:null}</tbody></table></div></Card>

    <div className="grid gap-5 lg:grid-cols-[.9fr_1.1fr]"><Card className="p-5 sm:p-6"><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#7d8b4d]">Rentowność domków</p><h2 className="font-display text-2xl font-semibold">Sprzedaż, koszty i wynik</h2><div className="mt-5 grid gap-3">{management.units.map((item)=>{const unit=data.units.find((candidate)=>candidate.id===item.unitId);const currencyReady=management.currencies.find((candidate)=>candidate.currency===item.currency)?.completeness!=="unavailable";return <div className="rounded-2xl bg-[#f4f1e9] p-4" key={`${item.unitId}-${item.currency}`}><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-black">{unit?.name??item.unitId}</p><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#7a847e]">{item.currency}</p></div><p className={`font-display text-xl font-semibold ${currencyReady&&item.result<0?"text-[#a5442d]":""}`}>{currencyReady?money(item.result,item.currency):"brak podstawy"}</p></div><div className="mt-3 grid grid-cols-3 gap-2 text-xs"><div><p className="text-[#7a847e]">Sprzedaż</p><p className="font-black">{money(item.sales,item.currency)}</p></div><div><p className="text-[#7a847e]">Koszty</p><p className="font-black">{money(item.costs,item.currency)}</p></div><div><p className="text-[#7a847e]">Prowizje</p><p className="font-black">{money(item.commissions,item.currency)}</p></div></div></div>})}{!management.units.length?<p className="rounded-xl bg-[#f4f1e9] p-5 text-sm font-bold text-[#68756f]">Brak danych dla domków w tym okresie.</p>:null}</div></Card><Card className="bg-[#edf1e4] p-5 sm:p-6"><div className="flex gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#174d3b] text-white"><Icon className="size-6" name="spark"/></span><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#6f7d48]">Plan bez przeciążenia</p><h2 className="mt-1 font-display text-2xl font-semibold">{management.readiness.readyCount===management.readiness.totalCount?"Można porównać wynik z ręcznym rachunkiem.":"Najpierw jedna dobra próbka, potem backlog."}</h2><p className="mt-2 text-sm leading-6 text-[#5e6d65]">Nie pytaj taty o całą historię naraz. Wybierzcie jeden miesiąc, potwierdźcie stawki sprzątania, koszty stałe i prowizje OTA, a dopiero po zgodności rozszerzcie zakres.</p><Button className="mt-4" variant="secondary" onClick={()=>setShowAssumptions((value)=>!value)}>{showAssumptions?"Ukryj kolejność":"Pokaż kolejność pracy"}</Button>{showAssumptions?<ol className="mt-3 grid gap-2 rounded-xl bg-white/70 p-4 text-xs leading-5 text-[#5e6d65]"><li><strong>1.</strong> Zamknięty miesiąc i lista pobytów.</li><li><strong>2.</strong> Sprzątanie oraz 3–5 największych kosztów.</li><li><strong>3.</strong> Prowizje z paneli lub rozliczeń OTA.</li><li><strong>4.</strong> Ręczny wynik i porównanie z aplikacją.</li><li><strong>5.</strong> Dopiero potem wcześniejsze miesiące.</li></ol>:null}</div></div></Card></div>
    {showInvoice?<InvoiceDialog bookings={bookings} onClose={()=>setShowInvoice(false)} onSave={(invoice)=>{addInvoice(invoice);setShowInvoice(false);}}/>:null}
  </div>;
}

function Mini({label,values,note,metadata,issues}:{label:string;values:string[];note:string;metadata:MetricMetadata;issues:CommercialMetrics["issues"]}){return <div className="rounded-2xl border border-[#d9d1c1] bg-[#fffdf8] p-4"><p className="text-[10px] font-black uppercase tracking-[.13em] text-[#7b857f]">{label}</p><div className="mt-1 grid gap-0.5">{values.map((value)=><p className="font-display text-2xl font-semibold" key={value}>{value}</p>)}</div><p className="mt-1 text-xs text-[#707b75]">{note}</p><MetricContext issues={issues} metadata={metadata}/></div>}
function FinanceStat({label,value,note,icon,tone}:{label:string;value:string;note:string;icon:IconName;tone:"forest"|"coral"|"sun"|"lake"}){const tones={forest:"bg-[#174d3b] text-white",coral:"bg-[#f7dfd7] text-[#a1442c]",sun:"bg-[#f6ebc8] text-[#806117]",lake:"bg-[#dcebea] text-[#276662]"};return <div className="rounded-[18px] border border-[#d9d1c1] bg-[#fffdf8] p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.13em] text-[#7b857f]">{label}</p><p className="mt-2 break-words font-display text-[28px] font-semibold leading-tight">{value}</p><p className="mt-1 text-xs leading-5 text-[#707b75]">{note}</p></div><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${tones[tone]}`}><Icon className="size-5" name={icon}/></span></div></div>}
function InvoiceDialog({bookings,onClose,onSave}:{bookings:ReturnType<typeof useAppStore>["data"]["bookings"];onClose:()=>void;onSave:(invoice:InvoiceRecord)=>void}){const [form,setForm]=useState({bookingId:bookings[0]?.id??"",number:`FV/${todayInPoland().replaceAll("-","")}/1`,issuedAt:todayInPoland(),amount:bookings[0]?.grossPrice?String(bookings[0].grossPrice):"",status:"Do wystawienia" as InvoiceRecord["status"]});return <div className="fixed inset-0 z-50 grid place-items-center bg-[#102c24]/70 p-4 backdrop-blur-sm" onMouseDown={(event)=>{if(event.target===event.currentTarget)onClose();}}><form className="w-full max-w-lg rounded-[22px] bg-[#fffdf8] p-6 shadow-2xl" onSubmit={(event)=>{event.preventDefault();const amount=Number(form.amount);if(!amount)return;onSave({id:`INV-${Date.now()}`,...form,amount});}}><div className="flex items-start justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#7d8b4d]">Rejestr dokumentów</p><h2 className="font-display text-2xl font-semibold">Dodaj fakturę lub rachunek</h2></div><button aria-label="Zamknij" type="button" onClick={onClose}><Icon className="size-5" name="close"/></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Numer"><input className={inputClass} required value={form.number} onChange={(event)=>setForm({...form,number:event.target.value})}/></Field><Field label="Data"><input className={inputClass} type="date" required value={form.issuedAt} onChange={(event)=>setForm({...form,issuedAt:event.target.value})}/></Field><Field label="Rezerwacja"><select className={inputClass} value={form.bookingId} onChange={(event)=>{const booking=bookings.find((item)=>item.id===event.target.value);setForm({...form,bookingId:event.target.value,amount:booking?.grossPrice?String(booking.grossPrice):form.amount});}}>{bookings.map((booking)=><option key={booking.id} value={booking.id}>{booking.guestLabel}</option>)}</select></Field><Field label="Kwota PLN"><input className={inputClass} min="0.01" step="0.01" type="number" required value={form.amount} onChange={(event)=>setForm({...form,amount:event.target.value})}/></Field><Field label="Status"><select className={inputClass} value={form.status} onChange={(event)=>setForm({...form,status:event.target.value as InvoiceRecord["status"]})}>{["Do wystawienia","Wystawiona","Opłacona","Anulowana"].map((item)=><option key={item}>{item}</option>)}</select></Field></div><p className="mt-4 rounded-xl bg-[#f5ead0] p-3 text-xs leading-5 text-[#725a1d]">Ten wpis jest rejestrem operacyjnym. Nie wysyła dokumentu do KSeF i nie nadaje mu skutków księgowych.</p><div className="mt-6 flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Anuluj</Button><Button type="submit">Dodaj do rejestru</Button></div></form></div>}
