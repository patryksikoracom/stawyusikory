"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/components/layout/app-store";
import { Badge, Button, Card, inputClass } from "@/components/ui/primitives";
import { Icon, type IconName } from "@/components/ui/icons";
import type { Booking, MessageRecord, PaymentTransaction, ScheduledMessage, WorkflowStatus } from "@/lib/types";
import { bookingQualityScore, canClose, canConfirm, getBookingConflicts, getBookingDataIssues, getNextAction, leadTimeDays, nightsBetween, unitName } from "@/lib/workflow/rules";
import { NewBookingDialog } from "@/components/bookings/new-booking-dialog";
import { formatPolishDate, todayInPoland } from "@/lib/date";
import { DepartureDebriefSheet } from "@/components/departures/departure-debrief-sheet";
import type { DepartureDebrief } from "@/lib/types";
import { daysLeftInTrash, isBookingInTrash } from "@/lib/booking-trash";
import { BookingsSheet } from "@/components/bookings/bookings-sheet";
import { calculateBookingFinance, financeIssueLabel } from "@/lib/metrics/finance";

const statuses: WorkflowStatus[] = ["Nowa", "Potwierdzona", "Przed przyjazdem", "W trakcie", "Po pobycie", "Zamknięta", "Anulowana"];
const tabs = ["Podsumowanie", "Płatności", "Wiadomości", "Zadania", "Historia"] as const;
type Tab = (typeof tabs)[number];

function money(value?: number, currency: Booking["currency"] = "PLN") { return value == null ? "—" : new Intl.NumberFormat("pl-PL", { style: "currency", currency: currency ?? "PLN", maximumFractionDigits: 0 }).format(value); }
function shortDate(value?: string) { return formatPolishDate(value); }

