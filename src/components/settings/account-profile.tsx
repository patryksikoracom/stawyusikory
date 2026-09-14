"use client";

import { useState } from "react";
import { Button, Card, Field, inputClass } from "@/components/ui/primitives";

export function AccountProfile() {
  const [profile, setProfile] = useState<{ displayName: string; email: string; role: string }>();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  async function request(save: boolean) {
    if (busy) return;
    setBusy(true); setError(""); setSaved(false);
    try {
      const response = await fetch("/api/account/profile", save
        ? { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ displayName: name }) }
        : { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Nie udało się odczytać konta.");
      if (save) { setProfile(current => current && ({ ...current, displayName: result.displayName })); setName(result.displayName); setSaved(true); }
      else { setProfile(result); setName(result.displayName); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Nie udało się połączyć z serwerem."); }
    finally { setBusy(false); }
  }
  return <Card className="p-5"><h2 className="font-display text-xl font-semibold">Moje konto</h2>
    {profile ? <div className="mt-4 grid gap-3"><p className="text-sm">{profile.email} · {profile.role}</p><Field label="Nazwa konta"><input className={inputClass} value={name} disabled={busy} maxLength={100} onChange={event => { setName(event.target.value); setSaved(false); }}/></Field><Button disabled={busy || name.trim().length < 2 || name === profile.displayName} onClick={() => void request(true)}>{busy ? "Zapisuję…" : "Zapisz nazwę konta"}</Button></div>
      : <Button className="mt-4" variant="secondary" disabled={busy} onClick={() => void request(false)}>{busy ? "Pobieram…" : "Pokaż moje konto"}</Button>}
    {error ? <p role="alert" className="mt-3 text-sm text-[#943b27]">{error}</p> : null}
    {saved ? <p role="status" className="mt-3 text-sm text-[#215c3b]">Nazwa konta została zapisana.</p> : null}
  </Card>;
}
