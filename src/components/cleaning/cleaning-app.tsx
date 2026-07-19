"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/ui/icons";
import type { AppIdentity } from "@/lib/auth/identity";
import type { CleaningDashboard, CleaningJob } from "@/lib/cleaning/dashboard";
import { formatPolishDate, todayInPoland } from "@/lib/date";
import { createClient } from "@/lib/supabase/client";

type ReportDraft = { taskId: string; unitName: string; title: string; description: string; category: "Bezpieczeństwo" | "Dostęp/drzwi" | "Woda" | "Prąd" | "Wyposażenie" | "Komfort" | "Inne" };

function dayLabel(date?: string) {
  if (!date) return "Termin do ustalenia";
  const today = todayInPoland();
  const tomorrow = new Date(`${today}T12:00:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowIso = tomorrow.toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" });
  if (date === today) return "Dzisiaj";
  if (date === tomorrowIso) return "Jutro";
  return formatPolishDate(date, { year: false });
}

function statusCopy(status: CleaningJob["status"]) {
  if (status === "W toku") return "W trakcie";
  if (status === "Zrobione") return "Gotowe";
  if (status === "Zablokowane") return "Problem";
  return "Do zrobienia";
}

export function CleaningApp({ identity }: { identity: AppIdentity }) {
  const [dashboard, setDashboard] = useState<CleaningDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [report, setReport] = useState<ReportDraft | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/cleaning", { cache: "no-store" });
      const result = await response.json().catch(() => ({})) as CleaningDashboard & { error?: string };
      if (!response.ok) throw new Error(result.error || "Nie udało się pobrać planu.");
      setError("");
      setDashboard(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Nie udało się pobrać planu.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/cleaning", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result = await response.json().catch(() => ({})) as CleaningDashboard & { error?: string };
        if (!response.ok) throw new Error(result.error || "Nie udało się pobrać planu.");
        return result;
      })
      .then((result) => { setDashboard(result); setError(""); })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setError(loadError instanceof Error ? loadError.message : "Nie udało się pobrać planu.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  const visibleJobs = useMemo(() => (dashboard?.jobs ?? []).filter((job) => showDone ? job.status === "Zrobione" : job.status !== "Zrobione"), [dashboard, showDone]);
  const openCount = (dashboard?.jobs ?? []).filter((job) => job.status !== "Zrobione").length;
  const todayCount = (dashboard?.jobs ?? []).filter((job) => job.status !== "Zrobione" && job.dueDate === todayInPoland()).length;

  async function mutate(payload: Record<string, unknown>, success: string) {
    const key = String(payload.itemId ?? payload.taskId ?? payload.action);
    setBusy(key);
    setError("");
    try {
      const response = await fetch("/api/cleaning", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Nie udało się zapisać zmiany.");
      setToast(success);
      window.setTimeout(() => setToast(""), 3000);
      await load();
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : "Nie udało się zapisać zmiany.");
    } finally {
      setBusy("");
    }
  }

  async function signOut() {
    const client = createClient();
    if (client) await client.auth.signOut();
    window.localStorage.clear();
    if ("caches" in window) {
      const keys = await window.caches.keys();
      await Promise.all(keys.map((key) => window.caches.delete(key)));
    }
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen bg-[#eef0e6] text-[#17372d]">
      <header className="sticky top-0 z-30 border-b border-[#d2d7c5] bg-[#f8f7f0]/95 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[68px] max-w-3xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-[14px] bg-[#174d3b] font-display font-semibold text-white shadow-[0_8px_22px_rgba(23,77,59,.2)]">SU</span>
            <div><p className="font-display text-[18px] font-semibold leading-5">Stawy u Sikory</p><p className="text-[9px] font-black uppercase tracking-[.16em] text-[#75834d]">Plan sprzątania</p></div>
          </div>
          <button className="flex min-h-11 items-center gap-2 rounded-xl border border-[#d0d4c8] bg-white px-3 text-xs font-black text-[#53645d]" onClick={signOut} type="button">
            <span className="grid size-7 place-items-center rounded-lg bg-[#e7ecdc] text-[#245541]">{identity.initials}</span>
            Wyloguj
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-12 pt-5">
        <section className="animate-rise relative overflow-hidden rounded-[26px] bg-[#174d3b] px-5 pb-5 pt-6 text-white shadow-[0_18px_50px_rgba(23,77,59,.18)]">
          <div className="absolute -right-14 -top-20 size-52 rounded-full border-[28px] border-white/[.05]" />
          <p className="relative text-[10px] font-black uppercase tracking-[.18em] text-[#cdd9a8]">{new Intl.DateTimeFormat("pl-PL", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</p>
          <h1 className="relative mt-1 font-display text-[34px] font-semibold leading-tight tracking-[-.035em]">Dzień dobry, Jadziu</h1>
          <p className="relative mt-2 max-w-lg text-sm leading-6 text-white/70">Tu jest tylko plan przygotowania domków. Bez danych gości, cen i pozostałych modułów.</p>
          <div className="relative mt-5 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-white/[.09] p-3.5"><p className="font-display text-3xl font-semibold">{todayCount}</p><p className="text-[10px] font-black uppercase tracking-[.12em] text-white/55">na dzisiaj</p></div>
            <div className="rounded-2xl bg-white/[.09] p-3.5"><p className="font-display text-3xl font-semibold">{openCount}</p><p className="text-[10px] font-black uppercase tracking-[.12em] text-white/55">łącznie otwarte</p></div>
          </div>
        </section>

        <div className="animate-rise-2 mt-5 grid grid-cols-2 gap-2 rounded-2xl border border-[#d4d8cb] bg-[#f8f7f0] p-1.5">
          <button className={`min-h-11 rounded-xl text-sm font-black transition ${!showDone ? "bg-[#174d3b] text-white shadow-sm" : "text-[#68746d]"}`} onClick={() => setShowDone(false)} type="button">Do zrobienia · {openCount}</button>
          <button className={`min-h-11 rounded-xl text-sm font-black transition ${showDone ? "bg-[#174d3b] text-white shadow-sm" : "text-[#68746d]"}`} onClick={() => setShowDone(true)} type="button">Gotowe</button>
        </div>

        {error ? <div className="mt-4 flex items-start gap-3 rounded-2xl border border-[#e7c8bd] bg-[#fff2ed] p-4 text-sm font-bold text-[#8f402c]" role="alert"><Icon className="mt-0.5 size-5 shrink-0" name="warning"/><span className="flex-1">{error}</span><button className="underline" onClick={() => void load()} type="button">Ponów</button></div> : null}

        {loading ? <div className="mt-5 grid gap-3" aria-label="Pobieram zadania"><div className="h-52 animate-pulse rounded-[22px] bg-white/70"/><div className="h-52 animate-pulse rounded-[22px] bg-white/70"/></div> : null}

        {!loading ? <div className="animate-rise-3 mt-5 grid gap-4">{visibleJobs.map((job) => <JobCard busy={busy} job={job} key={job.id} onMutate={mutate} onReport={() => setReport({ taskId: job.id, unitName: job.unit.name, title: "", description: "", category: "Inne" })}/>)}</div> : null}

        {!loading && !visibleJobs.length ? <section className="mt-5 rounded-[24px] border border-[#d4d8cb] bg-[#fffdf8] p-8 text-center"><span className="mx-auto grid size-14 place-items-center rounded-full bg-[#dfebdc] text-[#34704f]"><Icon className="size-7" name="check"/></span><h2 className="mt-4 font-display text-2xl font-semibold">{showDone ? "Brak ukończonych zadań" : "Wszystko przygotowane"}</h2><p className="mt-2 text-sm text-[#68756f]">{showDone ? "Ukończone sprzątania pojawią się tutaj." : "Nie ma teraz żadnego otwartego sprzątania."}</p></section> : null}
      </main>

      {report ? <ReportDialog busy={Boolean(busy)} draft={report} onChange={setReport} onClose={() => setReport(null)} onSubmit={async () => { await mutate({ action: "report", taskId: report.taskId, title: report.title, description: report.description, category: report.category }, "Problem zgłoszony właścicielowi."); setReport(null); }}/>: null}
      {toast ? <div className="fixed bottom-5 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-2xl bg-[#17372d] px-4 py-3.5 text-sm font-bold text-white shadow-2xl" role="status"><span className="grid size-7 place-items-center rounded-full bg-[#559169]"><Icon className="size-4" name="check"/></span>{toast}</div> : null}
    </div>
  );
}

function JobCard({ job, busy, onMutate, onReport }: { job: CleaningJob; busy: string; onMutate: (payload: Record<string, unknown>, success: string) => Promise<void>; onReport: () => void }) {
  const checklistDone = job.checklist.length > 0 && job.checklist.every((item) => item.done);
  const isBusy = Boolean(busy);
  return <article className="overflow-hidden rounded-[24px] border border-[#d4d8cb] bg-[#fffdf8] shadow-[0_12px_34px_rgba(44,63,52,.07)]">
    <div className="flex items-start justify-between gap-3 border-b border-[#e3e4db] p-5">
      <div className="flex items-center gap-3"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#e3ecdf] text-[#316449]"><Icon className="size-6" name="home"/></span><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#7a8750]">{dayLabel(job.dueDate)}</p><h2 className="font-display text-[24px] font-semibold leading-7">{job.unit.name}</h2></div></div>
      <span className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[.08em] ${job.status === "Zablokowane" ? "bg-[#f7ddd5] text-[#963e28]" : job.status === "Zrobione" ? "bg-[#dfeede] text-[#2d6849]" : job.status === "W toku" ? "bg-[#dceced] text-[#286265]" : "bg-[#f4e8c9] text-[#795b19]"}`}>{statusCopy(job.status)}</span>
    </div>

    <div className="p-5">
      <div className={`grid gap-3 rounded-2xl p-4 ${job.sameDayTurnover ? "bg-[#fff0d4]" : "bg-[#f0f1eb]"}`}>
        {job.sameDayTurnover ? <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.12em] text-[#8a5b0f]"><Icon className="size-4" name="clock"/>Sprzątanie między pobytami</p> : null}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div><p className="text-[9px] font-black uppercase tracking-[.12em] text-[#7a817c]">Można wejść od</p><p className="mt-0.5 text-lg font-black">{job.departureTime}</p></div><Icon className="size-5 text-[#89938c]" name="arrow"/><div className="text-right"><p className="text-[9px] font-black uppercase tracking-[.12em] text-[#7a817c]">Gotowe do</p><p className="mt-0.5 text-lg font-black">{job.sameDayTurnover ? job.nextArrival?.time : "bez pośpiechu"}</p></div>
        </div>
        {job.nextArrival ? <div className="flex flex-wrap gap-2 border-t border-black/[.07] pt-3 text-xs font-bold text-[#53645c]"><span className="inline-flex items-center gap-1.5"><Icon className="size-4" name="people"/>{job.nextArrival.people} {job.nextArrival.people === 1 ? "osoba" : "osoby/osób"}</span><span>· przygotuj {job.bedsToPrepare} {job.bedsToPrepare === 1 ? "miejsce" : "miejsca/miejsc"}</span>{job.bedrooms ? <span>· {job.bedrooms} {job.bedrooms === 1 ? "sypialnia" : "sypialnie"}</span> : null}</div> : <p className="border-t border-black/[.07] pt-3 text-xs font-bold text-[#647169]">Brak kolejnego przyjazdu w planie.</p>}
      </div>

      {job.handoffNote ? <div className="mt-3 rounded-2xl border-l-4 border-[#e4aa44] bg-[#fff8e8] p-4"><p className="text-[9px] font-black uppercase tracking-[.13em] text-[#8a671f]">Ważne po poprzednim pobycie</p><p className="mt-1.5 text-sm font-semibold leading-6 text-[#5f5540]">{job.handoffNote}</p></div> : null}
      {job.blocker ? <div className="mt-3 flex gap-3 rounded-2xl bg-[#fff0eb] p-4 text-sm font-bold leading-5 text-[#8f402c]"><Icon className="size-5 shrink-0" name="warning"/>{job.blocker}</div> : null}

      <div className="mt-5"><div className="mb-3 flex items-center justify-between"><h3 className="text-xs font-black uppercase tracking-[.13em] text-[#607068]">Checklista</h3><span className="text-xs font-black text-[#6f7a74]">{job.checklist.filter((item) => item.done).length}/{job.checklist.length}</span></div><div className="grid gap-2">{job.checklist.map((item) => <button aria-pressed={item.done} className={`flex min-h-12 items-center gap-3 rounded-2xl border px-3.5 text-left text-sm font-bold transition ${item.done ? "border-[#c6dcc5] bg-[#eaf3e7] text-[#356249]" : "border-[#d8d9d1] bg-white text-[#42584f]"}`} disabled={isBusy || job.status === "Zrobione"} key={item.id} onClick={() => onMutate({ action: "checklist", taskId: job.id, itemId: item.id, done: !item.done }, item.done ? "Punkt cofnięty." : "Punkt wykonany.")} type="button"><span className={`grid size-7 shrink-0 place-items-center rounded-xl border-2 ${item.done ? "border-[#4f8c67] bg-[#4f8c67] text-white" : "border-[#bcc4bc] bg-white"}`}>{item.done ? <Icon className="size-4" name="check"/> : null}</span><span className={item.done ? "line-through decoration-[#8aa08e]" : ""}>{item.label}</span></button>)}</div></div>
    </div>

    {job.status !== "Zrobione" ? <div className="grid gap-2 border-t border-[#e3e4db] bg-[#faf9f4] p-4 sm:grid-cols-[1fr_auto]">{job.status === "Do zrobienia" ? <button className="min-h-12 rounded-2xl bg-[#174d3b] px-5 text-sm font-black text-white shadow-sm disabled:opacity-50" disabled={isBusy} onClick={() => onMutate({ action: "start", taskId: job.id }, "Sprzątanie rozpoczęte.")} type="button"><span className="inline-flex items-center gap-2"><Icon className="size-4" name="clock"/>Rozpocznij sprzątanie</span></button> : null}{job.status === "W toku" ? <button className="min-h-12 rounded-2xl bg-[#174d3b] px-5 text-sm font-black text-white shadow-sm disabled:opacity-45" disabled={isBusy || !checklistDone} onClick={() => onMutate({ action: "complete", taskId: job.id }, "Domek oznaczony jako gotowy.")} title={checklistDone ? "" : "Najpierw ukończ checklistę"} type="button"><span className="inline-flex items-center gap-2"><Icon className="size-4" name="check"/>Potwierdź: domek gotowy</span></button> : null}<button className="min-h-12 rounded-2xl border border-[#d4c6bd] bg-white px-4 text-sm font-black text-[#8b432f] disabled:opacity-50" disabled={isBusy} onClick={onReport} type="button">Zgłoś problem</button>{job.status === "W toku" && !checklistDone ? <p className="text-xs font-semibold text-[#7b756b] sm:col-span-2">Zaznacz wszystkie punkty, aby potwierdzić gotowość.</p> : null}</div> : null}
  </article>;
}

function ReportDialog({ draft, busy, onChange, onClose, onSubmit }: { draft: ReportDraft; busy: boolean; onChange: (draft: ReportDraft) => void; onClose: () => void; onSubmit: () => Promise<void> }) {
  return <div className="fixed inset-0 z-50 flex items-end bg-[#102d24]/70 p-3 backdrop-blur-sm sm:items-center sm:justify-center" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form aria-label="Zgłoś problem" aria-modal="true" className="w-full max-w-lg rounded-[26px] bg-[#fffdf8] p-5 shadow-2xl" onSubmit={(event) => { event.preventDefault(); void onSubmit(); }} role="dialog"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#8a7650]">{draft.unitName}</p><h2 className="font-display text-2xl font-semibold">Zgłoś problem</h2></div><button aria-label="Zamknij" className="grid size-10 place-items-center rounded-xl border border-[#d8d4ca]" onClick={onClose} type="button"><Icon className="size-4" name="close"/></button></div><div className="mt-5 grid gap-4"><label className="grid gap-1.5 text-xs font-black text-[#52645b]">Co się stało?<input autoFocus className="min-h-12 rounded-xl border border-[#cbc8bf] bg-white px-3.5 text-sm font-semibold outline-none focus:border-[#397762]" maxLength={120} onChange={(event) => onChange({ ...draft, title: event.target.value })} placeholder="np. cieknie kran w łazience" required value={draft.title}/></label><label className="grid gap-1.5 text-xs font-black text-[#52645b]">Kategoria<select className="min-h-12 rounded-xl border border-[#cbc8bf] bg-white px-3.5 text-sm font-semibold" onChange={(event) => onChange({ ...draft, category: event.target.value as ReportDraft["category"] })} value={draft.category}>{["Inne", "Wyposażenie", "Komfort", "Woda", "Prąd", "Dostęp/drzwi", "Bezpieczeństwo"].map((category) => <option key={category}>{category}</option>)}</select></label><label className="grid gap-1.5 text-xs font-black text-[#52645b]">Dodatkowy opis <span className="font-semibold text-[#879088]">(opcjonalnie)</span><textarea className="min-h-24 rounded-xl border border-[#cbc8bf] bg-white p-3.5 text-sm font-semibold outline-none focus:border-[#397762]" maxLength={500} onChange={(event) => onChange({ ...draft, description: event.target.value })} placeholder="Gdzie dokładnie i czy blokuje przygotowanie domku?" value={draft.description}/></label></div><div className="mt-5 grid grid-cols-2 gap-2"><button className="min-h-12 rounded-2xl border border-[#d4d0c6] bg-white text-sm font-black" onClick={onClose} type="button">Anuluj</button><button className="min-h-12 rounded-2xl bg-[#9a452f] text-sm font-black text-white disabled:opacity-50" disabled={busy || draft.title.trim().length < 2} type="submit">{busy ? "Zapisuję…" : "Wyślij zgłoszenie"}</button></div></form></div>;
}
