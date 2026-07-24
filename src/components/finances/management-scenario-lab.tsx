"use client";

import { useMemo, useState } from "react";
import { Badge, Button, Card, Field, inputClass } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icons";
import { calculateManagementResult } from "@/lib/metrics/management-result";
import type { Booking, Channel, PaymentTransaction, PlatformImport, Unit } from "@/lib/types";

const sampleUnit: Unit = {
  id: "sample-unit",
  name: "Domek testowy",
  maxPeople: 4,
  bedrooms: 2,
  defaultPricePerNight: 500,
  defaultCleaningCost: 0,
  notes: "",
};

function money(value: number) {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 0,
  }).format(value);
}

export function ManagementScenarioLab() {
  const [platform, setPlatform] = useState<Extract<Channel, "Bezpośrednio" | "Booking">>("Booking");
  const [sales, setSales] = useState(1_000);
  const [costs, setCosts] = useState(250);
  const [commission, setCommission] = useState(150);

  const result = useMemo(() => {
    const booking: Booking = {
      id: "SAMPLE-BOOKING",
      bookingDate: "2026-05-01",
      source: "Scenariusz kontrolny",
      platform,
      unitId: sampleUnit.id,
      checkIn: "2026-05-10",
      checkOut: "2026-05-12",
      adults: 2,
      children: 0,
      guestLabel: "Gość testowy",
      grossPrice: sales,
      currency: "PLN",
      paymentStatus: "Opłacone",
      workflowStatus: "Zamknięta",
      createdBy: "Scenariusz kontrolny",
    };
    const cost: PaymentTransaction = {
      id: "SAMPLE-COST",
      bookingId: booking.id,
      occurredAt: "2026-05-12",
      type: "Koszt",
      amount: costs,
      currency: "PLN",
      status: "Zaksięgowana",
      source: "Faktura testowa",
      sourceRef: "TEST/05/2026",
      costCategory: "Inne",
      unitId: sampleUnit.id,
    };
    const imported: PlatformImport[] = platform === "Booking" && commission > 0 ? [{
      id: "SAMPLE-IMPORT",
      platform: "Booking",
      commission,
      matchedBookingId: booking.id,
      reservationNo: "TEST-BOOKING",
      transferStatus: "Przeniesione",
    }] : [];
    return calculateManagementResult({
      bookings: [booking],
      payments: [cost],
      costSettings: [],
      imports: imported,
      units: [sampleUnit],
      period: { from: "2026-05-01", toExclusive: "2026-06-01" },
    }).currencies[0];
  }, [commission, costs, platform, sales]);

  const managementResult = result?.result ?? 0;

  return <Card className="overflow-hidden border-[#bfd1c6] bg-[#f6faf5]">
    <div className="grid gap-6 p-5 lg:grid-cols-[.85fr_1.15fr] sm:p-6">
      <div>
        <div className="flex flex-wrap items-center gap-2"><Badge tone="good">dane ćwiczeniowe</Badge><span className="text-[10px] font-black uppercase tracking-[.14em] text-[#718078]">niczego nie zapisuje</span></div>
        <h2 className="mt-3 font-display text-3xl font-semibold">Sprawdź 6b bez uzupełniania backlogu</h2>
        <p className="mt-2 text-sm leading-6 text-[#617068]">Zmieniaj sprzedaż, koszt i kanał. Wynik poniżej liczy ten sam silnik co prawdziwy raport.</p>
        <div className="mt-5 flex flex-wrap gap-2"><Button variant="secondary" onClick={() => { setSales(1_000); setCosts(250); setCommission(150); setPlatform("Booking"); }}>Przykład z zyskiem</Button><Button variant="secondary" onClick={() => { setSales(1_000); setCosts(1_200); setCommission(150); setPlatform("Booking"); }}>Pokaż stratę</Button></div>
      </div>
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Kanał"><select className={inputClass} value={platform} onChange={(event) => setPlatform(event.target.value as typeof platform)}><option>Booking</option><option>Bezpośrednio</option></select></Field>
          <Field label="Sprzedaż PLN"><input className={inputClass} min="0" step="50" type="number" value={sales} onChange={(event) => setSales(Math.max(0, Number(event.target.value)))}/></Field>
          <Field label="Faktyczne koszty PLN"><input className={inputClass} min="0" step="50" type="number" value={costs} onChange={(event) => setCosts(Math.max(0, Number(event.target.value)))}/></Field>
          <Field label="Prowizja OTA PLN" hint={platform === "Bezpośrednio" ? "Direct nie wymaga prowizji." : "Fakt z rozliczenia Booking."}><input className={inputClass} disabled={platform === "Bezpośrednio"} min="0" step="10" type="number" value={platform === "Bezpośrednio" ? 0 : commission} onChange={(event) => setCommission(Math.max(0, Number(event.target.value)))}/></Field>
        </div>
        <div className={`mt-4 flex items-center justify-between gap-4 rounded-2xl p-4 ${managementResult < 0 ? "bg-[#f9e3dc] text-[#8f3f2b]" : "bg-[#e4f0e3] text-[#285f48]"}`}>
          <div><p className="text-[10px] font-black uppercase tracking-[.14em] opacity-70">Wynik zarządczy</p><p className="mt-1 text-xs font-bold">{platform === "Booking" ? "sprzedaż − koszt − prowizja" : "sprzedaż − koszt; bez prowizji OTA"}</p></div>
          <div className="flex items-center gap-2"><Icon className="size-5" name={managementResult < 0 ? "warning" : "check"}/><p className="font-display text-3xl font-semibold">{money(managementResult)}</p></div>
        </div>
      </div>
    </div>
  </Card>;
}
