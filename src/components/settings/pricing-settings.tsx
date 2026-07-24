"use client";

import { useState, type FormEvent } from "react";
import { useAppStore } from "@/components/layout/app-store";
import { Badge, Button, Card, Field, inputClass } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icons";
import type { Channel, CostCategory, CostSetting, Currency, RateRule, Unit } from "@/lib/types";
import { pricingReadiness } from "@/lib/workflow/pricing";
import { formatPolishDate } from "@/lib/date";

const seasons: RateRule["season"][] = ["Niski", "Średni", "Wysoki", "Święta/długi weekend", "Promocja", "Specjalny"];
const costUnits: CostSetting["unit"][] = ["miesiąc", "rok", "pobyt", "noc", "% przychodu"];
const costCategories: CostCategory[] = ["Sprzątanie", "Energia", "Woda", "Szambo", "Serwis i naprawy", "Marketing", "Podatki i opłaty", "Inne"];
const commissionPlatforms: Channel[] = ["Booking", "Airbnb", "Agoda", "Expedia", "VRBO", "Slowhop", "Aloha Camp"];

export function PricingSettings() {
  const { data, updateUnit, upsertRate, deleteRate, upsertCostSetting, deleteCostSetting } = useAppStore();
  const [rate, setRate] = useState({ unitId: data.units[0]?.id ?? "", season: "Wysoki" as RateRule["season"], dateFrom: "", dateTo: "", price: "", minNights: "2" });
  const [cost, setCost] = useState({
    kind: "operating" as NonNullable<CostSetting["kind"]>,
    category: "Energia" as CostCategory,
    platform: "Booking" as Channel,
    unitId: "",
    label: "",
    value: "",
    unit: "miesiąc" as CostSetting["unit"],
    currency: "PLN" as Currency,
    source: "",
    dateFrom: "",
    dateTo: "",
    allocation: "equal" as NonNullable<CostSetting["allocation"]>,
  });
  const [rateError, setRateError] = useState("");
  const [costError, setCostError] = useState("");
  const readiness = pricingReadiness(data);

  function addRate(event: FormEvent) {
    event.preventDefault();
    const price = Number(rate.price); const minNights = Number(rate.minNights);
    setRateError("");
    if (!rate.unitId || !rate.dateFrom || !rate.dateTo || rate.dateTo < rate.dateFrom || price <= 0 || minNights < 1) { setRateError("Sprawdź daty, cenę i minimalną długość pobytu."); return; }
    upsertRate({ id: `RATE-${Date.now()}`, unitId: rate.unitId, season: rate.season, dateFrom: rate.dateFrom, dateTo: rate.dateTo, pricePerNight: price, minNights, active: true });
    setRate({ ...rate, dateFrom: "", dateTo: "", price: "" });
  }

  function addCost(event: FormEvent) {
    event.preventDefault();
    const value = Number(cost.value);
    setCostError("");
    if (!cost.label.trim() || value <= 0) { setCostError("Podaj nazwę kosztu i wartość większą od zera."); return; }
    if (!cost.source.trim() || !cost.dateFrom || !cost.dateTo || cost.dateTo < cost.dateFrom) {
      setCostError("Dodaj źródło oraz prawidłowy okres obowiązywania. Dzięki temu wynik nie będzie anonimowym szacunkiem.");
      return;
    }
    upsertCostSetting({
      id: `COST-${Date.now()}`,
      unitId: cost.unitId || undefined,
      label: cost.label.trim(),
      value,
      unit: cost.unit,
      active: true,
      kind: cost.kind,
      category: cost.kind === "commission" ? "Prowizja OTA" : cost.category,
      platform: cost.kind === "commission" ? cost.platform : undefined,
      currency: cost.currency,
      source: cost.source.trim(),
      dateFrom: cost.dateFrom,
      dateTo: cost.dateTo,
      allocation: cost.unitId ? undefined : cost.allocation,
    });
    setCost({ ...cost, label: "", value: "", source: "" });
  }

  return <>
    <Card className="overflow-hidden"><Title eyebrow="Cennik" title="Ceny bazowe domków" body="Cena bazowa działa zawsze, gdy żaden datowany sezon nie pasuje do terminu pobytu."/><div className="grid gap-4 p-4 sm:grid-cols-2">{data.units.map((unit) => <UnitPriceCard key={`${unit.id}-${unit.defaultPricePerNight}-${unit.defaultCleaningCost}`} unit={unit} onSave={updateUnit}/>)}</div></Card>

    <Card className="overflow-hidden"><Title eyebrow="Sezonowość" title="Reguły cenowe" body="Każda noc jest wyceniana osobno. Reguła z konkretnymi datami ma pierwszeństwo przed ceną bazową."/><form className="grid gap-3 border-b border-[#e2dbce] bg-[#f5f2ea] p-4 sm:grid-cols-2 xl:grid-cols-6" onSubmit={addRate}><Field label="Domek"><select className={inputClass} value={rate.unitId} onChange={(event) => setRate({ ...rate, unitId: event.target.value })}>{data.units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></Field><Field label="Sezon"><select className={inputClass} value={rate.season} onChange={(event) => setRate({ ...rate, season: event.target.value as RateRule["season"] })}>{seasons.map((season) => <option key={season}>{season}</option>)}</select></Field><Field label="Od"><input className={inputClass} required type="date" value={rate.dateFrom} onChange={(event) => setRate({ ...rate, dateFrom: event.target.value })}/></Field><Field label="Do — włącznie"><input className={inputClass} required type="date" value={rate.dateTo} onChange={(event) => setRate({ ...rate, dateTo: event.target.value })}/></Field><Field label="Cena / noc"><input className={inputClass} min="1" required type="number" value={rate.price} onChange={(event) => setRate({ ...rate, price: event.target.value })}/></Field><div className="flex items-end"><Button className="w-full" type="submit"><Icon className="size-4" name="plus"/>Dodaj sezon</Button></div>{rateError ? <p className="rounded-xl bg-[#f9dfd7] p-3 text-xs font-bold text-[#963c27] sm:col-span-2 xl:col-span-6">{rateError}</p> : null}</form><div className="grid gap-2 p-3">{data.rates.map((item) => <div className="flex flex-col gap-3 rounded-2xl border border-[#ded7ca] bg-white p-4 sm:flex-row sm:items-center" key={item.id}><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#e6ece0] text-[#42664e]"><Icon className="size-5" name="calendar"/></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-black">{data.units.find((unit) => unit.id === item.unitId)?.name ?? item.unitId}</p><Badge tone={item.active ? "good" : "neutral"}>{item.season}</Badge>{!item.dateFrom && !item.dateTo ? <Badge tone="warn">uzupełnij daty</Badge> : null}</div><p className="mt-1 text-xs text-[#6b7771]">{item.dateFrom ? formatPolishDate(item.dateFrom) : "bez początku"} – {item.dateTo ? formatPolishDate(item.dateTo) : "bez końca"} · min. {item.minNights} noce{!item.dateFrom && !item.dateTo ? " · reguła nie wpływa na wycenę" : ""}</p></div><p className="font-display text-xl font-semibold">{item.pricePerNight.toLocaleString("pl-PL")} zł</p><button className="text-xs font-black text-[#49665a]" onClick={() => upsertRate({ ...item, active: !item.active })}>{item.active ? "Wyłącz" : "Włącz"}</button><button aria-label={`Usuń sezon ${item.season}`} className="grid size-8 place-items-center rounded-lg text-[#9b4029] hover:bg-[#f9dfd7]" onClick={() => deleteRate(item.id)}><Icon className="size-4" name="close"/></button></div>)}{!data.rates.length ? <p className="p-6 text-center text-sm font-bold text-[#6b7771]">Brak sezonów — używane są ceny bazowe.</p> : null}</div></Card>

    <Card className="overflow-hidden"><Title eyebrow="Rentowność" title="Master kosztów i prowizji" body="Zacznij od jednego sprawdzonego miesiąca. Każde założenie ma źródło i okres, więc później można je poprawić bez przepisywania historii."/><form className="grid gap-3 border-b border-[#e2dbce] bg-[#f5f2ea] p-4 sm:grid-cols-2 xl:grid-cols-4" onSubmit={addCost}><Field label="Rodzaj"><select className={inputClass} value={cost.kind} onChange={(event) => setCost({ ...cost, kind: event.target.value as NonNullable<CostSetting["kind"]> })}><option value="operating">Koszt prowadzenia</option><option value="commission">Prowizja OTA</option></select></Field>{cost.kind === "commission" ? <Field label="Platforma"><select className={inputClass} value={cost.platform} onChange={(event) => setCost({ ...cost, platform: event.target.value as Channel })}>{commissionPlatforms.map((platform) => <option key={platform}>{platform}</option>)}</select></Field> : <Field label="Kategoria"><select className={inputClass} value={cost.category} onChange={(event) => setCost({ ...cost, category: event.target.value as CostCategory })}>{costCategories.map((category) => <option key={category}>{category}</option>)}</select></Field>}<Field label="Nazwa"><input className={inputClass} required placeholder={cost.kind === "commission" ? "np. Booking lato 2026" : "np. prąd i ogrzewanie"} value={cost.label} onChange={(event) => setCost({ ...cost, label: event.target.value })}/></Field><Field label="Zakres"><select className={inputClass} value={cost.unitId} onChange={(event) => setCost({ ...cost, unitId: event.target.value })}><option value="">Wszystkie domki</option>{data.units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></Field><Field label="Kwota / stawka"><input className={inputClass} min="0.01" step="0.01" required type="number" value={cost.value} onChange={(event) => setCost({ ...cost, value: event.target.value })}/></Field><Field label="Naliczanie"><select className={inputClass} value={cost.unit} onChange={(event) => setCost({ ...cost, unit: event.target.value as CostSetting["unit"] })}>{costUnits.map((unit) => <option key={unit}>{unit}</option>)}</select></Field><Field label="Waluta"><select className={inputClass} value={cost.currency} onChange={(event) => setCost({ ...cost, currency: event.target.value as Currency })}><option>PLN</option><option>EUR</option></select></Field>{!cost.unitId ? <Field label="Podział między domki"><select className={inputClass} value={cost.allocation} onChange={(event) => setCost({ ...cost, allocation: event.target.value as NonNullable<CostSetting["allocation"]> })}><option value="equal">Po równo</option><option value="revenue">Według przychodu</option></select></Field> : <div/>}<Field label="Źródło" hint="np. faktura, umowa, panel OTA albo „szacunek taty 24.07”"><input className={inputClass} required value={cost.source} onChange={(event) => setCost({ ...cost, source: event.target.value })}/></Field><Field label="Obowiązuje od"><input className={inputClass} required type="date" value={cost.dateFrom} onChange={(event) => setCost({ ...cost, dateFrom: event.target.value })}/></Field><Field label="Obowiązuje do"><input className={inputClass} required type="date" value={cost.dateTo} onChange={(event) => setCost({ ...cost, dateTo: event.target.value })}/></Field><div className="flex items-end"><Button className="w-full" type="submit"><Icon className="size-4" name="plus"/>Dodaj założenie</Button></div>{costError ? <p className="rounded-xl bg-[#f9dfd7] p-3 text-xs font-bold text-[#963c27] sm:col-span-2 xl:col-span-4">{costError}</p> : null}</form><div className="grid gap-2 p-3">{data.costSettings.map((item) => <div className="flex flex-col gap-3 rounded-2xl border border-[#ded7ca] bg-white p-4 sm:flex-row sm:items-center" key={item.id}><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f5e9c8] text-[#806117]"><Icon className="size-4" name="wallet"/></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-black">{item.label}</p><Badge tone={item.kind === "commission" || item.category === "Prowizja OTA" ? "lake" : "neutral"}>{item.kind === "commission" || item.category === "Prowizja OTA" ? "prowizja" : "model kosztu"}</Badge>{!item.source || !item.dateFrom || !item.dateTo ? <Badge tone="warn">uzupełnij dowód</Badge> : null}</div><p className="mt-1 text-xs text-[#6b7771]">{item.platform ? `${item.platform} · ` : ""}{item.unitId ? data.units.find((unit) => unit.id === item.unitId)?.name : `Wspólny · ${item.allocation === "revenue" ? "wg przychodu" : "po równo"}`} · {item.value.toLocaleString("pl-PL")} {item.unit === "% przychodu" ? "%" : `${item.currency ?? "PLN"} / ${item.unit}`}</p><p className="mt-1 text-[10px] text-[#7a847e]">{item.source || "brak źródła"} · {item.dateFrom && item.dateTo ? `${formatPolishDate(item.dateFrom)}–${formatPolishDate(item.dateTo)}` : "brak okresu"}</p></div><button className="text-xs font-black text-[#49665a]" onClick={() => upsertCostSetting({ ...item, active: !item.active })}>{item.active ? "Wyłącz" : "Włącz"}</button><button aria-label={`Usuń koszt ${item.label}`} className="grid size-8 place-items-center rounded-lg text-[#9b4029] hover:bg-[#f9dfd7]" onClick={() => deleteCostSetting(item.id)}><Icon className="size-4" name="close"/></button></div>)}{!data.costSettings.length ? <p className="p-6 text-center text-sm font-bold text-[#6b7771]">Nie uzupełniaj całej historii. Dodaj najpierw koszty i prowizje dla jednego miesiąca, który razem z tatą możecie ręcznie sprawdzić.</p> : null}</div></Card>

    <Card className="overflow-hidden bg-[#edf1e4]"><div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#174d3b] text-white"><Icon className="size-6" name="spark"/></span><div className="flex-1"><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#6f7d48]">Gotowość do sugestii AI</p><h3 className="font-display text-2xl font-semibold">{readiness.readyCount}/4 warstwy danych gotowe</h3><div className="mt-3 grid gap-2 sm:grid-cols-2">{readiness.checks.map((check) => <p className="flex items-center gap-2 text-xs font-bold text-[#52645c]" key={check.id}><span className={`grid size-5 place-items-center rounded-full ${check.ready ? "bg-[#4b8a64] text-white" : "bg-white text-[#8a938e]"}`}>{check.ready ? "✓" : "·"}</span>{check.label}</p>)}</div></div><Badge tone={readiness.ready ? "good" : "warn"}>{readiness.ready ? "Można testować model" : "Najpierw dane"}</Badge></div><p className="border-t border-[#d7dfca] px-5 py-4 text-xs leading-5 text-[#627069]">Przyszły model powinien wyłącznie sugerować zmianę ceny wraz z uzasadnieniem, prognozą obłożenia i marży. Zastosowanie ceny nadal będzie wymagało zatwierdzenia właściciela.</p></Card>
  </>;
}

function UnitPriceCard({ unit, onSave }: { unit: Unit; onSave: (unit: Unit) => void }) {
  const [basePrice, setBasePrice] = useState(String(unit.defaultPricePerNight));
  const [cleaning, setCleaning] = useState(String(unit.defaultCleaningCost));
  function save() { const price = Number(basePrice); const cleaningCost = Number(cleaning); if (price < 0 || cleaningCost < 0) return; onSave({ ...unit, defaultPricePerNight: price, defaultCleaningCost: cleaningCost }); }
  return <article className="rounded-2xl border border-[#ded7ca] bg-white p-5"><div><p className="font-display text-xl font-semibold">{unit.name}</p><p className="text-xs text-[#6b7771]">Cena awaryjna poza sezonami</p></div><div className="mt-4 grid grid-cols-2 gap-3"><Field label="Cena bazowa / noc"><input className={inputClass} min="0" type="number" value={basePrice} onChange={(event) => setBasePrice(event.target.value)}/></Field><Field label="Sprzątanie / pobyt"><input className={inputClass} min="0" type="number" value={cleaning} onChange={(event) => setCleaning(event.target.value)}/></Field></div><Button className="mt-4 w-full" variant="secondary" onClick={save}>Zapisz ceny domku</Button></article>;
}

function Title({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) { return <div className="border-b border-[#e2dbce] p-5"><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#7d8b4d]">{eyebrow}</p><h2 className="font-display text-2xl font-semibold">{title}</h2><p className="mt-1 text-xs leading-5 text-[#68756f]">{body}</p></div>; }
