"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAppStore } from "@/components/layout/app-store";
import { Button, Card, Field, inputClass } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icons";
import type { Booking, CalendarBlock, Channel } from "@/lib/types";
import { getBookingConflicts, nightsBetween } from "@/lib/workflow/rules";
import { addLocalDays, formatLocalDate, parseLocalDate, todayInPoland } from "@/lib/date";

const dayMs = 86_400_000;
const channelStyles: Partial<Record<Channel, string>> = {
  Booking: "bg-[#27727d] text-white border-[#1d606a]",
  Airbnb: "bg-[#df735a] text-white border-[#c65f49]",
  Bezpośrednio: "bg-[#55835d] text-white border-[#416f49]",
  Telefon: "bg-[#d9ad4f] text-[#3d3218] border-[#c69b3f]",
};

function toDate(value: string) { return parseLocalDate(value) ?? new Date(); }
function iso(date: Date) { return formatLocalDate(date); }
function addDays(date: Date, days: number) { return new Date(date.getTime() + days * dayMs); }
function diffDays(a: Date, b: Date) { return Math.round((a.getTime() - b.getTime()) / dayMs); }

export function CalendarView() {
  const { data, addBlock, updateBlock } = useAppStore();
  const [anchor, setAnchor] = useState(() => toDate(todayInPoland()));
  const [daysCount, setDaysCount] = useState(21);
  const [channel, setChannel] = useState<string>("Wszystkie");
  const [blockForm, setBlockForm] = useState<{ unitId: string; dateFrom: string; dateTo: string; reason: string; blockType: CalendarBlock["blockType"] } | null>(null);
  const dates = useMemo(() => Array.from({ length: daysCount }, (_, index) => addDays(anchor, index)), [anchor, daysCount]);
  const end = addDays(anchor, daysCount);
  const today = todayInPoland();
  const visibleBookings = data.bookings.filter((booking) => booking.workflowStatus !== "Anulowana" && toDate(booking.checkIn) < end && toDate(booking.checkOut) > anchor && (channel === "Wszystkie" || booking.platform === channel));
  const conflictCount = visibleBookings.filter((booking) => getBookingConflicts(data.bookings, data.blocks, booking).length).length;
  const totalNights = visibleBookings.reduce((sum, booking) => sum + Math.max(0, Math.min(diffDays(toDate(booking.checkOut), anchor), daysCount) - Math.max(diffDays(toDate(booking.checkIn), anchor), 0)), 0);
  const occupancy = Math.round((totalNights / (daysCount * data.units.length)) * 100);

  return (
    <div className="grid gap-5">
      <section className="animate-rise-2 flex flex-col gap-4 rounded-[20px] border border-[#d8d0c2] bg-[#fffdf8] p-4 shadow-[0_14px_40px_rgba(38,53,45,.05)] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button aria-label="Poprzedni tydzień" variant="secondary" onClick={() => setAnchor(addDays(anchor, -7))}><Icon className="size-4 rotate-180" name="chevron" /></Button>
          <Button variant="secondary" onClick={() => setAnchor(toDate(today))}>Dzisiaj</Button>
          <Button aria-label="Następny tydzień" variant="secondary" onClick={() => setAnchor(addDays(anchor, 7))}><Icon className="size-4" name="chevron" /></Button>
          <div className="ml-1"><p className="font-display text-xl font-semibold capitalize">{new Intl.DateTimeFormat("pl-PL", { month: "long", year: "numeric" }).format(anchor)}</p><p className="text-xs font-semibold text-[#6d7972]">{new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short" }).format(anchor)} – {new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short" }).format(addDays(anchor, daysCount - 1))}</p></div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Filtr kanału" className="min-h-10 rounded-xl border border-[#cec6b7] bg-white px-3 text-sm font-bold outline-none" value={channel} onChange={(event) => setChannel(event.target.value)}><option>Wszystkie</option>{Array.from(new Set(data.bookings.map((item) => item.platform))).map((item) => <option key={item}>{item}</option>)}</select>
          <div className="flex rounded-xl bg-[#ebe7de] p-1">{[14, 21, 28].map((count) => <button className={`rounded-lg px-3 py-1.5 text-xs font-black transition ${daysCount === count ? "bg-white text-[#174d3b] shadow-sm" : "text-[#6f7a74]"}`} key={count} onClick={() => setDaysCount(count)}>{count} dni</button>)}</div>
          <Button onClick={() => setBlockForm({ unitId: data.units[0]?.id ?? "", dateFrom: today, dateTo: addLocalDays(today, 1), reason: "", blockType: "Właściciel" })}><Icon className="size-4" name="plus"/>Dodaj blokadę</Button>
        </div>
      </section>

      <div className="animate-rise-3 grid gap-3 sm:grid-cols-3">
        <MiniStat label="Obłożenie widoku" value={`${occupancy}%`} note={`${totalNights} zajętych dób`} />
        <MiniStat label="Pobyty w okresie" value={visibleBookings.length} note={`${data.units.length} domki`} />
        <MiniStat label="Konflikty" value={conflictCount} note={conflictCount ? "wymagają reakcji" : "kalendarz bezpieczny"} good={!conflictCount} />
      </div>

      <Card className="animate-rise-3 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[#ded7ca] p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex flex-wrap items-center gap-4 text-xs font-bold text-[#68756e]"><Legend color="bg-[#27727d]" label="Booking"/><Legend color="bg-[#df735a]" label="Airbnb"/><Legend color="bg-[#55835d]" label="Direct"/><Legend color="bg-[#d9ad4f]" label="Telefon"/><Legend color="border border-dashed border-[#8d866f] bg-[#f0eadc]" label="Blokada"/></div><p className="inline-flex items-center gap-2 text-xs font-bold text-[#567067]"><span className="size-2 rounded-full bg-[#d3a638]"/>iCal nie gwarantuje synchronizacji w czasie rzeczywistym</p></div>
        <div className="overflow-x-auto">
          <div className="min-w-max">
            <div className="grid grid-cols-[170px_auto] border-b border-[#ded7ca] bg-[#f7f4ed]">
              <div className="flex items-end p-4 text-[10px] font-black uppercase tracking-[.15em] text-[#78847d]">Pomieszczenie</div>
              <div className="grid" style={{ gridTemplateColumns: `repeat(${daysCount}, minmax(64px, 1fr))` }}>
                {dates.map((date) => { const dateIso = iso(date); const weekend = [0,6].includes(date.getDay()); return <div className={`border-l border-[#e3ddd2] px-2 py-3 text-center ${weekend ? "bg-[#f1ede3]" : ""} ${dateIso === today ? "bg-[#e8efdf]" : ""}`} key={dateIso}><p className="text-[9px] font-black uppercase tracking-[.12em] text-[#89928c]">{new Intl.DateTimeFormat("pl-PL", { weekday: "short" }).format(date).replace(".", "")}</p><p className={`mt-1 font-display text-lg font-semibold ${dateIso === today ? "mx-auto grid size-8 place-items-center rounded-full bg-[#174d3b] text-white" : ""}`}>{date.getDate()}</p></div>; })}
              </div>
            </div>

            {data.units.map((unit) => {
              const bookings = visibleBookings.filter((booking) => booking.unitId === unit.id);
              const blocks = data.blocks.filter((block) => block.unitId === unit.id && toDate(block.dateFrom) < end && toDate(block.dateTo) > anchor && block.status !== "Anulowana");
              return <div className="grid min-h-[112px] grid-cols-[170px_auto] border-b border-[#ded7ca] last:border-0" key={unit.id}><div className="flex flex-col justify-center border-r border-[#ded7ca] bg-[#fffdf8] p-4"><div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-lg bg-[#e8eee1] text-[#41684f]"><Icon className="size-4" name="home"/></span><p className="font-display text-[17px] font-semibold leading-tight">{unit.name}</p></div><p className="mt-2 text-[10px] font-bold uppercase tracking-[.1em] text-[#818b85]">max {unit.maxPeople} osób</p></div><div className="relative grid overflow-hidden" style={{ gridTemplateColumns: `repeat(${daysCount}, minmax(64px, 1fr))` }}>
                {dates.map((date) => <button aria-label={`Dodaj blokadę ${unit.name}, ${iso(date)}`} className={`border-r border-[#eee8dd] text-left hover:bg-[#e8efdf] ${[0,6].includes(date.getDay()) ? "bg-[#faf8f3]" : ""} ${iso(date) === today ? "bg-[#edf3e8]" : ""}`} key={iso(date)} onClick={() => setBlockForm({ unitId: unit.id, dateFrom: iso(date), dateTo: addLocalDays(iso(date), 1), reason: "", blockType: "Właściciel" })} />)}
                {bookings.map((booking, index) => <BookingBar anchor={anchor} booking={booking} daysCount={daysCount} index={index} key={booking.id} conflicts={getBookingConflicts(data.bookings, data.blocks, booking)} />)}
                {blocks.map((block, index) => { const start = Math.max(0, diffDays(toDate(block.dateFrom), anchor)); const finish = Math.min(daysCount, diffDays(toDate(block.dateTo), anchor)); return <button className="z-[3] mx-1 self-end overflow-hidden rounded-lg border border-dashed border-[#9a927b] bg-[#eee8dc]/95 px-2 py-1 text-left text-[10px] font-black text-[#6d6758]" key={block.id} style={{ gridColumn: `${start + 1} / span ${Math.max(1, finish-start)}`, gridRow: 1, marginBottom: `${8 + index * 24}px` }} title={`${block.reason} · kliknij, aby anulować`} onClick={() => { if (window.confirm(`Anulować blokadę „${block.reason}”?`)) updateBlock({ ...block, status: "Anulowana" }); }}>{block.blockType}</button>; })}
              </div></div>;
            })}
          </div>
        </div>
      </Card>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
        <Card className="p-5 sm:p-6"><div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#e3eedf] text-[#2b6646]"><Icon className="size-5" name="check" /></span><div><p className="font-display text-xl font-semibold">Kontrola lokalnych konfliktów jest aktywna</p><p className="mt-1 text-sm leading-6 text-[#63716a]">Stawy OS nie zapisze potwierdzonej rezerwacji na zajęty termin. Zewnętrzne OTA mogą jednak pobrać iCal z opóźnieniem — zawsze sprawdzaj czas ostatniej synchronizacji.</p></div></div></Card>
        <Card className="p-5 sm:p-6"><p className="text-[11px] font-black uppercase tracking-[.17em] text-[#7b894e]">Wolne noce w tym widoku</p><p className="mt-2 font-display text-2xl font-semibold">{Math.max(0, daysCount * data.units.length - totalNights)} dób</p><p className="mt-1 text-sm text-[#68756f]">Wyliczone z aktywnych rezerwacji. Sugestie cenowe wymagają skonfigurowania stawek sezonowych.</p></Card>
      </section>
      {blockForm ? <div className="fixed inset-0 z-50 grid place-items-center bg-[#102c24]/70 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setBlockForm(null); }}><form className="w-full max-w-lg rounded-[22px] bg-[#fffdf8] p-6 shadow-2xl" onSubmit={(event) => { event.preventDefault(); if (!blockForm.reason.trim() || blockForm.dateTo <= blockForm.dateFrom) return; addBlock({ id: `BLK-${Date.now()}`, ...blockForm, reason: blockForm.reason.trim(), status: "Aktywna" }); setBlockForm(null); }}><div className="flex items-start justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#7d8b4d]">Dostępność</p><h2 className="font-display text-2xl font-semibold">Dodaj blokadę terminu</h2></div><button aria-label="Zamknij" type="button" onClick={() => setBlockForm(null)}><Icon className="size-5" name="close"/></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Domek"><select className={inputClass} value={blockForm.unitId} onChange={(event) => setBlockForm({ ...blockForm, unitId: event.target.value })}>{data.units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></Field><Field label="Rodzaj"><select className={inputClass} value={blockForm.blockType} onChange={(event) => setBlockForm({ ...blockForm, blockType: event.target.value as CalendarBlock["blockType"] })}>{["Właściciel","Serwis","Remont","Bufor sprzątania","Influencer/barter","Inne"].map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Od"><input className={inputClass} type="date" required value={blockForm.dateFrom} onChange={(event) => setBlockForm({ ...blockForm, dateFrom: event.target.value })}/></Field><Field label="Do"><input className={inputClass} type="date" required value={blockForm.dateTo} onChange={(event) => setBlockForm({ ...blockForm, dateTo: event.target.value })}/></Field><div className="sm:col-span-2"><Field label="Powód"><input autoFocus className={inputClass} required placeholder="np. pobyt właścicieli lub serwis pompy" value={blockForm.reason} onChange={(event) => setBlockForm({ ...blockForm, reason: event.target.value })}/></Field></div></div>{blockForm.dateTo <= blockForm.dateFrom ? <p className="mt-3 text-sm font-bold text-[#963c27]">Data końcowa musi być późniejsza.</p> : null}<div className="mt-6 flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setBlockForm(null)}>Anuluj</Button><Button type="submit">Zapisz blokadę</Button></div></form></div> : null}
    </div>
  );
}

function BookingBar({ anchor, booking, daysCount, index, conflicts }: { anchor: Date; booking: Booking; daysCount: number; index: number; conflicts: string[] }) {
  const start = Math.max(0, diffDays(toDate(booking.checkIn), anchor));
  const finish = Math.min(daysCount, diffDays(toDate(booking.checkOut), anchor));
  return <Link className={`z-10 mx-1 my-3 flex h-12 min-w-0 items-center gap-2 overflow-hidden rounded-xl border px-3 text-xs font-bold shadow-[0_5px_14px_rgba(39,62,53,.15)] transition hover:-translate-y-0.5 hover:shadow-lg ${conflicts.length ? "border-[#b43b27] bg-[#c94e37] text-white" : channelStyles[booking.platform] ?? "border-[#65756d] bg-[#6f8178] text-white"}`} href={`/bookings/${booking.id}`} style={{ gridColumn: `${start + 1} / span ${Math.max(1, finish-start)}`, gridRow: 1, marginTop: `${12 + (index % 2) * 54}px` }} title={`${booking.guestLabel}: ${booking.checkIn}–${booking.checkOut}`}><span className="truncate">{booking.guestLabel}</span><span className="ml-auto shrink-0 rounded-full bg-black/10 px-2 py-0.5 text-[9px]">{nightsBetween(booking.checkIn, booking.checkOut)}n</span></Link>;
}

function MiniStat({ label, value, note, good = false }: { label: string; value: string | number; note: string; good?: boolean }) {
  return <div className="rounded-2xl border border-[#d8d0c2] bg-[#fffdf8] px-5 py-4"><div className="flex items-end justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#7b857f]">{label}</p><p className="mt-1 font-display text-3xl font-semibold">{value}</p></div>{good ? <span className="grid size-8 place-items-center rounded-full bg-[#dfeede] text-[#286144]"><Icon className="size-4" name="check"/></span> : null}</div><p className="mt-1 text-xs font-semibold text-[#6b7771]">{note}</p></div>;
}

function Legend({ color, label }: { color: string; label: string }) { return <span className="inline-flex items-center gap-1.5"><span className={`size-2.5 rounded-full ${color}`}/>{label}</span>; }
