"use client";

import { useState, type FormEvent, type RefObject } from "react";
import { useAppStore } from "@/components/layout/app-store";
import { Icon } from "@/components/ui/icons";
import { Button, Field, inputClass } from "@/components/ui/primitives";
import { Dialog } from "@/components/ui/dialog";
import type { Booking, CalendarBlock, Channel, ContactConsent, PaymentStatus } from "@/lib/types";
import { getBookingConflicts, nightsBetween } from "@/lib/workflow/rules";
import { guestDisplayName, validateGuestStep } from "@/lib/workflow/booking-form";
import { quoteStay } from "@/lib/workflow/pricing";
import { formatPolishDate } from "@/lib/date";

type BookingDefaults = Partial<Pick<Booking, "unitId" | "checkIn" | "checkOut" | "arrivalTime" | "departureTime">>;
const bookingChannels: Channel[] = ["Telefon", "E-mail", "Bezpośrednio", "Strona www", "Booking", "Airbnb", "Slowhop", "Aloha Camp", "Agoda", "Expedia", "VRBO", "Inne"];
const otaChannels: Channel[] = ["Booking", "Airbnb", "Slowhop", "Aloha Camp", "Agoda", "Expedia", "VRBO"];
const discoveryChannels = ["Nie wiadomo", "Google", "Facebook", "Instagram", "Polecenie", "Booking", "Airbnb", "Aloha Camp", "Strona www", "Inne"];

