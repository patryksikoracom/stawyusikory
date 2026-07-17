"use client";

import { useState } from "react";
import type { UserRole } from "@/lib/types";
import { Button, Card, CardTitle, Field, inputClass } from "@/components/ui/primitives";

type InvitationRole = Extract<UserRole, "admin" | "viewer">;

const roleLabels: Record<InvitationRole, string> = {
  admin: "Administrator — może edytować dane",
  viewer: "Podgląd — tylko odczyt",
};

export function TeamAccessSettings({ currentRole }: { currentRole: UserRole | null }) {
  const allowedRoles: InvitationRole[] = currentRole === "owner" ? ["admin", "viewer"] : currentRole === "admin" ? ["viewer"] : [];
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InvitationRole>(allowedRoles[0] ?? "viewer");
  const [status, setStatus] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!allowedRoles.length) return null;

  async function invite() {
    setSubmitting(true);
    setStatus(null);
    try {
      const response = await fetch("/api/admin/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Nie udało się wysłać zaproszenia.");
      setStatus({ tone: "success", message: `Zaproszenie wysłane do ${email.trim().toLowerCase()}.` });
      setEmail("");
    } catch (error) {
      setStatus({ tone: "error", message: error instanceof Error ? error.message : "Nie udało się wysłać zaproszenia." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardTitle eyebrow="Zespół" title="Dostęp do Stawy OS">
        Zaproszona osoba otrzyma e-mail do ustawienia hasła. Dostęp powstaje tylko z wybraną rolą — nigdy automatycznie jako właściciel.
      </CardTitle>
      <div className="grid gap-4 p-5 sm:grid-cols-[1fr_260px_auto] sm:items-end">
        <Field label="E-mail osoby">
          <input
            autoComplete="email"
            className={inputClass}
            disabled={submitting}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="osoba@firma.pl"
            type="email"
            value={email}
          />
        </Field>
        <Field label="Poziom dostępu">
          <select className={inputClass} disabled={submitting} onChange={(event) => setRole(event.target.value as InvitationRole)} value={role}>
            {allowedRoles.map((option) => <option key={option} value={option}>{roleLabels[option]}</option>)}
          </select>
        </Field>
        <Button disabled={submitting || !email.trim()} onClick={invite} type="button">
          {submitting ? "Wysyłanie…" : "Wyślij zaproszenie"}
        </Button>
      </div>
      {status ? (
        <p
          aria-live="polite"
          className={`border-t px-5 py-3 text-sm font-bold ${status.tone === "success" ? "border-[#c9ddc7] bg-[#eaf4e8] text-[#215c3b]" : "border-[#efcfc5] bg-[#fdf0ec] text-[#943b27]"}`}
          role={status.tone === "error" ? "alert" : "status"}
        >
          {status.message}
        </p>
      ) : null}
    </Card>
  );
}
