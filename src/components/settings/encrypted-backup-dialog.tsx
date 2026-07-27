"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button, Field, inputClass } from "@/components/ui/primitives";

export function EncryptedBackupDialog({ onClose, onExport }: { onClose: () => void; onExport: (passphrase: string) => Promise<void> }) {
  const [passphrase, setPassphrase] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (passphrase.length < 12) { setError("Hasło musi mieć co najmniej 12 znaków."); return; }
    if (passphrase !== confirmation) { setError("Powtórzone hasło nie jest identyczne."); return; }
    setBusy(true);
    setError("");
    try {
      await onExport(passphrase);
      onClose();
    } catch (exportError) {
      setBusy(false);
      setError(exportError instanceof Error ? exportError.message : "Nie udało się utworzyć zaszyfrowanej kopii.");
    }
  }

  return <Dialog ariaDescribedby="backup-dialog-description" ariaLabelledby="backup-dialog-title" className="w-full max-w-lg rounded-[22px] bg-[#fffdf8] p-6 shadow-2xl" closeDisabled={busy} onClose={onClose} overlayClassName="grid place-items-center">
    <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#7d8b4d]">Kopia bezpieczeństwa</p>
    <h2 className="mt-1 font-display text-2xl font-semibold" id="backup-dialog-title">Ustaw hasło szyfrowania</h2>
    <p className="mt-2 text-sm leading-6 text-[#65736d]" id="backup-dialog-description">Bez tego hasła nie da się odzyskać danych. Aplikacja nie zapisuje go ani nie wysyła do serwera.</p>
    <div className="mt-5 grid gap-4">
      <Field label="Hasło" hint="Minimum 12 znaków."><input aria-label="Hasło" data-dialog-initial-focus autoComplete="new-password" className={inputClass} disabled={busy} minLength={12} type="password" value={passphrase} onChange={(event) => setPassphrase(event.target.value)}/></Field>
      <Field label="Powtórz hasło"><input aria-label="Powtórz hasło" autoComplete="new-password" className={inputClass} disabled={busy} minLength={12} type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)}/></Field>
    </div>
    {error ? <p className="mt-4 rounded-xl bg-[#f9dfd7] p-3 text-sm font-bold text-[#963c27]" role="alert">{error}</p> : null}
    <div className="mt-6 flex flex-wrap justify-end gap-2"><Button disabled={busy} variant="secondary" onClick={onClose}>Anuluj</Button><Button disabled={busy} onClick={() => void save()}>{busy ? "Szyfruję…" : "Pobierz zaszyfrowany plik"}</Button></div>
  </Dialog>;
}
