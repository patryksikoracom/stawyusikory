"use client";

import { useRef, useState, type FormEvent, type RefObject } from "react";
import { useAppStore } from "@/components/layout/app-store";
import { Icon } from "@/components/ui/icons";
import { Button, Field, inputClass } from "@/components/ui/primitives";
import { Dialog } from "@/components/ui/dialog";
import type { Booking, CalendarBlock, Channel, ContactConsent, GuestPerson, PaymentStatus } from "@/lib/types";
import { getBookingConflicts, nightsBetween, overlaps } from "@/lib/workflow/rules";
import { guestDisplayName, validateGuestStep } from "@/lib/workflow/booking-form";
import { quoteStay } from "@/lib/workflow/pricing";
import { formatPolishDate } from "@/lib/date";
import { importedReservationBlockMatchesBooking, isOverridableCleaningBuffer } from "@/lib/integrations/ical-block-classification";
import { bookingLanguage } from "@/lib/crm/guest-identity";

export type BookingDefaults = Partial<Pick<Booking, "unitId" | "checkIn" | "checkOut" | "arrivalTime" | "departureTime" | "platform" | "importRef">>;
const bookingChannels: Channel[] = ["Telefon", "E-mail", "Bezpośrednio", "Strona www", "Booking", "Airbnb", "Slowhop", "Aloha Camp", "Agoda", "Expedia", "VRBO", "Inne"];
const otaChannels: Channel[] = ["Booking", "Airbnb", "Slowhop", "Aloha Camp", "Agoda", "Expedia", "VRBO"];
const discoveryChannels = ["Nie wiadomo", "Google", "Facebook", "Instagram", "Polecenie", "Booking", "Airbnb", "Aloha Camp", "Strona www", "Inne"];

