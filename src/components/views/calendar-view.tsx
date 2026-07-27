"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useAppStore } from "@/components/layout/app-store";
import { Badge, Button, Card, Field, inputClass } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icons";
import type { Booking, CalendarBlock, Channel } from "@/lib/types";
import { calendarBarPlacement, getBookingConflicts, nightsBetween } from "@/lib/workflow/rules";
import { addLocalDays, formatLocalDate, formatPolishDate, parseLocalDate, todayInPoland } from "@/lib/date";
import { DepartureDebriefSheet } from "@/components/departures/departure-debrief-sheet";
import { NewBookingDialog } from "@/components/bookings/new-booking-dialog";
import { operationalCalendarBlockSchema } from "@/lib/domain/calendar-block-command";
import { Dialog } from "@/components/ui/dialog";
import {
  buildCalendarBookingDraft,
  calendarWindowStart,
} from "@/lib/workflow/calendar-draft";

const dayMs = 86_400_000;
const calendarDays = 112;
const calendarStep = 14;
const bookingChannels: Channel[] = ["Booking", "Airbnb", "Aloha Camp", "Agoda", "Expedia", "VRBO", "Slowhop", "Telefon", "Bezpośrednio", "E-mail", "Strona www", "Inne"];
const channelStyles: Partial<Record<Channel, string>> = {
  Booking: "bg-[#27727d] text-white border-[#1d606a]",
  Airbnb: "bg-[#df735a] text-white border-[#c65f49]",
  Bezpośrednio: "bg-[#55835d] text-white border-[#416f49]",
  Telefon: "bg-[#d9ad4f] text-[#3d3218] border-[#c69b3f]",
};

function toDate(value: string) { return parseLocalDate(value) ?? new Date(); }
function iso(date: Date) { return formatLocalDate(date); }
function addDays(date: Date, days: number) { return toDate(addLocalDays(iso(date), days)); }
function diffDays(a: Date, b: Date) { return Math.round((a.getTime() - b.getTime()) / dayMs); }
function unitName(units: { id: string; name: string }[], unitId?: string) { return units.find((unit) => unit.id === unitId)?.name ?? "Domek"; }
function monthMarker(date: Date) { return new Intl.DateTimeFormat("pl-PL", { month: "long", year: "numeric" }).format(date); }
function shortMonth(date: Date) { return new Intl.DateTimeFormat("pl-PL", { month: "short" }).format(date).replace(".", ""); }

