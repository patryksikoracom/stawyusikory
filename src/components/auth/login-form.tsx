"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { navigateAfterLogin } from "@/lib/auth/browser-navigation";
import { Button, Field, inputClass } from "@/components/ui/primitives";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const client = createClient();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!client) { navigateAfterLogin(); return; }
    setBusy(true);
    setMessage("");
    try {
      const { data, error } = await client.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error || !data.session) {
        setMessage("Nie udało się zalogować. Sprawdź e-mail i hasło.");
        return;
      }
      navigateAfterLogin();
    } catch {
      setMessage("Nie udało się połączyć z logowaniem. Sprawdź internet i spróbuj ponownie.");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (!client || !email) { setMessage("Najpierw wpisz adres e-mail."); return; }
    setBusy(true);
    setMessage("");
    try {
      const { error } = await client.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo: `${window.location.origin}/auth/callback?next=/reset-password` },
      );
      setMessage(error ? "Nie udało się wysłać wiadomości." : "Link do zmiany hasła został wysłany.");
    } catch {
      setMessage("Nie udało się połączyć z resetem hasła. Spróbuj ponownie.");
    } finally {
      setBusy(false);
    }
  }

  return <form className="mt-7 grid gap-4" onSubmit={submit}>
    <Field label="E-mail"><input className={inputClass} autoComplete="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
    <Field label="Hasło"><input className={inputClass} autoComplete="current-password" type="password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /></Field>
    {message ? <p aria-live="polite" className="rounded-xl bg-[#f5ead0] p-3 text-sm font-bold text-[#725a1d]">{message}</p> : null}
    <Button className="w-full" disabled={busy} type="submit">{busy ? "Logowanie…" : client ? "Zaloguj się" : "Wejdź do trybu lokalnego"}</Button>
    {client ? <button className="text-sm font-bold text-[#246457] disabled:opacity-50" disabled={busy} type="button" onClick={resetPassword}>Nie pamiętam hasła</button> : <p className="text-center text-xs leading-5 text-[#6b7771]">Supabase nie jest skonfigurowane. Dane pozostaną wyłącznie na tym urządzeniu.</p>}
  </form>;
}
