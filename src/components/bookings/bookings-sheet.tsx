"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/components/layout/app-store";
import { Badge, Button, inputClass } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icons";
import type { Booking, Channel, PaymentStatus } from "@/lib/types";
import { formatPolishDate } from "@/lib/date";
import { getBookingConflicts, nightsBetween, unitName } from "@/lib/workflow/rules";
import { quoteStay } from "@/lib/workflow/pricing";

type Draft = {
  unitId: string;
  checkIn: string;
  checkOut: string;
  adults: string;
  children: string;
  platform: Channel;
  pricingMode: "rate-card" | "manual";
  pricePerNight: string;
  grossPrice: string;
  currency: "PLN" | "EUR";
  paymentStatus: PaymentStatus;
};

function money(value: number | undefined, currency: Booking["currency"] = "PLN") {
  return value == null ? "—" : new Intl.NumberFormat("pl-PL", { style: "currency", currency: currency ?? "PLN", maximumFractionDigits: 0 }).format(value);
}

function draftFor(booking: Booking): Draft {
  return {
    unitId: booking.unitId,
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    adults: String(booking.adults),
    children: String(booking.children),
    platform: booking.platform,
    pricingMode: booking.pricingMode ?? "manual",
    pricePerNight: booking.pricePerNight == null ? "" : String(booking.pricePerNight),
    grossPrice: booking.grossPrice == null ? "" : String(booking.grossPrice),
    currency: booking.currency ?? "PLN",
    paymentStatus: booking.paymentStatus,
  };
}

