"use client";

import Link from "next/link";
import { useAppStore } from "@/components/layout/app-store";
import { Badge, Card } from "@/components/ui/primitives";
import { Icon, type IconName } from "@/components/ui/icons";
import { dashboardMetrics, nightsBetween, unitName } from "@/lib/workflow/rules";
import type { Booking, OpsTask } from "@/lib/types";
import { todayInPoland } from "@/lib/date";

function isoToday() { return todayInPoland(); }
function formatDay(date?: string) { if (!date) return "—"; return new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00`)); }
function money(value: number) { return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", maximumFractionDigits: 0 }).format(value); }

export function DashboardView() {
  const { data, updateTask } = useAppStore();
  const today = isoToday();
  const metrics = dashboardMetrics(data);
  const active = data.bookings.filter((booking) => booking.workflowStatus !== "Anulowana" && booking.checkIn <= today && booking.checkOut > today);
  const arrivals = data.bookings.filter((booking) => booking.workflowStatus !== "Anulowana" && booking.checkIn >= today).sort((a, b) => a.checkIn.localeCompare(b.checkIn)).slice(0, 4);
  const departures = data.bookings.filter((booking) => booking.workflowStatus !== "Anulowana" && booking.checkOut >= today).sort((a, b) => a.checkOut.localeCompare(b.checkOut)).slice(0, 4);
  const openTasks = data.tasks.filter((task) => !["Zrobione", "Nie dotyczy"].includes(task.status));
  const priorityTasks = [...openTasks].sort((a, b) => (a.priority === "Wysoki" ? -1 : b.priority === "Wysoki" ? 1 : 0)).slice(0, 4);
  const pendingPayments = data.bookings.filter((booking) => ["Do uzupełnienia", "Do dopłaty", "Częściowo"].includes(booking.paymentStatus));
  const monthPrefix = today.slice(0,7);
  const monthNights = data.bookings.filter((booking)=>booking.workflowStatus!=="Anulowana" && (booking.checkIn.startsWith(monthPrefix)||booking.checkOut.startsWith(monthPrefix))).reduce((sum,booking)=>sum+nightsBetween(booking.checkIn,booking.checkOut),0);
  const daysInMonth = new Date(Number(today.slice(0,4)),Number(today.slice(5,7)),0).getDate();
  const occupancy = Math.min(100,Math.round((monthNights/Math.max(1,daysInMonth*data.units.length))*100));
  const urgentCount=priorityTasks.filter((task)=>task.priority==="Wysoki").length;

  return (
    <div className="grid gap-5">
      <section className="animate-rise-2 relative overflow-hidden rounded-[24px] bg-[#123d30] text-white shadow-[0_24px_60px_rgba(18,61,48,.18)]">
        <div className="absolute -right-16 -top-24 size-72 rounded-full border-[42px] border-white/[.035]" />
        <div className="absolute bottom-0 right-0 h-28 w-2/5 bg-[radial-gradient(ellipse_at_bottom_right,rgba(155,172,96,.32),transparent_70%)]" />
        <div className="relative grid gap-8 p-5 sm:p-7 xl:grid-cols-[1.2fr_.8fr] xl:items-end">
          <div>
            <div className="mb-5 flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[.14em] text-[#dbe5bb]"><Icon className="size-3.5" name="spark" />Brief operacyjny</span><span className="text-xs text-white/60">na podstawie aktualnych danych</span></div>
            <h2 className="max-w-3xl font-display text-[34px] font-semibold leading-[1.04] tracking-[-.035em] sm:text-[46px]">{active.length?`${active.length} ${active.length===1?"pobyt trwa":"pobyty trwają"}.`:"Domki są dziś wolne."} <span className="text-[#d3df9a]">{urgentCount?`${urgentCount} pilne ${urgentCount===1?"zadanie wymaga":"zadania wymagają"} uwagi.`:"Brak pilnych zadań."}</span></h2>
            <p className="mt-4 max-w-2xl text-sm font-medium leading-6 text-white/70">{arrivals[0]?`Najbliższy przyjazd: ${formatDay(arrivals[0].checkIn)}, ${unitName(data.units,arrivals[0].unitId)}.`:"Brak kolejnego przyjazdu w kalendarzu."} {pendingPayments.length?`${pendingPayments.length} rezerwacji wymaga sprawdzenia rozliczenia.`:"Wszystkie statusy płatności są oznaczone jako uzgodnione."}</p>
            <div className="mt-6 flex flex-wrap gap-2"><Link className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#f2c25e] px-4 text-sm font-black text-[#18332c] transition hover:bg-[#f7d47e]" href="/bookings">Przejdź do rezerwacji <Icon className="size-4" name="arrow" /></Link><Link className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/[.07] px-4 text-sm font-bold text-white transition hover:bg-white/[.12]" href="/tasks">Zobacz plan operacji</Link></div>
          </div>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10">
            <HeroStat icon="home" label="Goście na miejscu" value={active.length} note={`${active.reduce((sum, b) => sum + b.adults + b.children, 0)} osób`} />
            <HeroStat icon="calendar" label="Najbliższy przyjazd" value={arrivals[0] ? formatDay(arrivals[0].checkIn) : "—"} note={arrivals[0] ? unitName(data.units, arrivals[0].unitId) : "brak"} />
            <HeroStat icon="cleaning" label="Otwarte zadania" value={openTasks.length} note={`${priorityTasks.filter((t) => t.priority === "Wysoki").length} pilne`} />
            <HeroStat icon="wallet" label="Do rozliczenia" value={pendingPayments.length} note="rezerwacje" />
          </div>
        </div>
      </section>

      <section className="animate-rise-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <PulseCard label="Obłożenie w tym miesiącu" value={`${occupancy}%`} change={`${monthNights} zajętych dób`} tone="moss" />
        <PulseCard label="Przychód potwierdzony" value={money(metrics.revenue)} change={`${money(metrics.averageNightPrice)} / noc`} tone="lake" />
        <PulseCard label="Rezerwacje direct" value={`${metrics.directShare}%`} change="cel: 30%" tone="sun" />
        <PulseCard label="Jakość danych" value={`${metrics.dataQuality}%`} change={`${metrics.missingMarketingFields} pól do uzupełnienia`} tone="coral" />
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <Card className="animate-rise-2 overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#e5ded1] p-5 sm:p-6"><div><p className="text-[11px] font-black uppercase tracking-[.18em] text-[#7d8d4c]">Rytm najbliższych dni</p><h2 className="font-display text-2xl font-semibold">Pobyty i zmiany</h2></div><Link className="inline-flex items-center gap-1 text-sm font-black text-[#24655a]" href="/calendar">Pełny kalendarz <Icon className="size-4" name="arrow" /></Link></div>
          <div className="grid gap-0 lg:grid-cols-2">
            <ScheduleColumn label="Przyjazdy" icon="arrow" bookings={arrivals} dateKey="checkIn" data={data} />
            <ScheduleColumn label="Wyjazdy" icon="arrow" bookings={departures} dateKey="checkOut" data={data} reverse />
          </div>
        </Card>

        <Card className="animate-rise-3 overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#e5ded1] p-5 sm:p-6"><div><p className="text-[11px] font-black uppercase tracking-[.18em] text-[#7d8d4c]">Centrum akcji</p><h2 className="font-display text-2xl font-semibold">Do zrobienia</h2></div><Badge tone={priorityTasks.length ? "warn" : "good"}>{openTasks.length} otwartych</Badge></div>
          <div className="grid gap-2 p-3 sm:p-4">
            {priorityTasks.map((task) => <ActionItem key={task.id} task={task} onDone={() => updateTask({ ...task, status: "Zrobione", completedAt: today })} />)}
            {!priorityTasks.length ? <p className="p-6 text-center text-sm font-bold text-[#65736d]">Wszystko zrobione. Dobry dzień.</p> : null}
          </div>
          <div className="border-t border-[#e5ded1] p-4"><Link className="flex items-center justify-center gap-2 rounded-xl bg-[#f1eee6] py-2.5 text-sm font-black text-[#355248]" href="/tasks">Otwórz wszystkie zadania <Icon className="size-4" name="arrow" /></Link></div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-[#e5ded1] p-5 sm:p-6"><p className="text-[11px] font-black uppercase tracking-[.18em] text-[#7d8d4c]">Stan obiektu</p><h2 className="font-display text-2xl font-semibold">Domki</h2></div>
          <div className="grid gap-3 p-4">
            {data.units.map((unit) => {
              const stay = active.find((item) => item.unitId === unit.id);
              const next = arrivals.find((item) => item.unitId === unit.id);
              return <div className="rounded-2xl border border-[#e1dace] bg-white p-4" key={unit.id}><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><span className={`grid size-10 place-items-center rounded-xl ${stay ? "bg-[#dcebe4] text-[#24644d]" : "bg-[#eeeae1] text-[#67726c]"}`}><Icon className="size-5" name="home" /></span><div><p className="font-black">{unit.name}</p><p className="text-xs text-[#6b7771]">{stay ? `Zajęty do ${formatDay(stay.checkOut)}` : "Wolny i gotowy"}</p></div></div><Badge tone={stay ? "lake" : "good"}>{stay ? "Goście" : "Czysty"}</Badge></div>{next ? <div className="mt-3 flex items-center gap-2 border-t border-[#eee8dd] pt-3 text-xs font-semibold text-[#5f6e67]"><Icon className="size-3.5" name="calendar" />Następny: {formatDay(next.checkIn)} · {next.adults + next.children} os.</div> : null}</div>;
            })}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-start justify-between border-b border-[#e5ded1] p-5 sm:p-6"><div><p className="text-[11px] font-black uppercase tracking-[.18em] text-[#7d8d4c]">Bezpieczeństwo sprzedaży</p><h2 className="font-display text-2xl font-semibold">Kanały i synchronizacja</h2></div><span className="inline-flex items-center gap-2 text-xs font-black text-[#6f5b20]"><span className="size-2 rounded-full bg-[#d6a643]" />{data.sourceConnections.some((item)=>item.status==="Aktywne")?"Częściowo aktywne":"Do konfiguracji"}</span></div>
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            {data.sourceConnections.map((source) => <div className="relative overflow-hidden rounded-2xl border border-[#ded7ca] bg-white p-4" key={source.id}><div className="flex items-start justify-between"><div><p className="font-display text-xl font-semibold">{source.platform}</p><p className="text-xs font-semibold text-[#748078]">{source.connectionType} · pokrycie {source.coverage}%</p></div><Badge tone={source.status === "Aktywne" ? "good" : "warn"}>{source.status}</Badge></div><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#eae5dc]"><div className={`h-full rounded-full ${source.coverage > 70 ? "bg-[#4b9471]" : "bg-[#d6a643]"}`} style={{ width: `${source.coverage}%` }} /></div><p className="mt-3 text-xs leading-5 text-[#64716b]">{source.nextStep}</p></div>)}
          </div>
          <div className="mx-4 mb-4 flex flex-col gap-3 rounded-2xl bg-[#edf2e5] p-4 sm:flex-row sm:items-center"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#174d3b] text-white"><Icon className="size-5" name="spark" /></span><div className="flex-1"><p className="text-sm font-black">Kontrola dostępności</p><p className="text-xs leading-5 text-[#637068]">Kalendarz pokazuje rzeczywiste rezerwacje i blokady. Rekomendacje cenowe pozostają wyłączone, dopóki stawki sezonowe i koszty nie będą kompletne.</p></div><Link className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[#cec6b7] bg-white px-4 text-sm font-bold" href="/calendar">Sprawdź kalendarz</Link></div>
        </Card>
      </div>
    </div>
  );
}

function HeroStat({ icon, label, value, note }: { icon: IconName; label: string; value: string | number; note: string }) {
  return <div className="bg-[#143f33]/90 p-4 sm:p-5"><div className="flex items-center gap-2 text-white/55"><Icon className="size-4" name={icon} /><span className="text-[10px] font-black uppercase tracking-[.13em]">{label}</span></div><p className="mt-3 font-display text-3xl font-semibold">{value}</p><p className="mt-0.5 text-xs text-white/50">{note}</p></div>;
}

function PulseCard({ label, value, change, tone }: { label: string; value: string; change: string; tone: "moss" | "lake" | "sun" | "coral" }) {
  const tones = { moss: "before:bg-[#9bac60]", lake: "before:bg-[#317a78]", sun: "before:bg-[#f0be55]", coral: "before:bg-[#e86e4e]" };
  return <div className={`relative overflow-hidden rounded-[18px] border border-[#d9d1c1] bg-[#fffdf8] p-5 shadow-[0_12px_35px_rgba(38,53,45,.05)] before:absolute before:inset-y-0 before:left-0 before:w-1 ${tones[tone]}`}><p className="text-[11px] font-black uppercase tracking-[.13em] text-[#77817c]">{label}</p><p className="mt-2 font-display text-[30px] font-semibold leading-none tracking-[-.035em]">{value}</p><p className="mt-2 text-xs font-semibold text-[#64726c]">{change}</p></div>;
}

function ScheduleColumn({ label, icon, bookings, dateKey, data, reverse = false }: { label: string; icon: IconName; bookings: Booking[]; dateKey: "checkIn" | "checkOut"; data: ReturnType<typeof useAppStore>["data"]; reverse?: boolean }) {
  return <div className={`p-4 sm:p-5 ${reverse ? "border-t border-[#e5ded1] lg:border-l lg:border-t-0" : ""}`}><div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-[.14em] text-[#75827a]"><Icon className={`size-4 ${reverse ? "rotate-180" : ""}`} name={icon} />{label}</div><div className="grid gap-2">{bookings.slice(0, 3).map((booking) => <Link className="group flex items-center gap-3 rounded-xl p-2.5 transition hover:bg-[#f2efe7]" href={`/bookings/${booking.id}`} key={`${dateKey}-${booking.id}`}><span className="grid size-11 shrink-0 place-items-center rounded-xl border border-[#ded7ca] bg-white text-center"><span className="font-display text-lg font-semibold leading-none">{new Date(`${booking[dateKey]}T12:00:00`).getDate()}</span><span className="text-[8px] font-black uppercase text-[#7d897f]">{new Intl.DateTimeFormat("pl-PL", { month: "short" }).format(new Date(`${booking[dateKey]}T12:00:00`)).replace(".", "")}</span></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-black">{booking.guestLabel}</span><span className="block truncate text-xs text-[#6a766f]">{unitName(data.units, booking.unitId)} · {booking.adults + booking.children} os.</span></span><Badge tone={booking.platform === "Booking" ? "lake" : booking.platform === "Airbnb" ? "bad" : "good"}>{booking.platform}</Badge></Link>)}</div></div>;
}

function ActionItem({ task, onDone }: { task: OpsTask; onDone: () => void }) {
  const icons: Partial<Record<OpsTask["type"], IconName>> = { Płatność: "wallet", Sprzątanie: "cleaning", Opinia: "message", Dane: "warning", "Przed przyjazdem": "calendar" };
  return <div className="group flex items-start gap-3 rounded-2xl border border-transparent p-3 transition hover:border-[#ded7ca] hover:bg-white"><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${task.priority === "Wysoki" ? "bg-[#fae6da] text-[#a64a2e]" : "bg-[#e7eee2] text-[#41634c]"}`}><Icon className="size-[18px]" name={icons[task.type] ?? "check"} /></span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="text-sm font-black leading-5">{task.title}</p></div><p className="mt-1 text-xs text-[#6d7972]">{task.owner}{task.dueDate ? ` · ${formatDay(task.dueDate)}` : ""}</p></div><button aria-label="Oznacz jako zrobione" className="grid size-8 shrink-0 place-items-center rounded-full border border-[#cfc8ba] text-[#78837d] opacity-60 transition hover:border-[#4f8f69] hover:bg-[#e2efe5] hover:text-[#276141] group-hover:opacity-100" onClick={onDone}><Icon className="size-4" name="check" /></button></div>;
}