export function NewBookingDialog({ onClose, onAdded, booking, defaults, returnFocusRef }: { onClose: () => void; onAdded: () => void; booking?: Booking; defaults?: BookingDefaults; returnFocusRef?: RefObject<HTMLElement | null> }) {
  const { data, addBooking, updateBooking, deleteBooking } = useAppStore();
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
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
  const [draftId] = useState(() => `SUS-${Date.now().toString().slice(-6)}`);
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
      firstName: name.length > 1 ? name.shift() ?? "" : "", lastName: name.join(" ") || booking?.guestLabel || "", phone: contact?.phone ?? "", email: contact?.email ?? "",
      unitId: booking?.unitId ?? defaults?.unitId ?? data.units[0]?.id ?? "", checkIn: booking?.checkIn ?? defaults?.checkIn ?? today, checkOut: booking?.checkOut ?? defaults?.checkOut ?? tomorrow,
      arrivalTime: booking?.arrivalTime ?? defaults?.arrivalTime ?? data.settings.defaultCheckIn, departureTime: booking?.departureTime ?? defaults?.departureTime ?? data.settings.defaultCheckOut, adults: String(booking?.adults ?? 2), children: String(booking?.children ?? 0),
      platform: booking?.platform ?? "Telefon", discoveryChannel: discoveryChannels.includes(booking?.source ?? "") ? booking!.source : "Nie wiadomo", externalNo: booking?.platformReservationNo ?? "", commission: booking?.commission ? String(booking.commission) : "", pricePerNight: booking?.pricePerNight ? String(booking.pricePerNight) : "", totalPrice: booking?.grossPrice ? String(booking.grossPrice) : "",
      pricingMode: booking?.pricingMode ?? (booking?.grossPrice ? "manual" as const : "rate-card" as const),
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
  const conflicts = form.checkIn && form.checkOut ? getBookingConflicts(data.bookings, data.blocks, conflictProbe) : [];
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
    }
    if (targetStep === 2) return validateGuestStep(form.firstName, form.lastName);
  }

  function goNext() {
    setError("");
    const message = validationError(step);
    if (message) { setError(message); return; }
    setStep((current) => Math.min(3, current + 1));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < 3) { goNext(); return; }
    if (conflicts.length) { setError(`Ten termin jest zajęty: ${conflicts[0]}.`); setStep(1); return; }
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
      grossPrice: calculatedTotal || undefined,
      pricePerNight: form.pricingMode === "rate-card" ? rateQuote.averagePerNight || undefined : Number(form.pricePerNight) || (form.totalPrice && nights ? calculatedTotal / nights : undefined),
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
    };
    const contact: ContactConsent = {
      ...(data.consents.find((item) => item.bookingId === savedBooking.id) ?? {
        marketingConsent: "Do dopytania",
        photoFbConsent: "Do dopytania",
        photoSiteAdsConsent: "Do dopytania",
      }),
      bookingId: savedBooking.id,
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
    };
    if (booking) updateBooking(savedBooking, contact);
    else addBooking(savedBooking, contact);
    onAdded();
  }

  const stepLabels = ["Termin", "Gość", "Finanse"];
  const moneySuffix = form.currency;
  return (
    <Dialog
      ariaLabelledby="new-booking-title"
      className="mx-auto my-2 w-full max-w-5xl overflow-hidden rounded-[24px] bg-[#fffdf8] shadow-[0_30px_90px_rgba(8,29,22,.35)] sm:my-5"
      onClose={onClose}
      overlayClassName="overflow-y-auto p-2 sm:p-5"
      returnFocusRef={returnFocusRef}
    >
        <div className="border-b border-[#e3dccf] bg-[radial-gradient(circle_at_85%_-30%,#dce7bd_0,transparent_38%)] px-5 pb-5 pt-5 sm:px-7 sm:pt-6">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#81904e]">{booking ? "Edycja pobytu" : "Nowy pobyt"}</p><h2 className="font-display text-3xl font-semibold tracking-[-.03em]" id="new-booking-title">{booking ? "Edytuj rezerwację" : "Dodaj rezerwację"}</h2><p className="mt-1 text-sm text-[#66736c]">Termin, gość i rozliczenie — system od razu sprawdzi dostępność.</p></div>
            <button aria-label="Zamknij" className="grid size-10 shrink-0 place-items-center rounded-xl border border-[#ddd6c9] bg-white/80 transition hover:bg-white" onClick={onClose}><Icon className="size-5" name="close" /></button>
          </div>
          <ol className="mt-5 grid grid-cols-3 gap-2">
            {stepLabels.map((label, index) => {
              const number = index + 1;
              const available = number <= step + 1;
              return <li key={label}><button type="button" disabled={!available} className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-black transition sm:px-3 ${step === number ? "bg-[#174d3b] text-white shadow-lg" : step > number ? "bg-[#e2ecdc] text-[#285642]" : available ? "bg-white/80 text-[#5d6d65] hover:bg-white" : "cursor-not-allowed bg-white/45 text-[#9aa19d]"}`} onClick={() => { setError(""); if (number <= step) setStep(number); else goNext(); }}><span className={`grid size-6 shrink-0 place-items-center rounded-full text-[10px] ${step === number ? "bg-white text-[#174d3b]" : "bg-[#f2efe7]"}`}>{step > number ? "✓" : number}</span><span className="truncate">{label}</span></button></li>;
            })}
          </ol>
          {error ? <p aria-live="polite" className="mt-3 rounded-xl border border-[#efb8a8] bg-[#f9dfd7] px-4 py-3 text-sm font-bold text-[#963c27]">{error}</p> : null}
        </div>

        <form onSubmit={submit}>
          <div className="grid min-h-[440px] lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="p-5 sm:p-7">
              {step === 1 ? <div className="grid gap-5">
                <DialogSection eyebrow="Krok 1" title="Kiedy i który domek?" body="Najpierw blokujemy właściwy termin. Konflikt zobaczysz przed wpisywaniem danych gościa." />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Domek"><select autoFocus className={inputClass} required value={form.unitId} onChange={(e) => setForm({ ...form, unitId: e.target.value })}>{data.units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name} · do {unit.maxPeople} osób</option>)}</select></Field>
                  <div className={`rounded-xl border px-4 py-3 ${conflicts.length ? "border-[#efb7a8] bg-[#fbe7e1] text-[#8f3b27]" : "border-[#bdd7c3] bg-[#e9f2e7] text-[#275e3f]"}`}><p className="text-[10px] font-black uppercase tracking-[.14em]">Dostępność</p><p className="mt-1 text-sm font-black">{conflicts.length ? "Termin zajęty" : nights > 0 ? sameDayTurnovers.length ? "Termin wolny · turnover tego samego dnia" : "Termin wolny" : "Wybierz poprawne daty"}</p><p className="mt-0.5 text-xs">{conflicts[0] ?? turnoverSummary[0] ?? (nights > 0 ? `${nights} ${nights === 1 ? "noc" : "nocy"} · sprawdzono rezerwacje i blokady` : "Wyjazd musi być po przyjeździe")}</p></div>
                  <div className="sm:col-span-2">
                    <StayDateTimeline
                      blocks={data.blocks}
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

              {step === 2 ? <div className="grid gap-5">
                <DialogSection eyebrow="Krok 2" title="Gość, kontakt i źródło" body="Kanał zawarcia rezerwacji, dane kontaktowe i sposób odkrycia obiektu są osobnymi informacjami." />
                <p className="text-xs font-black uppercase tracking-[.14em] text-[#7d8b4d]">Gość i kontakt</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Imię"><input autoFocus className={inputClass} autoComplete="given-name" placeholder="Anna" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></Field>
                  <Field label="Nazwisko / nazwa rezerwacji" hint="Opcjonalne, jeśli podano imię."><input className={inputClass} autoComplete="family-name" placeholder="Kowalska" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></Field>
                  <Field label="Telefon"><input className={inputClass} autoComplete="tel" inputMode="tel" placeholder="+48 600 000 000" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
                  <Field label="E-mail"><input className={inputClass} autoComplete="email" placeholder="gosc@example.com" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
                </div>
                <p className="text-xs font-black uppercase tracking-[.14em] text-[#7d8b4d]">Sprzedaż i odkrycie</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Kanał zawarcia rezerwacji"><select className={inputClass} value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value as Channel })}>{bookingChannels.map((item) => <option key={item}>{item}</option>)}</select></Field>
                  <Field label="Jak gość odkrył obiekt?"><select className={inputClass} value={form.discoveryChannel} onChange={(e) => setForm((current) => ({ ...current, discoveryChannel: e.target.value }))}>{discoveryChannels.map((item) => <option key={item}>{item}</option>)}</select></Field>
                  {isOta ? <Field label="Numer rezerwacji OTA" hint="Numer z panelu Booking, Airbnb lub innej platformy."><input className={inputClass} placeholder="np. BKG-12345" value={form.externalNo} onChange={(e) => setForm({ ...form, externalNo: e.target.value })} /></Field> : null}
                  {isOta ? <Field label="Prowizja OTA"><MoneyInput suffix={form.currency} value={form.commission} onChange={(value) => setForm({ ...form, commission: value })} /></Field> : null}
                  <div className="sm:col-span-2"><Field label="Informacje dodatkowe"><textarea className={`${inputClass} min-h-24 resize-y`} placeholder="Życzenia i ustalenia dotyczące pobytu…" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field></div>
                  <p className="sm:col-span-2 rounded-xl bg-[#f4f1e9] p-3 text-xs leading-5 text-[#68756e]">Zwierzęta: zasada i dopłata nie są jeszcze zatwierdzone. Uzgodnij wyjątek ręcznie i zapisz go w informacjach dodatkowych — system nie dolicza opłaty automatycznie.</p>
                </div>
              </div> : null}

              {step === 3 ? <div className="grid gap-5">
                <DialogSection eyebrow="Krok 3" title="Cena i płatność" body="Możesz podać cenę za noc albo od razu pełną kwotę pobytu. Pełna kwota ma pierwszeństwo." />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Cena za dobę"><MoneyInput suffix={moneySuffix} value={form.pricingMode === "rate-card" ? suggestedNightPrice : form.pricePerNight} onChange={(value) => setForm({ ...form, pricePerNight: value, pricingMode: "manual" })} /></Field>
                  <Field label="Cena za pobyt"><MoneyInput suffix={moneySuffix} value={form.pricingMode === "rate-card" ? String(rateQuote.total || "") : form.totalPrice} onChange={(value) => setForm({ ...form, totalPrice: value, pricingMode: "manual" })} /></Field>
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

            <aside className="border-t border-[#e3dccf] bg-[#f1eee5] p-5 sm:p-6 lg:border-l lg:border-t-0">
              <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#7d8b4d]">Podsumowanie</p>
              <h3 className="mt-1 font-display text-2xl font-semibold">{selectedUnit?.name ?? "Wybierz domek"}</h3>
              <div className="mt-5 grid gap-3 text-sm">
                <SummaryLine label="Termin" value={form.checkIn && form.checkOut ? `${formatPolishDate(form.checkIn)} – ${formatPolishDate(form.checkOut)}` : "—"} />
                <SummaryLine label="Pobyt" value={nights > 0 ? `${nights} ${nights === 1 ? "noc" : "nocy"}` : "—"} />
                <SummaryLine label="Goście" value={`${guestCount} os. (${form.adults || 0}+${form.children || 0})`} />
                <SummaryLine label="Klient" value={[form.firstName, form.lastName].filter(Boolean).join(" ") || "Do uzupełnienia"} />
                <SummaryLine label="Kanał rezerwacji" value={form.platform} />
                <SummaryLine label="Odkrycie" value={form.discoveryChannel} />
              </div>
              <div className="my-5 h-px bg-[#d7d0c3]" />
              <div className="flex items-end justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#7a857f]">Suma pobytu</p><p className="mt-1 font-display text-3xl font-semibold">{calculatedTotal ? calculatedTotal.toLocaleString("pl-PL") : "0"} <span className="text-base">{moneySuffix}</span></p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${conflicts.length ? "bg-[#f6d8cf] text-[#963c27]" : "bg-[#dbead8] text-[#2d6242]"}`}>{conflicts.length ? "Konflikt" : "Termin OK"}</span></div>
              <p className="mt-4 text-xs leading-5 text-[#68756e]">Po zapisaniu powstaną wyłącznie zadania operacyjne dotyczące płatności, przygotowania domku, sprzątania i opinii. Content pozostaje ręczną okazją.</p>
            </aside>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-[#e3dccf] bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
            <div className="flex items-center gap-2">
              {booking ? <Button type="button" variant="danger" onClick={() => setConfirmDeletion(true)}>Usuń do kosza</Button> : null}
              <Button type="button" variant="ghost" onClick={onClose}>Anuluj</Button>
            </div>
            <div className="flex gap-2">
              {step > 1 ? <Button type="button" variant="secondary" onClick={() => { setError(""); setStep((current) => current - 1); }}><Icon className="size-4 rotate-180" name="arrow" />Wstecz</Button> : null}
              {step < 3 ? <Button type="button" onClick={goNext}>Dalej <Icon className="size-4" name="arrow" /></Button> : <Button type="submit"><Icon className="size-4" name="check" />{booking ? "Zapisz zmiany" : "Dodaj rezerwację"}</Button>}
            </div>
          </div>
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
          <div className="mt-6 flex justify-end gap-2"><Button data-dialog-initial-focus type="button" variant="secondary" onClick={() => setConfirmDeletion(false)}>Wróć</Button><Button type="button" variant="danger" onClick={() => { deleteBooking(booking.id); onAdded(); }}>Tak, usuń do kosza</Button></div>
        </Dialog>
      ) : null}
    </Dialog>
  );
}

function DialogSection({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#7d8b4d]">{eyebrow}</p><h3 className="font-display text-2xl font-semibold">{title}</h3><p className="mt-1 max-w-2xl text-sm leading-6 text-[#65736c]">{body}</p></div>;
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
    <section aria-label="Wizualny wybór terminu pobytu" className="overflow-hidden rounded-2xl border border-[#d8d0c2] bg-[#f7f4ed]">
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
      <div className="scrollbar-thin overflow-x-auto">
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

function SummaryLine({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-3"><span className="text-[#748078]">{label}</span><span className="text-right font-black text-[#29453a]">{value}</span></div>;
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