export function BookingsView({ initialId, initialView = "list" }: { initialId?: string; initialView?: "list" | "sheet" }) {
  const { data } = useAppStore();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("Wszystkie");
  const [payment, setPayment] = useState("Wszystkie");
  const [year, setYear] = useState("Wszystkie");
  const [viewMode, setViewMode] = useState<"list" | "sheet">(initialView);
  const [selectedId, setSelectedId] = useState(initialId ?? data.bookings[0]?.id ?? "");
  const [descending, setDescending] = useState(true);
  const [showTrash, setShowTrash] = useState(false);
  const activeBookings = useMemo(() => data.bookings.filter((booking) => !isBookingInTrash(booking)), [data.bookings]);
  const trashedBookings = useMemo(() => data.bookings.filter(isBookingInTrash), [data.bookings]);
  const rows = useMemo(() => activeBookings.filter((booking) => {
    const q = search.toLowerCase();
    const matchesQuery = !q || [booking.guestLabel, booking.id, booking.platformReservationNo, unitName(data.units, booking.unitId)].filter(Boolean).some((value) => String(value).toLowerCase().includes(q));
    return matchesQuery && (year === "Wszystkie" || booking.checkIn.startsWith(year)) && (platform === "Wszystkie" || booking.platform === platform) && (payment === "Wszystkie" || booking.paymentStatus === payment);
  }).sort((a, b) => descending ? b.checkIn.localeCompare(a.checkIn) : a.checkIn.localeCompare(b.checkIn)), [activeBookings, data.units, search, year, platform, payment, descending]);
  const selected = activeBookings.find((booking) => booking.id === selectedId) ?? rows[0];
  const future = activeBookings.filter((item) => item.checkOut >= todayInPoland() && item.workflowStatus !== "Anulowana").length;
  const unsettled = activeBookings.filter((item) => ["Do uzupełnienia", "Do dopłaty", "Częściowo"].includes(item.paymentStatus)).length;
  const years = Array.from(new Set(activeBookings.map((item) => item.checkIn.slice(0, 4)))).sort((a, b) => b.localeCompare(a));

  function changeView(mode: "list" | "sheet") {
    setViewMode(mode);
    router.replace(mode === "sheet" ? "/bookings?view=sheet" : "/bookings", { scroll: false });
  }

  function downloadCsv() {
    const lines = [["id", "gość", "domek", "przyjazd", "wyjazd", "kanał", "kwota", "płatność", "status"], ...rows.map((booking) => [booking.id, booking.guestLabel, unitName(data.units, booking.unitId), booking.checkIn, booking.checkOut, booking.platform, booking.grossPrice ?? "", booking.paymentStatus, booking.workflowStatus])];
    const csv = lines.map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "rezerwacje-stawy-os.csv"; link.click(); URL.revokeObjectURL(url);
  }

  return <div className="grid gap-5">
    <section className="animate-rise-2 grid gap-3 sm:grid-cols-3">
      <Summary label="Wszystkie rezerwacje" value={activeBookings.length} note={`${future} nadchodzących`} icon="booking" />
      <Summary label="Do rozliczenia" value={unsettled} note="wymagają sprawdzenia" icon="wallet" warn={unsettled > 0} />
      <Summary label="Wartość rezerwacji" value={money(activeBookings.reduce((sum, item) => sum + (item.grossPrice ?? 0), 0))} note="brutto w bazie" icon="spark" />
    </section>

    <Card className="animate-rise-3 overflow-hidden">
      <div className="grid gap-3 border-b border-[#e2dbce] p-4 lg:grid-cols-[1fr_130px_170px_190px_auto]">
        <div className="relative"><Icon className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#7b867f]" name="search"/><input className={`${inputClass} pl-10`} placeholder="Szukaj gościa, numeru lub domku..." value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        <select aria-label="Filtr roku" className={inputClass} value={year} onChange={(event) => setYear(event.target.value)}><option>Wszystkie</option>{years.map((item) => <option key={item}>{item}</option>)}</select>
        <select className={inputClass} value={platform} onChange={(event) => setPlatform(event.target.value)}><option>Wszystkie</option>{Array.from(new Set(activeBookings.map((item) => item.platform))).map((item) => <option key={item}>{item}</option>)}</select>
        <select className={inputClass} value={payment} onChange={(event) => setPayment(event.target.value)}><option>Wszystkie</option>{Array.from(new Set(activeBookings.map((item) => item.paymentStatus))).map((item) => <option key={item}>{item}</option>)}</select>
        <div className="flex gap-2"><div className="flex rounded-xl bg-[#ebe7de] p-1"><button className={`rounded-lg px-3 text-xs font-black ${viewMode === "list" ? "bg-white shadow-sm" : "text-[#6d7972]"}`} onClick={() => changeView("list")}>Lista</button><button className={`rounded-lg px-3 text-xs font-black ${viewMode === "sheet" ? "bg-white shadow-sm" : "text-[#6d7972]"}`} onClick={() => changeView("sheet")}>Arkusz</button></div><Button variant="secondary" onClick={() => setShowTrash(true)}>Kosz{trashedBookings.length ? ` (${trashedBookings.length})` : ""}</Button><Button variant="secondary" onClick={downloadCsv}><Icon className="size-4" name="download"/>Eksport</Button></div>
      </div>

      {viewMode === "sheet" ? <BookingsSheet rows={rows}/> : <div className="grid min-h-[620px] xl:grid-cols-[390px_minmax(0,1fr)]">
        <aside className="max-h-[760px] overflow-y-auto border-b border-[#e2dbce] bg-[#f7f4ed] xl:border-b-0 xl:border-r">
          <div className="flex items-center justify-between px-4 py-3 text-xs font-black text-[#6a7770]"><span>{rows.length} wyników</span><button className="inline-flex items-center gap-1" onClick={() => setDescending((value) => !value)}><Icon className="size-3.5" name="filter"/>{descending ? "Najnowsze" : "Najbliższe"}</button></div>
          <div className="grid gap-1 px-2 pb-3">
            {rows.map((booking) => <BookingRow active={selected?.id === booking.id} booking={booking} key={booking.id} onClick={() => { setSelectedId(booking.id); router.push(`/bookings/${booking.id}`, { scroll: false }); }} unit={unitName(data.units, booking.unitId)} nextAction={getNextAction(data, booking)} />)}
            {!rows.length ? <p className="p-8 text-center text-sm font-bold text-[#738078]">Brak rezerwacji dla tych filtrów.</p> : null}
          </div>
        </aside>
        <main className="min-w-0 bg-[#fffdf8]">{selected ? <BookingCommandCenter booking={selected} /> : <div className="grid h-full place-items-center p-10 text-center"><div><Icon className="mx-auto size-10 text-[#829052]" name="booking"/><p className="mt-3 font-display text-2xl font-semibold">Wybierz rezerwację</p></div></div>}</main>
      </div>}
    </Card>
    {showTrash ? <BookingTrashDialog bookings={trashedBookings} onClose={() => setShowTrash(false)} /> : null}
  </div>;
}

function BookingTrashDialog({ bookings, onClose }: { bookings: Booking[]; onClose: () => void }) {
  const { restoreBooking } = useAppStore();
  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#102c24]/70 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
    <section aria-labelledby="booking-trash-title" aria-modal="true" className="my-6 w-full max-w-2xl rounded-[22px] bg-[#fffdf8] shadow-2xl" role="dialog">
      <div className="flex items-start justify-between border-b border-[#e3dccf] p-6"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#a84a2e]">Usunięte rezerwacje</p><h2 className="font-display text-2xl font-semibold" id="booking-trash-title">Kosz rezerwacji</h2><p className="mt-1 text-sm text-[#68756f]">Po 30 dniach pozycje są usuwane automatycznie.</p></div><button aria-label="Zamknij" type="button" onClick={onClose}><Icon className="size-5" name="close"/></button></div>
      <div className="grid gap-3 p-5">{bookings.length ? bookings.sort((a, b) => String(b.deletedAt).localeCompare(String(a.deletedAt))).map((booking) => <article className="flex flex-col gap-3 rounded-2xl border border-[#e4dac7] bg-white p-4 sm:flex-row sm:items-center" key={booking.id}><div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{booking.guestLabel}</p><p className="mt-1 text-xs text-[#68756f]">{shortDate(booking.checkIn)} – {shortDate(booking.checkOut)} · {booking.id}</p><p className="mt-2 text-xs font-bold text-[#9b4029]">{daysLeftInTrash(booking)} dni do trwałego usunięcia</p></div><Button variant="secondary" onClick={() => restoreBooking(booking.id)}>Przywróć</Button></article>) : <p className="p-8 text-center text-sm font-bold text-[#738078]">Kosz jest pusty.</p>}</div>
    </section>
  </div>;
}

