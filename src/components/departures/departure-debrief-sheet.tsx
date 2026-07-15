"use client";

import { useMemo, useState } from "react";
import { useAppStore } from "@/components/layout/app-store";
import { Badge, Button, Field, inputClass } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icons";
import type { Booking, Channel, DepartureDebrief, DiscoveryMethod, IssueReport } from "@/lib/types";
import { unitName } from "@/lib/workflow/rules";
import { formatPolishDate } from "@/lib/date";

const discoverySources: Channel[] = ["Slowhop", "Google", "Facebook", "Polecenie", "AI/czat", "Booking", "Airbnb", "Aloha Camp", "Strona www", "Telefon", "E-mail", "Inne"];
const methods: DiscoveryMethod[] = ["Przeglądanie ofert", "Wyszukiwarka", "Polecenie", "Social media", "Reklama", "Inne", "Nie wiadomo"];
const categories: NonNullable<IssueReport["category"]>[] = ["Bezpieczeństwo", "Dostęp/drzwi", "Woda", "Prąd", "Wyposażenie", "Komfort", "Inne"];

export function DepartureDebriefSheet({ booking, queueLabel, onClose, onSaved }: { booking: Booking; queueLabel?: string; onClose: () => void; onSaved?: () => void }) {
  const { data, saveDepartureDebrief, snoozeDepartureDebrief, skipDepartureDebrief } = useAppStore();
  const existing = data.departureDebriefs.find((item) => item.bookingId === booking.id);
  const existingIssue = data.issues.find((item) => item.debriefId === existing?.id);
  const profile = data.guests.find((item) => item.bookingId === booking.id);
  const [step, setStep] = useState(1);
  const [departureStatus, setDepartureStatus] = useState<NonNullable<DepartureDebrief["departureStatus"]>>(existing?.departureStatus ?? "Wyjechali");
  const [keysSettled, setKeysSettled] = useState(existing?.keysSettled ?? false);
  const [paymentNote, setPaymentNote] = useState(existing?.paymentOrDamageNote ?? "");
  const [cleaningHandoff, setCleaningHandoff] = useState(existing?.cleaningHandoff ?? "");
  const [urgentRisk, setUrgentRisk] = useState(existing?.urgentNextArrivalRisk ?? false);
  const [discoverySource, setDiscoverySource] = useState<Channel | "">(existing?.discoverySource ?? profile?.discoveryChannel ?? "");
  const [discoveryMethod, setDiscoveryMethod] = useState<DiscoveryMethod>(existing?.discoveryMethod ?? profile?.discoveryMethod ?? "Nie wiadomo");
  const [discoveryNote, setDiscoveryNote] = useState(existing?.discoveryNote ?? profile?.discoveryNote ?? "");
  const [whyChose, setWhyChose] = useState(existing?.whyChose ?? "");
  const [bestParts, setBestParts] = useState(existing?.bestParts ?? "");
  const [improvementNotes, setImprovementNotes] = useState(existing?.improvementNotes ?? "");
  const [bestQuote, setBestQuote] = useState(existing?.bestQuote ?? "");
  const [nps, setNps] = useState(existing?.nps == null ? "" : String(existing.nps));
  const [returnIntent, setReturnIntent] = useState<NonNullable<DepartureDebrief["returnIntent"]>>(existing?.returnIntent ?? "Nie wiadomo");
  const [quotePermission, setQuotePermission] = useState<DepartureDebrief["publicQuotePermission"]>(existing?.publicQuotePermission ?? "Do dopytania");
  const [createIssue, setCreateIssue] = useState(Boolean(existingIssue));
  const [issueTitle, setIssueTitle] = useState(existingIssue?.title ?? "");
  const [issueCategory, setIssueCategory] = useState<NonNullable<IssueReport["category"]>>(existingIssue?.category ?? "Dostęp/drzwi");
  const [issueSeverity, setIssueSeverity] = useState<NonNullable<IssueReport["severity"]>>(existingIssue?.severity ?? "Średnia");
  const [issueLocation, setIssueLocation] = useState(existingIssue?.location ?? unitName(data.units, booking.unitId));
  const [error, setError] = useState("");
  const nextBooking = useMemo(() => data.bookings.filter((item) => item.unitId === booking.unitId && item.checkIn >= booking.checkOut && item.workflowStatus !== "Anulowana" && item.id !== booking.id).sort((a, b) => a.checkIn.localeCompare(b.checkIn))[0], [data.bookings, booking]);
  const safetySuggestion = ["Bezpieczeństwo", "Dostęp/drzwi", "Woda", "Prąd"].includes(issueCategory) && ["Krytyczna", "Wysoka"].includes(issueSeverity);

  function later() { snoozeDepartureDebrief(booking.id); onClose(); }
  function skip() { const reason = window.prompt("Dlaczego pomijasz podsumowanie?", "Nie było rozmowy z gościem"); if (!reason?.trim()) return; skipDepartureDebrief(booking.id, reason.trim()); onSaved?.(); onClose(); }
  function save() {
    if (createIssue && !issueTitle.trim()) { setError("Dodaj krótki tytuł usterki albo wyłącz tworzenie zgłoszenia."); return; }
    const completedAt = new Date().toISOString();
    const debrief: DepartureDebrief = {
      id: existing?.id ?? `DEB-${booking.id}`,
      bookingId: booking.id,
      status: "Ukończony",
      lastPromptedAt: existing?.lastPromptedAt,
      completedAt,
      capturedBy: "Właściciel",
      actualDepartureAt: completedAt,
      departureStatus,
      keysSettled,
      paymentOrDamageNote: paymentNote.trim() || undefined,
      cleaningHandoff: cleaningHandoff.trim() || undefined,
      urgentNextArrivalRisk: urgentRisk,
      discoverySource: discoverySource || undefined,
      discoveryMethod,
      discoveryNote: discoveryNote.trim() || undefined,
      whyChose: whyChose.trim() || undefined,
      bestParts: bestParts.trim() || undefined,
      improvementNotes: improvementNotes.trim() || undefined,
      bestQuote: bestQuote.trim() || undefined,
      nps: nps === "" ? undefined : Number(nps),
      returnIntent,
      publicQuotePermission: quotePermission,
    };
    const issue: IssueReport | undefined = createIssue ? {
      id: existingIssue?.id ?? `ISS-${booking.id}-${Date.now()}`,
      bookingId: booking.id,
      unitId: booking.unitId,
      debriefId: debrief.id,
      title: issueTitle.trim(),
      description: improvementNotes.trim() || undefined,
      category: issueCategory,
      location: issueLocation.trim() || undefined,
      severity: issueSeverity,
      source: "Gość",
      owner: "Patryk",
      nextArrivalRisk: urgentRisk,
      planningHorizon: existingIssue?.planningHorizon ?? "Do oceny",
      status: existingIssue?.status ?? "Otwarte",
      createdAt: existingIssue?.createdAt ?? completedAt,
    } : undefined;
    saveDepartureDebrief(debrief, issue);
    onSaved?.(); onClose();
  }

  return <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[#0b2b22]/70 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-label={`Podsumowanie wyjazdu ${booking.guestLabel}`} onMouseDown={(event) => { if (event.target === event.currentTarget) later(); }}>
    <section className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-t-[28px] bg-[#fffdf8] shadow-2xl sm:rounded-[28px]">
      <header className="sticky top-0 z-10 border-b border-[#ded7ca] bg-[#fffdf8]/95 px-5 py-4 backdrop-blur sm:px-7">
        <div className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><Badge tone="lake">Wyjazd dzisiaj</Badge>{queueLabel ? <Badge>{queueLabel}</Badge> : null}<span className="text-xs font-bold text-[#718078]">{unitName(data.units, booking.unitId)}</span></div><h2 className="mt-2 font-display text-3xl font-semibold tracking-[-.03em]">Co zabieramy z tego pobytu?</h2><p className="mt-1 text-sm text-[#65736d]">{booking.guestLabel} · wyjazd {booking.departureTime || data.settings.defaultCheckOut}</p></div><button aria-label="Później" className="grid size-10 shrink-0 place-items-center rounded-full bg-[#eee9df]" onClick={later}><Icon className="size-5" name="close"/></button></div>
        <div className="mt-4 grid grid-cols-3 gap-2">{[1,2,3].map((item) => <button key={item} onClick={() => setStep(item)} className={`h-1.5 rounded-full ${item <= step ? "bg-[#2f7460]" : "bg-[#ddd6c8]"}`} aria-label={`Krok ${item}`}/>)}</div>
      </header>

      <div className="p-5 sm:p-7">
        {step === 1 ? <div className="grid gap-5"><SectionTitle number="01" title="Wyjazd i przekazanie domku" body="Najpierw zamknij sprawy, które mogą wpłynąć na następny przyjazd."/><Field label="Status wyjazdu"><select className={inputClass} value={departureStatus} onChange={(e) => setDepartureStatus(e.target.value as NonNullable<DepartureDebrief["departureStatus"]>)}>{["Wyjechali","Późny wyjazd","Niepotwierdzone"].map((item) => <option key={item}>{item}</option>)}</select></Field><div className="grid gap-4 sm:grid-cols-2"><ToggleCard checked={keysSettled} onChange={setKeysSettled} title="Klucze i dostęp rozliczone" body="Klucz, kod lub pilot wrócił zgodnie z ustaleniami."/><ToggleCard checked={urgentRisk} onChange={setUrgentRisk} title="Ryzyko przed kolejnym pobytem" body={nextBooking ? `Następny przyjazd: ${formatPolishDate(nextBooking.checkIn)}` : "Brak kolejnego pobytu w kalendarzu."} warn/></div><Field label="Płatność, szkoda lub rzecz do sprawdzenia"><textarea className={`${inputClass} min-h-24`} placeholder="Zostaw puste, jeśli wszystko jest rozliczone." value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)}/></Field><Field label="Przekazanie dla sprzątania"><textarea className={`${inputClass} min-h-24`} placeholder="Np. późniejszy wyjazd, zostawione rzeczy, dodatkowa uwaga." value={cleaningHandoff} onChange={(e) => setCleaningHandoff(e.target.value)}/></Field></div> : null}

        {step === 2 ? <div className="grid gap-5"><SectionTitle number="02" title="Co powiedział gość" body="Kanał rezerwacji zostaje bez zmian. Tutaj zapisujesz, skąd naprawdę dowiedzieli się o Stawach."/><div className="grid gap-4 sm:grid-cols-2"><Field label="Źródło odkrycia"><select className={inputClass} value={discoverySource} onChange={(e) => setDiscoverySource(e.target.value as Channel | "")}><option value="">Nie wiadomo</option>{discoverySources.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Jak szukali"><select className={inputClass} value={discoveryMethod} onChange={(e) => setDiscoveryMethod(e.target.value as DiscoveryMethod)}>{methods.map((item) => <option key={item}>{item}</option>)}</select></Field></div><Field label="Szczegół źródła"><input className={inputClass} placeholder="Np. przeglądali oferty na Slowhop bez konkretnej frazy" value={discoveryNote} onChange={(e) => setDiscoveryNote(e.target.value)}/></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Dlaczego wybrali Stawy"><textarea className={`${inputClass} min-h-24`} value={whyChose} onChange={(e) => setWhyChose(e.target.value)}/></Field><Field label="Co podobało się najbardziej"><textarea className={`${inputClass} min-h-24`} value={bestParts} onChange={(e) => setBestParts(e.target.value)}/></Field></div><Field label="Co można poprawić"><textarea className={`${inputClass} min-h-24`} placeholder="Jedna konkretna obserwacja jest więcej warta niż ogólna ocena." value={improvementNotes} onChange={(e) => { setImprovementNotes(e.target.value); if (e.target.value && !issueTitle) setIssueTitle(e.target.value.slice(0,80)); }}/></Field><Field label="Najlepszy cytat — dokładne słowa gościa"><textarea className={`${inputClass} min-h-20`} value={bestQuote} onChange={(e) => setBestQuote(e.target.value)}/></Field><div className="grid gap-4 sm:grid-cols-3"><Field label="NPS 0–10"><input className={inputClass} type="number" min="0" max="10" value={nps} onChange={(e) => setNps(e.target.value)}/></Field><Field label="Czy wrócą"><select className={inputClass} value={returnIntent} onChange={(e) => setReturnIntent(e.target.value as NonNullable<DepartureDebrief["returnIntent"]>)}>{["Tak","Może","Nie","Nie wiadomo"].map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Zgoda na cytat"><select className={inputClass} value={quotePermission} onChange={(e) => setQuotePermission(e.target.value as DepartureDebrief["publicQuotePermission"])}>{["Tak","Nie","Do dopytania"].map((item) => <option key={item}>{item}</option>)}</select></Field></div></div> : null}

        {step === 3 ? <div className="grid gap-5"><SectionTitle number="03" title="Follow-up i naprawa" body="Usterka trafi do właściciela do oceny. Termin nie zostanie narzucony automatycznie."/><ToggleCard checked={createIssue} onChange={setCreateIssue} title="Utwórz usterkę i zadanie naprawy" body="Powiąż zgłoszenie z pobytem i dodaj je do kolejki Do oceny."/>{createIssue ? <div className="grid gap-4 rounded-2xl border border-[#dbcdb6] bg-[#f7f1e4] p-4 sm:grid-cols-2"><div className="sm:col-span-2"><Field label="Tytuł usterki"><input className={inputClass} placeholder="Np. drzwi wejściowe nie domykają się" value={issueTitle} onChange={(e) => setIssueTitle(e.target.value)}/></Field></div><Field label="Kategoria"><select className={inputClass} value={issueCategory} onChange={(e) => setIssueCategory(e.target.value as NonNullable<IssueReport["category"]>)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Ważność"><select className={inputClass} value={issueSeverity} onChange={(e) => setIssueSeverity(e.target.value as NonNullable<IssueReport["severity"]>)}>{["Krytyczna","Wysoka","Średnia","Niska"].map((item) => <option key={item}>{item}</option>)}</select></Field><div className="sm:col-span-2"><Field label="Miejsce"><input className={inputClass} value={issueLocation} onChange={(e) => setIssueLocation(e.target.value)}/></Field></div>{safetySuggestion ? <p className="sm:col-span-2 rounded-xl bg-[#f8ddd3] p-3 text-xs font-bold text-[#8f3f2b]">Sugestia: sprawdź przed następnym przyjazdem. Ostateczny termin wybierzesz w kolejce usterek.</p> : null}</div> : null}<div className="rounded-2xl border border-[#d8dfcc] bg-[#edf2e5] p-4"><p className="text-sm font-black">Dwa szkice powstaną automatycznie</p><p className="mt-1 text-xs leading-5 text-[#627069]">Podziękowanie z prośbą o prywatny feedback oraz osobna, neutralna prośba o publiczną opinię. Nic nie zostanie wysłane bez zatwierdzenia.</p></div>{error ? <p className="rounded-xl bg-[#f9dfd7] p-3 text-sm font-bold text-[#963c27]">{error}</p> : null}</div> : null}

        <footer className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-[#e3dccf] pt-5"><button className="text-xs font-bold text-[#7b6258] underline decoration-dotted underline-offset-4" onClick={skip}>Pomiń z powodem</button><div className="ml-auto flex gap-2">{step > 1 ? <Button variant="secondary" onClick={() => setStep(step - 1)}>Wstecz</Button> : <Button variant="secondary" onClick={later}>Za 2 godziny</Button>}{step < 3 ? <Button onClick={() => setStep(step + 1)}>Dalej <Icon className="size-4" name="arrow"/></Button> : <Button onClick={save}><Icon className="size-4" name="check"/>Zapisz podsumowanie</Button>}</div></footer>
      </div>
    </section>
  </div>;
}

function SectionTitle({ number, title, body }: { number: string; title: string; body: string }) { return <div className="flex gap-4"><span className="font-display text-4xl font-semibold text-[#b8c58a]">{number}</span><div><h3 className="font-display text-2xl font-semibold">{title}</h3><p className="mt-1 text-sm leading-6 text-[#66736c]">{body}</p></div></div>; }
function ToggleCard({ checked, onChange, title, body, warn = false }: { checked: boolean; onChange: (value: boolean) => void; title: string; body: string; warn?: boolean }) { return <button type="button" className={`flex gap-3 rounded-2xl border p-4 text-left transition ${checked ? warn ? "border-[#dc826a] bg-[#fae8e1]" : "border-[#6e9876] bg-[#e5efe2]" : "border-[#d8d0c2] bg-white"}`} onClick={() => onChange(!checked)}><span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border ${checked ? "border-[#327154] bg-[#327154] text-white" : "border-[#bbb2a3]"}`}>{checked ? <Icon className="size-3.5" name="check"/> : null}</span><span><span className="block text-sm font-black">{title}</span><span className="mt-1 block text-xs leading-5 text-[#66736c]">{body}</span></span></button>; }
