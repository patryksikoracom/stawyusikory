"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, Field, inputClass } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icons";
import {
  canManageMinorProtectionStandard,
  type MinorProtectionExecution,
  type MinorProtectionReaction,
  type MinorProtectionStandard,
} from "@/lib/compliance/minor-protection";
import { formatPolishDate } from "@/lib/date";
import type { UserRole } from "@/lib/types";

type Stay = {
  bookingId: string;
  unitId: string;
  unitName: string;
  checkIn: string;
  checkOut: string;
  execution: MinorProtectionExecution | null;
  reaction: MinorProtectionReaction | null;
};

type Dashboard = {
  activeStandard: MinorProtectionStandard | null;
  standards: MinorProtectionStandard[];
  stays: Stay[];
};

type StandardDraft = Omit<MinorProtectionStandard, "id" | "active" | "steps"> & {
  stepsText: string;
};

const emptyDraft: StandardDraft = {
  version: "",
  approvedAt: "",
  effectiveFrom: "",
  reviewDueAt: "",
  fullDocumentUrl: "",
  childFriendlyDocumentUrl: "",
  reviewOwner: "",
  staffPreparationReference: "",
  publicationConfirmed: false,
  premisesDisplayConfirmed: false,
  stepsText: "",
};

function stayStatus(stay: Stay, standard: MinorProtectionStandard | null) {
  if (!standard) return "Brak aktywnego SOP";
  if (!stay.execution) return "Do wykonania";
  if (stay.execution.outcome === "Wymaga reakcji" && stay.reaction?.status !== "Zamknięte") {
    return "Wymaga reakcji";
  }
  return "Wykonana";
}

