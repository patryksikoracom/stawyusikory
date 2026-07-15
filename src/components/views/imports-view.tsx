"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/components/layout/app-store";
import { Badge, Button, Card, Field, inputClass } from "@/components/ui/primitives";
import { Icon, type IconName } from "@/components/ui/icons";
import type { Booking, SourceConnection } from "@/lib/types";
import type { ImportPreview } from "@/lib/import/mobile-calendar";
import { nightsBetween, unitName } from "@/lib/workflow/rules";
import { formatPolishDate, formatPolishDateTime } from "@/lib/date";

export function ImportsView() {
  const { data, replaceWithImportedBookings, updateConnection, exportSnapshot, exportPricingAnalysis } = useAppStore();
  const [rawImport, setRawImport] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [configuring, setConfiguring] = useState<SourceConnection | null>(null);
  const [feedUrls, setFeedUrls] = useState<Record<string, string>>({});
  const connected = data.sourceConnections.filter((item) => item.status === "Aktywne").length;

  useEffect(() => {
    let active = true;
    void fetch("/api/calendar/feed-tokens", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<{ feeds: { unitId: string; url: string }[] }> : null)
      .then((payload) => {
        if (active && payload) setFeedUrls(Object.fromEntries(payload.feeds.map((feed) => [feed.unitId, feed.url])));
      });
    return () => { active = false; };
  }, []);

  async function previewImport() {
    setBusy(true); setMessage("");
    const response = await fetch("/api/imports/mobile-calendar/preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ raw: rawImport }) });
    const result = await response.json().catch(() => null) as ImportPreview | { error?: string } | null;
    setBusy(false);
    if (!response.ok || !result || !("rows" in result)) { setMessage((result && "error" in result && result.error) || "Nie udało się przeanalizować importu."); return; }
    setPreview(result);
    setMessage(result.rows.length ? `Rozpoznano ${result.rows.length} ${result.rows.length === 1 ? "rekord" : "rekordów"}. Sprawdź podgląd przed scaleniem.` : "Nie rozpoznano poprawnych rekordów.");
  }

  async function selectFile(file?: File) {
    if (!file) return;
    setMessage(""); setPreview(null); setFileName(file.name);
    try { setRawImport(await file.text()); }
    catch { setMessage("Nie udało się odczytać pliku CSV."); }
  }

  async function commitImport() {
    if (!preview?.rows.length) return;
    setBusy(true);
    const response = await fetch("/api/imports/mobile-calendar/commit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rows: preview.rows, contacts: preview.contacts }) });
    setBusy(false);
    if (!response.ok) { setMessage("Walidacja importu nie powiodła się."); return; }
    const existing = new Set(data.bookings.map((booking) => booking.id));
    const newCount = preview.rows.filter((booking) => !existing.has(booking.id)).length;
    replaceWithImportedBookings(preview.rows, preview.contacts);
    setMessage(`Dodano ${newCount} rekordów; pominięto ${preview.rows.length - newCount} już istniejących. Dane zapisują się teraz w chmurze.`);
    setRawImport(""); setFileName(""); setPreview(null);
  }

  async function syncNow() {
    setBusy(true); setMessage("Sprawdzam skonfigurowane kalendarze…");
    const response = await fetch("/api/integrations/ical/sync", { method: "POST" });
    const result = await response.json().catch(() => ({})) as { error?: string; feeds?: number; blocks?: number };
    setBusy(false);
    setMessage(response.ok ? `Sprawdzono ${result.feeds ?? 0} feedów iCal; odczytano ${result.blocks ?? 0} blokad.` : result.error ?? "Synchronizacja nie powiodła się.");
  }

  return <div className="grid gap-5">
    <section className="animate-rise-2 relative overflow-hidden rounded-[22px] bg-[#163e34] p-6 text-white sm:p-7"><div className="absolute -right-16 -top-24 size-72 rounded-full border-[40px] border-white/[.04]"/><div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center"><div><span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[.14em] text-[#dce5bd]"><Icon className="size-3.5" name="plug"/>Dostępność OTA</span><h2 className="mt-4 max-w-3xl font-display text-4xl font-semibold leading-[1.05] tracking-[-.035em]">Bezpłatny most iCal, <span className="text-[#d2de99]">bez udawania pełnego API.</span></h2><p className="mt-4 max-w-2xl text-sm leading-6 text-white/65">iCal może blokować terminy między portalami, ale nie pobiera ceny, płatności ani kontaktu gościa. Odświeżenie po stronie portalu może potrwać kilka godzin.</p></div><Button className="bg-[#f0be55] text-[#18332c] hover:bg-[#f5ce77]" disabled={busy} onClick={() => void syncNow()}><Icon className="size-4" name="refresh"/>Sprawdź teraz</Button></div></section>

    <section className="animate-rise-3 grid gap-4 md:grid-cols-3"><Stat label="Aktywne połączenia" value={`${connected}/${data.sourceConnections.length}`} note="osobno dla każdego portalu" icon="plug"/><Stat label="Blokady zewnętrzne" value={data.blocks.filter((item) => item.id.startsWith("ICAL-")).length} note="nie są pełnymi rezerwacjami" icon="calendar"/><Stat label="Wymaga weryfikacji" value={data.bookings.filter((item) => item.needsReview).length} note="rekordy niekompletne" icon="warning" warn/></section>

    {message ? <p aria-live="polite" className="rounded-xl border border-[#ded7ca] bg-[#fffdf8] p-4 text-sm font-bold text-[#365d42]">{message}</p> : null}

    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <Card className="overflow-hidden"><div className="flex items-start justify-between border-b border-[#e2dbce] p-5 sm:p-6"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#7d8b4d]">Kanały sprzedaży</p><h2 className="font-display text-2xl font-semibold">Kalendarze Booking i Airbnb</h2></div><Badge tone={connected ? "good" : "warn"}>{connected ? "Częściowo aktywne" : "Do konfiguracji"}</Badge></div><div className="grid gap-4 p-4 sm:grid-cols-2">{data.sourceConnections.map((source) => <article className="rounded-2xl border border-[#ded7ca] bg-white p-5" key={source.id}><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><span className={`grid size-11 place-items-center rounded-2xl ${source.platform === "Booking" ? "bg-[#dbeaec] text-[#246675]" : "bg-[#f9dfd8] text-[#b04c37]"}`}><span className="font-display text-xl font-semibold">{source.platform[0]}</span></span><div><p className="font-display text-xl font-semibold">{source.platform}</p><p className="text-xs text-[#6c7872]">{source.connectionType} · {source.unitId ? unitName(data.units, source.unitId) : "brak domku"}</p></div></div><Badge tone={source.status === "Aktywne" ? "good" : source.status === "Błąd" ? "bad" : "warn"}>{source.status}</Badge></div><p className="mt-4 text-sm font-bold leading-6 text-[#43594f]">{source.nextStep}</p>{source.lastSyncAt ? <p className="mt-2 text-xs text-[#748078]">Ostatni odczyt: {formatPolishDateTime(source.lastSyncAt)}</p> : null}{source.lastError ? <p className="mt-2 text-xs font-bold text-[#9b4029]">{source.lastError}</p> : null}<Button className="mt-4 w-full" variant="secondary" onClick={() => setConfiguring(source)}>Skonfiguruj {source.platform}</Button></article>)}</div></Card>
      <aside className="grid content-start gap-5"><Card className="p-5"><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#7d8b4d]">Eksport Stawy OS</p><h2 className="font-display text-xl font-semibold">Linki dostępności</h2><p className="mt-2 text-xs leading-5 text-[#68756f]">Każdy domek ma prywatny adres. Skopiuj właściwy link do ustawień importu kalendarza w Booking lub Airbnb.</p><div className="mt-4 grid gap-2">{data.units.map((unit) => feedUrls[unit.id] ? <a className="flex items-center justify-between rounded-xl border border-[#d8d0c2] bg-white p-3 text-xs font-black" href={feedUrls[unit.id]} key={unit.id} rel="noreferrer" target="_blank">{unit.name}<Icon className="size-4" name="download"/></a> : <span className="rounded-xl border border-[#d8d0c2] bg-[#f5f2eb] p-3 text-xs font-black text-[#77827c]" key={unit.id}>{unit.name} · generuję link…</span>)}</div></Card><Card className="p-5"><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#7d8b4d]">Kopia bezpieczeństwa</p><h2 className="font-display text-xl font-semibold">Szyfrowany eksport</h2><p className="mt-2 text-xs leading-5 text-[#68756f]">Pełna kopia jest szyfrowana hasłem jeszcze w przeglądarce. Zapisz ją przed dużym importem.</p><Button className="mt-4 w-full" variant="secondary" onClick={() => void exportSnapshot()}><Icon className="size-4" name="download"/>Pobierz zaszyfrowany backup</Button></Card><Card className="p-5"><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#7d8b4d]">Analiza cen</p><h2 className="font-display text-xl font-semibold">Dane dla AI bez danych gości</h2><p className="mt-2 text-xs leading-5 text-[#68756f]">Eksport obejmuje terminy, obłożenie, ceny, kanały, prowizje i koszty. Nie zawiera nazwisk, telefonów, e-maili ani wiadomości.</p><Button className="mt-4 w-full" variant="secondary" onClick={exportPricingAnalysis}><Icon className="size-4" name="download"/>Pobierz zestaw cenowy</Button></Card></aside>
    </div>

    <Card className="overflow-hidden border-[#cedbb9] bg-[#fbfcf5]"><div className="grid gap-5 p-5 lg:grid-cols-[1fr_320px] sm:p-6"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#66813d]">Import jednorazowy i historyczny</p><h2 className="mt-1 font-display text-2xl font-semibold">Mobile Calendar: wgraj eksport CSV</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#5d6b61]">Wybierz oryginalny plik eksportu. Zachowamy pobyty, kontakty, ceny i płatności; techniczne ID, wyżywienie oraz opłaty za sprzątanie nie trafią do codziennego widoku.</p><label className="mt-4 flex cursor-pointer items-center gap-4 rounded-2xl border border-dashed border-[#9dad7b] bg-white p-4 transition hover:border-[#50734a] hover:bg-[#f7faef]"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#e6efdc] text-[#3f6c48]"><Icon className="size-5" name="upload"/></span><span className="min-w-0"><span className="block text-sm font-black">{fileName || "Wybierz plik .csv"}</span><span className="block truncate text-xs text-[#69766f]">Eksport pozostaje w tej sesji do momentu zatwierdzenia.</span></span><input accept=".csv,text/csv" className="sr-only" type="file" onChange={(event) => void selectFile(event.target.files?.[0])}/></label><details className="mt-3"><summary className="cursor-pointer text-xs font-black text-[#4a6c50]">Wklej dane ręcznie zamiast pliku</summary><textarea aria-label="Dane z Mobile Calendar" className="mt-3 min-h-36 w-full rounded-2xl border border-[#cfd8c2] bg-white px-4 py-3 font-mono text-xs leading-5 outline-none focus:border-[#759655]" value={rawImport} onChange={(event) => { setRawImport(event.target.value); setFileName(""); setPreview(null); }} placeholder={"Wklej zawartość eksportu CSV…"}/></details></div><div className="rounded-2xl bg-[#e8f0dd] p-5"><span className="grid size-10 place-items-center rounded-xl bg-white text-[#477346]"><Icon className="size-5" name="refresh"/></span><p className="mt-4 text-sm font-black">Najpierw kontrola, potem zapis</p><p className="mt-2 text-xs leading-5 text-[#60725e]">Podgląd pokaże historię, aktywne pobyty i rekordy wymagające uwagi. Ponowne wgranie tego samego eksportu nie stworzy duplikatów.</p><Button className="mt-5 w-full" disabled={busy || !rawImport.trim()} onClick={() => void previewImport()}>1. Sprawdź dane</Button><Button className="mt-2 w-full" disabled={busy || !preview?.rows.length} variant="secondary" onClick={() => void commitImport()}>2. Dodaj {preview?.rows.length ?? 0} rekordów</Button></div></div>{preview ? <PreviewTable data={data} preview={preview}/> : null}</Card>

    {configuring ? <ConnectionDialog connection={configuring} units={data.units} onClose={() => setConfiguring(null)} onSave={(connection) => { updateConnection(connection); setConfiguring(null); setMessage("Konfiguracja zapisana. Uruchom „Sprawdź teraz”, aby pobrać blokady."); }}/>:null}
  </div>;
}

function PreviewTable({ data, preview }: { data: ReturnType<typeof useAppStore>["data"]; preview: ImportPreview }) { return <div className="border-t border-[#ded7ca] p-4"><div className="mb-4 grid gap-2 sm:grid-cols-4"><ImportMini label="Wszystkie" value={preview.summary.total}/><ImportMini label="Historia" value={preview.summary.historical}/><ImportMini label="Aktywne" value={preview.summary.active}/><ImportMini label="Do sprawdzenia" value={preview.summary.needsReview} warn={preview.summary.needsReview>0}/></div><div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="text-[10px] font-black uppercase tracking-[.13em] text-[#78837d]"><tr><th className="p-3">Gość</th><th>Termin</th><th>Domek</th><th>Stan</th><th>Kontrola</th></tr></thead><tbody>{preview.rows.map((booking:Booking)=><tr className="border-t" key={booking.id}><td className="p-3"><p className="font-black">{booking.guestLabel}</p><p className="text-xs text-[#6e7973]">{booking.platform}</p></td><td>{formatPolishDate(booking.checkIn)} – {formatPolishDate(booking.checkOut)}<p className="text-xs">{nightsBetween(booking.checkIn,booking.checkOut)} nocy</p></td><td>{unitName(data.units,booking.unitId)}</td><td><Badge tone={data.bookings.some((item)=>item.id===booking.id)?"warn":"good"}>{data.bookings.some((item)=>item.id===booking.id)?"Już istnieje":"Nowy"}</Badge></td><td className="max-w-[300px] text-xs">{booking.importWarnings?.length ? <span className="font-bold text-[#9a402b]">{booking.importWarnings.join(" · ")}</span> : <span className="font-bold text-[#3f6e4c]">Gotowe</span>}</td></tr>)}</tbody></table></div><p className="mt-3 text-xs font-bold text-[#586b61]">Suma eksportu: {preview.summary.plnTotal.toLocaleString("pl-PL")} PLN{preview.summary.eurTotal ? ` · ${preview.summary.eurTotal.toLocaleString("pl-PL")} EUR` : ""}</p>{preview.errors.length?<div className="mt-3 rounded-xl bg-[#f9dfd7] p-3 text-xs font-bold text-[#963c27]">Pominięte wiersze: {preview.errors.map((item)=>`${item.line}: ${item.message}`).join(" · ")}</div>:null}</div> }

function ImportMini({label,value,warn=false}:{label:string;value:number;warn?:boolean}) { return <div className={`rounded-xl border p-3 ${warn?"border-[#ecc5b8] bg-[#f9e7df]":"border-[#dbe1cf] bg-white"}`}><p className="text-[9px] font-black uppercase tracking-[.13em] text-[#7c8780]">{label}</p><p className="font-display text-xl font-semibold">{value}</p></div>; }

function ConnectionDialog({connection,units,onClose,onSave}:{connection:SourceConnection;units:ReturnType<typeof useAppStore>["data"]["units"];onClose:()=>void;onSave:(value:SourceConnection)=>void}) { const [form,setForm]=useState(connection); return <div className="fixed inset-0 z-50 grid place-items-center bg-[#102c24]/70 p-4 backdrop-blur-sm" onMouseDown={(event)=>{if(event.target===event.currentTarget)onClose();}}><form className="w-full max-w-xl rounded-[22px] bg-[#fffdf8] p-6 shadow-2xl" onSubmit={(event)=>{event.preventDefault();onSave({...form,status:form.importUrl?"Wymaga sprawdzenia":"Do podłączenia",connectionType:"iCal",nextStep:form.importUrl?"Uruchom kontrolę połączenia.":"Wklej prywatny adres eksportu iCal z panelu portalu."});}}><div className="flex items-start justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#7d8b4d]">iCal</p><h2 className="font-display text-2xl font-semibold">{connection.platform}</h2></div><button aria-label="Zamknij" type="button" onClick={onClose}><Icon className="size-5" name="close"/></button></div><div className="mt-5 grid gap-4"><Field label="Domek"><select className={inputClass} required value={form.unitId??""} onChange={(event)=>setForm({...form,unitId:event.target.value})}><option value="">Wybierz domek</option>{units.map((unit)=><option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></Field><Field label="Prywatny adres importu .ics" hint="Adres zawiera sekret. Nie publikuj go i nie wklejaj do wiadomości."><input className={inputClass} type="url" placeholder="https://…/calendar.ics" value={form.importUrl??""} onChange={(event)=>setForm({...form,importUrl:event.target.value})}/></Field><div className="rounded-xl bg-[#f5ead0] p-3 text-xs leading-5 text-[#725a1d]">Synchronizacja iCal nie jest natychmiastowa. Połączenie blokuje dostępność, lecz nie przenosi ceny ani danych gościa.</div></div><div className="mt-6 flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Anuluj</Button><Button type="submit">Zapisz konfigurację</Button></div></form></div> }

function Stat({label,value,note,icon,warn=false}:{label:string;value:string|number;note:string;icon:IconName;warn?:boolean}){return <div className="flex items-center gap-4 rounded-[18px] border border-[#d9d1c1] bg-[#fffdf8] p-4"><span className={`grid size-11 place-items-center rounded-xl ${warn?"bg-[#fae5da] text-[#a5482e]":"bg-[#e4ece0] text-[#3c664a]"}`}><Icon className="size-5" name={icon}/></span><div><p className="text-[10px] font-black uppercase tracking-[.13em] text-[#7b857f]">{label}</p><p className="font-display text-2xl font-semibold">{value}</p><p className="text-xs text-[#707b75]">{note}</p></div></div>}