export function NewBookingDialog({ onClose, onAdded, booking, defaults, returnFocusRef }: { onClose: () => void; onAdded: () => void; booking?: Booking; defaults?: BookingDefaults; returnFocusRef?: RefObject<HTMLElement | null> }) {
  const { data, addBooking, updateBooking, deleteBooking } = useAppStore();
  const [step, setStep] = useState(1);
  const contentRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const saveInFlight = useRef(false);
  const [confirmDeletion, setConfirmDeletion] = useState(false);
  const [showTimeExceptions, setShowTimeExceptions] = useState(
    Boolean(booking && (
      (booking.arrivalTime && booking.arrivalTime !== data.settings.defaultCheckIn)
      || (booking.departureTime && booking.departureTime !== data.settings.defaultCheckOut)
    )),
  );
  const [showChildren, setShowChildren] = useState(Boolean(booking?.children));
  const [depositOverride, setDepositOverride] = useState(Boolean(booking?.depositAmount));
  const [dateSelection, setDateSelection] = useState<"checkIn" | "checkOut">("checkIn");
  const [confirmedCleaningBufferKey, setConfirmedCleaningBufferKey] = useState("");
  const [confirmedImportedBlockKey, setConfirmedImportedBlockKey] = useState("");
  const [cleaningPlan, setCleaningPlan] = useState<"self-cleaning" | "arranged-cleaning" | "">("");
  const [draftId] = useState(() => `SUS-${crypto.randomUUID()}`);
  const [defaultDates] = useState(() => {
    const start = new Date();
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { today: localDateValue(start), tomorrow: localDateValue(end) };
  });
  const { today, tomorrow } = defaultDates;
  const [form, setForm] = useState(() => {
    const contact = booking ? data.consents.find((item) => item.bookingId === booking.id) : undefined;
    const name = booking?.guestLabel.trim().split(/\s+/) ?? [];
    return {
      firstName: name.length > 1 ? name.shift() ?? "" : "", lastName: name.join(" ") || booking?.guestLabel || "", phone: contact?.phone ?? "", email: contact?.email ?? "", preferredLanguage: (booking ? bookingLanguage(data, booking.id) : undefined) ?? "pl" as NonNullable<GuestPerson["preferredLanguage"]>,
      unitId: booking?.unitId ?? defaults?.unitId ?? data.units[0]?.id ?? "", checkIn: booking?.checkIn ?? defaults?.checkIn ?? today, checkOut: booking?.checkOut ?? defaults?.checkOut ?? tomorrow,
      arrivalTime: booking?.arrivalTime ?? defaults?.arrivalTime ?? data.settings.defaultCheckIn, departureTime: booking?.departureTime ?? defaults?.departureTime ?? data.settings.defaultCheckOut, adults: String(booking?.adults ?? 2), children: String(booking?.children ?? 0),
      platform: booking?.platform ?? defaults?.platform ?? "Telefon", discoveryChannel: discoveryChannels.includes(booking?.source ?? "") ? booking!.source : "Nie wiadomo", externalNo: booking?.platformReservationNo ?? "", commission: booking?.commission ? String(booking.commission) : "", pricePerNight: booking?.pricePerNight != null ? String(booking.pricePerNight) : "", totalPrice: booking?.grossPrice != null ? String(booking.grossPrice) : "",
      pricingMode: booking?.pricingMode ?? (booking?.grossPrice != null ? "manual" as const : "rate-card" as const),
      paymentStatus: booking?.paymentStatus === "Opłacone" ? "Wpłacona całość" : booking?.paymentStatus === "Zaliczka" ? "Wpłacony zadatek" : booking?.paymentStatus === "Częściowo" ? "Częściowo opłacone" : "Oczekiwanie na zadatek", depositAmount: booking?.depositAmount ? String(booking.depositAmount) : "", depositDueDate: booking?.depositDueDate ?? "",
      paymentMethod: booking?.paymentMethod ?? "Brak", currency: booking?.currency ?? "PLN", notes: booking?.specialRequests ?? "",
    };
  });

  const nights = nightsBetween(form.checkIn, form.checkOut);
  const selectedUnit = data.units.find((unit) => unit.id === form.unitId);
  const guestCount = Number(form.adults || 0) + Number(form.children || 0);
  const rateQuote = quoteStay(data.units, data.rates, form.unitId, form.checkIn, form.checkOut);
  const rateCardAvailable = form.currency === "PLN";
  const suggestedNightPrice = rateCardAvailable && rateQuote.averagePerNight ? String(Math.round(rateQuote.averagePerNight * 100) / 100) : "";
  const calculatedTotal = form.pricingMode === "rate-card" && rateCardAvailable
    ? rateQuote.total
    : form.totalPrice ? Number(form.totalPrice) : form.pricePerNight ? Number(form.pricePerNight) * nights : 0;
  const isOta = otaChannels.includes(form.platform as Channel);
  const suggestedDeposit = Math.round(calculatedTotal * 0.33 * 100) / 100;
  const depositValue = depositOverride ? Number(form.depositAmount || 0) : suggestedDeposit;
  const rateDifference = calculatedTotal && rateQuote.total
    ? calculatedTotal - rateQuote.total
    : 0;
  const conflictProbe: Booking = {
    id: booking?.id ?? "draft", bookingDate: booking?.bookingDate ?? today, source: "Panel Stawy OS", platform: form.platform as Channel,
    unitId: form.unitId, checkIn: form.checkIn, checkOut: form.checkOut, arrivalTime: form.arrivalTime, departureTime: form.departureTime,
    adults: Number(form.adults || 0), children: Number(form.children || 0),
    guestLabel: "Wersja robocza", paymentStatus: "Do uzupełnienia",
    workflowStatus: "Nowa", createdBy: "Stawy OS",
  };
  const ignoredIcalBlockId = booking?.importRef?.source === "ical"
    ? booking.importRef.key
    : defaults?.importRef?.source === "ical" ? defaults.importRef.key : undefined;
  const importedBlockToReplace = ignoredIcalBlockId
    ? data.blocks.find((block) => block.id === ignoredIcalBlockId)
    : undefined;
  const importedBlockConfirmed = Boolean(importedBlockToReplace)
    && confirmedImportedBlockKey === importedBlockToReplace?.id;
  const availabilityBlocks = data.blocks.filter((block) => {
    if (block.id === ignoredIcalBlockId) return false;
    if (booking && importedReservationBlockMatchesBooking(block, booking)) return false;
    return true;
  });
  const cleaningBuffers = availabilityBlocks
    .filter((block) => block.unitId === form.unitId)
    .filter((block) => block.status !== "Anulowana" && block.status !== "Zakończona")
    .filter((block) => isOverridableCleaningBuffer(block))
    .filter((block) => overlaps(form.checkIn, form.checkOut, block.dateFrom, block.dateTo));
  const cleaningBufferKey = cleaningBuffers.map((block) => block.id).sort().join("|");
  const cleaningBufferConfirmed = Boolean(cleaningBufferKey) && confirmedCleaningBufferKey === cleaningBufferKey;
  const hardAvailabilityBlocks = availabilityBlocks.filter((block) => !cleaningBuffers.some((buffer) => buffer.id === block.id));
  const conflicts = form.checkIn && form.checkOut ? getBookingConflicts(data.bookings, hardAvailabilityBlocks, conflictProbe) : [];
  const sameDayTurnovers = data.bookings
    .filter((candidate) => candidate.id !== booking?.id && candidate.unitId === form.unitId && candidate.workflowStatus !== "Anulowana")
    .filter((candidate) => candidate.checkOut === form.checkIn || candidate.checkIn === form.checkOut);
  const turnoverSummary = sameDayTurnovers.map((candidate) => candidate.checkOut === form.checkIn
    ? `${candidate.guestLabel} wyjeżdża o ${candidate.departureTime || data.settings.defaultCheckOut}; nowy przyjazd o ${form.arrivalTime || data.settings.defaultCheckIn}`
    : `Po tym pobycie: ${candidate.guestLabel} przyjeżdża o ${candidate.arrivalTime || data.settings.defaultCheckIn}`);

  function normalizedPaymentStatus(): PaymentStatus {
    if (form.paymentStatus === "Wpłacona całość") return "Opłacone";
    if (form.paymentStatus === "Wpłacony zadatek") return "Zaliczka";
    if (form.paymentStatus === "Częściowo opłacone") return "Częściowo";
    if (form.paymentStatus === "Anulowane") return "Anulowane";
    return calculatedTotal ? "Do dopłaty" : "Do uzupełnienia";
  }

  function validationError(targetStep: number) {
    if (targetStep === 1) {
      if (!form.unitId || !form.checkIn || !form.checkOut) return "Wybierz domek oraz pełny termin pobytu.";
      if (nights < 1) return "Wyjazd musi być co najmniej dzień po przyjeździe.";
      if (Number(form.adults) < 1) return "Rezerwacja musi mieć co najmniej jedną osobę dorosłą.";
      if (selectedUnit && guestCount > selectedUnit.maxPeople) return `${selectedUnit.name} mieści maksymalnie ${selectedUnit.maxPeople} osób.`;
      if (conflicts.length) return `Ten termin jest zajęty: ${conflicts[0]}.`;
      if (importedBlockToReplace && !importedBlockConfirmed) return "Potwierdź, że chcesz zastąpić wskazaną blokadę rezerwacją.";
      if (cleaningBuffers.length && (!cleaningBufferConfirmed || !cleaningPlan)) return "Wybierz sposób sprzątania i potwierdź świadome obejście buforu.";
    }
    if (targetStep === 2) return validateGuestStep(form.firstName, form.lastName);
  }

  function moveToStep(nextStep: number) {
    setStep(nextStep);
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }

  function goNext() {
    setError("");
    const message = validationError(step);
    if (message) { setError(message); return; }
    moveToStep(Math.min(3, step + 1));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saveInFlight.current) return;
    if (step < 3) { goNext(); return; }
    for (const requiredStep of [1, 2]) {
      const message = validationError(requiredStep);
      if (message) { setError(message); moveToStep(requiredStep); return; }
    }
    if (depositValue > calculatedTotal && calculatedTotal > 0) { setError("Zadatek nie może być większy niż suma rezerwacji."); return; }
    const guestLabel = guestDisplayName(form.firstName, form.lastName);
    const savedBooking: Booking = {
      ...booking,
      id: booking?.id ?? draftId,
      bookingDate: booking?.bookingDate || today,
      source: form.discoveryChannel,
      platform: form.platform as Channel,
      platformReservationNo: isOta ? form.externalNo.trim() || undefined : undefined,
      unitId: form.unitId,
      checkIn: form.checkIn,
      checkOut: form.checkOut,
      arrivalTime: form.arrivalTime,
      departureTime: form.departureTime,
      adults: Number(form.adults),
      children: Number(form.children),
      guestLabel,
      grossPrice: form.pricingMode === "manual" && (form.totalPrice !== "" || form.pricePerNight !== "") ? calculatedTotal : calculatedTotal || undefined,
      pricePerNight: nights > 0 ? calculatedTotal / nights : undefined,
      pricingMode: form.pricingMode,
      commission: isOta ? Number(form.commission) || undefined : undefined,
      depositAmount: depositValue || undefined,
      depositDueDate: form.depositDueDate || undefined,
      paymentMethod: form.paymentMethod as Booking["paymentMethod"],
      currency: form.currency as Booking["currency"],
      paymentStatus: normalizedPaymentStatus(),
      workflowStatus: booking?.workflowStatus ?? "Nowa",
      specialRequests: form.notes.trim() || undefined,
      createdBy: booking?.createdBy ?? "Stawy OS",
      needsReview: false,
      importRef: booking?.importRef ?? defaults?.importRef,
      availabilityOverride: cleaningBuffers.length && cleaningPlan ? {
        kind: "cleaning-buffer",
        blockIds: cleaningBuffers.map((block) => block.id),
        plan: cleaningPlan,
        confirmedAt: new Date().toISOString(),
      } : booking?.availabilityOverride,
    };
    const contact: ContactConsent = {
      ...(data.consents.find((item) => item.bookingId === savedBooking.id) ?? {
        marketingConsent: "Do dopytania",
        photoFbConsent: "Do dopytania",
        photoSiteAdsConsent: "Do dopytania",
      }),
      bookingId: savedBooking.id,
      preferredLanguage: form.preferredLanguage,
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
    };
    saveInFlight.current = true;
    setSaving(true);
    setError("");
    try {
      const result = booking
        ? await updateBooking(savedBooking, contact)
        : await addBooking(savedBooking, contact);
      if (!result.ok) { setError(result.message); return; }
      onAdded();
    } catch {
      setError("Nie udało się potwierdzić zapisu. Sprawdź połączenie i spróbuj ponownie.");
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  }

  const stepLabels = ["Termin", "Gość", "Finanse"];
  const moneySuffix = form.currency;
  return (
    <Dialog
      ariaLabelledby="new-booking-title"
      className="mobile-dialog-surface mx-auto w-full max-w-3xl overflow-hidden bg-[#fffdf8] shadow-[0_30px_90px_rgba(8,29,22,.35)] sm:my-5 sm:rounded-[24px]"
      onClose={onClose}
      closeDisabled={saving}
      overlayClassName="overflow-y-auto !p-0 sm:!p-5"
      returnFocusRef={returnFocusRef}
    >
        <div className="mobile-dialog-header border-b border-[#e3dccf] bg-[#fffdf8] bg-[radial-gradient(circle_at_85%_-30%,#dce7bd_0,transparent_38%)] px-3 pb-2 pt-[max(.5rem,env(safe-area-inset-top))] sm:static sm:px-7 sm:pb-5 sm:pt-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[.1em] text-[#81904e] sm:text-[10px] sm:tracking-[.2em]">{booking ? "Edycja pobytu" : "Nowy pobyt"}</p><h2 className="font-display text-xl font-semibold leading-none tracking-[-.03em] sm:text-3xl" id="new-booking-title">{booking ? "Edytuj rezerwację" : "Dodaj rezerwację"}</h2></div>
            <button aria-label="Zamknij" disabled={saving} className="grid size-9 shrink-0 place-items-center rounded-xl border border-[#ddd6c9] bg-white/80 transition hover:bg-white sm:size-10" onClick={onClose}><Icon className="size-5" name="close" /></button>
          </div>
          <ol aria-label="Postęp formularza" className="booking-stepper mt-2 grid grid-cols-3 gap-1.5 sm:mt-4">
            {stepLabels.map((label, index) => {
              const number = index + 1;
              const available = number <= step + 1;
              return <li key={label}><button aria-current={step === number ? "step" : undefined} aria-label={`Krok ${number}: ${label}`} type="button" disabled={saving || !available} className="block w-full rounded-full py-1" onClick={() => { setError(""); if (number <= step) moveToStep(number); else goNext(); }}><span aria-hidden="true" className={`block h-1 rounded-full transition ${step === number ? "bg-[#174d3b]" : step > number ? "bg-[#8fae82]" : "bg-[#ddd9cf]"}`} /><span className="sr-only">{number}. {label}</span></button></li>;
            })}
          </ol>
          {error ? <p aria-live="polite" className="mt-3 rounded-xl border border-[#efb8a8] bg-[#f9dfd7] px-4 py-3 text-sm font-bold text-[#963c27]">{error}</p> : null}
        </div>

        <form className="mobile-dialog-form" onSubmit={submit}>
          <fieldset disabled={saving} className="contents">
          <div className="mobile-dialog-scroll" ref={contentRef}>
            <div className="mx-auto min-w-0 w-full max-w-3xl p-3 sm:p-7">
              {step === 1 ? <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
                <DialogSection title="Domek i termin" />
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
                  <fieldset className="grid min-w-0 max-w-full grid-cols-1 gap-2 min-[380px]:grid-cols-2 sm:col-span-2">
                    <legend className="mb-2 text-[10px] font-black uppercase tracking-[.13em] text-[#6c7871]">Domek</legend>
                    {data.units.map((unit) => {
                      const selected = unit.id === form.unitId;
                      const bird = unit.name.toLocaleLowerCase("pl-PL").includes("czap");
                      return <button autoFocus={selected} aria-label={`Wybierz domek ${bird ? "Czapla" : "Rybak"}`} aria-pressed={selected} className={`min-h-20 rounded-2xl border px-4 text-left transition ${selected ? "border-[#174d3b] bg-[#174d3b] text-white shadow-lg" : "border-[#d8d0c2] bg-white text-[#355248] hover:border-[#79927d]"}`} key={unit.id} onClick={() => setForm({ ...form, unitId: unit.id })} type="button"><span aria-hidden="true" className="mr-2 text-2xl">{bird ? "🐦" : "🐟"}</span><span className="text-base font-black">{bird ? "Czapla" : "Rybak"}</span><span className={`mt-1 block text-xs ${selected ? "text-white/75" : "text-[#6d7972]"}`}>do {unit.maxPeople} osób</span></button>;
                    })}
                  </fieldset>
                  <div className="booking-status-strip grid min-w-0 max-w-full grid-cols-2 gap-2 sm:contents">
                    <div className={`rounded-xl border px-3 py-2.5 sm:px-4 sm:py-3 ${conflicts.length ? "border-[#efb7a8] bg-[#fbe7e1] text-[#8f3b27]" : cleaningBuffers.length ? "border-[#e4c46f] bg-[#fbf0d3] text-[#745815]" : "border-[#bdd7c3] bg-[#e9f2e7] text-[#275e3f]"}`}><p className="text-[10px] font-black uppercase tracking-[.1em] sm:tracking-[.14em]">Dostępność</p><p className="mt-1 text-sm font-black">{conflicts.length ? "Termin zajęty" : cleaningBuffers.length ? <><span className="sm:hidden">Dostępny warunkowo</span><span className="hidden sm:inline">Termin dostępny warunkowo · bufor sprzątania</span></> : nights > 0 ? sameDayTurnovers.length ? "Wolny · turnover" : "Termin wolny" : "Sprawdź daty"}</p><p className="mt-0.5 hidden text-xs sm:block">{conflicts[0] ?? (cleaningBuffers.length ? "Możesz zapisać pobyt po wskazaniu, jak zapewnicie sprzątanie." : turnoverSummary[0]) ?? (nights > 0 ? `${nights} ${nights === 1 ? "noc" : "nocy"} · sprawdzono rezerwacje i blokady` : "Wyjazd musi być po przyjeździe")}</p></div>
                    <div className="rounded-xl border border-[#c8d8bd] bg-[#f1f5e9] px-3 py-2.5 sm:px-4 sm:py-3"><p className="text-[10px] font-black uppercase tracking-[.1em] text-[#66794f] sm:tracking-[.14em]">Wycena</p><p className="mt-1 font-display text-xl font-semibold text-[#214f3d] sm:text-2xl">{calculatedTotal ? calculatedTotal.toLocaleString("pl-PL") : "—"} {calculatedTotal ? moneySuffix : ""}</p><p className="mt-0.5 text-xs font-bold text-[#647267]">{nights > 0 ? `${nights} ${nights === 1 ? "noc" : "nocy"}${calculatedTotal ? ` · ${(calculatedTotal / nights).toLocaleString("pl-PL", { maximumFractionDigits: 2 })} ${moneySuffix}/noc` : ""}` : "Wybierz daty"}</p></div>
                  </div>
                  {cleaningBuffers.length && !conflicts.length ? <fieldset className="sm:col-span-2 rounded-2xl border border-[#dfc16e] bg-[#fff8e8] p-4"><legend className="px-1 text-sm font-black text-[#654d16]">Jak obsłużycie sprzątanie?</legend><p className="mt-1 text-xs leading-5 text-[#756238]">To jest wyłącznie bufor techniczny. Rezerwacja gościa nadal zawsze blokuje termin.</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><label className="flex min-h-12 items-center gap-3 rounded-xl border border-[#dfd1aa] bg-white px-3 text-sm font-bold"><input checked={cleaningPlan === "self-cleaning"} name="cleaning-plan" onChange={() => setCleaningPlan("self-cleaning")} type="radio"/>Posprzątamy samodzielnie</label><label className="flex min-h-12 items-center gap-3 rounded-xl border border-[#dfd1aa] bg-white px-3 text-sm font-bold"><input checked={cleaningPlan === "arranged-cleaning"} name="cleaning-plan" onChange={() => setCleaningPlan("arranged-cleaning")} type="radio"/>Umówię osobę sprzątającą</label></div><label className="mt-3 flex items-start gap-3 text-sm font-bold text-[#5f4b1d]"><input checked={cleaningBufferConfirmed} className="mt-1" onChange={(event) => setConfirmedCleaningBufferKey(event.target.checked ? cleaningBufferKey : "")} type="checkbox"/>Potwierdzam, że sprawdziłem termin i świadomie zastępuję bufor własnym planem sprzątania.</label></fieldset> : null}
                  {importedBlockToReplace ? <fieldset className="sm:col-span-2 rounded-xl border border-[#dfaa9c] bg-[#fff0eb] p-3"><legend className="px-1 text-sm font-black text-[#7f3424]">Blokada z {form.platform}</legend><p className="mt-1 text-xs leading-5 text-[#704d44]">{importedBlockToReplace.reason}. Zapis rezerwacji usunie dokładnie tę blokadę i zastąpi ją pobytem.</p><label className="mt-2 flex items-start gap-2 text-sm font-bold text-[#6f3022]"><input checked={importedBlockConfirmed} className="mt-1" onChange={(event) => setConfirmedImportedBlockKey(event.target.checked ? importedBlockToReplace.id : "")} type="checkbox"/>Sprawdziłem domek i daty. Zastąp tę blokadę rezerwacją.</label></fieldset> : null}
                  <div className="min-w-0 max-w-full sm:col-span-2">
                    <StayDateTimeline
                      blocks={availabilityBlocks}
                      bookings={data.bookings}
                      checkIn={form.checkIn}
                      checkOut={form.checkOut}
                      selection={dateSelection}
                      unitId={form.unitId}
                      onSelect={(date) => {
                        if (dateSelection === "checkIn") {
                          setForm((current) => ({
                            ...current,
                            checkIn: date,
                            checkOut: current.checkOut > date ? current.checkOut : shiftDate(date, 1),
                          }));
                          setDateSelection("checkOut");
                          return;
                        }
                        if (date <= form.checkIn) {
                          setForm((current) => ({ ...current, checkIn: date, checkOut: shiftDate(date, 1) }));
                        } else {
                          setForm((current) => ({ ...current, checkOut: date }));
                          setDateSelection("checkIn");
                        }
                      }}
                    />
                  </div>
                  <Field label="Przyjazd"><input className={inputClass} required type="date" value={form.checkIn} onChange={(e) => setForm({ ...form, checkIn: e.target.value })} /></Field>
                  <Field label="Wyjazd"><input className={inputClass} required type="date" value={form.checkOut} onChange={(e) => setForm({ ...form, checkOut: e.target.value })} /></Field>
                  <Field label="Dorośli"><input className={inputClass} min="1" required type="number" value={form.adults} onChange={(e) => setForm({ ...form, adults: e.target.value })} /></Field>
                  <div className="flex min-h-11 items-center"><button className="text-sm font-black text-[#2b6752]" type="button" onClick={() => { setShowChildren((value) => !value); if (showChildren) setForm({ ...form, children: "0" }); }}>{showChildren ? "Usuń dzieci z pobytu" : "Dodaj dzieci"}</button></div>
                  {showChildren ? <Field label="Liczba dzieci"><input className={inputClass} min="0" type="number" value={form.children} onChange={(e) => setForm({ ...form, children: e.target.value })} /></Field> : null}
                  <div className="sm:col-span-2 rounded-xl border border-[#ddd6c9] bg-white p-3">
                    <button className="flex min-h-11 w-full items-center justify-between gap-3 text-left text-sm font-black text-[#355248]" type="button" onClick={() => setShowTimeExceptions((value) => !value)}><span>Godziny standardowe: {data.settings.defaultCheckIn} przyjazd · {data.settings.defaultCheckOut} wyjazd</span><span>{showTimeExceptions ? "Ukryj wyjątek" : "Zmień godziny"}</span></button>
                    {showTimeExceptions ? <div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="Wyjątkowa godzina przyjazdu"><input className={inputClass} type="time" value={form.arrivalTime} onChange={(e) => setForm({ ...form, arrivalTime: e.target.value })} /></Field><Field label="Wyjątkowa godzina wyjazdu"><input className={inputClass} type="time" value={form.departureTime} onChange={(e) => setForm({ ...form, departureTime: e.target.value })} /></Field></div> : null}
                  </div>
                </div>
                {rateQuote.belowMinimum ? <p className="rounded-xl border border-[#ecd39b] bg-[#fbf0d3] p-3 text-xs font-bold text-[#745815]">Cennik sezonowy sugeruje minimum {rateQuote.minimumNights} noce. Możesz przejść dalej, ale sprawdź wyjątek przed potwierdzeniem.</p> : null}
              </div> : null}

              {step === 2 ? <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
                <DialogSection title="Gość i kontakt" />
                <p className="text-xs font-black uppercase tracking-[.14em] text-[#7d8b4d]">Gość i kontakt</p>
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
                  <Field label="Imię"><input autoFocus className={inputClass} autoComplete="given-name" placeholder="Anna" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></Field>
                  <Field label="Nazwisko / nazwa rezerwacji" hint="Opcjonalne, jeśli podano imię."><input className={inputClass} autoComplete="family-name" placeholder="Kowalska" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></Field>
                  <Field label="Telefon"><input className={inputClass} autoComplete="tel" inputMode="tel" placeholder="+48 600 000 000" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
                  <Field label="E-mail"><input className={inputClass} autoComplete="email" placeholder="gosc@example.com" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
                  <Field label="Język wiadomości"><select className={inputClass} value={form.preferredLanguage} onChange={(e) => setForm({ ...form, preferredLanguage: e.target.value as NonNullable<GuestPerson["preferredLanguage"]> })}><option value="pl">Polski</option><option value="de">Deutsch</option><option value="en">English</option></select></Field>
                </div>
                <p className="text-xs font-black uppercase tracking-[.14em] text-[#7d8b4d]">Sprzedaż i odkrycie</p>
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
                  <Field label="Kanał zawarcia rezerwacji"><select className={inputClass} value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value as Channel })}>{bookingChannels.map((item) => <option key={item}>{item}</option>)}</select></Field>
                  <Field label="Jak gość odkrył obiekt?"><select className={inputClass} value={form.discoveryChannel} onChange={(e) => setForm((current) => ({ ...current, discoveryChannel: e.target.value }))}>{discoveryChannels.map((item) => <option key={item}>{item}</option>)}</select></Field>
                  {isOta ? <Field label="Numer rezerwacji OTA" hint="Numer z panelu Booking, Airbnb lub innej platformy."><input className={inputClass} placeholder="np. BKG-12345" value={form.externalNo} onChange={(e) => setForm({ ...form, externalNo: e.target.value })} /></Field> : null}
                  {isOta ? <Field label="Prowizja OTA"><MoneyInput suffix={form.currency} value={form.commission} onChange={(value) => setForm({ ...form, commission: value })} /></Field> : null}
                  <div className="sm:col-span-2"><Field label="Informacje dodatkowe"><textarea className={`${inputClass} min-h-24 resize-y`} placeholder="Życzenia i ustalenia dotyczące pobytu…" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field></div>
                </div>
              </div> : null}

              {step === 3 ? <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
                <DialogSection title="Cena i płatność" />
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
                  <Field label="Cena za dobę"><MoneyInput suffix={moneySuffix} value={form.pricingMode === "rate-card" ? suggestedNightPrice : form.pricePerNight || (form.totalPrice && nights ? String(Math.round(calculatedTotal / nights * 100) / 100) : "")} onChange={(value) => setForm({ ...form, pricePerNight: value, totalPrice: "", pricingMode: "manual" })} /></Field>
                  <Field label="Cena za pobyt"><MoneyInput suffix={moneySuffix} value={form.pricingMode === "rate-card" ? String(rateQuote.total || "") : form.totalPrice || (form.pricePerNight ? String(calculatedTotal) : "")} onChange={(value) => setForm({ ...form, totalPrice: value, pricePerNight: "", pricingMode: "manual" })} /></Field>
                  <Field label="Status płatności"><select className={inputClass} value={form.paymentStatus} onChange={(e) => setForm({ ...form, paymentStatus: e.target.value })}>{["Oczekiwanie na zadatek", "Brak wpłaty", "Wpłacony zadatek", "Częściowo opłacone", "Wpłacona całość", "Anulowane"].map((item) => <option key={item}>{item}</option>)}</select></Field>
                  <Field label="Rodzaj płatności"><select className={inputClass} value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value as NonNullable<Booking["paymentMethod"]> })}>{["Brak", "Przelew", "Gotówka", "Karta", "Online"].map((item) => <option key={item}>{item}</option>)}</select></Field>
                  <div className="rounded-xl border border-[#d8dfcc] bg-[#f7f8f2] p-3 sm:col-span-2">
                    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.13em] text-[#6d7b50]">Zadatek domyślny · 33%</p><p className="mt-1 text-lg font-black">{suggestedDeposit.toLocaleString("pl-PL")} {moneySuffix}</p></div><button className="min-h-10 text-sm font-black text-[#2b6752]" type="button" onClick={() => { setDepositOverride((value) => !value); if (!depositOverride) setForm({ ...form, depositAmount: String(suggestedDeposit || "") }); }}>{depositOverride ? "Wróć do 33%" : "Ustaw wyjątek"}</button></div>
                    {depositOverride ? <div className="mt-3"><Field label="Wyjątkowa kwota zadatku"><MoneyInput suffix={moneySuffix} value={form.depositAmount} onChange={(value) => setForm({ ...form, depositAmount: value })} /></Field></div> : null}
                  </div>
                  <Field label="Termin zadatku"><input className={inputClass} type="date" value={form.depositDueDate} onChange={(e) => setForm({ ...form, depositDueDate: e.target.value })} /></Field>
                  <Field label="Waluta"><select className={inputClass} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value as NonNullable<Booking["currency"]> })}><option>PLN</option><option>EUR</option></select></Field>
                </div>
                <div className="rounded-2xl border border-[#d8dfcc] bg-[#edf2e5] p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-black">{form.pricingMode === "manual" ? "Cena ustawiona ręcznie" : rateCardAvailable ? "Cena wyliczana z cennika" : "Cena wymaga wpisania"}</p><p className="mt-1 text-xs leading-5 text-[#627069]">{!rateCardAvailable ? "Cennik bazowy jest prowadzony w PLN. Dla EUR wpisz cenę ręcznie — system nie zgaduje kursu walutowego." : rateQuote.breakdown.length ? rateQuote.breakdown.map((item) => `${item.label}: ${item.nights} × ${item.pricePerNight.toLocaleString("pl-PL")} zł`).join(" · ") : "Uzupełnij cenę bazową domku w Ustawieniach."}</p>{form.pricingMode === "manual" && rateQuote.total ? <p className={`mt-2 text-xs font-black ${rateDifference < 0 ? "text-[#9b4029]" : "text-[#326045]"}`}>{rateDifference === 0 ? "Bez rabatu względem cennika." : rateDifference < 0 ? `Rabat względem cennika: ${Math.abs(rateDifference).toLocaleString("pl-PL")} ${moneySuffix}.` : `Cena wyższa od cennika o ${rateDifference.toLocaleString("pl-PL")} ${moneySuffix}.`}</p> : null}</div>{form.pricingMode === "manual" ? <Button type="button" variant="secondary" onClick={() => setForm({ ...form, pricePerNight: "", totalPrice: "", pricingMode: "rate-card" })}>Przywróć cennik</Button> : null}</div></div>
                <details className="rounded-xl border border-[#ddd6c9] bg-white p-3"><summary className="cursor-pointer text-sm font-black text-[#355248]">Dane opcjonalne: faktura i adres</summary><p className="mt-2 text-xs leading-5 text-[#68756e]">Dane fakturowe uzupełnij dopiero na życzenie gościa w procesie wystawiania faktury. Nie są wymagane do zapisania pobytu.</p></details>
              </div> : null}
            </div>

          </div>

          <div className="mobile-dialog-footer flex gap-2 border-t border-[#e3dccf] bg-white px-3 py-2 sm:static sm:items-center sm:justify-between sm:px-7 sm:py-4">
            <div className="grid grid-cols-2 items-center gap-2 sm:flex">
              {booking ? <Button className={`${step > 1 ? "mobile-dialog-delete-late" : ""} w-full`} type="button" variant="danger" onClick={() => setConfirmDeletion(true)}>Usuń do kosza</Button> : null}
              <Button className="mobile-dialog-cancel w-full" type="button" variant="ghost" onClick={onClose}>Anuluj</Button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              {step > 1 ? <Button className="w-full" type="button" variant="secondary" onClick={() => { setError(""); moveToStep(step - 1); }}><Icon className="size-4 rotate-180" name="arrow" />Wstecz</Button> : <span aria-hidden="true" />}
              {step < 3 ? <Button key="next" className="w-full" type="button" onClick={goNext}>Dalej <Icon className="size-4" name="arrow" /></Button> : <Button key="save" aria-label={saving ? "Zapisywanie…" : booking ? "Zapisz zmiany" : "Dodaj rezerwację"} className="w-full" disabled={saving} type="submit"><Icon className="size-4" name={saving ? "clock" : "check"} /><span className="sm:hidden">{saving ? "Zapisuję…" : "Zapisz"}</span><span className="hidden sm:inline">{saving ? "Zapisywanie…" : booking ? "Zapisz zmiany" : "Dodaj rezerwację"}</span></Button>}
            </div>
          </div>
          </fieldset>
        </form>
      {confirmDeletion && booking ? (
        <Dialog
          ariaDescribedby="delete-booking-description"
          ariaLabelledby="delete-booking-title"
          className="w-full max-w-md rounded-[22px] border border-[#e3b9ad] bg-[#fffdf8] p-6 shadow-[0_28px_80px_rgba(8,29,22,.35)]"
          onClose={() => setConfirmDeletion(false)}
          overlayClassName="z-[60] grid place-items-center"
          role="alertdialog"
        >
          <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#a84a2e]">Usuwanie rezerwacji</p>
          <h3 className="mt-1 font-display text-2xl font-semibold" id="delete-booking-title">Przenieść do kosza?</h3>
          <p className="mt-3 text-sm leading-6 text-[#5d6c65]" id="delete-booking-description"><strong>{booking.guestLabel}</strong> zniknie z kalendarza i bieżących list. Rezerwację będzie można przywrócić z kosza przez 30 dni, potem zostanie usunięta automatycznie.</p>
          {error ? <p aria-live="assertive" className="mt-4 rounded-xl bg-[#f9dfd7] p-3 text-sm font-bold text-[#963c27]">{error}</p> : null}
          <div className="mt-6 flex justify-end gap-2"><Button data-dialog-initial-focus disabled={saving} type="button" variant="secondary" onClick={() => setConfirmDeletion(false)}>Wróć</Button><Button disabled={saving} type="button" variant="danger" onClick={async () => { setSaving(true); setError(""); const result = await deleteBooking(booking.id); setSaving(false); if (!result.ok) { setError(result.message); return; } onAdded(); }}>{saving ? "Usuwanie…" : "Tak, usuń do kosza"}</Button></div>
        </Dialog>
      ) : null}
    </Dialog>
  );
}