export function CalendarView() {
  const { data, addBlock, updateBlock, prepareDepartureDebriefs } = useAppStore();
  const [anchor, setAnchor] = useState(() => toDate(calendarWindowStart(todayInPoland())));
  const [channel, setChannel] = useState<string>("Wszystkie");
  const [mobileMode, setMobileMode] = useState<"agenda" | "timeline">("timeline");
  const [departureId, setDepartureId] = useState<string>();
  const [bookingDraft, setBookingDraft] = useState<{ unitId: string; checkIn: string; checkOut: string }>();
  const [rangeStart, setRangeStart] = useState<{ unitId: string; date: string }>();
  const [rangeHover, setRangeHover] = useState<string>();
  const [selectionStatus, setSelectionStatus] = useState<string>();
  const timelineRef = useRef<HTMLDivElement>(null);
  const focusTodayRef = useRef(true);
  const dragStartRef = useRef<{ unitId: string; date: string } | null>(null);
  const draggedRef = useRef(false);
  const [blockForm, setBlockForm] = useState<{ unitId: string; dateFrom: string; dateTo: string; reason: string; blockType: CalendarBlock["blockType"] } | null>(null);
  const [blockToCancel, setBlockToCancel] = useState<CalendarBlock | null>(null);
  const [blockSaving, setBlockSaving] = useState(false);
  const [blockStatus, setBlockStatus] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const blockTriggerRef = useRef<HTMLElement | null>(null);
  const blockDialogOpen = Boolean(blockForm || blockToCancel);
  const daysCount = calendarDays;
  const dates = useMemo(() => Array.from({ length: daysCount }, (_, index) => addDays(anchor, index)), [anchor, daysCount]);
  const mobileDates = useMemo(
    () => dates.filter((date) => iso(date) >= todayInPoland()).slice(0, 7),
    [dates],
  );
  const monthSegments = useMemo(() => dates.reduce<{ date: Date; start: number; span: number }[]>((segments, date, index) => {
    const previous = segments[segments.length - 1];
    if (!previous || previous.date.getMonth() !== date.getMonth() || previous.date.getFullYear() !== date.getFullYear()) segments.push({ date, start: index, span: 1 });
    else previous.span += 1;
    return segments;
  }, []), [dates]);
  const end = addDays(anchor, daysCount);
  const today = todayInPoland();
  const visibleBookings = data.bookings.filter((booking) => booking.workflowStatus !== "Anulowana" && toDate(booking.checkIn) < end && toDate(booking.checkOut) >= anchor && (channel === "Wszystkie" || booking.platform === channel));
  const conflictCount = visibleBookings.filter((booking) => getBookingConflicts(data.bookings, data.blocks, booking).length).length;
  const totalNights = visibleBookings.reduce((sum, booking) => sum + Math.max(0, Math.min(diffDays(toDate(booking.checkOut), anchor), daysCount) - Math.max(diffDays(toDate(booking.checkIn), anchor), 0)), 0);
  const occupancy = Math.round((totalNights / Math.max(1, daysCount * data.units.length)) * 100);
  const dayWidth = 44;
  const unitWidth = 138;
  const availableChannels = bookingChannels.filter((item) => data.bookings.some((booking) => booking.platform === item));

  useEffect(() => {
    if (!focusTodayRef.current) return;
    const todayIndex = dates.findIndex((date) => iso(date) === today);
    if (todayIndex < 0 || !timelineRef.current) return;
    timelineRef.current.scrollLeft = Math.max(
      0,
      todayIndex * dayWidth - timelineRef.current.clientWidth * 0.28,
    );
    focusTodayRef.current = false;
  }, [dates, today]);

  function showToday() {
    focusTodayRef.current = true;
    setAnchor(toDate(calendarWindowStart(today)));
  }

  function moveCalendar(days: number) {
    focusTodayRef.current = false;
    setAnchor((current) => addDays(current, days));
  }

  function completeRange(unitId: string, firstDate: string, secondDate: string) {
    const result = buildCalendarBookingDraft(data, unitId, firstDate, secondDate);
    setRangeStart(undefined);
    setRangeHover(undefined);
    if (result.conflict) {
      setSelectionStatus(`Nie można otworzyć wyceny: ${result.conflict}. Wybierz inny zakres.`);
      return;
    }
    setSelectionStatus(undefined);
    setBookingDraft(result.draft);
  }

  function selectDay(unitId: string, date: string) {
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    if (!rangeStart || rangeStart.unitId !== unitId) {
      setRangeStart({ unitId, date });
      setRangeHover(date);
      setSelectionStatus(`Wybrano przyjazd ${formatPolishDate(date)} w ${unitName(data.units, unitId)}. Wskaż datę wyjazdu.`);
      return;
    }
    completeRange(unitId, rangeStart.date, date);
  }

  function startPointerRange(unitId: string, date: string) {
    dragStartRef.current = { unitId, date };
    draggedRef.current = false;
    setRangeHover(date);
  }

  function enterPointerRange(unitId: string, date: string) {
    if (!dragStartRef.current || dragStartRef.current.unitId !== unitId) return;
    if (dragStartRef.current.date !== date) draggedRef.current = true;
    setRangeHover(date);
  }

  function finishPointerRange(unitId: string, date: string) {
    const start = dragStartRef.current;
    dragStartRef.current = null;
    if (!start || !draggedRef.current || start.unitId !== unitId) return;
    completeRange(unitId, start.date, date);
  }
  async function submitBlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!blockForm || blockSaving) return;
    const parsed = operationalCalendarBlockSchema.safeParse({
      id: `BLK-${Date.now()}`,
      ...blockForm,
      reason: blockForm.reason.trim(),
      status: "Aktywna",
      version: 1,
    });
    if (!parsed.success) {
      setBlockStatus({ tone: "error", message: "Sprawdź domek, zakres dat i powód blokady." });
      return;
    }
    setBlockSaving(true);
    setBlockStatus(null);
    const saved = await addBlock(parsed.data);
    setBlockSaving(false);
    if (!saved) {
      setBlockStatus({ tone: "error", message: "Nie potwierdzono zapisu blokady. Odśwież dane i sprawdź konflikty terminu." });
      return;
    }
    setBlockForm(null);
    setBlockStatus({
      tone: "success",
      message: "Blokada została zapisana w Stawy OS. Potwierdź ją jeszcze w Mobile Calendar.",
    });
  }
  async function cancelSelectedBlock() {
    if (!blockToCancel || blockSaving) return;
    setBlockSaving(true);
    setBlockStatus(null);
    const saved = await updateBlock({ ...blockToCancel, status: "Anulowana" });
    setBlockSaving(false);
    if (!saved) {
      setBlockStatus({ tone: "error", message: "Nie potwierdzono anulowania. Termin pozostaje zablokowany do wyjaśnienia." });
      return;
    }
    setBlockToCancel(null);
    setBlockStatus({
      tone: "success",
      message: "Blokada została anulowana w Stawy OS. Sprawdź również Mobile Calendar.",
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="order-[-2] animate-rise-2 flex flex-col gap-4 rounded-[20px] border border-[#d8d0c2] bg-[#fffdf8] p-4 shadow-[0_14px_40px_rgba(38,53,45,.05)] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button aria-label="Przesuń kalendarz wstecz" variant="secondary" onClick={() => moveCalendar(-calendarStep)}><Icon className="size-4 rotate-180" name="chevron" /></Button>
          <Button variant="secondary" onClick={showToday}>Dzisiaj</Button>
          <Button aria-label="Przesuń kalendarz dalej" variant="secondary" onClick={() => moveCalendar(calendarStep)}><Icon className="size-4" name="chevron" /></Button>
          <div className="ml-1"><p className="font-display text-xl font-semibold capitalize">{new Intl.DateTimeFormat("pl-PL", { month: "long", year: "numeric" }).format(anchor)}</p><p className="text-xs font-semibold text-[#6d7972]">{formatPolishDate(anchor, { year: false })} – {formatPolishDate(addDays(anchor, daysCount - 1), { year: false })}</p></div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#cec6b7] bg-white px-3 text-sm font-black text-[#355248]" href="/calendar/year"><Icon className="size-4" name="calendar"/>Przegląd roku</Link>
          <select aria-label="Filtr kanału rezerwacji" className="min-h-10 rounded-xl border border-[#cec6b7] bg-white px-3 text-sm font-bold outline-none" value={channel} onChange={(event) => setChannel(event.target.value)}><option value="Wszystkie">Wszystkie kanały</option>{availableChannels.map((item) => <option key={item}>{item}</option>)}</select>
          <div className="flex rounded-xl bg-[#ebe7de] p-1 sm:hidden"><button className={`rounded-lg px-3 py-1.5 text-xs font-black ${mobileMode === "agenda" ? "bg-white shadow-sm" : "text-[#6f7a74]"}`} onClick={() => setMobileMode("agenda")}>Agenda</button><button className={`rounded-lg px-3 py-1.5 text-xs font-black ${mobileMode === "timeline" ? "bg-white shadow-sm" : "text-[#6f7a74]"}`} onClick={() => setMobileMode("timeline")}>Oś czasu</button></div>
          <Button onClick={(event) => { blockTriggerRef.current = event.currentTarget; setBlockStatus(null); setBlockForm({ unitId: data.units[0]?.id ?? "", dateFrom: today, dateTo: addLocalDays(today, 1), reason: "", blockType: "Właściciel" }); }}><Icon className="size-4" name="plus"/>Dodaj blokadę</Button>
        </div>
      </section>

      {blockStatus ? <div aria-live={blockStatus.tone === "error" ? "assertive" : "polite"} className={`rounded-2xl border px-4 py-3 text-sm font-bold ${blockStatus.tone === "success" ? "border-[#b9d2bd] bg-[#e8f2e7] text-[#285d3e]" : "border-[#e3b5a7] bg-[#f9e7e1] text-[#8a3b29]"} ${blockStatus.tone === "error" && blockDialogOpen ? "fixed left-1/2 top-4 z-[60] w-[min(92vw,34rem)] -translate-x-1/2 shadow-xl" : ""}`}>{blockStatus.message}</div> : null}

      <section className="animate-rise-3 hidden flex-col gap-3 rounded-2xl border border-[#d6ddc5] bg-[#eef2e5] p-3 sm:flex sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#174d3b] text-white"><Icon className="size-4" name="calendar"/></span><div><p className="text-xs font-black">Praca z kalendarzem</p><p className="text-[11px] text-[#617069]">Wskaż przyjazd i wyjazd dwoma kliknięciami lub przeciągnij na desktopie. Klawiaturą użyj Enter na obu dniach.</p></div></div>
        <div className="flex flex-wrap gap-2"><Link className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-[#c8d1bb] bg-white px-3 text-xs font-black text-[#315846] transition hover:border-[#6f8a68]" href="/bookings?view=sheet"><Icon className="size-3.5" name="booking"/>Arkusz rezerwacji</Link><Link className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-[#c8d1bb] bg-white px-3 text-xs font-black text-[#315846] transition hover:border-[#6f8a68]" href="/imports"><Icon className="size-3.5" name="download"/>Import danych</Link></div>
      </section>

      <section aria-label="Stan synchronizacji kalendarza" className="hidden gap-2 rounded-2xl border border-[#d8d0c2] bg-[#fffdf8] p-3 sm:grid sm:grid-cols-2">
        {data.sourceConnections.map((source) => <div className="flex items-center justify-between gap-3 rounded-xl bg-[#f4f1e9] px-3 py-2" key={source.id}><div><p className="text-sm font-black">{source.platform} · {source.connectionType}</p><p className="text-[11px] text-[#68756e]">Pokrycie {source.coverage}% · dostępność może czekać na synchronizację</p></div><Badge tone={source.status === "Aktywne" ? "good" : "warn"}>{source.status}</Badge></div>)}
      </section>

      {selectionStatus ? <div aria-live="polite" className={`rounded-xl border px-4 py-3 text-sm font-bold ${selectionStatus.startsWith("Nie można") ? "border-[#e3b5a7] bg-[#f9e7e1] text-[#8a3b29]" : "border-[#b9d2bd] bg-[#e8f2e7] text-[#285d3e]"}`}>{selectionStatus}</div> : null}

      <div className="animate-rise-3 hidden gap-3 sm:grid sm:grid-cols-3">
        <MiniStat label="Obłożenie widoku" value={`${occupancy}%`} note={`${totalNights} zajętych dób`} />
        <MiniStat label="Pobyty w okresie" value={visibleBookings.length} note={`${data.units.length} domki`} />
        <MiniStat label="Konflikty" value={conflictCount} note={conflictCount ? "wymagają reakcji" : "kalendarz bezpieczny"} good={!conflictCount} />
      </div>

      {mobileMode === "agenda" ? <section className="grid gap-3 sm:hidden">{mobileDates.map((date) => { const dateIso = iso(date); const arrivals = data.bookings.filter((item) => item.workflowStatus !== "Anulowana" && item.checkIn === dateIso); const departuresForDay = data.bookings.filter((item) => item.workflowStatus !== "Anulowana" && item.checkOut === dateIso); const stays = data.bookings.filter((item) => item.workflowStatus !== "Anulowana" && item.checkIn < dateIso && item.checkOut > dateIso); const cleaning = data.tasks.filter((item) => item.type === "Sprzątanie" && item.dueDate === dateIso && !["Zrobione","Nie dotyczy"].includes(item.status)); const scheduled = data.scheduledMessages.filter((item) => item.dueAt.startsWith(dateIso) && !["Anulowana","Wysłana","Dostarczona"].includes(item.status)); const empty = !arrivals.length && !departuresForDay.length && !stays.length && !cleaning.length && !scheduled.length; return <article key={dateIso} className={`overflow-hidden rounded-[18px] border bg-[#fffdf8] ${dateIso === today ? "border-[#80965a] shadow-[0_10px_28px_rgba(68,91,51,.1)]" : "border-[#d9d1c1]"}`}><header className={`flex items-center justify-between gap-3 px-4 py-3 ${dateIso === today ? "bg-[#e9efdd]" : "bg-[#f4f1ea]"}`}><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#7a867e]">{dateIso === today ? "Dzisiaj" : new Intl.DateTimeFormat("pl-PL", { weekday: "long" }).format(date)}</p><p className="font-display text-xl font-semibold">{new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "long" }).format(date)}</p></div><div className="flex items-center gap-2"><Badge tone={empty ? "neutral" : "lake"}>{arrivals.length + departuresForDay.length + cleaning.length + scheduled.length} akcji</Badge><button aria-label={`${rangeStart ? "Wybierz wyjazd" : "Wybierz przyjazd"} ${dateIso}`} className="grid size-9 place-items-center rounded-xl bg-[#174d3b] text-white shadow-sm" onClick={() => selectDay(data.units[0]?.id ?? "", dateIso)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); selectDay(data.units[0]?.id ?? "", dateIso); } }}><Icon className="size-4" name="plus"/></button></div></header><div className="grid gap-2 p-3">{departuresForDay.map((booking) => <AgendaRow key={`out-${booking.id}`} icon="arrow" tone="sun" title={`Wyjazd · ${booking.guestLabel}`} body={`${unitName(data.units, booking.unitId)} · ${booking.departureTime || data.settings.defaultCheckOut}`} action="Podsumuj" onClick={() => { prepareDepartureDebriefs([booking.id]); setDepartureId(booking.id); }}/>) }{arrivals.map((booking) => <AgendaLink key={`in-${booking.id}`} booking={booking} title={`Przyjazd · ${booking.guestLabel}`} body={`${unitName(data.units, booking.unitId)} · ${booking.arrivalTime || data.settings.defaultCheckIn}`}/>)}{cleaning.map((task) => <AgendaRow key={task.id} icon="cleaning" tone="moss" title="Turnover" body={`${unitName(data.units, task.unitId)} · ${task.owner}`} />)}{scheduled.map((message) => <AgendaRow key={message.id} icon="message" tone="lake" title={data.messageTemplates.find((item) => item.id === message.templateId)?.name || "Wiadomość"} body={`${message.dueAt.slice(11,16)} · ${message.status}`} />)}{stays.map((booking) => <AgendaLink key={`stay-${booking.id}`} booking={booking} title={`Pobyt trwa · ${booking.guestLabel}`} body={unitName(data.units, booking.unitId)}/>)}{empty ? <p className="py-4 text-center text-xs font-bold text-[#7b857f]">Spokojny dzień — brak zaplanowanych akcji.</p> : null}</div></article>; })}</section> : null}

      <Card className={`order-[-1] animate-rise-3 overflow-hidden ${mobileMode === "agenda" ? "hidden sm:block" : "block"}`}>
        <div className="flex flex-wrap items-center gap-3 border-b border-[#ded7ca] p-3 text-xs font-bold text-[#68756e]"><Legend color="bg-[#27727d]" label="Booking"/><Legend color="bg-[#df735a]" label="Airbnb"/><Legend color="bg-[#55835d]" label="Direct"/><Legend color="bg-[#d9ad4f]" label="Telefon"/><Legend color="border border-dashed border-[#8d866f] bg-[#f0eadc]" label="Blokada"/></div>
        <div className="scrollbar-thin overflow-x-auto scroll-smooth" ref={timelineRef}>
          <div className="min-w-max">
            <div className="grid border-b border-[#ded7ca] bg-[#f7f4ed]" style={{ gridTemplateColumns: `${unitWidth}px auto` }}>
              <div className="sticky left-0 z-20 row-span-2 flex items-end border-r border-[#ded7ca] bg-[#f7f4ed] p-3 text-[9px] font-black uppercase tracking-[.15em] text-[#78847d]">Domek</div>
              <div className="grid border-b border-[#d5d2ca] bg-[#efeee9]" style={{ gridTemplateColumns: `repeat(${daysCount}, ${dayWidth}px)` }}>
                {monthSegments.map((segment, index) => <div className={`flex h-7 items-center px-2 ${index ? "border-l-2 border-[#b9b6ad]" : ""}`} key={`${segment.start}-${iso(segment.date)}`} style={{ gridColumn: `${segment.start + 1} / span ${segment.span}` }}><p className="text-[9px] font-black uppercase tracking-[.13em] text-[#536158]">{monthMarker(segment.date)}</p></div>)}
              </div>
              <div className="grid" style={{ gridTemplateColumns: `repeat(${daysCount}, ${dayWidth}px)` }}>
                {dates.map((date) => { const dateIso = iso(date); const weekend = [0,6].includes(date.getDay()); const beginsMonth = date.getDate() === 1; const background = dateIso === today ? "bg-[#e8efdf]" : weekend ? "bg-[#e9e9e6]" : "bg-[#faf9f6]"; return <div className={`min-h-[42px] border-l border-[#dedbd4] px-1 py-1.5 text-center ${beginsMonth ? "border-l-2 border-l-[#b9b6ad]" : ""} ${background}`} key={dateIso}><p className="text-[8px] font-black uppercase tracking-[.08em] text-[#7e8782]">{new Intl.DateTimeFormat("pl-PL", { weekday: "short" }).format(date).replace(".", "")}</p><p className={`mt-0.5 inline-flex items-baseline justify-center gap-0.5 font-display text-base font-semibold ${dateIso === today ? "mx-auto grid size-7 place-items-center rounded-full bg-[#174d3b] text-white" : ""}`}><span>{date.getDate()}</span>{beginsMonth && dateIso !== today ? <span className="font-sans text-[8px] font-black uppercase text-[#69736d]">{shortMonth(date)}</span> : null}</p></div>; })}
              </div>
            </div>

            {data.units.map((unit) => {
              const bookings = visibleBookings.filter((booking) => booking.unitId === unit.id);
              const blocks = data.blocks.filter((block) => block.unitId === unit.id && toDate(block.dateFrom) < end && toDate(block.dateTo) > anchor && block.status !== "Anulowana");
              return <div className="grid min-h-[82px] border-b border-[#ded7ca] last:border-0" style={{ gridTemplateColumns: `${unitWidth}px auto` }} key={unit.id}><div className="sticky left-0 z-20 flex flex-col justify-center border-r border-[#ded7ca] bg-[#fffdf8] p-3"><div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-lg bg-[#e8eee1] text-[#41684f]"><Icon className="size-3.5" name="home"/></span><p className="font-display text-[15px] font-semibold leading-tight">{unit.name}</p></div><p className="mt-1 text-[9px] font-bold uppercase tracking-[.08em] text-[#818b85]">max {unit.maxPeople} osób</p></div><div className="relative grid overflow-hidden" style={{ gridTemplateColumns: `repeat(${daysCount}, ${dayWidth}px)` }}>
                {dates.map((date, index) => { const dateIso = iso(date); const beginsMonth = date.getDate() === 1; const weekend = [0,6].includes(date.getDay()); const selectedStart = rangeStart?.unitId === unit.id && rangeStart.date === dateIso; const previewStart = rangeStart?.date && rangeHover ? [rangeStart.date, rangeHover].sort()[0] : undefined; const previewEnd = rangeStart?.date && rangeHover ? [rangeStart.date, rangeHover].sort()[1] : undefined; const inPreview = rangeStart?.unitId === unit.id && previewStart && previewEnd && dateIso >= previewStart && dateIso <= previewEnd; const background = selectedStart ? "bg-[#cdddbf]" : inPreview ? "bg-[#e0ead8]" : dateIso === today ? "bg-[#edf3e8]" : weekend ? "bg-[#eeeeeb]" : "bg-[#fffdf8]"; return <button aria-label={`${rangeStart?.unitId === unit.id ? "Wybierz datę wyjazdu" : "Wybierz datę przyjazdu"} ${unit.name}, ${formatPolishDate(date)}`} className={`group relative border-r border-[#e4e2dc] text-left hover:bg-[#e3eadf] focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#174d3b] ${beginsMonth ? "border-l-2 border-l-[#b9b6ad]" : ""} ${background}`} key={dateIso} style={{ gridColumn: index + 1, gridRow: 1 }} onClick={() => selectDay(unit.id, dateIso)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); selectDay(unit.id, dateIso); } }} onPointerDown={() => startPointerRange(unit.id, dateIso)} onPointerEnter={() => enterPointerRange(unit.id, dateIso)} onPointerMove={() => enterPointerRange(unit.id, dateIso)} onPointerUp={() => finishPointerRange(unit.id, dateIso)}><span className="pointer-events-none absolute bottom-1 right-1 hidden size-4 place-items-center rounded-full bg-[#174d3b] text-white group-hover:grid"><Icon className="size-2.5" name="plus"/></span></button>; })}
                {bookings.map((booking, index) => <BookingBar anchor={anchor} booking={booking} compact dayWidth={dayWidth} daysCount={daysCount} index={index} key={booking.id} conflicts={getBookingConflicts(data.bookings, data.blocks, booking)} />)}
                {blocks.map((block, index) => { const start = Math.max(0, diffDays(toDate(block.dateFrom), anchor)); const finish = Math.min(daysCount, diffDays(toDate(block.dateTo), anchor)); return <button className="z-[3] mx-1 self-end overflow-hidden rounded-lg border border-dashed border-[#9a927b] bg-[#eee8dc]/95 px-2 py-1 text-left text-[10px] font-black text-[#6d6758]" key={block.id} style={{ gridColumn: `${start + 1} / span ${Math.max(1, finish-start)}`, gridRow: 1, marginBottom: `${8 + index * 24}px` }} title={`${block.reason} · kliknij, aby anulować`} onClick={(event) => { blockTriggerRef.current = event.currentTarget; setBlockStatus(null); setBlockToCancel(block); }}>{block.blockType}</button>; })}
              </div></div>;
            })}
          </div>
        </div>
      </Card>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
        <Card className="p-5 sm:p-6"><div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#e3eedf] text-[#2b6646]"><Icon className="size-5" name="check" /></span><div><p className="font-display text-xl font-semibold">Kontrola lokalnych konfliktów jest aktywna</p><p className="mt-1 text-sm leading-6 text-[#63716a]">Stawy OS nie zapisze potwierdzonej rezerwacji na zajęty termin. Zewnętrzne OTA mogą jednak pobrać iCal z opóźnieniem — zawsze sprawdzaj czas ostatniej synchronizacji.</p></div></div></Card>
        <Card className="p-5 sm:p-6"><p className="text-[11px] font-black uppercase tracking-[.17em] text-[#7b894e]">Wolne noce w tym widoku</p><p className="mt-2 font-display text-2xl font-semibold">{Math.max(0, daysCount * data.units.length - totalNights)} dób</p><p className="mt-1 text-sm text-[#68756f]">Wyliczone z aktywnych rezerwacji. Sugestie cenowe wymagają skonfigurowania stawek sezonowych.</p></Card>
      </section>
      {blockForm ? (
        <Dialog
          ariaLabelledby="calendar-block-title"
          className="w-full max-w-lg rounded-[22px] bg-[#fffdf8] shadow-2xl"
          closeDisabled={blockSaving}
          onClose={() => setBlockForm(null)}
          overlayClassName="grid place-items-center"
          returnFocusRef={blockTriggerRef}
        >
          <form className="p-6" onSubmit={submitBlock}>
            <div className="flex items-start justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#7d8b4d]">Dostępność</p><h2 className="font-display text-2xl font-semibold" id="calendar-block-title">Dodaj blokadę terminu</h2></div><button aria-label="Zamknij" disabled={blockSaving} type="button" onClick={() => setBlockForm(null)}><Icon className="size-5" name="close"/></button></div><p className="mt-2 text-xs leading-5 text-[#68756f]">Zapis w Stawy OS chroni lokalną dostępność. Potwierdzenie w kanałach wymaga osobnej synchronizacji Mobile Calendar.</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Domek"><select className={inputClass} disabled={blockSaving} value={blockForm.unitId} onChange={(event) => setBlockForm({ ...blockForm, unitId: event.target.value })}>{data.units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></Field><Field label="Rodzaj"><select className={inputClass} disabled={blockSaving} value={blockForm.blockType} onChange={(event) => setBlockForm({ ...blockForm, blockType: event.target.value as CalendarBlock["blockType"] })}>{["Właściciel","Serwis","Remont","Bufor sprzątania","Influencer/barter","Inne"].map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Od"><input className={inputClass} disabled={blockSaving} type="date" required value={blockForm.dateFrom} onChange={(event) => setBlockForm({ ...blockForm, dateFrom: event.target.value })}/></Field><Field label="Do"><input className={inputClass} disabled={blockSaving} type="date" required value={blockForm.dateTo} onChange={(event) => setBlockForm({ ...blockForm, dateTo: event.target.value })}/></Field><div className="sm:col-span-2"><Field label="Powód"><input data-dialog-initial-focus className={inputClass} disabled={blockSaving} maxLength={1000} required placeholder="np. pobyt właścicieli lub serwis pompy" value={blockForm.reason} onChange={(event) => setBlockForm({ ...blockForm, reason: event.target.value })}/></Field></div></div>{blockForm.dateTo <= blockForm.dateFrom ? <p className="mt-3 text-sm font-bold text-[#963c27]">Data końcowa musi być późniejsza.</p> : null}<div className="mt-6 flex justify-end gap-2"><Button disabled={blockSaving} type="button" variant="ghost" onClick={() => setBlockForm(null)}>Anuluj</Button><Button disabled={blockSaving} type="submit">{blockSaving ? "Zapisywanie…" : "Zapisz blokadę"}</Button></div>
          </form>
        </Dialog>
      ) : null}
      {blockToCancel ? (
        <Dialog
          ariaDescribedby="cancel-block-description"
          ariaLabelledby="cancel-block-title"
          className="w-full max-w-md rounded-[22px] border border-[#e1d4c5] bg-[#fffdf8] p-6 shadow-2xl"
          closeDisabled={blockSaving}
          onClose={() => setBlockToCancel(null)}
          overlayClassName="grid place-items-center"
          returnFocusRef={blockTriggerRef}
          role="alertdialog"
        >
          <span className="grid size-11 place-items-center rounded-2xl bg-[#f4dfd6] text-[#9a432e]"><Icon className="size-5" name="close"/></span><h2 className="mt-4 font-display text-2xl font-semibold" id="cancel-block-title">Anulować blokadę?</h2><p className="mt-2 text-sm leading-6 text-[#68756f]" id="cancel-block-description">„{blockToCancel.reason}” przestanie blokować termin w Stawy OS. Zmianę trzeba również sprawdzić w Mobile Calendar.</p><div className="mt-6 flex justify-end gap-2"><Button data-dialog-initial-focus disabled={blockSaving} type="button" variant="ghost" onClick={() => setBlockToCancel(null)}>Zostaw blokadę</Button><Button disabled={blockSaving} type="button" onClick={() => void cancelSelectedBlock()}>{blockSaving ? "Anulowanie…" : "Anuluj blokadę"}</Button></div>
        </Dialog>
      ) : null}
      {departureId ? <DepartureDebriefSheet booking={data.bookings.find((item) => item.id === departureId)!} onClose={() => setDepartureId(undefined)}/> : null}
      {bookingDraft ? <NewBookingDialog defaults={{ ...bookingDraft, arrivalTime: data.settings.defaultCheckIn, departureTime: data.settings.defaultCheckOut }} onClose={() => setBookingDraft(undefined)} onAdded={() => setBookingDraft(undefined)}/> : null}
    </div>
  );
}

function BookingBar({ anchor, booking, compact, dayWidth, daysCount, index, conflicts }: { anchor: Date; booking: Booking; compact: boolean; dayWidth: number; daysCount: number; index: number; conflicts: string[] }) {
  const placement = calendarBarPlacement(booking.checkIn, booking.checkOut, iso(anchor), daysCount, dayWidth);
  return <Link aria-label={`${booking.guestLabel}, kanał ${booking.platform}, ${formatPolishDate(booking.checkIn)}–${formatPolishDate(booking.checkOut)}`} className={`z-10 flex min-w-0 items-center gap-1.5 overflow-hidden border px-2 font-bold shadow-[0_5px_14px_rgba(39,62,53,.15)] transition hover:-translate-y-0.5 hover:shadow-lg ${compact ? "h-8 rounded-lg text-[10px]" : "h-12 rounded-xl text-xs"} ${conflicts.length ? "border-[#b43b27] bg-[#c94e37] text-white" : channelStyles[booking.platform] ?? "border-[#65756d] bg-[#6f8178] text-white"}`} href={`/bookings/${booking.id}`} style={{ gridColumn: `${placement.start + 1} / span ${placement.span}`, gridRow: 1, marginLeft: `${placement.marginLeft}px`, marginRight: `${placement.marginRight}px`, marginTop: `${compact ? 9 + (index % 2) * 34 : 12 + (index % 2) * 54}px` }} title={`${booking.guestLabel}: przyjazd ${formatPolishDate(booking.checkIn)} ${booking.arrivalTime || "16:00"}, wyjazd ${formatPolishDate(booking.checkOut)} ${booking.departureTime || "11:00"}`}><span className="shrink-0 rounded-full bg-black/15 px-1.5 py-0.5 text-[8px] uppercase">{booking.platform}</span><span className="truncate">{booking.guestLabel}</span><span className="ml-auto shrink-0 rounded-full bg-black/10 px-1.5 py-0.5 text-[8px]">{nightsBetween(booking.checkIn, booking.checkOut)}n</span></Link>;
}

function MiniStat({ label, value, note, good = false }: { label: string; value: string | number; note: string; good?: boolean }) {
  return <div className="rounded-2xl border border-[#d8d0c2] bg-[#fffdf8] px-5 py-4"><div className="flex items-end justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#7b857f]">{label}</p><p className="mt-1 font-display text-3xl font-semibold">{value}</p></div>{good ? <span className="grid size-8 place-items-center rounded-full bg-[#dfeede] text-[#286144]"><Icon className="size-4" name="check"/></span> : null}</div><p className="mt-1 text-xs font-semibold text-[#6b7771]">{note}</p></div>;
}

function Legend({ color, label }: { color: string; label: string }) { return <span className="inline-flex items-center gap-1.5"><span className={`size-2.5 rounded-full ${color}`}/>{label}</span>; }

function AgendaLink({ booking, title, body }: { booking: Booking; title: string; body: string }) { return <Link href={`/bookings/${booking.id}`} className="flex items-center gap-3 rounded-xl border border-[#e4ded2] bg-white p-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#e2ede7] text-[#2d6b54]"><Icon className="size-4" name="home"/></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-black">{title}</span><span className="block truncate text-xs text-[#6d7972]">{body}</span></span><Icon className="size-4 text-[#7c8781]" name="chevron"/></Link>; }
function AgendaRow({ icon, tone, title, body, action, onClick }: { icon: "arrow" | "cleaning" | "message"; tone: "sun" | "moss" | "lake"; title: string; body: string; action?: string; onClick?: () => void }) { const tones = { sun: "bg-[#fae7bd] text-[#806018]", moss: "bg-[#e3eddc] text-[#386247]", lake: "bg-[#dcebea] text-[#28635f]" }; const Tag = onClick ? "button" : "div"; return <Tag className="flex w-full items-center gap-3 rounded-xl border border-[#e4ded2] bg-white p-3 text-left" onClick={onClick}><span className={`grid size-9 shrink-0 place-items-center rounded-xl ${tones[tone]}`}><Icon className={`size-4 ${icon === "arrow" ? "rotate-180" : ""}`} name={icon}/></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-black">{title}</span><span className="block truncate text-xs text-[#6d7972]">{body}</span></span>{action ? <span className="text-xs font-black text-[#2f6c57]">{action}</span> : null}</Tag>; }