function Summary({ label, value, note, icon, warn = false }: { label: string; value: string | number; note: string; icon: IconName; warn?: boolean }) {
  return <div className="flex items-center gap-4 rounded-[18px] border border-[#d9d1c1] bg-[#fffdf8] p-4 shadow-[0_12px_35px_rgba(38,53,45,.05)]"><span className={`grid size-11 shrink-0 place-items-center rounded-xl ${warn ? "bg-[#fae5d8] text-[#a84a2e]" : "bg-[#e5ecdf] text-[#3c654a]"}`}><Icon className="size-5" name={icon}/></span><div><p className="text-[10px] font-black uppercase tracking-[.13em] text-[#7b857f]">{label}</p><p className="mt-0.5 font-display text-2xl font-semibold">{value}</p><p className="text-xs text-[#717b75]">{note}</p></div></div>;
}

function BookingRow({ booking, unit, nextAction, active, onClick }: { booking: Booking; unit: string; nextAction: string; active: boolean; onClick: () => void }) {
  const paymentTone = booking.paymentStatus === "Opłacone" ? "good" : booking.paymentStatus === "Do uzupełnienia" ? "bad" : "warn";
  return <button className={`w-full rounded-2xl border p-3.5 text-left transition ${active ? "border-[#b9c8a4] bg-white shadow-[0_8px_22px_rgba(38,53,45,.07)]" : "border-transparent hover:border-[#ddd5c7] hover:bg-white/70"}`} onClick={onClick}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-black">{booking.guestLabel}</p><p className="mt-0.5 truncate text-xs text-[#6e7973]">{unit} · {booking.importRef ? booking.platform : booking.id}</p></div><Badge tone={paymentTone}>{booking.paymentStatus}</Badge></div><div className="mt-3 flex items-center justify-between gap-3"><span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#50645b]"><Icon className="size-3.5" name="calendar"/>{shortDate(booking.checkIn)} – {shortDate(booking.checkOut)}</span><span className="font-display text-sm font-semibold">{money(booking.grossPrice, booking.currency)}</span></div><p className="mt-2 truncate border-t border-[#eee8dd] pt-2 text-[11px] font-semibold text-[#7a847e]">Następnie: {nextAction}</p></button>;
}

function BookingCommandCenter({ booking }: { booking: Booking }) {
  const { data, cancelBooking, updateBooking, updateTask } = useAppStore();
  const [tab, setTab] = useState<Tab>("Podsumowanie");
  const [editing, setEditing] = useState(false);
  const [actions, setActions] = useState(false);
  const [showDebrief, setShowDebrief] = useState(false);
  const [statusError, setStatusError] = useState("");
  const profile = data.guests.find((item) => item.bookingId === booking.id);
  const consent = data.consents.find((item) => item.bookingId === booking.id);
  const importMatch = data.imports.find((item) => item.matchedBookingId === booking.id);
  const tasks = data.tasks.filter((item) => item.bookingId === booking.id);
  const debrief = data.departureDebriefs.find((item) => item.bookingId === booking.id);
  const issues = getBookingDataIssues(data, booking);
  const quality = bookingQualityScore(data, booking);
  const conflicts = getBookingConflicts(data.bookings, data.blocks, booking);
  const confirmState = canConfirm(data, booking);
  const closeState = canClose(data, booking);
  const commission = importMatch?.commission ?? 0;
  const payout = importMatch?.payout ?? ((booking.grossPrice ?? 0) - commission);

  function changeStatus(status: WorkflowStatus) {
    setStatusError("");
    if (status === "Potwierdzona" && !confirmState.ok) { setStatusError(`Nie można potwierdzić: ${confirmState.missing.join(", ")}.`); return; }
    if (status === "Zamknięta" && !closeState.ok) { setStatusError(`Najpierw zamknij zadania: ${closeState.blockingTasks.map((task) => task.type).join(", ")}.`); return; }
    updateBooking({ ...booking, workflowStatus: status });
  }

  return <div className="min-w-0">
    <div className="border-b border-[#e3dccf] p-5 sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between"><div><div className="mb-2 flex flex-wrap items-center gap-2"><Badge tone={booking.platform === "Booking" ? "lake" : booking.platform === "Airbnb" ? "bad" : "good"}>{booking.platform}</Badge><Badge tone={importMatch ? "good" : "warn"}>{importMatch ? "Dane OTA" : "Ręczny wpis"}</Badge>{booking.needsReview ? <Badge tone="warn">Wymaga uzupełnienia</Badge> : null}{conflicts.length ? <Badge tone="bad">Konflikt terminu</Badge> : null}</div><h2 className="font-display text-[30px] font-semibold leading-tight tracking-[-.03em] sm:text-[36px]">{booking.guestLabel}</h2><p className="mt-1 text-sm font-semibold text-[#68756f]">{booking.platformReservationNo || booking.id} · utworzona {shortDate(booking.bookingDate)}</p></div><div className="relative flex items-center gap-2"><Button variant="secondary" onClick={() => setTab("Wiadomości")}><Icon className="size-4" name="message"/>Napisz</Button><Button onClick={() => setActions((value) => !value)}><Icon className="size-4" name="more"/>Akcje</Button>{actions ? <div className="absolute right-0 top-12 z-20 w-52 rounded-2xl border border-[#d7cfc0] bg-white p-2 shadow-xl"><button className="w-full rounded-xl px-3 py-2 text-left text-sm font-bold hover:bg-[#f1eee6]" onClick={() => { setEditing(true); setActions(false); }}>Edytuj rezerwację</button><button className="w-full rounded-xl px-3 py-2 text-left text-sm font-bold text-[#9b4029] hover:bg-[#f9dfd7]" onClick={() => { if (window.confirm("Anulować tę rezerwację? Termin zostanie zwolniony.")) cancelBooking(booking.id); setActions(false); }}>Anuluj rezerwację</button></div> : null}</div></div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><DataPoint icon="calendar" label="Pobyt" value={`${shortDate(booking.checkIn)} – ${shortDate(booking.checkOut)}`} sub={`${nightsBetween(booking.checkIn, booking.checkOut)} nocy`} /><DataPoint icon="home" label="Domek" value={unitName(data.units, booking.unitId)} sub={`${booking.adults + booking.children} gości`} /><DataPoint icon="wallet" label="Wartość" value={money(booking.grossPrice)} sub={booking.paymentStatus} /><DataPoint icon="clock" label="Wyprzedzenie" value={`${leadTimeDays(booking) ?? "—"} dni`} sub={`jakość danych ${quality.score}%`} /></div>
    </div>

    <div className="overflow-x-auto border-b border-[#e3dccf] px-4 sm:px-6"><nav className="flex min-w-max gap-1">{tabs.map((item) => <button className={`border-b-2 px-3 py-3.5 text-sm font-black transition ${tab === item ? "border-[#174d3b] text-[#174d3b]" : "border-transparent text-[#737e77] hover:text-[#314b41]"}`} key={item} onClick={() => setTab(item)}>{item}{item === "Zadania" && tasks.length ? <span className="ml-2 rounded-full bg-[#ece7dd] px-2 py-0.5 text-[10px]">{tasks.length}</span> : null}</button>)}</nav></div>

    <div className="p-5 sm:p-6">
      {conflicts.length ? <div className="mb-5 flex gap-3 rounded-2xl border border-[#efc1b3] bg-[#fbe9e2] p-4 text-[#8e3c27]"><Icon className="mt-0.5 size-5 shrink-0" name="warning"/><div><p className="text-sm font-black">Nie można potwierdzić tej rezerwacji</p><p className="mt-0.5 text-xs leading-5">{conflicts.join(" · ")}</p></div></div> : null}
      {statusError ? <p aria-live="polite" className="mb-5 rounded-xl bg-[#f9dfd7] p-3 text-sm font-bold text-[#963c27]">{statusError}</p> : null}
      {tab === "Podsumowanie" ? <Overview booking={booking} profile={profile} consent={consent} debrief={debrief} issues={issues} importMatch={importMatch} nextAction={getNextAction(data, booking)} changeStatus={changeStatus} onOpenDebrief={() => setShowDebrief(true)} /> : null}
      {tab === "Płatności" ? <Payments booking={booking} commission={commission} payout={payout} /> : null}
      {tab === "Wiadomości" ? <Messages booking={booking} /> : null}
      {tab === "Zadania" ? <Tasks tasks={tasks} updateTask={updateTask} /> : null}
      {tab === "Historia" ? <History booking={booking} imported={Boolean(importMatch)} /> : null}
    </div>
    {editing ? <NewBookingDialog booking={booking} onClose={() => setEditing(false)} onAdded={() => setEditing(false)} /> : null}
    {showDebrief ? <DepartureDebriefSheet booking={booking} onClose={() => setShowDebrief(false)}/> : null}
  </div>;
}

function Overview({ booking, profile, consent, debrief, issues, importMatch, nextAction, changeStatus, onOpenDebrief }: { booking: Booking; profile: ReturnType<typeof useAppStore>["data"]["guests"][number] | undefined; consent: ReturnType<typeof useAppStore>["data"]["consents"][number] | undefined; debrief?: DepartureDebrief; issues: string[]; importMatch: ReturnType<typeof useAppStore>["data"]["imports"][number] | undefined; nextAction: string; changeStatus: (status: WorkflowStatus) => void; onOpenDebrief: () => void }) {
  const canDebrief = booking.checkOut <= todayInPoland();
  return <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]"><div className="grid gap-5"><Panel title="Status pobytu" eyebrow="Workflow"><div className="flex flex-wrap gap-2">{statuses.map((status) => <button className={`rounded-full border px-3 py-2 text-xs font-black transition ${booking.workflowStatus === status ? "border-[#174d3b] bg-[#174d3b] text-white" : "border-[#d6cfc1] bg-white text-[#596a62] hover:border-[#729079]"}`} key={status} onClick={() => changeStatus(status)}>{status}</button>)}</div></Panel><Panel title="Gość i potrzeby" eyebrow="CRM"><div className="grid gap-3 sm:grid-cols-2"><Info label="Segment" value={profile?.segment}/><Info label="Motywacja" value={profile?.motivation}/><Info label="Decydent" value={profile?.decisionMaker}/><Info label="Źródło odkrycia" value={profile?.discoveryChannel}/><Info wide label="Pierwsze pytanie / prompt" value={profile?.searchPhraseOrAiPrompt}/><Info wide label="Prośby specjalne" value={booking.specialRequests}/></div></Panel>{canDebrief || debrief ? <DepartureSummary debrief={debrief} onOpen={onOpenDebrief}/> : null}<Panel title="Dane kontaktowe i zgody" eyebrow="Relacja"><div className="grid gap-3 sm:grid-cols-2"><Info label="E-mail" value={consent?.email}/><Info label="Telefon" value={consent?.phone}/><Info label="Marketing" value={consent?.marketingConsent}/><Info label="Zdjęcia Facebook" value={consent?.photoFbConsent}/></div></Panel></div><aside className="grid content-start gap-5"><Panel title="Następna akcja" eyebrow="Stawy OS"><div className="rounded-xl bg-[#edf1e3] p-4"><p className="text-sm font-black">{nextAction}</p><p className="mt-1 text-xs leading-5 text-[#67736d]">System ustala kolejność na podstawie terminu pobytu, płatności, podsumowania wyjazdu i otwartych zadań.</p></div></Panel><Panel title="Źródło i jakość" eyebrow="Synchronizacja"><div className="grid gap-3"><StatusLine label="Połączenie" value={importMatch ? `${importMatch.platform} / ${importMatch.syncSource}` : "Ręcznie"} ok={Boolean(importMatch)}/><StatusLine label="Nr zewnętrzny" value={importMatch?.reservationNo || booking.platformReservationNo || "brak"} ok={Boolean(importMatch?.reservationNo || booking.platformReservationNo)}/><StatusLine label="Kompletność operacyjna" value={`${Math.max(0, 100 - issues.length * 8)}%`} ok={issues.length < 3}/></div>{issues.length ? <div className="mt-4 rounded-xl bg-[#faf0d5] p-3"><p className="text-xs font-black text-[#725710]">Do uzupełnienia</p><p className="mt-1 text-xs leading-5 text-[#7b6a3e]">{issues.slice(0, 5).join(" · ")}</p></div> : <p className="mt-4 rounded-xl bg-[#e5efe2] p-3 text-xs font-bold text-[#326045]">Dane potrzebne do obsługi pobytu są kompletne.</p>}</Panel></aside></div>;
}

function DepartureSummary({ debrief, onOpen }: { debrief?: DepartureDebrief; onOpen: () => void }) {
  if (!debrief || debrief.status === "Oczekuje") return <Panel title="Podsumowanie wyjazdu" eyebrow="Po pobycie"><div className="flex flex-col gap-3 rounded-xl border border-[#ead4a6] bg-[#fbf0d5] p-4 sm:flex-row sm:items-center"><div className="flex-1"><p className="text-sm font-black">Dane z rozmowy nie zostały jeszcze zapisane.</p><p className="mt-1 text-xs leading-5 text-[#76613a]">Uzupełnij opinię gościa, źródło odkrycia i ewentualne usterki.</p></div><Button onClick={onOpen}>Uzupełnij</Button></div></Panel>;
  if (debrief.status === "Pominięty") return <Panel title="Podsumowanie wyjazdu" eyebrow="Po pobycie"><div className="rounded-xl bg-[#f0ede6] p-4"><p className="text-sm font-black">Podsumowanie pominięte</p><p className="mt-1 text-xs text-[#6d756f]">{debrief.skipReason || "Nie zapisano powodu."}</p></div><Button className="mt-3" variant="secondary" onClick={onOpen}>Uzupełnij teraz</Button></Panel>;
  return <Panel title="Podsumowanie wyjazdu" eyebrow="Zapisane po pobycie"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2"><Badge tone="good">{debrief.departureStatus || "Ukończone"}</Badge><Badge tone={debrief.urgentNextArrivalRisk ? "warn" : "neutral"}>{debrief.urgentNextArrivalRisk ? "Ryzyko przed przyjazdem" : "Bez pilnego ryzyka"}</Badge></div><Button variant="secondary" onClick={onOpen}>Edytuj podsumowanie</Button></div><div className="grid gap-3 sm:grid-cols-2"><Info label="Klucze i dostęp" value={debrief.keysSettled ? "Rozliczone" : "Do sprawdzenia"}/><Info label="Źródło odkrycia" value={debrief.discoverySource}/><Info label="Jak szukali" value={debrief.discoveryMethod}/><Info label="Czy wrócą" value={debrief.returnIntent}/><Info wide label="Dlaczego wybrali Stawy" value={debrief.whyChose}/><Info wide label="Najlepsza część pobytu" value={debrief.bestParts}/><Info wide label="Co można poprawić" value={debrief.improvementNotes}/><Info wide label="Dokładny cytat" value={debrief.bestQuote}/><Info label="NPS" value={debrief.nps}/><Info label="Zgoda na cytat" value={debrief.publicQuotePermission}/><Info wide label="Płatność lub szkoda" value={debrief.paymentOrDamageNote}/><Info wide label="Przekazanie dla sprzątania" value={debrief.cleaningHandoff}/></div></Panel>;
}

function Payments({ booking, commission, payout }: { booking: Booking; commission: number; payout: number }) {
  const { data, addPayment } = useAppStore();
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<PaymentTransaction["type"]>("Wpłata");
  const payments = data.payments.filter((item) => item.bookingId === booking.id).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const finance = calculateBookingFinance(booking, payments);
  const isOta = ["Booking", "Airbnb", "Agoda", "Expedia", "VRBO", "Slowhop", "Aloha Camp"].includes(booking.platform);
  const balanceLabel = finance.balanceStatus === "overpaid" ? "Nadpłata" : finance.balanceStatus === "unavailable" ? "Saldo" : "Pozostało";
  const balanceValue = finance.balanceStatus === "overpaid" ? finance.overpayment : finance.amountDue;
  const balanceNote = finance.balanceStatus === "settled" ? "rezerwacja rozliczona" : finance.balanceStatus === "unavailable" ? "brak danych do obliczenia" : finance.balanceStatus === "overpaid" ? `saldo surowe ${money(finance.balance ?? undefined, finance.currency ?? undefined)}` : "do zapłaty przez gościa";
  function save() {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return;
    addPayment({ id: `PAY-${Date.now()}`, bookingId: booking.id, occurredAt: todayInPoland(), type, amount: value, currency: booking.currency ?? "PLN", status: "Zaksięgowana", method: booking.paymentMethod, note: `Dodano w panelu ${booking.platform}` });
    setAmount("");
  }
  return <div className="grid gap-5 lg:grid-cols-3">
    <Metric label="Wartość pobytu" value={money(finance.bookingValue ?? undefined, finance.currency ?? undefined)} note="uzgodniona wartość rezerwacji"/>
    <Metric label="Wpłacono od gościa" value={money(finance.guestPaidNet, finance.currency ?? undefined)} note={`wpłaty i zaliczki ${money(finance.guestPayments, finance.currency ?? undefined)} · zwroty ${money(finance.guestRefunds, finance.currency ?? undefined)}`}/>
    <Metric label={balanceLabel} value={money(balanceValue ?? undefined, finance.currency ?? undefined)} note={balanceNote}/>
    {finance.perspectives.receivables.completeness !== "complete" ? <div className="rounded-2xl border border-[#ecd39b] bg-[#fbf0d3] p-4 text-xs font-bold leading-5 text-[#745815] lg:col-span-3"><p className="font-black">Rozliczenie jest {finance.perspectives.receivables.completeness === "unavailable" ? "niedostępne" : "częściowe"}.</p><p className="mt-1">{finance.issues.slice(0, 4).map((issue) => financeIssueLabel(issue.code)).join(" ")}</p></div> : null}
    {booking.openingPaidAmount != null ? <div className="rounded-2xl border border-[#d9d1c1] bg-[#f3f0e8] p-4 text-xs leading-5 text-[#596a62] lg:col-span-3"><strong className="font-black text-[#304d40]">Saldo otwarcia: {money(finance.openingPaid, finance.currency ?? undefined)}.</strong> Źródło: {finance.openingPaidSource ?? "nie zapisano"}.</div> : null}
    {isOta ? <Panel className="lg:col-span-3" title="Rozliczenie kanału OTA" eyebrow="Poza saldem gościa"><div className="grid gap-3 sm:grid-cols-2"><Info label="Prowizja OTA" value={money(commission, booking.currency)}/><Info label="Wypłata OTA" value={money(payout, booking.currency)}/></div><p className="mt-3 text-xs leading-5 text-[#6d7972]">Prowizja, wypłata OTA i koszty nie zmieniają kwoty wpłaconej przez gościa.</p></Panel> : <div className="rounded-2xl border border-[#cddbc8] bg-[#edf3e8] p-4 text-sm font-bold text-[#356048] lg:col-span-3">Rezerwacja direct — brak prowizji OTA jest prawidłowym stanem.</div>}
    <Panel className="lg:col-span-3" title="Dodaj transakcję" eyebrow="Ledger"><div className="grid gap-3 sm:grid-cols-[180px_1fr_auto]"><select aria-label="Typ transakcji" className={inputClass} value={type} onChange={(event) => setType(event.target.value as PaymentTransaction["type"])}>{["Wpłata","Zaliczka","Zwrot","Prowizja","Wypłata OTA","Koszt"].map((item) => <option key={item}>{item}</option>)}</select><input aria-label={`Kwota transakcji w ${booking.currency ?? "PLN"}`} className={inputClass} min="0.01" step="0.01" type="number" placeholder={`Kwota ${booking.currency ?? "PLN"}`} value={amount} onChange={(event) => setAmount(event.target.value)}/><Button onClick={save}>Zaksięguj</Button></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="text-[10px] font-black uppercase tracking-[.13em] text-[#7a857e]"><tr><th className="pb-3">Data</th><th className="pb-3">Typ</th><th className="pb-3">Status</th><th className="pb-3">Notatka</th><th className="pb-3 text-right">Kwota</th></tr></thead><tbody>{payments.map((item) => <tr className="border-t border-[#e8e1d5]" key={item.id}><td className="py-4">{shortDate(item.occurredAt)}</td><td className="py-4 font-bold">{item.type}</td><td className="py-4"><Badge tone={item.status === "Zaksięgowana" ? "good" : "warn"}>{item.status}</Badge></td><td className="py-4 text-xs text-[#6d7972]">{item.note || "—"}</td><td className="py-4 text-right font-black">{money(item.amount, item.currency ?? booking.currency)}</td></tr>)}{!payments.length ? <tr><td className="border-t py-6 text-center text-sm text-[#6d7972]" colSpan={5}>Brak transakcji. Status rezerwacji nie jest traktowany jako dowód wpłaty.</td></tr> : null}</tbody></table></div></Panel>
  </div>;
}

function Messages({ booking }: { booking: Booking }) {
  const { data, addMessage, updateScheduledMessage } = useAppStore();
  const [body, setBody] = useState("");
  const messages = data.messages.filter((item) => item.bookingId === booking.id).sort((a,b) => a.createdAt.localeCompare(b.createdAt));
  const scheduled = data.scheduledMessages.filter((item) => item.bookingId === booking.id).sort((a,b) => a.dueAt.localeCompare(b.dueAt));
  function draft() { if (!body.trim()) return; const message: MessageRecord = { id: `MSG-${Date.now()}`, bookingId: booking.id, channel: "Notatka", direction: "Wychodząca", body: body.trim(), status: "Wersja robocza", createdAt: new Date().toISOString() }; addMessage(message); setBody(""); }
  return <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px]"><Panel title="Oś komunikacji" eyebrow={booking.platform}><div className="grid gap-3">{messages.map((item) => <div className={`max-w-[85%] rounded-2xl p-4 text-sm leading-6 ${item.direction === "Wychodząca" ? "ml-auto rounded-tr-sm bg-[#174d3b] text-white" : "rounded-tl-sm bg-[#eeebe3]"}`} key={item.id}><p>{item.body}</p><p className="mt-1 text-[10px] opacity-65">{item.channel} · {item.status}</p></div>)}{!messages.length ? <p className="rounded-xl bg-[#f2efe7] p-4 text-sm text-[#66736c]">Brak wysłanych wiadomości. Zaplanowane szkice są widoczne obok.</p> : null}</div><div className="mt-5 flex gap-2"><input className={inputClass} placeholder="Wewnętrzna notatka…" value={body} onChange={(event) => setBody(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") draft(); }}/><Button aria-label="Zapisz notatkę" onClick={draft}><Icon className="size-4" name="arrow"/></Button></div></Panel><Panel title="Zaplanowane szkice" eyebrow={`${scheduled.filter((item) => item.status === "Wersja robocza").length} do zatwierdzenia`}><div className="grid gap-3">{scheduled.map((message) => <ScheduledMessageCard key={message.id} message={message} templateName={data.messageTemplates.find((item) => item.id === message.templateId)?.name ?? "Wiadomość"} onChange={updateScheduledMessage}/>)}{!scheduled.length ? <p className="rounded-xl bg-white p-4 text-xs leading-5 text-[#6b7771]">Brak reguł pasujących do tej rezerwacji.</p> : null}</div><p className="mt-4 text-xs leading-5 text-[#6b7771]">Tryb draft-first: zatwierdzenie zamraża odbiorcę i treść. Istotna zmiana rezerwacji cofnie zatwierdzenie.</p></Panel></div>;
}

function ScheduledMessageCard({ message, templateName, onChange }: { message: ScheduledMessage; templateName: string; onChange: (message: ScheduledMessage) => void }) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(message.renderedBody);
  const terminal = ["Wysłana", "Dostarczona", "Anulowana"].includes(message.status);
  function approve() { onChange({ ...message, renderedBody: body, status: "Zatwierdzona", approvedAt: new Date().toISOString(), blockedReason: undefined }); setEditing(false); }
  function saveDraft() { onChange({ ...message, renderedBody: body, status: "Wersja robocza", approvedAt: undefined }); setEditing(false); }
  return <article className="rounded-2xl border border-[#dfd8cb] bg-white p-3.5"><div className="flex items-start justify-between gap-2"><div><p className="text-xs font-black leading-5">{templateName}</p><p className="mt-0.5 text-[10px] font-semibold text-[#758079]">{message.dueAt.slice(0, 10)} · {message.dueAt.slice(11, 16)} · {message.channel}</p></div><Badge tone={message.status === "Zatwierdzona" ? "good" : message.status === "Wymaga sprawdzenia" || message.status === "Błąd" ? "bad" : message.status === "Anulowana" ? "neutral" : "warn"}>{message.status}</Badge></div>{editing ? <textarea className={`${inputClass} mt-3 min-h-32 text-xs leading-5`} value={body} onChange={(event) => setBody(event.target.value)}/> : <p className="mt-3 line-clamp-4 whitespace-pre-line text-xs leading-5 text-[#566860]">{message.renderedBody}</p>}<p className={`mt-2 text-[10px] font-bold ${message.blockedReason ? "text-[#9a402a]" : "text-[#768079]"}`}>{message.blockedReason || message.recipient || "Odbiorca zostanie ustalony"}</p>{!terminal ? <div className="mt-3 flex flex-wrap gap-2">{editing ? <Button className="min-h-8 py-1 text-xs" variant="secondary" onClick={saveDraft}>Zapisz szkic</Button> : <Button className="min-h-8 py-1 text-xs" variant="secondary" onClick={() => setEditing(true)}>Edytuj</Button>}{message.status !== "Zatwierdzona" ? <Button className="min-h-8 py-1 text-xs" disabled={Boolean(message.blockedReason)} onClick={approve}>Zatwierdź</Button> : null}<button className="ml-auto text-[10px] font-black text-[#93432f]" onClick={() => onChange({ ...message, status: "Anulowana", approvedAt: undefined })}>Anuluj</button></div> : null}</article>;
}

