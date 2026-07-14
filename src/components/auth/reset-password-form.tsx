"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Field, inputClass } from "@/components/ui/primitives";

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirmation) {
      setMessage("Hasła nie są identyczne.");
      return;
    }
    const client = createClient();
    if (!client) return setMessage("Brak konfiguracji logowania.");
    setBusy(true);
    const { error } = await client.auth.updateUser({ password });
    setBusy(false);
    if (error) return setMessage("Nie udało się ustawić nowego hasła.");
    router.replace("/dashboard");
    router.refresh();
  }

  return <form className="mt-7 grid gap-4" onSubmit={submit}>
    <Field label="Nowe hasło"><input className={inputClass} type="password" minLength={10} autoComplete="new-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></Field>
    <Field label="Powtórz hasło"><input className={inputClass} type="password" minLength={10} autoComplete="new-password" required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></Field>
    {message ? <p aria-live="polite" className="rounded-xl bg-[#f5ead0] p-3 text-sm font-bold text-[#725a1d]">{message}</p> : null}
    <Button className="w-full" disabled={busy} type="submit">{busy ? "Zapisuję…" : "Ustaw nowe hasło"}</Button>
  </form>;
}

