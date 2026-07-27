"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAppStore } from "@/components/layout/app-store";
import { Badge, Card } from "@/components/ui/primitives";
import { calculateGrowthMetrics, GROWTH_MIN_COMPLETENESS, GROWTH_MIN_SAMPLE } from "@/lib/growth/growth-metrics";
import { todayInPoland } from "@/lib/date";

export function GrowthDashboard() {
  const { data } = useAppStore();
  const year = todayInPoland().slice(0, 4);
  const period = useMemo(() => ({ from: `${year}-01-01`, to: `${year}-12-31` }), [year]);
  const metrics = useMemo(() => calculateGrowthMetrics(data, period), [data, period]);
  const totalSpend = data.adSpend.reduce((sum, record) => sum + (record.currency === "PLN" ? record.cost : 0), 0);

  return <Card className="overflow-hidden">
    <header className="flex flex-col gap-3 border-b border-[#e2dbce] p-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#7d8b4d]">Wzrost oparty na dowodach</p><h3 className="font-display text-2xl font-semibold">Metryki, próba i kompletność</h3><p className="mt-1 text-xs text-[#65736c]">{period.from} – {period.to} · próg publikacji n ≥ {GROWTH_MIN_SAMPLE}, kompletność ≥ {Math.round(GROWTH_MIN_COMPLETENESS*100)}%</p></div><Badge tone={metrics.every((metric)=>metric.status==="ready")?"good":"warn"}>{metrics.filter((metric)=>metric.status==="ready").length}/{metrics.length} gotowych</Badge></header>
    <div className="grid gap-px bg-[#e5ded2] sm:grid-cols-2 xl:grid-cols-5">{metrics.map((metric)=><article className="bg-[#fffdf8] p-4" key={metric.id}><div className="flex items-center justify-between gap-2"><p className="text-[10px] font-black uppercase tracking-[.13em] text-[#78837c]">{metric.label}</p><Badge tone={metric.status==="ready"?"good":"neutral"}>n={metric.sample}</Badge></div><p className="mt-3 font-display text-2xl font-semibold">{metric.status==="ready"&&metric.value!=null?`${metric.value.toFixed(1)} ${metric.unit}`:"Zbieramy dane"}</p><p className="mt-1 text-[10px] font-bold text-[#7c857f]">kompletność {Math.round(metric.completeness*100)}%</p><div className="mt-3 flex flex-wrap gap-1">{metric.evidenceBookingIds.slice(0,3).map((id)=><Link className="text-[10px] font-black text-[#24655a] underline-offset-2 hover:underline" href={`/bookings/${id}`} key={id}>{id}</Link>)}</div>{metric.status==="collecting"?<p className="mt-3 text-[10px] leading-4 text-[#7a6b47]">Brakuje {Math.max(0,GROWTH_MIN_SAMPLE-metric.sample)} rekordów lub wymaganej kompletności. Nie publikujemy wniosku.</p>:null}</article>)}</div>
    <div className="grid gap-4 border-t border-[#e2dbce] p-5 md:grid-cols-3"><div><p className="text-xs font-black">Wydatki reklamowe</p><p className="mt-1 font-display text-2xl font-semibold">{totalSpend.toLocaleString("pl-PL")} PLN</p><p className="text-[10px] text-[#737d77]">{data.adSpend.length} rekordów CSV; korelacja kampanii z pobytem nie jest dowodem przyczynowości.</p></div><div><p className="text-xs font-black">Eksperymenty</p><p className="mt-1 font-display text-2xl font-semibold">{data.growthExperiments.length}</p><p className="text-[10px] text-[#737d77]">Każdy ma koszt, kod, kryterium sukcesu i decyzję po pilocie.</p></div><div><p className="text-xs font-black">Granica automatyzacji</p><p className="mt-1 text-sm font-bold text-[#8a432e]">Brak auto-send, publikacji, reklamy i zmiany ceny</p><p className="mt-1 text-[10px] text-[#737d77]">AI może wyłącznie podsumować rekordy lub przygotować propozycję z dowodami.</p></div></div>
  </Card>;
}
