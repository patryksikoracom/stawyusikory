"use client";

import { useState } from "react";
import { useAppStore } from "@/components/layout/app-store";
import { Badge, Button, Card, CardTitle, Field, inputClass } from "@/components/ui/primitives";
import type { MediaAsset } from "@/lib/types";
import { Icon } from "@/components/ui/icons";
import { Dialog } from "@/components/ui/dialog";
import { mediaConsentDecision } from "@/lib/compliance/consent-ledger";

export function MediaView() {
  const { data, addMedia, updateMedia } = useAppStore();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    bookingId: data.bookings[0]?.id ?? "",
    type: "Opinia" as MediaAsset["type"],
    caption: "",
    consentScope: "",
    publishChannel: "Facebook" as MediaAsset["publishChannel"],
  });

  function save() {
    if (!form.bookingId || !form.caption.trim()) return;
    addMedia({
      id: `MED-${Date.now()}`,
      bookingId: form.bookingId,
      type: form.type,
      caption: form.caption.trim(),
      consentScope: form.consentScope.trim() || undefined,
      usageStatus: "Do zgody",
      publishChannel: form.publishChannel,
      privacyRisk: "Zgoda/RODO",
    });
    setAdding(false);
    setForm({ ...form, caption: "", consentScope: "" });
  }

  return (
    <div className="grid gap-5">
      <Card>
        <CardTitle
          title="Media i zgody"
          action={<Button onClick={() => setAdding(true)}><Icon className="size-4" name="plus" />Dodaj materiał</Button>}
        >
          Publikacja jest możliwa wyłącznie przy aktywnej zgodzie na dokładny kanał. Wycofanie blokuje użycie natychmiast.
        </CardTitle>
        <div className="grid gap-4 p-5 md:grid-cols-2">
          {data.media.map((asset) => {
            const booking = data.bookings.find((item) => item.id === asset.bookingId);
            const decision = mediaConsentDecision(data, asset);
            const consentLabel = !decision.personId
              ? "brak powiązanej osoby"
              : !decision.purpose
                ? "kanał bez zdefiniowanego celu"
                : decision.consent?.decision === "granted"
                  ? `aktywna · ${decision.consent.textVersion}`
                  : decision.consent?.decision === "withdrawn"
                    ? "wycofana"
                    : "brak";
            return (
              <article className="rounded-2xl border border-[#e4dac7] bg-white p-4" key={asset.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-[#7d6b35]">
                      {asset.type} · {booking?.guestLabel ?? asset.bookingId}
                    </p>
                    <h2 className="mt-2 font-display text-xl font-semibold">{asset.caption ?? "Bez opisu"}</h2>
                  </div>
                  <Badge tone={decision.canPublish ? "good" : "bad"}>
                    {decision.canPublish ? asset.usageStatus : "Publikacja zablokowana"}
                  </Badge>
                </div>
                <dl className="mt-4 grid gap-3 text-sm">
                  <Row label="Zgoda w rejestrze" value={consentLabel} />
                  <Row label="Zakres opisowy" value={asset.consentScope ?? "brak"} />
                  <Row label="Kanał publikacji" value={asset.publishChannel} />
                  <Row label="Ryzyko prywatności" value={asset.privacyRisk} />
                </dl>
                <div className="mt-4 flex gap-2">
                  <Button
                    className="flex-1"
                    variant="secondary"
                    onClick={() => updateMedia({ ...asset, usageStatus: "Opublikowane" })}
                    disabled={!decision.canPublish || asset.usageStatus === "Opublikowane"}
                  >
                    {asset.usageStatus === "Opublikowane" ? "Opublikowane" : "Oznacz publikację"}
                  </Button>
                  <Button variant="danger" onClick={() => updateMedia({ ...asset, usageStatus: "Nie używać" })}>
                    Nie używać
                  </Button>
                </div>
              </article>
            );
          })}
          {!data.media.length
            ? <p className="p-8 text-center text-sm text-[#68756f] md:col-span-2">Biblioteka jest pusta.</p>
            : null}
        </div>
      </Card>
      {adding
        ? (
          <Dialog
            ariaLabel="Dodaj materiał"
            className="w-full max-w-lg rounded-[22px] bg-[#fffdf8] shadow-2xl"
            onClose={() => setAdding(false)}
            overlayClassName="grid place-items-center"
          >
            <form className="p-6" onSubmit={(event) => { event.preventDefault(); save(); }}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#7d8b4d]">Biblioteka</p>
                  <h2 className="font-display text-2xl font-semibold">Dodaj materiał</h2>
                </div>
                <button aria-label="Zamknij" type="button" onClick={() => setAdding(false)}>
                  <Icon className="size-5" name="close" />
                </button>
              </div>
              <div className="mt-5 grid gap-4">
                <Field label="Rezerwacja">
                  <select
                    data-dialog-initial-focus
                    className={inputClass}
                    value={form.bookingId}
                    onChange={(event) => setForm({ ...form, bookingId: event.target.value })}
                  >
                    {data.bookings.map((booking) => (
                      <option key={booking.id} value={booking.id}>{booking.guestLabel} · {booking.id}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Typ">
                  <select
                    className={inputClass}
                    value={form.type}
                    onChange={(event) => setForm({ ...form, type: event.target.value as MediaAsset["type"] })}
                  >
                    {["Zdjęcie", "Wideo", "Cytat", "Opinia", "Post", "Inne"].map((item) => <option key={item}>{item}</option>)}
                  </select>
                </Field>
                <Field label="Docelowy kanał">
                  <select
                    className={inputClass}
                    value={form.publishChannel}
                    onChange={(event) => setForm({
                      ...form,
                      publishChannel: event.target.value as MediaAsset["publishChannel"],
                    })}
                  >
                    {["Facebook", "Instagram", "Strona", "Reklama"].map((item) => <option key={item}>{item}</option>)}
                  </select>
                </Field>
                <Field label="Opis / treść">
                  <textarea
                    className={`${inputClass} min-h-24`}
                    required
                    value={form.caption}
                    onChange={(event) => setForm({ ...form, caption: event.target.value })}
                  />
                </Field>
                <Field
                  label="Notatka o zakresie lub źródle"
                  hint="To pole opisowe nie zastępuje wersjonowanej zgody zapisanej w profilu osoby."
                >
                  <textarea
                    className={`${inputClass} min-h-20`}
                    value={form.consentScope}
                    onChange={(event) => setForm({ ...form, consentScope: event.target.value })}
                  />
                </Field>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setAdding(false)}>Anuluj</Button>
                <Button type="submit">Dodaj</Button>
              </div>
            </form>
          </Dialog>
        )
        : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#f8f4eb] p-3">
      <dt className="text-[10px] font-black uppercase tracking-[.12em] text-[#7d6b35]">{label}</dt>
      <dd className="mt-1">{value}</dd>
    </div>
  );
}