export function MinorProtectionPanel({ role }: { role: UserRole }) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [showStandardForm, setShowStandardForm] = useState(false);
  const [draft, setDraft] = useState<StandardDraft>(emptyDraft);
  const [resolutionReferences, setResolutionReferences] = useState<Record<string, string>>({});
  const canManage = canManageMinorProtectionStandard(role);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/minor-protection", { cache: "no-store" });
      const payload = await response.json().catch(() => ({})) as Dashboard & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Nie udało się pobrać procedury.");
      setDashboard(payload);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Nie udało się pobrać procedury.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/minor-protection", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({})) as Dashboard & { error?: string };
        if (!response.ok) throw new Error(payload.error || "Nie udało się pobrać procedury.");
        return payload;
      })
      .then((payload) => {
        setDashboard(payload);
        setError("");
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setError(loadError instanceof Error ? loadError.message : "Nie udało się pobrać procedury.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  async function mutate(payload: Record<string, unknown>, success: string) {
    setBusy(String(payload.bookingId ?? payload.action));
    setError("");
    try {
      const response = await fetch("/api/minor-protection", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Nie udało się zapisać procedury.");
      setFeedback(success);
      await load();
      return true;
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : "Nie udało się zapisać procedury.");
      return false;
    } finally {
      setBusy("");
    }
  }

  const openStays = useMemo(
    () => (dashboard?.stays ?? []).filter((stay) => stayStatus(stay, dashboard?.activeStandard ?? null) !== "Wykonana"),
    [dashboard],
  );

  if (loading) return <Card className="h-52 animate-pulse bg-white/70" aria-label="Pobieram procedurę ochrony małoletnich"/>;

  return <div className="grid min-w-0 gap-4">
    {error ? <p className="rounded-xl border border-[#e5c4ba] bg-[#fff0eb] p-3 text-sm font-bold text-[#8f402c]" role="alert">{error}</p> : null}
    {feedback ? <p className="rounded-xl bg-[#dfeede] p-3 text-sm font-bold text-[#215c3b]" role="status">{feedback}</p> : null}

    <Card className="min-w-0 overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-[#e2dbce] p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.15em] text-[#7d8b4d]">Standard organizacji</p>
          <h2 className="font-display text-2xl font-semibold">Ochrona małoletnich</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#68756f]">System zapisuje wykonanie zatwierdzonej procedury. Nie przechowuje nazwiska, dokumentu, PESEL-u ani profilu dziecka.</p>
        </div>
        {canManage ? <Button className="min-h-11" variant="secondary" onClick={() => setShowStandardForm((current) => !current)}>
          <Icon className="size-4" name="settings"/>{showStandardForm ? "Zamknij formularz" : "Aktywuj wersję SOP"}
        </Button> : null}
      </div>

      {dashboard?.activeStandard ? <div className="grid gap-4 p-5 lg:grid-cols-[1fr_auto]">
        <div>
          <div className="flex flex-wrap items-center gap-2"><Badge tone="good">Aktywny</Badge><p className="font-black">Wersja {dashboard.activeStandard.version}</p></div>
          <p className="mt-2 text-xs leading-5 text-[#65736c]">Obowiązuje od {formatPolishDate(dashboard.activeStandard.effectiveFrom)} · przegląd do {formatPolishDate(dashboard.activeStandard.reviewDueAt)} · właściciel: {dashboard.activeStandard.reviewOwner}</p>
          <p className="mt-1 text-xs text-[#65736c]">Przygotowanie personelu: {dashboard.activeStandard.staffPreparationReference}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className="inline-flex min-h-11 items-center rounded-xl border border-[#d4cdbf] bg-white px-3 text-xs font-black text-[#315d4c]" href={dashboard.activeStandard.fullDocumentUrl} rel="noreferrer" target="_blank">Wersja pełna ↗</a>
          <a className="inline-flex min-h-11 items-center rounded-xl border border-[#d4cdbf] bg-white px-3 text-xs font-black text-[#315d4c]" href={dashboard.activeStandard.childFriendlyDocumentUrl} rel="noreferrer" target="_blank">Wersja dla dzieci ↗</a>
        </div>
      </div> : <div className="m-5 rounded-2xl border border-[#ecccb8] bg-[#fff4e8] p-4 text-sm font-bold text-[#825326]">
        Brak aktywnego, zatwierdzonego SOP. Wydanie kluczy dla pobytu z dziećmi pozostaje zablokowane.
      </div>}

      {showStandardForm && canManage ? <StandardForm
        busy={Boolean(busy)}
        draft={draft}
        onChange={setDraft}
        onSubmit={async () => {
          const steps = draft.stepsText.split("\n").map((step) => step.trim()).filter(Boolean);
          const success = await mutate({
            action: "activate_standard",
            standard: {
              ...draft,
              stepsText: undefined,
              steps,
            },
          }, "Nowa wersja SOP została aktywowana i zapisana w audycie.");
          if (success) {
            setDraft(emptyDraft);
            setShowStandardForm(false);
          }
        }}
      /> : null}
    </Card>

    <section className="grid min-w-0 gap-3">
      <div className="flex items-end justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.15em] text-[#7d8b4d]">Pobyty wymagające działania</p><h2 className="font-display text-2xl font-semibold">{openStays.length} otwartych</h2></div></div>
      {openStays.map((stay) => {
        const status = stayStatus(stay, dashboard?.activeStandard ?? null);
        const reactionOpen = stay.execution?.outcome === "Wymaga reakcji" && stay.reaction?.status !== "Zamknięte";
        return <Card className="min-w-0 overflow-hidden" key={stay.bookingId}>
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e3dccf] p-5">
            <div><p className="text-[10px] font-black uppercase tracking-[.13em] text-[#7c8855]">{stay.bookingId}</p><h3 className="font-display text-xl font-semibold">{stay.unitName}</h3><p className="mt-1 text-xs font-semibold text-[#68756f]">{formatPolishDate(stay.checkIn)}–{formatPolishDate(stay.checkOut)}</p></div>
            <Badge tone={status === "Wymaga reakcji" || status === "Brak aktywnego SOP" ? "bad" : "warn"}>{status}</Badge>
          </div>
          <div className="grid gap-4 p-5">
            {!stay.execution && dashboard?.activeStandard ? <>
              <ol className="grid gap-2">{dashboard.activeStandard.steps.map((step, index) => <li className="flex gap-3 text-sm leading-6 text-[#52645b]" key={`${index}-${step}`}><span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#e4ebdc] text-xs font-black text-[#3c674d]">{index + 1}</span><span>{step}</span></li>)}</ol>
              <div className="flex flex-wrap gap-2 border-t border-[#ebe5da] pt-4">
                <Button className="min-h-11" disabled={Boolean(busy)} onClick={() => void mutate({ action: "complete", bookingId: stay.bookingId, outcome: "Bez uwag" }, "Wykonanie procedury zapisane bez uwag.")}><Icon className="size-4" name="check"/>Wykonano bez uwag</Button>
                <Button className="min-h-11" disabled={Boolean(busy)} variant="danger" onClick={() => void mutate({ action: "complete", bookingId: stay.bookingId, outcome: "Wymaga reakcji" }, "Otworzono kontrolowaną ścieżkę reakcji.")}><Icon className="size-4" name="warning"/>Wymaga reakcji</Button>
              </div>
            </> : null}
            {reactionOpen ? <div className="rounded-2xl border border-[#e5b9aa] bg-[#fff0eb] p-4">
              <p className="text-sm font-black text-[#8f402c]">Nie wydawaj kluczy. Postępuj według zatwierdzonego SOP poza publiczną notatką.</p>
              <p className="mt-1 text-xs leading-5 text-[#80584d]">System nie prosi o opis zdarzenia ani dane dziecka. Wrażliwa dokumentacja pozostaje w zatwierdzonym kanale procedury.</p>
              {canManage ? <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                <input aria-label="Odwołanie do zapisu reakcji" className={inputClass} maxLength={200} onChange={(event) => setResolutionReferences((current) => ({ ...current, [stay.bookingId]: event.target.value }))} placeholder="np. numer wpisu w rejestrze SOP" value={resolutionReferences[stay.bookingId] ?? ""}/>
                {stay.reaction?.status === "Otwarte" ? <Button className="min-h-11" disabled={Boolean(busy)} variant="secondary" onClick={() => void mutate({ action: "acknowledge_reaction", bookingId: stay.bookingId }, "Reakcja została przyjęta przez osobę odpowiedzialną.")}>Przyjmij</Button> : null}
                <Button className="min-h-11" disabled={Boolean(busy) || (resolutionReferences[stay.bookingId] ?? "").trim().length < 2} onClick={() => void mutate({ action: "close_reaction", bookingId: stay.bookingId, resolutionReference: resolutionReferences[stay.bookingId] }, "Reakcja została zamknięta z odwołaniem do właściwego rejestru.")}>Zamknij reakcję</Button>
              </div> : null}
            </div> : null}
          </div>
        </Card>;
      })}
      {!openStays.length ? <Card className="min-w-0 p-10 text-center"><Icon className="mx-auto size-8 text-[#668c58]" name="check"/><h3 className="mt-3 font-display text-2xl font-semibold">Brak otwartych procedur</h3><p className="mt-1 text-sm text-[#68756f]">Wszystkie wymagane wykonania i reakcje są zamknięte.</p></Card> : null}
    </section>
  </div>;
}

function StandardForm({ draft, busy, onChange, onSubmit }: {
  draft: StandardDraft;
  busy: boolean;
  onChange: (draft: StandardDraft) => void;
  onSubmit: () => Promise<void>;
}) {
  return <form className="grid gap-4 border-t border-[#e2dbce] bg-[#faf8f3] p-5" onSubmit={(event) => { event.preventDefault(); void onSubmit(); }}>
    <div className="rounded-xl bg-[#f5ead0] p-3 text-xs font-bold leading-5 text-[#725a1d]">Wpisz wyłącznie metadane i kroki dokumentu zatwierdzonego poza aplikacją. Ten formularz nie tworzy porady prawnej ani nowego standardu.</div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="Wersja SOP"><input className={inputClass} maxLength={40} onChange={(event) => onChange({ ...draft, version: event.target.value })} required value={draft.version}/></Field>
      <Field label="Data zatwierdzenia"><input className={inputClass} onChange={(event) => onChange({ ...draft, approvedAt: event.target.value })} required type="date" value={draft.approvedAt}/></Field>
      <Field label="Obowiązuje od"><input className={inputClass} onChange={(event) => onChange({ ...draft, effectiveFrom: event.target.value })} required type="date" value={draft.effectiveFrom}/></Field>
      <Field label="Przegląd najpóźniej"><input className={inputClass} onChange={(event) => onChange({ ...draft, reviewDueAt: event.target.value })} required type="date" value={draft.reviewDueAt}/></Field>
      <Field label="Właściciel przeglądu"><input className={inputClass} maxLength={120} onChange={(event) => onChange({ ...draft, reviewOwner: event.target.value })} required value={draft.reviewOwner}/></Field>
      <Field label="Dowód przygotowania personelu"><input className={inputClass} maxLength={160} onChange={(event) => onChange({ ...draft, staffPreparationReference: event.target.value })} required value={draft.staffPreparationReference}/></Field>
    </div>
    <Field label="HTTPS — pełna wersja standardów"><input className={inputClass} onChange={(event) => onChange({ ...draft, fullDocumentUrl: event.target.value })} required type="url" value={draft.fullDocumentUrl}/></Field>
    <Field label="HTTPS — skrócona wersja dla dzieci"><input className={inputClass} onChange={(event) => onChange({ ...draft, childFriendlyDocumentUrl: event.target.value })} required type="url" value={draft.childFriendlyDocumentUrl}/></Field>
    <Field label="Kroki dla osoby wydającej klucze — jeden krok w wierszu"><textarea className={`${inputClass} min-h-32 py-3`} maxLength={6000} onChange={(event) => onChange({ ...draft, stepsText: event.target.value })} required value={draft.stepsText}/></Field>
    <label className="flex items-start gap-3 text-sm font-bold text-[#52645b]"><input checked={draft.publicationConfirmed} className="mt-0.5 size-5 accent-[#174d3b]" onChange={(event) => onChange({ ...draft, publicationConfirmed: event.target.checked })} required type="checkbox"/>Potwierdzam udostępnienie wersji pełnej i skróconej na stronie.</label>
    <label className="flex items-start gap-3 text-sm font-bold text-[#52645b]"><input checked={draft.premisesDisplayConfirmed} className="mt-0.5 size-5 accent-[#174d3b]" onChange={(event) => onChange({ ...draft, premisesDisplayConfirmed: event.target.checked })} required type="checkbox"/>Potwierdzam wywieszenie obu wersji w widocznym miejscu obiektu.</label>
    <div className="flex justify-end"><Button className="min-h-11" disabled={busy || !draft.publicationConfirmed || !draft.premisesDisplayConfirmed} type="submit">{busy ? "Aktywuję…" : "Aktywuj zatwierdzoną wersję"}</Button></div>
  </form>;
}
