"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Field, inputClass } from "@/components/ui/primitives";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const client = createClient();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!client) { router.push("/dashboard"); return; }
    setBusy(true); setMessage("");
    const { error } = await client.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { setMessage("Nie udało się zalogować. Sprawdź e-mail i hasło."); return; }
    router.replace("/dashboard"); router.refresh();
  }

  async function resetPassword() {
    if (!client || !email) { setMessage("Najpierw wpisz adres e-mail."); return; }
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback?next=/reset-password` });
    setMessage(error ? "Nie udało się wysłać wiadomości." : "Link do zmiany hasła został wysłany.");
  }

  return <form className="mt-7 grid gap-4" onSubmit={submit}>
    <Field label="E-mail"><input className={inputClass} autoComplete="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
    <Field label="Hasło"><input className={inputClass} autoComplete="current-password" type="password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /></Field>
    {message ? <p aria-live="polite" className="rounded-xl bg-[#f5ead0] p-3 text-sm font-bold text-[#725a1d]">{message}</p> : null}
    <Button className="w-full" disabled={busy} type="submit">{busy ? "Logowanie…" : client ? "Zaloguj się" : "Wejdź do trybu lokalnego"}</Button>
    {client ? <button className="text-sm font-bold text-[#246457]" type="button" onClick={resetPassword}>Nie pamiętam hasła</button> : <p className="text-center text-xs leading-5 text-[#6b7771]">Supabase nie jest skonfigurowane. Dane pozostaną wyłącznie na tym urządzeniu.</p>}
  </form>;
}
