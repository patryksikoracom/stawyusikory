"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppStoreProvider, clearPersistedAppData, useAppStore, type SyncMode } from "./app-store";
import { AppDataGate } from "./app-data-gate";
import { NewBookingDialog } from "@/components/bookings/new-booking-dialog";
import { Icon, type IconName } from "@/components/ui/icons";
import { Button } from "@/components/ui/primitives";
import type { AppIdentity } from "@/lib/auth/identity";
import { createClient } from "@/lib/supabase/client";
import { formatPolishDate } from "@/lib/date";
import { deriveShellAlerts } from "@/lib/workflow/shell-alerts";
import { unitName } from "@/lib/workflow/rules";

const primaryNav: { href: string; label: string; icon: IconName }[] = [
  { href: "/dashboard", label: "Dzisiaj", icon: "today" },
  { href: "/calendar", label: "Kalendarz", icon: "calendar" },
  { href: "/bookings", label: "Rezerwacje", icon: "booking" },
  { href: "/guests", label: "Goście i marketing", icon: "guest" },
  { href: "/finances", label: "Finanse", icon: "wallet" },
];

const secondaryNav: { href: string; label: string; icon: IconName }[] = [
  { href: "/tasks", label: "Sprzątanie i zadania", icon: "cleaning" },
  { href: "/imports", label: "Integracje", icon: "plug" },
  { href: "/settings", label: "Ustawienia", icon: "settings" },
];

const pageMeta: Record<string, { eyebrow: string; title: string; body: string }> = {
  "/dashboard": { eyebrow: "Centrum operacyjne", title: "Dzień dobry", body: "Najważniejsze rzeczy na dziś — bez szukania po modułach." },
  "/calendar": { eyebrow: "Obłożenie i dostępność", title: "Kalendarz pobytów", body: "Wspólny widok obu domków z jawnym statusem źródła i synchronizacji." },
  "/bookings": { eyebrow: "Sprzedaż i pobyty", title: "Rezerwacje", body: "Każdy pobyt, płatność i następna akcja w jednym miejscu." },
  "/guests": { eyebrow: "Relacje i wzrost", title: "Goście i marketing", body: "Wiedza, która pomaga zdobywać lepsze rezerwacje bez zwiększania prowizji." },
  "/finances": { eyebrow: "Przychody i rozliczenia", title: "Finanse", body: "Wpłaty, prowizje, wypłaty i faktyczna marża." },
  "/tasks": { eyebrow: "Operacje obiektu", title: "Sprzątanie i zadania", body: "Kto, co i do kiedy — z potwierdzeniem wykonania." },
  "/imports": { eyebrow: "Kanały sprzedaży", title: "Integracje", body: "Stan połączeń, importów i bezpieczeństwa kalendarza." },
  "/settings": { eyebrow: "Konfiguracja", title: "Ustawienia", body: "Domki, reguły, automatyzacje i dostęp zespołu." },
  "/media": { eyebrow: "Biblioteka", title: "Media i zgody", body: "Materiały gotowe do bezpiecznego użycia w marketingu." },
};

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function syncCopy(syncMode: SyncMode, lastSavedAt?: string) {
  switch (syncMode) {
    case "cloud":
      return {
        label: "Synchronizacja aktywna",
        body: `Dane zapisują się między urządzeniami${lastSavedAt ? ` · ${new Date(lastSavedAt).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}` : ""}.`,
      };
    case "checking":
      return { label: "Pobieram dane", body: "Pobieramy aktualny stan organizacji." };
    case "conflict":
      return { label: "Konflikt zmian", body: "Dane zmieniły się na innym urządzeniu. Odśwież stronę przed ponowną edycją." };
    case "error":
      return { label: "Błąd synchronizacji", body: "Nie udało się pobrać lub zapisać danych. Sprawdź połączenie i spróbuj ponownie." };
    default:
      return { label: "Tryb lokalny", body: "Dane są zapisane wyłącznie w tej przeglądarce." };
  }
}

