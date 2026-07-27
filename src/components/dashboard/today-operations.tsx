"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/primitives";
import { Icon, type IconName } from "@/components/ui/icons";
import type { TodayAgendaEvent, TodayUnitState } from "@/lib/workflow/today-agenda";

const eventIcons: Record<TodayAgendaEvent["kind"], IconName> = {
  Wyjazd: "arrow",
  Turnover: "cleaning",
  Przyjazd: "home",
  Wiadomość: "message",
  Zadanie: "check",
};

function statusTone(state: TodayUnitState["state"]): "good" | "warn" | "bad" | "lake" {
  if (state === "Gotowy") return "good";
  if (state === "Goście") return "lake";
  if (state === "Zablokowany usterką") return "bad";
  return "warn";
}

function channelTone(channel?: TodayAgendaEvent["channel"]): "neutral" | "good" | "bad" | "lake" {
  if (channel === "Booking") return "lake";
  if (channel === "Airbnb") return "bad";
  if (channel === "Bezpośrednio" || channel === "Telefon") return "good";
  return "neutral";
}

export function TodayOperations({
  events,
  units,
  onOpenDeparture,
}: {
  events: TodayAgendaEvent[];
  units: TodayUnitState[];
  onOpenDeparture: (bookingId: string) => void;
}) {
  return (
    <section aria-labelledby="today-operations-title" className="animate-rise-2 overflow-hidden rounded-[24px] border border-[#cdd8c4] bg-[#fffdf8] shadow-[0_18px_55px_rgba(38,53,45,.08)]">
      <header className="border-b border-[#dfe5da] bg-[linear-gradient(120deg,#eef3e5,#fffaf0)] p-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[.18em] text-[#677b49]">Plan operacyjny</p>
        <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-[-.03em]" id="today-operations-title">Dzisiaj, krok po kroku</h2>
            <p className="mt-1 text-base leading-6 text-[#5d6c65]">Przyjazdy, wyjazdy, przygotowanie domków i komunikacja w jednej kolejności.</p>
          </div>
          <Link className="inline-flex min-h-11 items-center gap-2 text-sm font-black text-[#245d49]" href="/calendar">Otwórz kalendarz <Icon className="size-4" name="arrow"/></Link>
        </div>
      </header>

      <div className="grid gap-3 border-b border-[#e3e7df] bg-[#f8f6f0] p-4 sm:grid-cols-2 sm:p-5">
        {units.map((unit) => (
          <article className={`rounded-2xl border bg-white p-4 ${unit.sameDayTurnover?.risky ? "border-[#df9f82] shadow-[0_8px_24px_rgba(168,74,46,.08)]" : "border-[#ded8cc]"}`} key={unit.unitId}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-black">{unit.unitName}</p>
                <p className="mt-0.5 text-sm text-[#63716a]">{unit.currentGuest ? `Teraz: ${unit.currentGuest}` : "Brak gości na miejscu"}</p>
              </div>
              <Badge tone={statusTone(unit.state)}>{unit.state}</Badge>
            </div>
            <div className="mt-4 grid gap-2 text-sm">
              <p className="flex items-center gap-2 font-bold text-[#455a51]"><Icon className="size-4 text-[#74824f]" name="calendar"/>{unit.nextChange}</p>
              {unit.sameDayTurnover ? <p className={`flex items-center gap-2 rounded-xl px-3 py-2 font-black ${unit.sameDayTurnover.risky ? "bg-[#f9e2d8] text-[#8e3d28]" : "bg-[#e5efe1] text-[#2c6141]"}`}><Icon className="size-4" name={unit.sameDayTurnover.risky ? "warning" : "clock"}/>Turnover tego samego dnia · {unit.sameDayTurnover.windowLabel}</p> : null}
              {unit.blocker ? <Link className="flex items-start gap-2 rounded-xl bg-[#f9e2d8] px-3 py-2 font-bold text-[#8e3d28] transition hover:bg-[#f5d4c7] focus-visible:ring-2 focus-visible:ring-[#8e3d28]" href={unit.blocker.href}><Icon className="mt-0.5 size-4 shrink-0" name="warning"/><span className="min-w-0 flex-1">Blokada: {unit.blocker.label}<span className="mt-1 block text-xs font-black underline underline-offset-2">{unit.blocker.actionLabel} →</span></span></Link> : null}
            </div>
          </article>
        ))}
      </div>

      <ol aria-label="Chronologiczna agenda dnia" className="divide-y divide-[#ebe6dc]">
        {events.map((event) => {
          const content = (
            <>
              <span className="w-20 shrink-0 font-display text-lg font-semibold tabular-nums text-[#18332c]">{event.time}</span>
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#edf1e5] text-[#3c654a]"><Icon className={`size-5 ${event.kind === "Wyjazd" ? "rotate-180" : ""}`} name={eventIcons[event.kind]}/></span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <Badge>{event.kind}</Badge>
                  <Badge tone={channelTone(event.channel)}>{event.channel ?? "Bez kanału"}</Badge>
                  <span className="text-xs font-bold text-[#738078]">{event.status}</span>
                </span>
                <span className="mt-1 block text-base font-black">{event.title}</span>
                <span className="block text-sm text-[#66736c]">{event.detail}</span>
              </span>
              <span className="col-start-3 mt-1 inline-flex items-center gap-1 text-sm font-black text-[#2b6752] sm:col-auto sm:mt-0 sm:shrink-0">{event.actionLabel}<Icon className="size-4" name="chevron"/></span>
            </>
          );
          const className = "grid min-h-20 w-full grid-cols-[5rem_2.5rem_minmax(0,1fr)] items-center gap-3 px-4 py-3 text-left transition hover:bg-[#f6f3ec] focus-visible:bg-[#f6f3ec] sm:flex sm:px-6";
          return (
            <li key={event.id}>
              {event.kind === "Wyjazd" && event.bookingId ? (
                <button className={className} onClick={() => onOpenDeparture(event.bookingId!)}>{content}</button>
              ) : event.href ? (
                <Link className={className} href={event.href}>{content}</Link>
              ) : (
                <div className={className}>{content}</div>
              )}
            </li>
          );
        })}
        {!events.length ? <li className="p-8 text-center text-sm font-bold text-[#65736d]">Brak zaplanowanych akcji na dzisiaj.</li> : null}
      </ol>
    </section>
  );
}