function Tasks({ tasks, updateTask }: { tasks: ReturnType<typeof useAppStore>["data"]["tasks"]; updateTask: ReturnType<typeof useAppStore>["updateTask"] }) { return <div className="grid gap-3">{tasks.map((task) => <div className="flex flex-col gap-3 rounded-2xl border border-[#e0d9cc] bg-white p-4 sm:flex-row sm:items-center" key={task.id}><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${task.status === "Zrobione" ? "bg-[#dfeede] text-[#2b6646]" : "bg-[#f7e8c9] text-[#806118]"}`}><Icon className="size-5" name={task.status === "Zrobione" ? "check" : "clock"}/></span><div className="flex-1"><p className="text-sm font-black">{task.title}</p><p className="mt-1 text-xs text-[#6b7771]">{task.type} · {task.owner}{task.dueDate ? ` · ${shortDate(task.dueDate)}` : ""}</p></div><Badge tone={task.status === "Zrobione" ? "good" : task.priority === "Wysoki" ? "warn" : "neutral"}>{task.status}</Badge>{task.status !== "Zrobione" ? <Button variant="secondary" onClick={() => updateTask({ ...task, status: "Zrobione", completedAt: todayInPoland() })}>Gotowe</Button> : null}</div>)}</div>; }

function History({ booking, imported }: { booking: Booking; imported: boolean }) { const {data}=useAppStore(); const audits=data.auditLog.filter((item)=>item.entityId===booking.id); const events = [...audits.map((item)=>({title:item.summary,body:`${item.actor} · ${item.action}`,date:item.createdAt.slice(0,10)})), { title: "Rezerwacja utworzona", body: `${booking.platform} · ${booking.createdBy}`, date: booking.bookingDate }, ...(imported ? [{ title: "Połączono dane OTA", body: "Rekord ma dopasowany import platformy", date: booking.bookingDate }] : [])]; return <div className="relative ml-3 border-l border-[#cfc7b8] pl-7">{events.map((event, index) => <div className="relative pb-7" key={`${event.title}-${index}`}><span className="absolute -left-[33px] top-0 grid size-3 rounded-full border-[3px] border-[#fffdf8] bg-[#4e8a66]"/><p className="text-sm font-black">{event.title}</p><p className="mt-1 text-xs text-[#6b7771]">{event.body}</p><p className="mt-1 text-[10px] font-black uppercase tracking-[.12em] text-[#8b938e]">{shortDate(event.date)}</p></div>)}</div>; }

function DataPoint({ icon, label, value, sub }: { icon: IconName; label: string; value: string; sub: string }) { return <div className="flex items-center gap-3 rounded-2xl border border-[#e1dace] bg-white p-3.5"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#edf0e4] text-[#466952]"><Icon className="size-[18px]" name={icon}/></span><div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[.14em] text-[#7c867f]">{label}</p><p className="truncate text-sm font-black">{value}</p><p className="text-[11px] text-[#727c76]">{sub}</p></div></div>; }
function Panel({ title, eyebrow, children, className = "" }: { title: string; eyebrow: string; children: React.ReactNode; className?: string }) { return <section className={`rounded-2xl border border-[#ded7ca] bg-[#faf8f3] p-4 sm:p-5 ${className}`}><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#7d8b4d]">{eyebrow}</p><h3 className="mb-4 mt-0.5 font-display text-xl font-semibold">{title}</h3>{children}</section>; }
function Info({ label, value, wide = false }: { label: string; value?: string | number; wide?: boolean }) { return <div className={`rounded-xl bg-white p-3.5 ${wide ? "sm:col-span-2" : ""}`}><p className="text-[9px] font-black uppercase tracking-[.13em] text-[#828b86]">{label}</p><p className={`mt-1 text-sm font-bold leading-5 ${value === undefined || value === "" ? "text-[#8b938e]" : ""}`}>{value === undefined || value === "" ? "Nie zebrano" : value}</p></div>; }
function StatusLine({ label, value, ok }: { label: string; value: string; ok: boolean }) { return <div className="flex items-center justify-between gap-3 rounded-xl bg-white p-3"><span className="text-xs font-semibold text-[#68756e]">{label}</span><span className="flex items-center gap-1.5 text-xs font-black"><span className={`size-2 rounded-full ${ok ? "bg-[#4d986b]" : "bg-[#d6a643]"}`}/>{value}</span></div>; }
function Metric({ label, value, note }: { label: string; value: string; note: string }) { return <div className="rounded-2xl border border-[#ded7ca] bg-white p-5"><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#7b857f]">{label}</p><p className="mt-2 font-display text-3xl font-semibold">{value}</p><p className="mt-1 text-xs text-[#6d7972]">{note}</p></div>; }
