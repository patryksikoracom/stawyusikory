"use client";

import { useRef, useState } from "react";
import { decryptJson } from "@/lib/security/data-exports";
import { Dialog } from "@/components/ui/dialog";
import { Button, Field, inputClass } from "@/components/ui/primitives";

export function VerifyBackupDialog({ onClose }: { onClose: () => void }) {
  const [file, setFile] = useState<File>();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState<string>();
  const pending = useRef(false);
  async function verify() {
    if (!file || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setReport(undefined);
    try {
      if (file.size > 100_000_000) throw new Error("Plik kopii jest zbyt duży.");
      const data = await decryptJson(await file.text(), password);
      if (!data || typeof data !== "object" || !("bookings" in data) || !Array.isArray(data.bookings)) {
        throw new Error("Plik został odszyfrowany, ale nie zawiera kopii rezerwacji Stawy OS.");
      }
      const collections = Object.values(data).filter(Array.isArray);
      setReport(`Odszyfrowano ${collections.length} kolekcji, w tym ${data.bookings.length} rezerwacji. Integralność zaszyfrowanego pliku jest poprawna. Test odtworzenia bazy i powiązań wymaga osobnego środowiska.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nie udało się sprawdzić kopii.");
    } finally {
      setPassword("");
      setBusy(false);
      pending.current = false;
    }
  }
  return <Dialog ariaLabelledby="verify-backup-title" closeDisabled={busy} onClose={onClose} className="w-full max-w-lg rounded-[22px] bg-[#fffdf8] p-6" overlayClassName="grid place-items-center">
    <h2 id="verify-backup-title" className="font-display text-2xl font-semibold">Sprawdź kopię danych</h2>
    <p className="mt-3 text-sm text-[#65736d]">Plik i hasło pozostają w tej przeglądarce. Sprawdzenie nie zmienia danych aplikacji. Kopia obejmuje wyeksportowane dane operacyjne; konta, uprawnienia i kolejki dostaw wymagają kopii bazy.</p>
    <div className="mt-5 grid gap-4">
      <Field label="Zaszyfrowana kopia"><input aria-label="Zaszyfrowana kopia" type="file" accept=".stawyos" disabled={busy} onChange={event => { setFile(event.target.files?.[0]); setReport(undefined); setError(""); }}/></Field>
      <Field label="Hasło kopii"><input aria-label="Hasło kopii" className={inputClass} type="password" autoComplete="off" value={password} disabled={busy} onChange={event => setPassword(event.target.value)}/></Field>
    </div>
    {error ? <p role="alert" className="mt-4 text-sm text-[#963c27]">{error}</p> : null}
    {report ? <p role="status" className="mt-4 text-sm text-[#315b43]">{report}</p> : null}
    <div className="mt-5 flex justify-end gap-2"><Button variant="secondary" disabled={busy} onClick={onClose}>Zamknij</Button><Button disabled={busy || !file || !password} onClick={() => void verify()}>{busy ? "Sprawdzam…" : "Sprawdź plik"}</Button></div>
  </Dialog>;
}
