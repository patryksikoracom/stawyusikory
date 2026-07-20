"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAppStore } from "@/components/layout/app-store";
import { Badge, Button, Card, Field, inputClass } from "@/components/ui/primitives";
import { Icon, type IconName } from "@/components/ui/icons";
import { nightsBetween, unitName } from "@/lib/workflow/rules";
import type { InvoiceRecord } from "@/lib/types";
import { todayInPoland } from "@/lib/date";
import { calculateModeledCosts } from "@/lib/workflow/pricing";
import { formatPolishDate } from "@/lib/date";
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

export function FinancesView() {
  const { data, addInvoice } = useAppStore();
  const currentLocalDate = todayInPoland();
  const currentYear = Number(currentLocalDate.slice(0,4));
  const years = Array.from(new Set([currentYear, ...data.bookings.map((item) => Number(item.checkIn.slice(0,4))).filter(Boolean)])).sort((a,b)=>b-a);
  const [year,setYear]=useState(years[0]);
  const [showLedger,setShowLedger]=useState(false);
  const [showAssumptions,setShowAssumptions]=useState(false);
  const [showInvoice,setShowInvoice]=useState(false);
  const commercial = useMemo(() => {
    const fullYearPeriod = calendarYearPeriod(year);
    const period = year < currentYear
      ? fullYearPeriod
      : year === currentYear
        ? { ...fullYearPeriod, toExclusive: currentLocalDate }
        : { ...fullYearPeriod, toExclusive: fullYearPeriod.from };
    return calculateCommercialMetrics({
      bookings: data.bookings,
      units: data.units,
      blocks: data.blocks,
      period,
    });
  }, [currentLocalDate, currentYear, data.blocks, data.bookings, data.units, year]);
  const financeOverview = useMemo(() => calculateFinanceOverview({
    bookings: data.bookings,
    payments: data.payments,
    period: calendarYearPeriod(year),
  }), [data.bookings, data.payments, year]);
  const monthsInPeriod = year === currentYear ? Number(currentLocalDate.slice(5,7)) : 12;
  const stays = data.bookings.filter((item)=>Number(item.checkIn.slice(0,4))===year && item.workflowStatus!=="Anulowana");
  const foreignBookings = stays.filter((item)=>(item.currency??"PLN")!=="PLN");
  const bookings = stays.filter((item)=>(item.currency??"PLN")==="PLN");
  const payments = data.payments.filter((item)=>Number(item.occurredAt.slice(0,4))===year && item.status==="Zaksięgowana");
  const bookingById = new Map(data.bookings.map((item) => [item.id, item]));
  const plnPayments = payments.filter((item) => (item.currency ?? bookingById.get(item.bookingId)?.currency ?? "PLN") === "PLN");
  const commissionFromLedger = plnPayments.filter((item)=>item.type==="Prowizja").reduce((sum,item)=>sum+item.amount,0);
  const commissionFromImports = data.imports.filter((item)=>item.checkIn?.startsWith(String(year))).reduce((sum,item)=>sum+(item.commission??0),0);
  const commission = commissionFromLedger || commissionFromImports;
  const modeledCosts = calculateModeledCosts(data.costSettings, stays, monthsInPeriod);
  const months = monthNames.map((label,index)=>{const prefix=`${year}-${String(index+1).padStart(2,"0")}`;const monthStays=stays.filter((item)=>item.checkIn.startsWith(prefix));const monthBookings=bookings.filter((item)=>item.checkIn.startsWith(prefix));const revenue=monthBookings.reduce((sum,item)=>sum+(item.grossPrice??0),0);const ledgerCosts=plnPayments.filter((item)=>item.occurredAt.startsWith(prefix)&&["Prowizja","Koszt","Zwrot"].includes(item.type)).reduce((sum,item)=>sum+item.amount,0);const monthCleaning=monthStays.reduce((sum,item)=>sum+(data.units.find((unit)=>unit.id===item.unitId)?.defaultCleaningCost??0),0);const masterCosts=calculateModeledCosts(data.costSettings,monthStays,1).total;return{label,revenue,net:Math.max(0,revenue-ledgerCosts-monthCleaning-masterCosts)}});
  const maxMonth=Math.max(1,...months.map((item)=>item.revenue));
  const unitRevenue=data.units.map((unit)=>({unit,value:bookings.filter((item)=>item.unitId===unit.id).reduce((sum,item)=>sum+(item.grossPrice??0),0),nights:stays.filter((item)=>item.unitId===unit.id).reduce((sum,item)=>sum+nightsBetween(item.checkIn,item.checkOut),0)}));
  const maxUnit=Math.max(1,...unitRevenue.map((item)=>item.value));
  const unsettled=financeOverview.bookingFinances.filter((finance)=>finance.balanceStatus!=="settled");

  function exportCsv(){const periodBookingIds=new Set(financeOverview.bookingFinances.map((item)=>item.bookingId));const csv=buildBookingFinanceCsv({bookings:data.bookings.filter((item)=>periodBookingIds.has(item.id)),payments:data.payments,units:data.units});const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));const link=document.createElement("a");link.href=url;link.download=`finanse-stawy-os-${year}.csv`;link.click();URL.revokeObjectURL(url);}

  return <div className="grid gap-5">
    <div className="animate-rise-2 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#d9d1c1] bg-[#fffdf8] p-3"><div className="flex items-center gap-2"><span className="text-xs font-black uppercase tracking-[.13em] text-[#7b857f]">Okres</span><select className="min-h-10 rounded-xl border border-[#cec6b7] bg-white px-3 text-sm font-black" value={year} onChange={(event)=>setYear(Number(event.target.value))}>{years.map((item)=><option key={item}>{item}</option>)}</select></div><Button variant="secondary" onClick={exportCsv}><Icon className="size-4" name="download"/>Eksport CSV</Button></div>
    <div className="rounded-2xl border border-[#cddbc8] bg-[#edf3e8] p-4 text-sm leading-6 text-[#425d4e]"><strong className="font-black text-[#234b3b]">Saldo gościa ma jedno źródło prawdy.</strong> Sprzedaż, należności i cashflow są oddzielone, a prowizje, koszty i wypłaty OTA nie zmieniają wpłat gościa. Docelowy model kosztów i wyniku powstaje osobno w PR‑6b.</div>
    {foreignBookings.length ? <p className="rounded-xl border border-[#ecd39b] bg-[#fbf0d3] p-3 text-xs font-bold text-[#745815]">{foreignBookings.length} rezerwacji w EUR nie wchodzi jeszcze do pilotażowych kart przychodu i wyniku. W KPI v2 ADR/RevPAR jest pokazane osobno, bez przeliczania i łączenia walut.</p> : null}
    <section className="animate-rise-2 grid gap-4 md:grid-cols-2 xl:grid-cols-4"><FinanceStat label="Sprzedaż" value={overviewMoney(financeOverview.sales,financeOverview.completeness.sales,financeOverview.bookingCount)} note={`${financeOverview.bookingCount} aktywnych rezerwacji · dane ${completenessLabel(financeOverview.completeness.sales)}`} icon="wallet" tone="forest"/><FinanceStat label="Należności gości" value={overviewMoney(financeOverview.receivables,financeOverview.completeness.receivables,financeOverview.bookingCount)} note={`nadpłaty ${overviewMoney(financeOverview.overpayments,financeOverview.completeness.receivables,financeOverview.bookingCount)} · dane ${completenessLabel(financeOverview.completeness.receivables)}`} icon="warning" tone="coral"/><FinanceStat label="Cashflow netto" value={overviewMoney(financeOverview.cashflow,financeOverview.completeness.cashflow,financeOverview.transactionCount)} note={`${financeOverview.transactionCount} zaksięgowanych transakcji według daty zdarzenia`} icon="plug" tone="sun"/><FinanceStat label="Wynik zarządczy" value="Wejścia rozdzielone" note={`prowizje ${overviewMoney(financeOverview.commissions,financeOverview.completeness.management,financeOverview.managementTransactionCount)} · koszty ${overviewMoney(financeOverview.costs,financeOverview.completeness.management,financeOverview.managementTransactionCount)} · model w PR‑6b`} icon="spark" tone="lake"/></section>
    <section className="grid gap-3 sm:grid-cols-3">
      <Mini label="Obłożenie komercyjne" values={[commercial.occupancyPercent == null ? "Brak danych" : `${commercial.occupancyPercent.toLocaleString("pl-PL", { maximumFractionDigits: 1 })}%`]} note={`${commercial.soldNights} sprzedanych / ${commercial.availableNights} dostępnych nocy`} metadata={commercial.occupancyMetadata} issues={commercial.occupancyIssues}/>
      <Mini label="ADR zrealizowany" values={currencyMetricValues(commercial.currencies, "adr")} note={`${commercial.valueMetadata.sampleSize} nocy zrealizowanych · waluty osobno`} metadata={commercial.valueMetadata} issues={commercial.valueIssues}/>
      <Mini label="RevPAR zrealizowany" values={currencyMetricValues(commercial.currencies, "revPar")} note="wartość noclegów / dostępne noce" metadata={commercial.valueMetadata} issues={commercial.valueIssues}/>
    </section>
    {modeledCosts.lines.length ? <Card className="overflow-hidden"><div className="border-b border-[#e2dbce] p-5"><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#7d8b4d]">Założenia kosztowe</p><h2 className="font-display text-2xl font-semibold">Master kosztów {year}</h2><p className="mt-1 text-xs text-[#68756f]">Koszty stałe policzone za {monthsInPeriod} {monthsInPeriod===1?"miesiąc":"miesięcy"}. Rejestruj osobno tylko koszty jednorazowe, aby nie dublować pozycji z mastera.</p></div><div className="grid gap-px bg-[#e4ddd1] sm:grid-cols-2 xl:grid-cols-4">{modeledCosts.lines.map(({cost,total})=><div className="bg-[#fffdf8] p-4" key={cost.id}><p className="text-xs font-black">{cost.label}</p><p className="mt-1 font-display text-xl font-semibold">{money(total)}</p><p className="text-[10px] text-[#6d7972]">{cost.value.toLocaleString("pl-PL")} {cost.unit==="% przychodu"?"%":`zł / ${cost.unit}`}</p></div>)}</div></Card> : null}

    <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
      <Card className="overflow-hidden"><div className="border-b border-[#e2dbce] p-5 sm:p-6"><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#7d8b4d]">Przepływ pieniędzy</p><h2 className="font-display text-2xl font-semibold">Przychód i wynik miesięczny</h2></div><div className="p-5 sm:p-6"><div className="flex h-64 items-end gap-2 border-b border-[#dcd5c8] px-1">{months.map((item)=><div className="group flex h-full flex-1 flex-col justify-end gap-2" key={item.label}><div className="relative mx-auto w-full max-w-10 rounded-t-lg bg-[#dfe6d5]" style={{height:`${Math.max(item.revenue?6:0,(item.revenue/maxMonth)*100)}%`}} title={`${item.label}: ${money(item.revenue)}`}><div className="absolute inset-x-0 bottom-0 rounded-t-lg bg-[#3b7d67]" style={{height:`${item.revenue?Math.max(0,(item.net/item.revenue)*100):0}%`}}/></div><span className="text-center text-[9px] font-black uppercase text-[#818a85]">{item.label}</span></div>)}</div><div className="mt-5 flex gap-4 text-xs font-bold text-[#65736c]"><span className="inline-flex items-center gap-2"><span className="size-2.5 rounded-full bg-[#3b7d67]"/>Wynik</span><span className="inline-flex items-center gap-2"><span className="size-2.5 rounded-full bg-[#dfe6d5]"/>Przychód</span></div></div></Card>
      <Card className="overflow-hidden"><div className="border-b border-[#e2dbce] p-5 sm:p-6"><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#7d8b4d]">Do działania</p><h2 className="font-display text-2xl font-semibold">Salda rezerwacji</h2></div><div className="grid gap-2 p-3">{unsettled.slice(0,6).map((finance)=>{const booking=bookingById.get(finance.bookingId);if(!booking)return null;const amount=finance.balanceStatus==="overpaid"?finance.overpayment:finance.amountDue;const label=finance.balanceStatus==="unavailable"?"brak danych":finance.balanceStatus==="overpaid"?"nadpłata":"do zapłaty";return <Link className="flex items-center gap-3 rounded-2xl p-3 transition hover:bg-[#f3f0e8]" href={`/bookings/${booking.id}`} key={booking.id}><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f7ebc9] text-[#806118]"><Icon className="size-5" name="wallet"/></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{booking.guestLabel}</p><p className="text-xs text-[#6d7972]">{unitName(data.units,booking.unitId)} · wpłacono {money(finance.guestPaidNet,finance.currency??"PLN")}</p></div><div className="text-right"><p className="font-display text-base font-semibold">{amount==null?"—":money(amount,finance.currency??"PLN")}</p><Badge tone={finance.balanceStatus==="unavailable"?"bad":finance.balanceStatus==="overpaid"?"good":"warn"}>{label}</Badge></div></Link>})}{!unsettled.length?<p className="p-8 text-center text-sm font-bold text-[#68756f]">Brak sald wymagających uwagi.</p>:null}</div><div className="border-t border-[#e2dbce] p-4"><Button className="w-full" variant="secondary" onClick={()=>setShowLedger((value)=>!value)}>{showLedger?"Ukryj rejestr":"Otwórz pełny rejestr"}</Button></div></Card>
    </div>

    {showLedger?<Card className="overflow-hidden"><div className="border-b p-5"><h2 className="font-display text-2xl font-semibold">Rejestr transakcji {year}</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-[#f3f0e8] text-[10px] font-black uppercase tracking-[.13em]"><tr><th className="p-4">Data</th><th>Rezerwacja</th><th>Typ</th><th>Status</th><th className="pr-4 text-right">Kwota</th></tr></thead><tbody>{payments.map((item)=>{const currency=item.currency??bookingById.get(item.bookingId)?.currency??"PLN";return <tr className="border-t" key={item.id}><td className="p-4">{formatPolishDate(item.occurredAt)}</td><td>{item.bookingId}</td><td>{item.type}</td><td><Badge tone="good">{item.status}</Badge></td><td className="pr-4 text-right font-black">{money(item.amount,currency)}</td></tr>})}{!payments.length?<tr><td className="p-8 text-center text-[#68756f]" colSpan={5}>Brak zaksięgowanych transakcji w wybranym roku.</td></tr>:null}</tbody></table></div></Card>:null}

    <Card className="overflow-hidden"><div className="flex items-start justify-between gap-3 border-b p-5"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#7d8b4d]">Dokumenty sprzedaży</p><h2 className="font-display text-2xl font-semibold">Rejestr faktur i rachunków</h2><p className="mt-1 text-xs text-[#68756f]">Rejestr operacyjny — nie zastępuje KSeF ani programu księgowego.</p></div><Button variant="secondary" onClick={()=>setShowInvoice(true)}><Icon className="size-4" name="plus"/>Dodaj dokument</Button></div><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-[#f3f0e8] text-[10px] font-black uppercase tracking-[.13em]"><tr><th className="p-4">Numer</th><th>Data</th><th>Rezerwacja</th><th>Status</th><th className="pr-4 text-right">Kwota</th></tr></thead><tbody>{data.invoices.filter((item)=>item.issuedAt.startsWith(String(year))).map((item)=><tr className="border-t" key={item.id}><td className="p-4 font-black">{item.number}</td><td>{item.issuedAt}</td><td>{item.bookingId??"—"}</td><td><Badge tone={item.status==="Opłacona"?"good":"neutral"}>{item.status}</Badge></td><td className="pr-4 text-right font-black">{money(item.amount)}</td></tr>)}{!data.invoices.some((item)=>item.issuedAt.startsWith(String(year)))?<tr><td className="p-8 text-center text-[#68756f]" colSpan={5}>Brak dokumentów w wybranym roku.</td></tr>:null}</tbody></table></div></Card>

    <div className="grid gap-5 lg:grid-cols-[.9fr_1.1fr]"><Card className="p-5 sm:p-6"><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#7d8b4d]">Rentowność domków</p><h2 className="font-display text-2xl font-semibold">Przychód według obiektu</h2><div className="mt-5 grid gap-4">{unitRevenue.map(({unit,value,nights:unitNights})=><div key={unit.id}><div className="mb-2 flex items-end justify-between"><div><p className="text-sm font-black">{unit.name}</p><p className="text-xs text-[#6d7972]">{unitNights} sprzedanych nocy</p></div><p className="font-display text-xl font-semibold">{money(value)}</p></div><div className="h-2 overflow-hidden rounded-full bg-[#e9e4da]"><div className="h-full rounded-full bg-[#4a8269]" style={{width:`${(value/maxUnit)*100}%`}}/></div></div>)}</div></Card><Card className="bg-[#edf1e4] p-5 sm:p-6"><div className="flex gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#174d3b] text-white"><Icon className="size-6" name="spark"/></span><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#6f7d48]">Doradca — wymaga zatwierdzenia</p><h2 className="mt-1 font-display text-2xl font-semibold">Kanał direct może ograniczyć prowizje.</h2><p className="mt-2 text-sm leading-6 text-[#5e6d65]">W danych za {year} zapisano {money(commission)} prowizji. Rekomendacja ma charakter informacyjny i nie zmieni cen ani nie wyśle kampanii.</p><Button className="mt-4" variant="secondary" onClick={()=>setShowAssumptions((value)=>!value)}>{showAssumptions?"Ukryj założenia":"Pokaż założenia"}</Button>{showAssumptions?<p className="mt-3 rounded-xl bg-white/70 p-3 text-xs leading-5 text-[#5e6d65]">Wyliczenie wykorzystuje wyłącznie zaksięgowane prowizje, a gdy ich nie ma — wartości zaimportowane z OTA. Nie zakłada automatycznie prowizji dla brakujących rekordów.</p>:null}</div></div></Card></div>
    {showInvoice?<InvoiceDialog bookings={bookings} onClose={()=>setShowInvoice(false)} onSave={(invoice)=>{addInvoice(invoice);setShowInvoice(false);}}/>:null}
  </div>;
}

function Mini({label,values,note,metadata,issues}:{label:string;values:string[];note:string;metadata:MetricMetadata;issues:CommercialMetrics["issues"]}){return <div className="rounded-2xl border border-[#d9d1c1] bg-[#fffdf8] p-4"><p className="text-[10px] font-black uppercase tracking-[.13em] text-[#7b857f]">{label}</p><div className="mt-1 grid gap-0.5">{values.map((value)=><p className="font-display text-2xl font-semibold" key={value}>{value}</p>)}</div><p className="mt-1 text-xs text-[#707b75]">{note}</p><MetricContext issues={issues} metadata={metadata}/></div>}
function FinanceStat({label,value,note,icon,tone}:{label:string;value:string;note:string;icon:IconName;tone:"forest"|"coral"|"sun"|"lake"}){const tones={forest:"bg-[#174d3b] text-white",coral:"bg-[#f7dfd7] text-[#a1442c]",sun:"bg-[#f6ebc8] text-[#806117]",lake:"bg-[#dcebea] text-[#276662]"};return <div className="rounded-[18px] border border-[#d9d1c1] bg-[#fffdf8] p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.13em] text-[#7b857f]">{label}</p><p className="mt-2 break-words font-display text-[28px] font-semibold leading-tight">{value}</p><p className="mt-1 text-xs leading-5 text-[#707b75]">{note}</p></div><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${tones[tone]}`}><Icon className="size-5" name={icon}/></span></div></div>}
function InvoiceDialog({bookings,onClose,onSave}:{bookings:ReturnType<typeof useAppStore>["data"]["bookings"];onClose:()=>void;onSave:(invoice:InvoiceRecord)=>void}){const [form,setForm]=useState({bookingId:bookings[0]?.id??"",number:`FV/${todayInPoland().replaceAll("-","")}/1`,issuedAt:todayInPoland(),amount:bookings[0]?.grossPrice?String(bookings[0].grossPrice):"",status:"Do wystawienia" as InvoiceRecord["status"]});return <div className="fixed inset-0 z-50 grid place-items-center bg-[#102c24]/70 p-4 backdrop-blur-sm" onMouseDown={(event)=>{if(event.target===event.currentTarget)onClose();}}><form className="w-full max-w-lg rounded-[22px] bg-[#fffdf8] p-6 shadow-2xl" onSubmit={(event)=>{event.preventDefault();const amount=Number(form.amount);if(!amount)return;onSave({id:`INV-${Date.now()}`,...form,amount});}}><div className="flex items-start justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#7d8b4d]">Rejestr dokumentów</p><h2 className="font-display text-2xl font-semibold">Dodaj fakturę lub rachunek</h2></div><button aria-label="Zamknij" type="button" onClick={onClose}><Icon className="size-5" name="close"/></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Numer"><input className={inputClass} required value={form.number} onChange={(event)=>setForm({...form,number:event.target.value})}/></Field><Field label="Data"><input className={inputClass} type="date" required value={form.issuedAt} onChange={(event)=>setForm({...form,issuedAt:event.target.value})}/></Field><Field label="Rezerwacja"><select className={inputClass} value={form.bookingId} onChange={(event)=>{const booking=bookings.find((item)=>item.id===event.target.value);setForm({...form,bookingId:event.target.value,amount:booking?.grossPrice?String(booking.grossPrice):form.amount});}}>{bookings.map((booking)=><option key={booking.id} value={booking.id}>{booking.guestLabel}</option>)}</select></Field><Field label="Kwota PLN"><input className={inputClass} min="0.01" step="0.01" type="number" required value={form.amount} onChange={(event)=>setForm({...form,amount:event.target.value})}/></Field><Field label="Status"><select className={inputClass} value={form.status} onChange={(event)=>setForm({...form,status:event.target.value as InvoiceRecord["status"]})}>{["Do wystawienia","Wystawiona","Opłacona","Anulowana"].map((item)=><option key={item}>{item}</option>)}</select></Field></div><p className="mt-4 rounded-xl bg-[#f5ead0] p-3 text-xs leading-5 text-[#725a1d]">Ten wpis jest rejestrem operacyjnym. Nie wysyła dokumentu do KSeF i nie nadaje mu skutków księgowych.</p><div className="mt-6 flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Anuluj</Button><Button type="submit">Dodaj do rejestru</Button></div></form></div>}
