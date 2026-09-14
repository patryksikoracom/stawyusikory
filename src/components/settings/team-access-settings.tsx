"use client";

import { useState } from "react";
import type { UserRole } from "@/lib/types";
import { roleLabel } from "@/lib/auth/identity";
import { Button, Card, CardTitle, Field, inputClass } from "@/components/ui/primitives";

type InvitationRole = Exclude<UserRole, "owner">;

const roleLabels: Record<InvitationRole, string> = {
  admin: "Administrator — może edytować dane",
  manager: "Operator — kalendarz i rezerwacje",
  viewer: "Podgląd — tylko odczyt",
  cleaning: "Sprzątanie — tylko zadania i checklisty",
  marketing: "Marketing — materiały bez danych kontaktowych",
  accounting: "Księgowość — finanse i eksport",
};

export function TeamAccessSettings({ currentRole }: { currentRole: UserRole | null }) {
  const allowedRoles: InvitationRole[] = currentRole === "owner"
    ? ["admin", "manager", "cleaning", "marketing", "accounting", "viewer"]
    : currentRole === "admin" ? ["viewer"] : [];
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InvitationRole>(allowedRoles[0] ?? "viewer");
  const [status, setStatus] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [members, setMembers] = useState<Array<{ userId: string; role: UserRole; displayName: string; email: string | null; accountAvailable: boolean }>>();
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [membersError, setMembersError] = useState("");

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
      <div className="border-b p-5">
        <Button variant="secondary" disabled={loadingMembers} onClick={async () => {
          setLoadingMembers(true); setMembersError("");
          try {
            const response = await fetch("/api/admin/members", { cache: "no-store" });
            const result = await response.json();
            if (!response.ok || !Array.isArray(result.members)) throw new Error(result.error ?? "Nie udało się pobrać listy kont.");
            setMembers(result.members);
          } catch (cause) { setMembersError(cause instanceof Error ? cause.message : "Nie udało się pobrać listy kont."); }
          finally { setLoadingMembers(false); }
        }}>{loadingMembers ? "Pobieram konta…" : "Pokaż obecne konta i role"}</Button>
        {membersError ? <p role="alert" className="mt-3 text-sm text-[#943b27]">{membersError}</p> : null}
        {members ? <ul className="mt-4 grid gap-3">{members.map(member => <li key={member.userId} className="rounded-xl bg-[#f4f1e9] p-3 text-sm"><p className="font-bold">{member.displayName}</p><p>{roleLabel(member.role)}{member.email && member.email !== member.displayName ? ` · ${member.email}` : ""}</p>{!member.accountAvailable ? <p className="text-[#943b27]">Nie udało się odczytać danych konta.</p> : null}</li>)}</ul> : null}
      </div>
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