function DialogSection({ title }: { title: string }) {
  return <h3 className="font-display text-2xl font-semibold">{title}</h3>;
}

function StayDateTimeline({
  blocks,
  bookings,
  checkIn,
  checkOut,
  onSelect,
  selection,
  unitId,
}: {
  blocks: CalendarBlock[];
  bookings: Booking[];
  checkIn: string;
  checkOut: string;
  onSelect: (date: string) => void;
  selection: "checkIn" | "checkOut";
  unitId: string;
}) {
  const [anchor, setAnchor] = useState(() => shiftDate(checkIn || localDateValue(new Date()), -3));
  const dates = Array.from({ length: 21 }, (_, index) => shiftDate(anchor, index));
  const first = dates[0];
  const last = dates[dates.length - 1];
  const occupied = (date: string) => bookings.some((item) =>
    item.unitId === unitId
    && item.workflowStatus !== "Anulowana"
    && !item.deletedAt
    && item.checkIn <= date
    && item.checkOut > date,
  );
  const blocked = (date: string) => blocks.some((item) =>
    item.unitId === unitId
    && item.status !== "Anulowana"
    && item.dateFrom <= date
    && item.dateTo > date,
  );

  return (
    <section aria-label="Wizualny wybór terminu pobytu" className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-[#d8d0c2] bg-[#f7f4ed]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ddd6c9] px-3 py-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.15em] text-[#75824e]">Oś pobytu · {selection === "checkIn" ? "wybierz przyjazd" : "teraz wybierz wyjazd"}</p>
          <p className="mt-0.5 text-sm font-black text-[#29483c]">{formatPolishDate(first, { year: false })} – {formatPolishDate(last)}</p>
        </div>
        <div className="flex gap-1.5">
          <button aria-label="Pokaż wcześniejsze daty" className="grid size-9 place-items-center rounded-xl border border-[#d2cabb] bg-white text-[#355248]" onClick={() => setAnchor((current) => shiftDate(current, -14))} type="button"><Icon className="size-4 rotate-180" name="chevron"/></button>
          <button className="min-h-9 rounded-xl border border-[#d2cabb] bg-white px-3 text-xs font-black text-[#355248]" onClick={() => setAnchor(shiftDate(localDateValue(new Date()), -3))} type="button">Dzisiaj</button>
          <button aria-label="Pokaż późniejsze daty" className="grid size-9 place-items-center rounded-xl border border-[#d2cabb] bg-white text-[#355248]" onClick={() => setAnchor((current) => shiftDate(current, 14))} type="button"><Icon className="size-4" name="chevron"/></button>
        </div>
      </header>
      <div aria-label="Daty pobytu. Przesuń poziomo, aby zobaczyć kolejne dni." className="scrollbar-thin w-full max-w-full overflow-x-auto overscroll-x-contain" role="region" tabIndex={0}>
        <div className="grid min-w-[840px] grid-cols-[repeat(21,minmax(40px,1fr))]">
          {dates.map((date) => {
            const parsed = new Date(`${date}T12:00:00`);
            const isStart = date === checkIn;
            const isEnd = date === checkOut;
            const inStay = date > checkIn && date < checkOut;
            const unavailable = occupied(date) || blocked(date);
            const weekend = [0, 6].includes(parsed.getDay());
            return (
              <button
                aria-label={`${selection === "checkIn" ? "Ustaw przyjazd" : "Ustaw wyjazd"} ${formatPolishDate(date)}`}
                className={`relative min-h-[76px] border-r border-[#ded8cd] px-1 py-2 text-center transition focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#174d3b] ${isStart || isEnd ? "bg-[#174d3b] text-white" : inStay ? "bg-[#dce8d4] text-[#234b3a]" : unavailable ? "bg-[#f4ddd5] text-[#843f2d]" : weekend ? "bg-[#eeece6] text-[#52635b]" : "bg-white text-[#3e5148] hover:bg-[#e8efe1]"}`}
                key={date}
                onClick={() => onSelect(date)}
                type="button"
              >
                <span className="block text-[8px] font-black uppercase tracking-[.08em] opacity-65">{new Intl.DateTimeFormat("pl-PL", { weekday: "short" }).format(parsed).replace(".", "")}</span>
                <span className="mt-1 block font-display text-lg font-semibold">{parsed.getDate()}</span>
                <span className="mt-0.5 block text-[8px] font-black uppercase">{isStart ? "przyjazd" : isEnd ? "wyjazd" : unavailable ? "zajęte" : inStay ? "pobyt" : "wolne"}</span>
              </button>
            );
          })}
        </div>
      </div>
      <footer className="flex flex-wrap gap-x-4 gap-y-1 border-t border-[#ddd6c9] px-3 py-2 text-[10px] font-bold text-[#69756f]">
        <span><i className="mr-1 inline-block size-2 rounded-full bg-[#174d3b]"/>wybrany termin</span>
        <span><i className="mr-1 inline-block size-2 rounded-full bg-[#dce8d4]"/>noce pobytu</span>
        <span><i className="mr-1 inline-block size-2 rounded-full bg-[#e9bdae]"/>zajęte lub zablokowane</span>
      </footer>
    </section>
  );
}

function MoneyInput({ suffix, value, onChange }: { suffix: string; value: string; onChange: (value: string) => void }) {
  return <div className="relative"><input className={`${inputClass} pr-14`} inputMode="decimal" min="0" placeholder="0" type="number" value={value} onChange={(event) => onChange(event.target.value)} /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-[#78827c]">{suffix}</span></div>;
}

function localDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return localDateValue(date);
}