function NavItem({ href, label, icon, compact = false }: { href: string; label: string; icon: IconName; compact?: boolean }) {
  const pathname = usePathname();
  const active = isActive(pathname, href);
  return (
    <Link
      className={`group flex items-center gap-3 rounded-xl transition ${compact ? "px-3 py-2.5 text-[13px]" : "px-3 py-3 text-sm"} ${active ? "bg-[#e5ead7] font-black text-[#174d3b]" : "font-semibold text-[#607069] hover:bg-[#eeeae0] hover:text-[#18332c]"}`}
      href={href}
    >
      <span className={`grid size-8 shrink-0 place-items-center rounded-lg transition ${active ? "bg-[#174d3b] text-white" : "text-[#607069] group-hover:bg-white"}`}>
        <Icon className="size-[18px]" name={icon} />
      </span>
      <span>{label}</span>
      {active ? <span className="ml-auto size-1.5 rounded-full bg-[#e86e4e]" /> : null}
    </Link>
  );
}

function ShellInner({ children, identity }: { children: React.ReactNode; identity: AppIdentity }) {
  const { data, dataStatus, syncMode, lastSavedAt, retryDataLoad } = useAppStore();
  const pathname = usePathname();
  const [showNew, setShowNew] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const [toast, setToast] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [query, setQuery] = useState("");
  const dataReady = dataStatus === "ready";
  const { label: syncLabel, body: syncBody } = syncCopy(syncMode, lastSavedAt);
  const meta = Object.entries(pageMeta).find(([href]) => isActive(pathname, href))?.[1] ?? pageMeta["/dashboard"];
  const pageTitle = pathname === "/dashboard" ? `${meta.title}, ${identity.displayName}` : meta.title;
  const date = useMemo(() => new Intl.DateTimeFormat("pl-PL", { weekday: "long", day: "numeric", month: "long" }).format(new Date()), []);
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") void navigator.serviceWorker.register("/sw.js");
  }, []);
  const searchResults = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (value.length < 2) return [];
    return data.bookings.filter((booking) => [booking.guestLabel, booking.id, booking.platformReservationNo, unitName(data.units, booking.unitId)].filter(Boolean).some((field) => String(field).toLowerCase().includes(value))).slice(0, 8);
  }, [data, query]);
  const alerts = useMemo(() => dataReady ? deriveShellAlerts(data) : [], [data, dataReady]);

  async function signOut() {
    const client = createClient();
    if (client) await client.auth.signOut();
    clearPersistedAppData();
    if ("caches" in window) {
      const keys = await window.caches.keys();
      await Promise.all(keys.map((key) => window.caches.delete(key)));
    }
    window.location.href = "/login";
  }

  function added() {
    setShowNew(false);
    setToast("Rezerwacja dodana. Utworzyłem też zadania operacyjne.");
    window.setTimeout(() => setToast(""), 4200);
  }

  return (
    <div className="min-h-screen text-[#18332c] lg:grid lg:grid-cols-[252px_minmax(0,1fr)]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[252px] flex-col border-r border-[#d5cebf] bg-[#f7f3ea]/95 px-3 py-4 backdrop-blur lg:flex">
        <Link className="mb-6 flex items-center gap-3 px-2 py-1" href="/dashboard">
          <span className="grid size-11 place-items-center rounded-[14px] bg-[#174d3b] font-display text-lg font-semibold text-white shadow-[0_9px_24px_rgba(23,77,59,.24)]">SU</span>
          <span><span className="block font-display text-[19px] font-semibold leading-5">Stawy OS</span><span className="text-[10px] font-black uppercase tracking-[.17em] text-[#829052]">u Sikory</span></span>
        </Link>

        <nav className="grid gap-1">
          {primaryNav.map((item) => <NavItem key={item.href} {...item} />)}
        </nav>
        <div className="mx-3 my-4 h-px bg-[#ded7ca]" />
        <nav className="grid gap-1">
          {secondaryNav.map((item) => <NavItem compact key={item.href} {...item} />)}
        </nav>

        <div className="mt-auto rounded-2xl border border-[#d6ddc0] bg-[#edf0df] p-3.5">
          <div className="flex items-center gap-2 text-xs font-black text-[#294e3e]"><span className={`size-2 rounded-full ${syncMode === "cloud" ? "pulse-dot bg-[#4d986b]" : syncMode === "error" || syncMode === "conflict" ? "bg-[#d45f45]" : "bg-[#d3a638]"}`} />{syncLabel}</div>
          <p className="mt-2 text-[12px] leading-5 text-[#5e6d61]">{syncBody}</p>
          <Link className="mt-2 inline-flex items-center gap-1 text-xs font-black text-[#174d3b]" href="/imports">Zobacz integracje <Icon className="size-3.5" name="arrow" /></Link>
        </div>
      </aside>

      <div className="min-w-0 lg:col-start-2">
        <header className="sticky top-0 z-30 border-b border-[#d9d1c1]/85 bg-[#f5f1e7]/88 backdrop-blur-xl">
          <div className="flex h-[70px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <Link className="flex items-center gap-2 lg:hidden" href="/dashboard"><span className="grid size-9 place-items-center rounded-xl bg-[#174d3b] font-display font-semibold text-white">SU</span><span className="font-display font-semibold">Stawy OS</span></Link>
            <div className="hidden items-center gap-2 text-sm font-semibold text-[#64726b] sm:flex"><Icon className="size-4" name="calendar" /><span className="capitalize">{date}</span></div>
            <div className="ml-auto flex items-center gap-2">
              <button aria-label="Szukaj" className="grid size-10 place-items-center rounded-xl border border-[#d5cebf] bg-white text-[#53655d] transition hover:border-[#317a78] hover:text-[#174d3b] disabled:cursor-not-allowed disabled:opacity-45" disabled={!dataReady} onClick={() => setShowSearch(true)}><Icon className="size-[18px]" name="search" /></button>
              <div className="relative">
                <button aria-expanded={showAlerts} aria-haspopup="dialog" aria-label={alerts.length ? `Powiadomienia: ${alerts.length}` : "Powiadomienia: brak"} className="relative grid size-10 place-items-center rounded-xl border border-[#d5cebf] bg-white text-[#53655d] transition hover:border-[#317a78] disabled:cursor-not-allowed disabled:opacity-45" disabled={!dataReady} onClick={() => setShowAlerts((value) => !value)}><Icon className="size-[18px]" name="bell" />{dataReady && alerts.length ? <span className="absolute right-2 top-2 size-2 rounded-full border-2 border-white bg-[#e86e4e]" /> : null}</button>
                {showAlerts ? <div aria-label="Alerty operacyjne" className="absolute right-[-3rem] top-12 w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-[#d7cfc0] bg-[#fffdf8] p-3 shadow-2xl sm:right-0" role="dialog"><div className="flex items-center justify-between gap-3 px-2 py-1"><p className="text-xs font-black uppercase tracking-[.15em] text-[#74814d]">Wymaga uwagi</p>{alerts.length ? <span className="rounded-full bg-[#f6e8c9] px-2 py-0.5 text-[10px] font-black text-[#7a5b19]">{alerts.length}</span> : null}</div>{alerts.map((alert) => <AlertMini key={alert.id} {...alert} />)}{!alerts.length ? <div className="mx-1 mt-2 rounded-xl bg-[#e9f1e3] px-4 py-5 text-center"><span className="mx-auto grid size-9 place-items-center rounded-full bg-[#4d986b] text-white"><Icon className="size-4" name="check" /></span><p className="mt-2 text-sm font-black">Brak spraw wymagających uwagi</p><p className="mt-1 text-xs leading-5 text-[#607069]">Aktualne dane nie tworzą żadnego alertu.</p></div> : null}</div> : null}
              </div>
              <span className="hidden sm:block"><Button disabled={!dataReady} onClick={() => setShowNew(true)}><Icon className="size-4" name="plus" />Nowa rezerwacja</Button></span>
              <div className="relative"><button aria-expanded={showAccount} aria-label={`Konto: ${identity.displayName}`} className="grid size-10 place-items-center rounded-xl bg-[#18332c] text-xs font-black text-white" onClick={() => setShowAccount((value) => !value)}>{identity.initials}</button>{showAccount ? <div className="absolute right-0 top-12 w-[min(290px,calc(100vw-2rem))] rounded-2xl border border-[#d7cfc0] bg-[#fffdf8] p-2 shadow-2xl"><div className="border-b border-[#e8e1d5] px-3 pb-3 pt-2"><p className="truncate text-sm font-black">{identity.displayName}</p><p className="mt-0.5 truncate text-xs text-[#68766f]">{identity.email ?? "Brak adresu e-mail"}</p><div className="mt-2 flex flex-wrap gap-1.5"><span className="rounded-full bg-[#e5ead7] px-2 py-1 text-[10px] font-black text-[#315744]">{identity.roleLabel}</span>{identity.organizationName ? <span className="max-w-full truncate rounded-full bg-[#e5ecec] px-2 py-1 text-[10px] font-black text-[#315d61]">{identity.organizationName}</span> : null}</div></div><Link className="mt-1 block rounded-xl px-3 py-2 text-sm font-bold hover:bg-[#f1eee6]" href="/settings" onClick={() => setShowAccount(false)}>Ustawienia</Link><button className="w-full rounded-xl px-3 py-2 text-left text-sm font-bold text-[#9b4029] hover:bg-[#f9dfd7]" onClick={signOut}>Wyloguj się</button></div> : null}</div>
            </div>
          </div>
        </header>

        <main className="px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-12">
          <div className="mx-auto max-w-[1460px]">
            <AppDataGate onRetry={retryDataLoad} status={dataStatus}>
              <div className="animate-rise mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div><p className="text-[11px] font-black uppercase tracking-[.2em] text-[#7f8f4f]">{meta.eyebrow}</p><h1 className="font-display text-[34px] font-semibold leading-tight tracking-[-.035em] sm:text-[42px]">{pageTitle}</h1><p className="mt-1 text-sm text-[#61716a]">{meta.body}</p></div>
                <Button className="sm:hidden" onClick={() => setShowNew(true)}><Icon className="size-4" name="plus" />Nowa rezerwacja</Button>
              </div>
              {children}
            </AppDataGate>
          </div>
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-[#d4ccbd] bg-[#fffdf8]/95 px-1 pb-[max(.4rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-8px_30px_rgba(29,47,40,.08)] backdrop-blur lg:hidden">
        {[primaryNav[0], primaryNav[1], primaryNav[2], secondaryNav[0]].map((item) => { const active = isActive(pathname, item.href); return <Link className={`flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[9px] font-black ${active ? "text-[#174d3b]" : "text-[#768079]"}`} href={item.href} key={item.href}><span className={`grid size-8 place-items-center rounded-xl ${active ? "bg-[#e5ead7]" : ""}`}><Icon className="size-[18px]" name={item.icon} /></span><span className="max-w-full truncate">{item.label.replace("Sprzątanie i ", "")}</span></Link>; })}
        <button className={`flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[9px] font-black ${showMore ? "text-[#174d3b]" : "text-[#768079]"}`} onClick={() => setShowMore(true)}><span className={`grid size-8 place-items-center rounded-xl ${showMore ? "bg-[#e5ead7]" : ""}`}><Icon className="size-[18px]" name="more" /></span>Więcej</button>
      </nav>

      {showNew && dataReady ? <NewBookingDialog onClose={() => setShowNew(false)} onAdded={added} /> : null}
      {showSearch ? <div className="fixed inset-0 z-50 bg-[#102c24]/65 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowSearch(false); }}><section className="mx-auto mt-[8vh] max-w-2xl rounded-[22px] border border-[#d7cfc0] bg-[#fffdf8] p-4 shadow-2xl"><div className="flex gap-2"><div className="relative flex-1"><Icon className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#728078]" name="search"/><input autoFocus className="min-h-12 w-full rounded-xl border border-[#cbc3b4] bg-white pl-10 pr-4 text-sm outline-none focus:border-[#317a78]" placeholder="Gość, numer rezerwacji lub domek…" value={query} onChange={(event) => setQuery(event.target.value)} /></div><Button aria-label="Zamknij wyszukiwanie" variant="secondary" onClick={() => setShowSearch(false)}><Icon className="size-4" name="close"/></Button></div><div className="mt-3 grid gap-1">{searchResults.map((booking) => <Link className="flex items-center justify-between rounded-xl p-3 hover:bg-[#f1eee6]" href={`/bookings/${booking.id}`} key={booking.id} onClick={() => setShowSearch(false)}><span><span className="block text-sm font-black">{booking.guestLabel}</span><span className="text-xs text-[#6b7771]">{unitName(data.units, booking.unitId)} · {formatPolishDate(booking.checkIn)} – {formatPolishDate(booking.checkOut)}</span></span><Icon className="size-4" name="arrow"/></Link>)}{query.length >= 2 && !searchResults.length ? <p className="p-6 text-center text-sm font-bold text-[#6b7771]">Brak wyników.</p> : null}</div></section></div> : null}
      {showMore ? <div className="fixed inset-0 z-50 bg-[#102c24]/65 p-4 backdrop-blur-sm lg:hidden" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowMore(false); }}><section className="absolute inset-x-3 bottom-3 rounded-[24px] border border-[#d7cfc0] bg-[#fffdf8] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl"><div className="flex items-center justify-between px-1 pb-3"><h2 className="font-display text-2xl font-semibold">Wszystkie moduły</h2><button aria-label="Zamknij" className="grid size-9 place-items-center rounded-xl border" onClick={() => setShowMore(false)}><Icon className="size-4" name="close"/></button></div><div className="grid grid-cols-2 gap-2">{[primaryNav[3], primaryNav[4], secondaryNav[1], secondaryNav[2], { href: "/media", label: "Media i zgody", icon: "guest" as const }].map((item) => <Link className="flex items-center gap-3 rounded-2xl border border-[#ded7ca] bg-white p-3 text-sm font-black" href={item.href} key={item.href} onClick={() => setShowMore(false)}><span className="grid size-9 place-items-center rounded-xl bg-[#e5ead7]"><Icon className="size-4" name={item.icon}/></span>{item.label}</Link>)}</div></section></div> : null}
      {toast ? <div className="fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl bg-[#18332c] px-4 py-3 text-sm font-bold text-white shadow-2xl lg:bottom-6"><span className="grid size-6 place-items-center rounded-full bg-[#4d986b]"><Icon className="size-4" name="check" /></span>{toast}</div> : null}
    </div>
  );
}

function AlertMini({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  return <div className="mt-1 flex gap-3 rounded-xl p-2.5 hover:bg-[#f4f0e7]"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f6e8c9] text-[#8c6713]"><Icon className="size-4" name={icon} /></span><span><span className="block text-sm font-black">{title}</span><span className="mt-0.5 block text-xs leading-5 text-[#68766f]">{body}</span></span></div>;
}

export function AppShell({ children, identity }: { children: React.ReactNode; identity: AppIdentity }) {
  return <AppStoreProvider><ShellInner identity={identity}>{children}</ShellInner></AppStoreProvider>;
}
