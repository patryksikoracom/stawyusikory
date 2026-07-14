"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAppStore } from "@/components/layout/app-store";
import { Icon } from "@/components/ui/icons";
import { Button, Field, inputClass } from "@/components/ui/primitives";
import type { Booking, Channel, ContactConsent, PaymentStatus } from "@/lib/types";
import { getBookingConflicts, nightsBetween } from "@/lib/workflow/rules";

export function NewBookingDialog({ onClose, onAdded, booking }: { onClose: () => void; onAdded: () => void; booking?: Booking }) {
  const { data, addBooking, updateBooking, updateConsent } = useAppStore();
  const dialogRef = useRef<HTMLElement>(null);
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
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
      unitId: booking?.unitId ?? data.units[0]?.id ?? "", checkIn: booking?.checkIn ?? today, checkOut: booking?.checkOut ?? tomorrow,
      arrivalTime: booking?.arrivalTime ?? "16:00", departureTime: booking?.departureTime ?? "11:00", adults: String(booking?.adults ?? 2), children: String(booking?.children ?? 0),
      platform: booking?.platform ?? "Telefon", externalNo: booking?.platformReservationNo ?? "", pricePerNight: booking?.pricePerNight ? String(booking.pricePerNight) : "", totalPrice: booking?.grossPrice ? String(booking.grossPrice) : "",
      paymentStatus: booking?.paymentStatus === "Opłacone" ? "Wpłacona całość" : booking?.paymentStatus === "Zaliczka" ? "Wpłacony zadatek" : booking?.paymentStatus === "Częściowo" ? "Częściowo opłacone" : "Oczekiwanie na zadatek", depositAmount: booking?.depositAmount ? String(booking.depositAmount) : "", depositDueDate: booking?.depositDueDate ?? "",
      paymentMethod: booking?.paymentMethod ?? "Brak", currency: booking?.currency ?? "PLN", notes: booking?.specialRequests ?? "",
    };
  });

  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])"));
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [onClose]);

  const nights = nightsBetween(form.checkIn, form.checkOut);
  const selectedUnit = data.units.find((unit) => unit.id === form.unitId);
  const guestCount = Number(form.adults || 0) + Number(form.children || 0);
  const calculatedTotal = form.totalPrice ? Number(form.totalPrice) : Number(form.pricePerNight || 0) * nights;
  const conflictProbe: Booking = {
    id: booking?.id ?? "draft", bookingDate: booking?.bookingDate ?? today, source: "Panel Stawy OS", platform: form.platform as Channel,
    unitId: form.unitId, checkIn: form.checkIn, checkOut: form.checkOut,
    adults: Number(form.adults || 0), children: Number(form.children || 0),
    guestLabel: "Wersja robocza", paymentStatus: "Do uzupełnienia",
    workflowStatus: "Nowa", createdBy: "Stawy OS",
  };
  const conflicts = form.checkIn && form.checkOut ? getBookingConflicts(data.bookings, data.blocks, conflictProbe) : [];

  function normalizedPaymentStatus(): PaymentStatus {
    if (form.paymentStatus === "Wpłacona całość") return "Opłacone";
    if (form.paymentStatus === "Wpłacony zadatek") return "Zaliczka";
    if (form.paymentStatus === "Częściowo opłacone") return "Częściowo";
    if (form.paymentStatus === "Anulowane") return "Anulowane";
    return calculatedTotal ? "Do dopłaty" : "Do uzupełnienia";
  }

  function goNext() {
    setError("");
    if (step === 1) {
      if (!form.unitId || !form.checkIn || !form.checkOut) { setError("Wybierz domek oraz pełny termin pobytu."); return; }
      if (nights < 1) { setError("Wyjazd musi być co najmniej dzień po przyjeździe."); return; }
      if (Number(form.adults) < 1) { setError("Rezerwacja musi mieć co najmniej jedną osobę dorosłą."); return; }
      if (selectedUnit && guestCount > selectedUnit.maxPeople) { setError(`${selectedUnit.name} mieści maksymalnie ${selectedUnit.maxPeople} osób.`); return; }
      if (conflicts.length) { setError(`Ten termin jest zajęty: ${conflicts[0]}.`); return; }
    }
    if (step === 2 && !form.lastName.trim()) { setError("Uzupełnij nazwisko lub nazwę rezerwacji."); return; }
    setStep((current) => Math.min(3, current + 1));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < 3) { goNext(); return; }
    if (conflicts.length) { setError(`Ten termin jest zajęty: ${conflicts[0]}.`); setStep(1); return; }
    if (Number(form.depositAmount || 0) > calculatedTotal && calculatedTotal > 0) { setError("Zadatek nie może być większy niż suma rezerwacji."); return; }
    const guestLabel = [form.firstName.trim(), form.lastName.trim()].filter(Boolean).join(" ");
    const savedBooking: Booking = {
      ...booking,
      id: booking?.id ?? `SUS-${Date.now().toString().slice(-6)}`,
      bookingDate: booking?.bookingDate || today,
      source: form.platform === "Bezpośrednio" ? "Panel Stawy OS" : form.platform,
      platform: form.platform as Channel,
      platformReservationNo: form.externalNo.trim() || undefined,
      unitId: form.unitId,
      checkIn: form.checkIn,
      checkOut: form.checkOut,
      arrivalTime: form.arrivalTime,
      departureTime: form.departureTime,
      adults: Number(form.adults),
      children: Number(form.children),
      guestLabel,
      grossPrice: calculatedTotal || undefined,
      pricePerNight: Number(form.pricePerNight) || (calculatedTotal && nights ? calculatedTotal / nights : undefined),
      depositAmount: Number(form.depositAmount) || undefined,
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
    if (booking) { updateBooking(savedBooking); updateConsent(contact); }
    else addBooking(savedBooking, contact);
    onAdded();
  }

  const stepLabels = ["Termin", "Gość", "Finanse"];
  const moneySuffix = form.currency;
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#102c24]/70 p-2 backdrop-blur-sm sm:p-5" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section ref={dialogRef} aria-labelledby="new-booking-title" aria-modal="true" className="mx-auto my-2 w-full max-w-5xl overflow-hidden rounded-[24px] bg-[#fffdf8] shadow-[0_30px_90px_rgba(8,29,22,.35)] sm:my-5" role="dialog">
        <div className="border-b border-[#e3dccf] bg-[radial-gradient(circle_at_85%_-30%,#dce7bd_0,transparent_38%)] px-5 pb-5 pt-5 sm:px-7 sm:pt-6">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#81904e]">{booking ? "Edycja pobytu" : "Nowy pobyt"}</p><h2 className="font-display text-3xl font-semibold tracking-[-.03em]" id="new-booking-title">{booking ? "Edytuj rezerwację" : "Dodaj rezerwację"}</h2><p className="mt-1 text-sm text-[#66736c]">Termin, gość i rozliczenie — system od razu sprawdzi dostępność.</p></div>
            <button aria-label="Zamknij" className="grid size-10 shrink-0 place-items-center rounded-xl border border-[#ddd6c9] bg-white/80 transition hover:bg-white" onClick={onClose}><Icon className="size-5" name="close" /></button>
          </div>
          <ol className="mt-5 grid grid-cols-3 gap-2">
            {stepLabels.map((label, index) => {
              const number = index + 1;
              return <li className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-black transition sm:px-3 ${step === number ? "bg-[#174d3b] text-white shadow-lg" : step > number ? "bg-[#e2ecdc] text-[#285642]" : "bg-white/65 text-[#78827b]"}`} key={label}><span className={`grid size-6 shrink-0 place-items-center rounded-full text-[10px] ${step === number ? "bg-white text-[#174d3b]" : "bg-[#f2efe7]"}`}>{step > number ? "✓" : number}</span><span className="truncate">{label}</span></li>;
            })}
          </ol>
        </div>

        <form onSubmit={submit}>
          <div className="grid min-h-[440px] lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="p-5 sm:p-7">
              {step === 1 ? <div className="grid gap-5">
                <DialogSection eyebrow="Krok 1" title="Kiedy i który domek?" body="Najpierw blokujemy właściwy termin. Konflikt zobaczysz przed wpisywaniem danych gościa." />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Domek"><select autoFocus className={inputClass} required value={form.unitId} onChange={(e) => setForm({ ...form, unitId: e.target.value })}>{data.units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name} · do {unit.maxPeople} osób</option>)}</select></Field>
                  <div className={`rounded-xl border px-4 py-3 ${conflicts.length ? "border-[#efb7a8] bg-[#fbe7e1] text-[#8f3b27]" : "border-[#bdd7c3] bg-[#e9f2e7] text-[#275e3f]"}`}><p className="text-[10px] font-black uppercase tracking-[.14em]">Dostępność</p><p className="mt-1 text-sm font-black">{conflicts.length ? "Termin zajęty" : nights > 0 ? "Termin wolny" : "Wybierz poprawne daty"}</p><p className="mt-0.5 text-xs">{conflicts[0] ?? (nights > 0 ? `${nights} ${nights === 1 ? "noc" : "nocy"} · sprawdzono rezerwacje i blokady` : "Wyjazd musi być po przyjeździe")}</p></div>
                  <Field label="Przyjazd"><input className={inputClass} required type="date" value={form.checkIn} onChange={(e) => setForm({ ...form, checkIn: e.target.value })} /></Field>
                  <Field label="Wyjazd"><input className={inputClass} required type="date" value={form.checkOut} onChange={(e) => setForm({ ...form, checkOut: e.target.value })} /></Field>
                  <Field label="Godzina przyjazdu"><input className={inputClass} type="time" value={form.arrivalTime} onChange={(e) => setForm({ ...form, arrivalTime: e.target.value })} /></Field>
                  <Field label="Godzina wyjazdu"><input className={inputClass} type="time" value={form.departureTime} onChange={(e) => setForm({ ...form, departureTime: e.target.value })} /></Field>
                  <Field label="Dorośli"><input className={inputClass} min="1" required type="number" value={form.adults} onChange={(e) => setForm({ ...form, adults: e.target.value })} /></Field>
                  <Field label="Dzieci"><input className={inputClass} min="0" type="number" value={form.children} onChange={(e) => setForm({ ...form, children: e.target.value })} /></Field>
                </div>
              </div> : null}

              {step === 2 ? <div className="grid gap-5">
                <DialogSection eyebrow="Krok 2" title="Kto przyjeżdża?" body="Minimum to nazwisko. Kontakt pozwoli później wysłać instrukcję przyjazdu i prośbę o opinię." />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Imię"><input autoFocus className={inputClass} autoComplete="given-name" placeholder="Anna" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></Field>
                  <Field label="Nazwisko / nazwa rezerwacji"><input className={inputClass} autoComplete="family-name" placeholder="Kowalska" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></Field>
                  <Field label="Telefon"><input className={inputClass} autoComplete="tel" inputMode="tel" placeholder="+48 600 000 000" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
                  <Field label="E-mail"><input className={inputClass} autoComplete="email" placeholder="gosc@example.com" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
                  <Field label="Źródło rezerwacji"><select className={inputClass} value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value as Channel })}>{["Telefon", "E-mail", "Bezpośrednio", "Strona www", "Booking", "Airbnb", "Facebook", "Google", "Polecenie", "Slowhop", "Aloha Camp", "Agoda", "Expedia", "VRBO", "Influencer/barter", "Inne"].map((item) => <option key={item}>{item}</option>)}</select></Field>
                  <Field label="Numer zewnętrzny" hint="Opcjonalnie: numer Booking, Airbnb lub starego kalendarza."><input className={inputClass} placeholder="np. BKG-12345" value={form.externalNo} onChange={(e) => setForm({ ...form, externalNo: e.target.value })} /></Field>
                  <div className="sm:col-span-2"><Field label="Informacje dodatkowe"><textarea className={`${inputClass} min-h-24 resize-y`} placeholder="Godzina przyjazdu, życzenia, potrzeby dzieci, zwierzęta…" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field></div>
                </div>
              </div> : null}

              {step === 3 ? <div className="grid gap-5">
                <DialogSection eyebrow="Krok 3" title="Cena i płatność" body="Możesz podać cenę za noc albo od razu pełną kwotę pobytu. Pełna kwota ma pierwszeństwo." />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Cena za dobę"><MoneyInput suffix={moneySuffix} value={form.pricePerNight} onChange={(value) => setForm({ ...form, pricePerNight: value })} /></Field>
                  <Field label="Cena za pobyt"><MoneyInput suffix={moneySuffix} value={form.totalPrice} onChange={(value) => setForm({ ...form, totalPrice: value })} /></Field>
                  <Field label="Status płatności"><select className={inputClass} value={form.paymentStatus} onChange={(e) => setForm({ ...form, paymentStatus: e.target.value })}>{["Oczekiwanie na zadatek", "Brak wpłaty", "Wpłacony zadatek", "Częściowo opłacone", "Wpłacona całość", "Anulowane"].map((item) => <option key={item}>{item}</option>)}</select></Field>
                  <Field label="Rodzaj płatności"><select className={inputClass} value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value as NonNullable<Booking["paymentMethod"]> })}>{["Brak", "Przelew", "Gotówka", "Karta", "Online"].map((item) => <option key={item}>{item}</option>)}</select></Field>
                  <Field label="Zadatek"><MoneyInput suffix={moneySuffix} value={form.depositAmount} onChange={(value) => setForm({ ...form, depositAmount: value })} /></Field>
                  <Field label="Termin zadatku"><input className={inputClass} type="date" value={form.depositDueDate} onChange={(e) => setForm({ ...form, depositDueDate: e.target.value })} /></Field>
                  <Field label="Waluta"><select className={inputClass} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value as NonNullable<Booking["currency"]> })}><option>PLN</option><option>EUR</option></select></Field>
                </div>
              </div> : null}

              {error ? <p aria-live="polite" className="mt-5 rounded-xl border border-[#efb8a8] bg-[#f9dfd7] px-4 py-3 text-sm font-bold text-[#963c27]">{error}</p> : null}
            </div>

            <aside className="border-t border-[#e3dccf] bg-[#f1eee5] p-5 sm:p-6 lg:border-l lg:border-t-0">
              <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#7d8b4d]">Podsumowanie</p>
              <h3 className="mt-1 font-display text-2xl font-semibold">{selectedUnit?.name ?? "Wybierz domek"}</h3>
              <div className="mt-5 grid gap-3 text-sm">
                <SummaryLine label="Termin" value={form.checkIn && form.checkOut ? `${form.checkIn} – ${form.checkOut}` : "—"} />
                <SummaryLine label="Pobyt" value={nights > 0 ? `${nights} ${nights === 1 ? "noc" : "nocy"}` : "—"} />
                <SummaryLine label="Goście" value={`${guestCount} os. (${form.adults || 0}+${form.children || 0})`} />
                <SummaryLine label="Klient" value={[form.firstName, form.lastName].filter(Boolean).join(" ") || "Do uzupełnienia"} />
                <SummaryLine label="Źródło" value={form.platform} />
              </div>
              <div className="my-5 h-px bg-[#d7d0c3]" />
              <div className="flex items-end justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#7a857f]">Suma pobytu</p><p className="mt-1 font-display text-3xl font-semibold">{calculatedTotal ? calculatedTotal.toLocaleString("pl-PL") : "0"} <span className="text-base">{moneySuffix}</span></p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${conflicts.length ? "bg-[#f6d8cf] text-[#963c27]" : "bg-[#dbead8] text-[#2d6242]"}`}>{conflicts.length ? "Konflikt" : "Termin OK"}</span></div>
              <p className="mt-4 text-xs leading-5 text-[#68756e]">Po zapisaniu powstaną zadania dotyczące płatności, przygotowania domku, sprzątania i opinii.</p>
            </aside>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-[#e3dccf] bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
            <Button type="button" variant="ghost" onClick={onClose}>Anuluj</Button>
            <div className="flex gap-2">
              {step > 1 ? <Button type="button" variant="secondary" onClick={() => { setError(""); setStep((current) => current - 1); }}><Icon className="size-4 rotate-180" name="arrow" />Wstecz</Button> : null}
              {step < 3 ? <Button type="button" onClick={goNext}>Dalej <Icon className="size-4" name="arrow" /></Button> : <Button type="submit"><Icon className="size-4" name="check" />{booking ? "Zapisz zmiany" : "Dodaj rezerwację"}</Button>}
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}

function DialogSection({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#7d8b4d]">{eyebrow}</p><h3 className="font-display text-2xl font-semibold">{title}</h3><p className="mt-1 max-w-2xl text-sm leading-6 text-[#65736c]">{body}</p></div>;
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
