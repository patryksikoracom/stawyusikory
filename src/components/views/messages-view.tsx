"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useAppStore } from "@/components/layout/app-store";
import { Badge, Button, Field, inputClass } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icons";
import { Dialog } from "@/components/ui/dialog";
import { renderTemplate } from "@/lib/workflow/communications";
import { unitName } from "@/lib/workflow/rules";
import { formatPolishDate } from "@/lib/date";
import type { MessageTemplate, ScheduledMessage } from "@/lib/types";

const terminal = (message: ScheduledMessage) => ["Wysłana", "Dostarczona", "Anulowana"].includes(message.status);

export function MessagesView({ canEdit }: { canEdit: boolean }) {
  const { data, updateScheduledMessage } = useAppStore();
  const searchParams = useSearchParams();
  const view = searchParams.get("view") === "templates" ? "templates" : "messages";
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState(false);
  const [channel, setChannel] = useState("Wszystkie");
  const [selectedId, setSelectedId] = useState("");
  const [template, setTemplate] = useState<MessageTemplate | null>(null);
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const search = query.toLocaleLowerCase("pl-PL");
  const bookings = data.bookings.filter(booking => !booking.deletedAt && (history || !booking.historicalImport)
    && `${booking.guestLabel} ${booking.id} ${booking.platformReservationNo ?? ""}`.toLocaleLowerCase("pl-PL").includes(search)
    && (channel === "Wszystkie" || data.scheduledMessages.some(message => message.bookingId === booking.id && message.channel === channel)))
    .sort((a, b) => b.bookingDate.localeCompare(a.bookingDate));
  const selected = bookings.find(booking => booking.id === selectedId) ?? bookings[0];
  const scheduled = data.scheduledMessages.filter(message => message.bookingId === selected?.id && (channel === "Wszystkie" || message.channel === channel));
  const timeline = scheduled.filter(terminal).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const planned = scheduled.filter(message => !terminal(message)).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const notes = data.messages.filter(message => message.bookingId === selected?.id);
  const templates = data.messageTemplates.filter(item => `${item.name} ${item.purpose} ${item.language}`.toLocaleLowerCase("pl-PL").includes(search));
  async function change(message: ScheduledMessage, status: "Zatwierdzona" | "Anulowana") {
    setPending(true); setNotice("");
    const result = await updateScheduledMessage({ ...message, status,
      approvedAt: status === "Zatwierdzona" ? new Date().toISOString() : undefined,
      deliveryPolicy: status === "Zatwierdzona" ? "manual_send" : "draft_only" });
    setPending(false); setNotice(result.ok ? "Zapisano zmianę." : result.message ?? "Nie potwierdzono zapisu.");
  }
  return <div className="grid gap-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <nav aria-label="Widok komunikacji" className="flex rounded-xl border border-[#d9d1c1] bg-[#eae6dc] p-1">
        {[["messages", "Wiadomości"], ["templates", "Szablony wiadomości"]].map(([key, label]) => <Link key={key} href={key === "messages" ? "/messages" : "/messages?view=templates"} aria-current={view === key ? "page" : undefined} className={`rounded-lg px-4 py-2 text-sm font-bold ${view === key ? "bg-white text-[#174d3b] shadow-sm" : "text-[#69766e]"}`}>{label}</Link>)}
      </nav>
      <p className="text-xs text-[#69766e]">Odpowiedzi gości trafiają na skrzynkę Marcina.</p>
    </div>
    <div className="relative"><Icon name="search" className="absolute left-3 top-3 size-4 text-[#758079]"/><input aria-label={view === "messages" ? "Szukaj gościa lub numeru rezerwacji" : "Szukaj szablonu"} className={`${inputClass} pl-10`} placeholder={view === "messages" ? "Szukaj gościa lub numeru rezerwacji…" : "Szukaj szablonu, języka lub rodzaju wiadomości…"} value={query} onChange={event => setQuery(event.target.value)}/></div>
    {notice ? <p role="status" className="rounded-xl bg-[#edf1e7] p-3 text-sm">{notice}</p> : null}
    {view === "templates" ? <div className="overflow-hidden rounded-2xl border border-[#d9d1c1] bg-[#fffdf8]">
      <div className="border-b border-[#e2dbce] p-5"><h2 className="font-display text-xl font-semibold">Szablony wiadomości</h2><p className="mt-1 text-xs text-[#69766e]">Wybierz szablon, aby zobaczyć treść, zmienne i podgląd dla pobytu. Importy Mobile Calendar pozostają materiałem źródłowym.</p></div>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-[#f0ede5] text-xs text-[#69766e]"><tr><th className="p-4">Nazwa</th><th className="p-4">Język</th><th className="p-4">Kanał</th><th className="p-4">Status</th><th className="p-4"><span className="sr-only">Szczegóły</span></th></tr></thead><tbody>{templates.map(item => <tr key={item.id} className="border-t border-[#e7e1d5] hover:bg-[#f6f4ed]"><td className="p-4"><p className="font-bold">{item.name}</p><p className="mt-1 text-xs text-[#69766e]">{item.purpose} · v{item.version}</p></td><td className="p-4 uppercase">{item.language}</td><td className="p-4">{item.channel}</td><td className="p-4"><Badge tone={item.active ? "good" : "neutral"}>{item.active ? "Aktywny" : "Wyłączony"}</Badge></td><td className="p-4 text-right"><Button variant="secondary" onClick={() => setTemplate(item)}>Otwórz<span className="sr-only"> {item.name}</span></Button></td></tr>)}</tbody></table></div>
      {!templates.length ? <p className="p-8 text-center text-[#69766e]">Brak pasujących szablonów.</p> : null}
    </div> : <div className="grid overflow-hidden rounded-2xl border border-[#d9d1c1] bg-[#fffdf8] lg:min-h-[650px] lg:grid-cols-[310px_minmax(0,1fr)]">
      <aside aria-label="Lista rozmów" className="border-b border-[#ded7ca] bg-[#f7f5ee] lg:border-b-0 lg:border-r">
        <div className="grid gap-3 border-b border-[#ded7ca] p-4"><select aria-label="Kanał wiadomości" className={inputClass} value={channel} onChange={event => setChannel(event.target.value)}>{["Wszystkie", "E-mail", "SMS", "OTA"].map(item => <option key={item}>{item}</option>)}</select><label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={history} onChange={event => setHistory(event.target.checked)}/>Pokaż również historię</label></div>
        <div className="max-h-64 overflow-y-auto lg:max-h-[760px]">{bookings.map(booking => <button key={booking.id} aria-pressed={selected?.id === booking.id} onClick={() => { setSelectedId(booking.id); setNotice(""); }} className={`w-full border-b border-[#e2dbce] p-4 text-left ${selected?.id === booking.id ? "border-l-4 border-l-[#174d3b] bg-[#e5eddf]" : "hover:bg-[#eeeee5]"}`}><span className="block text-sm font-bold">{booking.guestLabel}</span><span className="mt-1 block text-xs text-[#69766e]">{unitName(data.units, booking.unitId)} · {booking.checkIn} → {booking.checkOut}</span>{booking.historicalImport ? <span className="mt-2 block text-[11px] text-[#69766e]">Historia — bez automatycznej wysyłki</span> : null}</button>)}{!bookings.length ? <p className="p-6 text-sm text-[#69766e]">Brak pasujących rozmów.</p> : null}</div>
      </aside>
      <section aria-label="Wybrana rozmowa" className="min-w-0">{selected ? <>
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[#ded7ca] p-5"><div><h2 className="font-display text-2xl font-semibold">{selected.guestLabel}</h2><p className="mt-1 text-xs text-[#69766e]">{unitName(data.units, selected.unitId)} · {formatPolishDate(selected.checkIn)} – {formatPolishDate(selected.checkOut)}</p></div><Link className="text-xs font-bold text-[#174d3b] underline" href={`/bookings/${encodeURIComponent(selected.id)}`}>Otwórz rezerwację</Link></header>
        <div className="grid gap-6 p-4 sm:p-6">{selected.historicalImport ? <p className="rounded-xl bg-[#eeece4] p-3 text-sm">Pobyt historyczny. Nie wysyłamy zaległych wiadomości ani przypomnień.</p> : null}
          <section><h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#758079]">Historia komunikacji</h3><div className="grid gap-3">{timeline.map(message => <Message key={message.id} message={message}/>)}{notes.map(note => <article key={note.id} className="rounded-xl bg-[#eeece4] p-4"><p className="text-xs font-bold">{note.channel} · {note.status}</p><p className="mt-2 whitespace-pre-wrap text-sm">{note.body}</p></article>)}{!timeline.length && !notes.length ? <p className="py-8 text-center text-sm text-[#758079]">Tutaj pojawią się wiadomości i potwierdzenia dostarczenia.</p> : null}</div></section>
          {planned.length ? <section><h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#758079]">Zaplanowane i do sprawdzenia</h3><div className="grid gap-3">{planned.map(message => <Message key={message.id} message={message}>{canEdit && !selected.historicalImport ? <div className="mt-3 flex gap-2">{message.status !== "Zatwierdzona" ? <Button disabled={pending || Boolean(message.blockedReason) || !message.recipient} onClick={() => void change(message, "Zatwierdzona")}>Zatwierdź</Button> : null}<Button disabled={pending} variant="secondary" onClick={() => void change(message, "Anulowana")}>Anuluj</Button></div> : null}</Message>)}</div></section> : null}
        </div>
      </> : <div className="grid min-h-80 place-items-center text-[#758079]">Wybierz rozmowę z listy.</div>}</section>
    </div>}
    {template ? <TemplateEditor key={template.id} template={template} canEdit={canEdit && !template.id.startsWith("TPL-MC-")} onClose={() => setTemplate(null)}/> : null}
  </div>;
}

function Message({ message, children }: { message: ScheduledMessage; children?: React.ReactNode }) {
  return <article className={`rounded-xl border p-4 ${message.status === "Dostarczona" ? "border-[#c8d9c2] bg-[#f0f5ea]" : "border-[#e0d9cc] bg-white"}`}><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold">{message.channel} · termin: {new Date(message.dueAt).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw", dateStyle: "short", timeStyle: "short" })}</p><Badge tone={message.status === "Dostarczona" ? "good" : message.status === "Błąd" ? "bad" : "neutral"}>{message.status}</Badge></div><p className="mt-3 font-bold">{message.subject || "Wiadomość dotycząca pobytu"}</p><details className="mt-2"><summary className="cursor-pointer text-xs font-semibold text-[#174d3b]">Pokaż treść</summary><p className="mt-3 whitespace-pre-wrap text-sm leading-6">{message.renderedBody}</p></details><p className="mt-3 break-words text-xs text-[#69766e]">{message.recipient || "Brak odbiorcy"}</p>{message.blockedReason ? <p className="mt-2 text-xs text-[#96452f]">{message.blockedReason}</p> : null}{children}</article>;
}

function TemplateEditor({ template, canEdit, onClose }: { template: MessageTemplate; canEdit: boolean; onClose: () => void }) {
  const { data, upsertCommunicationConfig } = useAppStore();
  const [openedConfigVersion] = useState(() => data.communicationConfigs.find(item => item.id === "communication")?.version ?? data.communicationConfigs[0]?.version);
  const [name, setName] = useState(template.name);
  const [subject, setSubject] = useState(template.subject ?? "");
  const [body, setBody] = useState(template.body);
  const [active, setActive] = useState(template.active);
  const [bookingId, setBookingId] = useState(data.bookings.find(booking => !booking.historicalImport && !booking.deletedAt)?.id ?? "");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [variableSearch, setVariableSearch] = useState("");
  const previewBooking = data.bookings.find(booking => booking.id === bookingId);
  const draft = { ...template, name, subject, body, active };
  const preview = previewBooking ? renderTemplate(draft, previewBooking, data) : undefined;
  const unknown = Array.from(`${subject}\n${body}`.matchAll(/{{\s*([^}]+)\s*}}/g)).map(match => match[1].trim()).filter(variable => !(template.allowedVariables ?? []).includes(variable));
  async function save() {
    setSaving(true); setStatus("");
    const config = data.communicationConfigs.find(item => item.id === "communication") ?? data.communicationConfigs[0] ?? { id: "communication", senderName: "Stawy u Sikory", copyUserIds: [], travelGuides: [] };
    if (config.version !== openedConfigVersion) { setSaving(false); setStatus("Konfiguracja zmieniła się podczas edycji. Zamknij i otwórz szablon ponownie."); return; }
    const result = await upsertCommunicationConfig({ ...config, templateOverrides: [
      ...(config.templateOverrides ?? []).filter(item => item.id !== template.id),
      { id: template.id, name: name.trim(), subject: subject.trim() || undefined, body: body.trim(), active, version: template.version + 1 },
    ] });
    setSaving(false);
    if (result.ok) onClose(); else setStatus(result.message ?? "Nie potwierdzono zapisu.");
  }
  return <Dialog ariaLabelledby="template-title" onClose={onClose} overlayClassName="grid place-items-center" className="max-h-[92dvh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-[#fffdf8] shadow-2xl">
    <header className="flex items-center justify-between border-b border-[#ded7ca] p-5"><div><p className="text-xs font-bold uppercase tracking-wider text-[#758079]">{template.language.toUpperCase()} · {template.channel} · {template.purpose}</p><h2 id="template-title" className="font-display text-2xl font-semibold">{canEdit ? "Edytuj szablon" : "Podgląd szablonu"}</h2></div><Button variant="secondary" onClick={onClose}>Zamknij</Button></header>
    <div className="grid lg:grid-cols-[220px_minmax(0,1fr)]"><aside className="border-b border-[#ded7ca] bg-[#f2f0e8] p-4 lg:border-b-0 lg:border-r"><h3 className="mb-3 text-sm font-bold">Zmienne wiadomości</h3><input className={inputClass} aria-label="Szukaj zmiennej" placeholder="Szukaj zmiennej…" value={variableSearch} onChange={event => setVariableSearch(event.target.value)}/><div className="mt-3 flex flex-wrap gap-2">{(template.allowedVariables ?? []).filter(variable => variable.includes(variableSearch)).map(variable => <button disabled={!canEdit} key={variable} onClick={() => setBody(value => `${value}{{${variable}}}`)} className="rounded-lg border border-[#d9d1c1] bg-white px-2 py-2 text-left text-xs text-[#174d3b]">{`{{${variable}}}`}</button>)}</div>{!template.allowedVariables?.length ? <p className="mt-3 text-xs leading-5 text-[#69766e]">Oryginał z Mobile Calendar. Zmienne wymagają dopasowania przed użyciem w automatyzacji.</p> : null}</aside>
      <div className="grid gap-4 p-5"><Field label="Nazwa szablonu"><input disabled={!canEdit} className={inputClass} value={name} onChange={event => setName(event.target.value)}/></Field><Field label="Temat wiadomości"><input disabled={!canEdit} className={inputClass} value={subject} onChange={event => setSubject(event.target.value)}/></Field><Field label="Treść wiadomości"><textarea disabled={!canEdit} className={`${inputClass} min-h-64 font-mono text-sm leading-6`} value={body} onChange={event => setBody(event.target.value)}/></Field><label className="flex items-center gap-2 text-sm"><input disabled={!canEdit} type="checkbox" checked={active} onChange={event => setActive(event.target.checked)}/>Szablon aktywny</label>
        {unknown.length ? <p role="alert" className="text-sm text-[#96452f]">Nieznane zmienne: {Array.from(new Set(unknown)).join(", ")}</p> : null}
        <div className="rounded-xl border border-[#ded7ca] bg-[#f5f3eb] p-4"><Field label="Podgląd dla rezerwacji"><select className={inputClass} value={bookingId} onChange={event => setBookingId(event.target.value)}><option value="">Wybierz rezerwację</option>{data.bookings.filter(booking => !booking.deletedAt).map(booking => <option key={booking.id} value={booking.id}>{booking.guestLabel} · {booking.checkIn}</option>)}</select></Field>{preview ? <><p className="mt-4 font-bold">{preview.subject}</p><p className="mt-3 whitespace-pre-wrap text-sm leading-6">{preview.body}</p>{preview.unresolved.length ? <p className="mt-3 text-xs text-[#96452f]">Ten pobyt wymaga danych: {preview.unresolved.join(", ")}.</p> : null}</> : <p className="mt-3 text-xs text-[#69766e]">Wybierz pobyt, aby zobaczyć podstawione dane.</p>}</div>
        {status ? <p role="alert" className="text-sm text-[#96452f]">{status}</p> : null}
        {canEdit ? <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#ded7ca] pt-4"><p className="max-w-lg text-xs leading-5 text-[#69766e]">Zmiana dotyczy przyszłych wiadomości. Wysłana historia pozostaje bez zmian. Kolejka ponownie sprawdzi odbiorcę, treść i wymagane dane.</p><Button disabled={saving || !name.trim() || !body.trim() || Boolean(unknown.length) || (template.channel === "E-mail" && !subject.trim())} onClick={() => void save()}>{saving ? "Zapisywanie…" : "Zapisz szablon"}</Button></div> : null}
      </div></div>
  </Dialog>;
}