export function BookingsSheet({ rows }: { rows: Booking[] }) {
  const { data, updateBooking } = useAppStore();
  const router = useRouter();
  const [editingId, setEditingId] = useState<string>();
  const [draft, setDraft] = useState<Draft>();
  const [error, setError] = useState("");

  function edit(booking: Booking) {
    setEditingId(booking.id); setDraft(draftFor(booking)); setError("");
  }

  function save(booking: Booking) {
    if (!draft) return;
    const adults = Number(draft.adults);
    const children = Number(draft.children);
    if (!draft.checkIn || !draft.checkOut || draft.checkOut <= draft.checkIn) { setError("Wyjazd musi być później niż przyjazd."); return; }
    if (!Number.isFinite(adults) || adults < 1 || !Number.isFinite(children) || children < 0) { setError("Sprawdź liczbę dorosłych i dzieci."); return; }
    const unit = data.units.find((item) => item.id === draft.unitId);
    if (unit && adults + children > unit.maxPeople) { setError(`${unit.name} mieści maksymalnie ${unit.maxPeople} osób.`); return; }
    const quote = quoteStay(data.units, data.rates, draft.unitId, draft.checkIn, draft.checkOut);
    const candidate: Booking = {
      ...booking,
      unitId: draft.unitId,
      checkIn: draft.checkIn,
      checkOut: draft.checkOut,
      adults,
      children,
      platform: draft.platform,
      pricingMode: draft.pricingMode,
      pricePerNight: draft.pricingMode === "rate-card" ? quote.averagePerNight || undefined : Number(draft.pricePerNight) || undefined,
      grossPrice: draft.pricingMode === "rate-card" ? quote.total || undefined : Number(draft.grossPrice) || undefined,
      currency: draft.currency,
      paymentStatus: draft.paymentStatus,
      needsReview: Boolean(booking.importWarnings?.length),
    };
    const conflicts = getBookingConflicts(data.bookings, data.blocks, candidate);
    if (conflicts.length) { setError(conflicts[0]); return; }
    updateBooking(candidate);
    setEditingId(undefined); setDraft(undefined); setError("");
  }

  return <div className="min-w-0 bg-[#fffdf8]">
    <div className="flex flex-col gap-3 border-b border-[#e2dbce] bg-[#f8f5ee] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div><p className="text-[10px] font-black uppercase tracking-[.15em] text-[#7d8b4d]">Widok arkuszowy</p><p className="text-sm font-bold text-[#52655c]">{rows.length} wierszy · edycja zapisuje cały wiersz po walidacji</p></div>
      <div className="flex flex-wrap gap-2 text-[10px] font-black"><span className="rounded-full bg-[#e3ecdd] px-2.5 py-1 text-[#356247]">Cennik = stawki sezonowe</span><span className="rounded-full bg-[#f5e7c8] px-2.5 py-1 text-[#7a5d19]">Ręczna = rabat lub import</span></div>
    </div>
    {error ? <p aria-live="polite" className="m-3 rounded-xl border border-[#efb8a8] bg-[#f9dfd7] px-4 py-3 text-sm font-bold text-[#963c27]">{error}</p> : null}
    <div className="max-h-[720px] overflow-auto">
      <table className="w-full min-w-[1540px] border-separate border-spacing-0 text-left text-xs">
        <thead className="sticky top-0 z-20 bg-[#ede9df] text-[9px] font-black uppercase tracking-[.12em] text-[#66736c]"><tr><th className="sticky left-0 z-30 min-w-52 border-b border-r border-[#d8d1c4] bg-[#ede9df] p-3">Gość</th><th className="border-b p-3">Domek</th><th className="border-b p-3">Przyjazd</th><th className="border-b p-3">Wyjazd</th><th className="border-b p-3">Nocy</th><th className="border-b p-3">Osoby</th><th className="border-b p-3">Kanał</th><th className="border-b p-3">Cena</th><th className="border-b p-3">Stawka</th><th className="border-b p-3">Razem</th><th className="border-b p-3">Płatność</th><th className="border-b p-3">Kontakt</th><th className="border-b p-3">Kontrola</th><th className="sticky right-0 z-30 border-b border-l border-[#d8d1c4] bg-[#ede9df] p-3">Akcje</th></tr></thead>
        <tbody>{rows.map((booking) => {
          const editing = editingId === booking.id && draft;
          const contact = data.consents.find((item) => item.bookingId === booking.id);
          const quote = quoteStay(
            data.units,
            data.rates,
            editing ? draft.unitId : booking.unitId,
            editing ? draft.checkIn : booking.checkIn,
            editing ? draft.checkOut : booking.checkOut,
          );
          const displayedRate = booking.pricingMode === "rate-card" ? booking.pricePerNight ?? quote.averagePerNight : booking.pricePerNight;
          const displayedTotal = booking.pricingMode === "rate-card" ? booking.grossPrice ?? quote.total : booking.grossPrice;
          return <tr className="group odd:bg-white even:bg-[#fbf9f4] hover:bg-[#f2f5e9]" key={booking.id}>
            <td className="sticky left-0 z-10 border-b border-r border-[#e5dfd4] bg-inherit p-3"><button className="max-w-48 truncate text-left text-sm font-black text-[#213f35] hover:underline" onClick={() => router.push(`/bookings/${booking.id}`)}>{booking.guestLabel}</button><p className="mt-0.5 text-[10px] text-[#758079]">rezerwacja {formatPolishDate(booking.bookingDate, { year: false })}</p></td>
            <td className="border-b border-[#e5dfd4] p-2">{editing ? <select className={`${inputClass} min-w-36 text-xs`} value={draft.unitId} onChange={(event) => setDraft({ ...draft, unitId: event.target.value })}>{data.units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select> : <span className="font-bold">{unitName(data.units, booking.unitId)}</span>}</td>
            <td className="border-b border-[#e5dfd4] p-2">{editing ? <input className={`${inputClass} min-w-32 text-xs`} type="date" value={draft.checkIn} onChange={(event) => setDraft({ ...draft, checkIn: event.target.value })}/> : formatPolishDate(booking.checkIn, { year: false })}</td>
            <td className="border-b border-[#e5dfd4] p-2">{editing ? <input className={`${inputClass} min-w-32 text-xs`} type="date" value={draft.checkOut} onChange={(event) => setDraft({ ...draft, checkOut: event.target.value })}/> : formatPolishDate(booking.checkOut, { year: false })}</td>
            <td className="border-b border-[#e5dfd4] p-3 font-black">{editing ? nightsBetween(draft.checkIn, draft.checkOut) : nightsBetween(booking.checkIn, booking.checkOut)}</td>
            <td className="border-b border-[#e5dfd4] p-2">{editing ? <div className="flex gap-1"><input aria-label="Dorośli" className={`${inputClass} w-16 text-xs`} min="1" type="number" value={draft.adults} onChange={(event) => setDraft({ ...draft, adults: event.target.value })}/><input aria-label="Dzieci" className={`${inputClass} w-16 text-xs`} min="0" type="number" value={draft.children} onChange={(event) => setDraft({ ...draft, children: event.target.value })}/></div> : `${booking.adults}+${booking.children}`}</td>
            <td className="border-b border-[#e5dfd4] p-2">{editing ? <select className={`${inputClass} min-w-32 text-xs`} value={draft.platform} onChange={(event) => setDraft({ ...draft, platform: event.target.value as Channel })}>{["Telefon","E-mail","Bezpośrednio","Strona www","Booking","Airbnb","Facebook","Google","Polecenie","Aloha Camp","Inne"].map((item) => <option key={item}>{item}</option>)}</select> : <Badge tone={booking.platform === "Booking" ? "lake" : booking.platform === "Airbnb" ? "bad" : "good"}>{booking.platform}</Badge>}</td>
            <td className="border-b border-[#e5dfd4] p-2">{editing ? <select className={`${inputClass} min-w-28 text-xs`} value={draft.pricingMode} onChange={(event) => setDraft({ ...draft, pricingMode: event.target.value as Draft["pricingMode"], currency: event.target.value === "rate-card" ? "PLN" : draft.currency })}><option value="rate-card">Cennik</option><option value="manual">Ręczna</option></select> : <Badge tone={booking.pricingMode === "rate-card" ? "good" : "warn"}>{booking.pricingMode === "rate-card" ? "Cennik" : "Ręczna"}</Badge>}</td>
            <td className="border-b border-[#e5dfd4] p-2">{editing ? <input className={`${inputClass} w-24 text-xs`} disabled={draft.pricingMode === "rate-card"} inputMode="decimal" value={draft.pricingMode === "rate-card" ? String(quote.averagePerNight || "") : draft.pricePerNight} onChange={(event) => setDraft({ ...draft, pricePerNight: event.target.value })}/> : money(displayedRate, booking.currency)}</td>
            <td className="border-b border-[#e5dfd4] p-2">{editing ? <div className="flex gap-1"><input className={`${inputClass} w-24 text-xs`} disabled={draft.pricingMode === "rate-card"} inputMode="decimal" value={draft.pricingMode === "rate-card" ? String(quote.total || "") : draft.grossPrice} onChange={(event) => setDraft({ ...draft, grossPrice: event.target.value })}/><select aria-label="Waluta" className={`${inputClass} w-20 text-xs`} disabled={draft.pricingMode === "rate-card"} value={draft.currency} onChange={(event) => setDraft({ ...draft, currency: event.target.value as Draft["currency"] })}><option>PLN</option><option>EUR</option></select></div> : <span className="font-black">{money(displayedTotal, booking.currency)}</span>}</td>
            <td className="border-b border-[#e5dfd4] p-2">{editing ? <select className={`${inputClass} min-w-36 text-xs`} value={draft.paymentStatus} onChange={(event) => setDraft({ ...draft, paymentStatus: event.target.value as PaymentStatus })}>{["Do uzupełnienia","Zaliczka","Opłacone","Częściowo","Do dopłaty","Anulowane","Barter"].map((item) => <option key={item}>{item}</option>)}</select> : <span className="font-bold">{booking.paymentStatus}</span>}</td>
            <td className="border-b border-[#e5dfd4] p-3"><p className="max-w-40 truncate font-bold">{contact?.phone || contact?.email || "—"}</p>{contact?.phone && contact.email ? <p className="max-w-40 truncate text-[10px] text-[#78827d]">{contact.email}</p> : null}</td>
            <td className="border-b border-[#e5dfd4] p-3">{booking.importWarnings?.length ? <span title={booking.importWarnings.join(" · ")}><Badge tone="warn">{booking.importWarnings.length} uwag</Badge></span> : booking.needsReview ? <Badge tone="warn">Sprawdź</Badge> : <Badge tone="good">OK</Badge>}</td>
            <td className="sticky right-0 z-10 border-b border-l border-[#e5dfd4] bg-inherit p-2">{editing ? <div className="flex gap-1"><Button className="min-h-8 px-2 py-1 text-[10px]" onClick={() => save(booking)}>Zapisz</Button><Button className="min-h-8 px-2 py-1 text-[10px]" variant="ghost" onClick={() => { setEditingId(undefined); setDraft(undefined); setError(""); }}>Anuluj</Button></div> : <div className="flex gap-1"><button aria-label={`Edytuj ${booking.guestLabel}`} className="grid size-8 place-items-center rounded-lg border border-[#d6cfc2] bg-white text-[#426052]" onClick={() => edit(booking)}><Icon className="size-3.5" name="settings"/></button><button aria-label={`Otwórz ${booking.guestLabel}`} className="grid size-8 place-items-center rounded-lg bg-[#174d3b] text-white" onClick={() => router.push(`/bookings/${booking.id}`)}><Icon className="size-3.5" name="arrow"/></button></div>}</td>
          </tr>;
        })}</tbody>
      </table>
      {!rows.length ? <p className="p-12 text-center text-sm font-bold text-[#718078]">Brak rezerwacji dla wybranych filtrów.</p> : null}
    </div>
  </div>;
}
