"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { initialData } from "@/lib/demo-data";
import { todayInPoland } from "@/lib/date";
import type {
  AppData,
  AuditEvent,
  Booking,
  CalendarBlock,
  ContactConsent,
  GuestProfile,
  IssueReport,
  InvoiceRecord,
  MessageRecord,
  MediaAsset,
  OpsTask,
  PaymentTransaction,
  SourceConnection,
  TaskChecklistItem,
} from "@/lib/types";
import { createTasksForBooking } from "@/lib/workflow/rules";

export type SyncMode = "checking" | "cloud" | "local" | "error";

type AppStore = {
  data: AppData;
  syncMode: SyncMode;
  lastSavedAt?: string;
  addBooking: (booking: Booking, contact?: ContactConsent) => void;
  updateBooking: (booking: Booking) => void;
  deleteBooking: (bookingId: string) => void;
  updateTask: (task: OpsTask) => void;
  toggleChecklistItem: (item: TaskChecklistItem) => void;
  addIssue: (issue: IssueReport) => void;
  addBlock: (block: CalendarBlock) => void;
  updateBlock: (block: CalendarBlock) => void;
  addPayment: (payment: PaymentTransaction) => void;
  addInvoice: (invoice: InvoiceRecord) => void;
  addMessage: (message: MessageRecord) => void;
  addMedia: (media: MediaAsset) => void;
  updateMedia: (media: MediaAsset) => void;
  updateGuest: (profile: GuestProfile) => void;
  updateConsent: (consent: ContactConsent) => void;
  updateConnection: (connection: SourceConnection) => void;
  updateSettings: (settings: AppData["settings"]) => void;
  replaceWithImportedBookings: (bookings: Booking[]) => void;
  exportSnapshot: () => void;
  resetDemo: () => void;
};

const StoreContext = createContext<AppStore | null>(null);
const storageKey = "stawy-u-sikory-app-data-v3";
const oldStorageKey = "stawy-u-sikory-app-data-v2";

function uid(prefix: string) {
  const value = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${value}`;
}

function defaultChecklist(tasks: OpsTask[]) {
  const labels = [
    "Pościel i ręczniki",
    "Łazienka i kuchnia",
    "Taras i strefa wejścia",
    "Zdjęcie po zakończeniu",
  ];
  return tasks
    .filter((task) => task.type === "Sprzątanie")
    .flatMap((task) => labels.map((label, index) => ({
      id: `${task.id}-check-${index}`,
      taskId: task.id,
      label,
      done: false,
    })));
}

function normalizeData(parsed?: Partial<AppData> | null): AppData {
  const base = { ...initialData, ...parsed };
  const tasks = parsed?.tasks ?? initialData.tasks;
  return {
    ...base,
    units: parsed?.units ?? initialData.units,
    bookings: (parsed?.bookings ?? initialData.bookings).map((booking) => ({
      ...booking,
      needsReview: booking.needsReview ?? (booking.createdBy === "Import Mobile-Calendar" && (!booking.grossPrice || booking.adults + booking.children === 0)),
      version: booking.version ?? 1,
    })),
    guests: parsed?.guests ?? initialData.guests,
    consents: parsed?.consents ?? initialData.consents,
    tasks,
    media: parsed?.media ?? initialData.media,
    blocks: parsed?.blocks ?? initialData.blocks,
    rates: parsed?.rates ?? initialData.rates,
    imports: parsed?.imports ?? initialData.imports,
    sourceConnections: (parsed?.sourceConnections ?? initialData.sourceConnections).map((connection) => connection.id === "SRC-BOOKING" ? {
      ...connection,
      connectionType: "iCal",
      coverage: connection.importUrl ? connection.coverage : 0,
      lastSyncAt: connection.lastSyncAt === "demo" ? undefined : connection.lastSyncAt,
      nextStep: connection.importUrl ? connection.nextStep : "Sprawdź w Extranecie, czy konto udostępnia adres iCal dla każdego domku.",
      notes: "iCal blokuje terminy, ale nie pobiera ceny, prowizji ani danych gościa.",
      staleAfterMinutes: connection.staleAfterMinutes ?? 240,
    } : { ...connection, coverage: connection.importUrl ? connection.coverage : 0, lastSyncAt: connection.lastSyncAt === "demo" ? undefined : connection.lastSyncAt, staleAfterMinutes: connection.staleAfterMinutes ?? 240 }),
    payments: parsed?.payments ?? [],
    invoices: parsed?.invoices ?? [],
    checklistItems: parsed?.checklistItems ?? defaultChecklist(tasks),
    issues: parsed?.issues ?? [],
    messages: parsed?.messages ?? [],
    auditLog: parsed?.auditLog ?? [],
    settings: parsed?.settings ?? {
      organizationName: "Stawy u Sikory",
      timezone: "Europe/Warsaw",
      cleaningContactName: "Pani Ewa",
      cleaningPhone: "",
      defaultCheckIn: "16:00",
      defaultCheckOut: "11:00",
      aiApprovalRequired: true,
    },
  };
}

function readLocalData() {
  if (typeof window === "undefined") return normalizeData();
  const raw = window.localStorage.getItem(storageKey) ?? window.localStorage.getItem(oldStorageKey);
  if (!raw) return normalizeData();
  try {
    return normalizeData(JSON.parse(raw) as Partial<AppData>);
  } catch {
    return normalizeData();
  }
}

function audit(entityType: string, entityId: string, action: string, summary: string): AuditEvent {
  return {
    id: uid("AUD"),
    entityType,
    entityId,
    action,
    summary,
    createdAt: new Date().toISOString(),
    actor: "Właściciel",
  };
}

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(readLocalData);
  const [hydrated, setHydrated] = useState(false);
  const [syncMode, setSyncMode] = useState<SyncMode>("checking");
  const [lastSavedAt, setLastSavedAt] = useState<string>();
  const cloudReady = useRef(false);
  const initialLocal = useRef(data);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const local = readLocalData();
      initialLocal.current = local;
      setData(local);
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    let active = true;
    async function loadCloud() {
      try {
        const response = await fetch("/api/state", { cache: "no-store" });
        if (!active) return;
        if (response.ok) {
          const payload = await response.json() as { data?: Partial<AppData>; updatedAt?: string };
          if (payload.data) setData(normalizeData(payload.data));
          else {
            await fetch("/api/state", {
              method: "PUT",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ data: initialLocal.current }),
            });
          }
          cloudReady.current = true;
          setSyncMode("cloud");
          setLastSavedAt(payload.updatedAt);
          return;
        }
        setSyncMode(response.status === 503 ? "local" : "error");
      } catch {
        if (active) setSyncMode("local");
      }
    }
    void loadCloud();
    return () => { active = false; };
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(storageKey, JSON.stringify(data));
    if (!cloudReady.current) return;
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/state", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ data }),
        });
        if (!response.ok) throw new Error("save failed");
        setSyncMode("cloud");
        setLastSavedAt(new Date().toISOString());
      } catch {
        setSyncMode("error");
      }
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [data, hydrated]);

  const mutate = useCallback((fn: (current: AppData) => AppData) => setData(fn), []);

  const value = useMemo<AppStore>(() => ({
    data,
    syncMode,
    lastSavedAt,
    addBooking: (booking, contact) => mutate((current) => {
      const tasks = createTasksForBooking(booking);
      return {
        ...current,
        bookings: [{ ...booking, version: 1, updatedAt: new Date().toISOString() }, ...current.bookings],
        consents: contact ? [contact, ...current.consents] : current.consents,
        tasks: [...tasks, ...current.tasks],
        checklistItems: [...defaultChecklist(tasks), ...current.checklistItems],
        auditLog: [audit("booking", booking.id, "created", `Dodano rezerwację ${booking.guestLabel}`), ...current.auditLog],
      };
    }),
    updateBooking: (booking) => mutate((current) => ({
      ...current,
      bookings: current.bookings.map((item) => item.id === booking.id
        ? { ...booking, version: (item.version ?? 1) + 1, updatedAt: new Date().toISOString() }
        : item),
      auditLog: [audit("booking", booking.id, "updated", `Zmieniono rezerwację ${booking.guestLabel}`), ...current.auditLog],
    })),
    deleteBooking: (bookingId) => mutate((current) => ({
      ...current,
      bookings: current.bookings.map((item) => item.id === bookingId
        ? { ...item, workflowStatus: "Anulowana", updatedAt: new Date().toISOString() }
        : item),
      auditLog: [audit("booking", bookingId, "cancelled", "Anulowano rezerwację"), ...current.auditLog],
    })),
    updateTask: (task) => mutate((current) => ({
      ...current,
      tasks: current.tasks.map((item) => item.id === task.id ? task : item),
      auditLog: [audit("task", task.id, "updated", `${task.title}: ${task.status}`), ...current.auditLog],
    })),
    toggleChecklistItem: (item) => mutate((current) => ({
      ...current,
      checklistItems: current.checklistItems.map((candidate) => candidate.id === item.id ? item : candidate),
      auditLog: [audit("checklist", item.id, item.done ? "completed" : "reopened", item.label), ...current.auditLog],
    })),
    addIssue: (issue) => mutate((current) => ({
      ...current,
      issues: [issue, ...current.issues],
      auditLog: [audit("issue", issue.id, "created", issue.title), ...current.auditLog],
    })),
    addBlock: (block) => mutate((current) => ({
      ...current,
      blocks: [block, ...current.blocks],
      auditLog: [audit("block", block.id, "created", block.reason), ...current.auditLog],
    })),
    updateBlock: (block) => mutate((current) => ({
      ...current,
      blocks: current.blocks.map((item) => item.id === block.id ? block : item),
      auditLog: [audit("block", block.id, "updated", block.reason), ...current.auditLog],
    })),
    addPayment: (payment) => mutate((current) => ({
      ...current,
      payments: [payment, ...current.payments],
      auditLog: [audit("payment", payment.id, "created", `${payment.type}: ${payment.amount} PLN`), ...current.auditLog],
    })),
    addInvoice: (invoice) => mutate((current) => ({
      ...current,
      invoices: [invoice, ...current.invoices],
      auditLog: [audit("invoice", invoice.id, "created", `Dokument ${invoice.number}`), ...current.auditLog],
    })),
    addMessage: (message) => mutate((current) => ({
      ...current,
      messages: [message, ...current.messages],
      auditLog: [audit("message", message.id, "created", `${message.channel}: ${message.status}`), ...current.auditLog],
    })),
    addMedia: (media) => mutate((current) => ({
      ...current,
      media: [media, ...current.media],
      auditLog: [audit("media", media.id, "created", media.caption ?? media.type), ...current.auditLog],
    })),
    updateMedia: (media) => mutate((current) => ({
      ...current,
      media: current.media.map((item) => item.id === media.id ? media : item),
      auditLog: [audit("media", media.id, "updated", `Status: ${media.usageStatus}`), ...current.auditLog],
    })),
    updateGuest: (profile) => mutate((current) => ({
      ...current,
      guests: current.guests.some((item) => item.bookingId === profile.bookingId)
        ? current.guests.map((item) => item.bookingId === profile.bookingId ? profile : item)
        : [profile, ...current.guests],
      auditLog: [audit("guest", profile.bookingId, "updated", "Zaktualizowano profil gościa"), ...current.auditLog],
    })),
    updateConsent: (consent) => mutate((current) => ({
      ...current,
      consents: current.consents.some((item) => item.bookingId === consent.bookingId)
        ? current.consents.map((item) => item.bookingId === consent.bookingId ? consent : item)
        : [consent, ...current.consents],
      auditLog: [audit("consent", consent.bookingId, "updated", "Zaktualizowano dane kontaktowe i zgody"), ...current.auditLog],
    })),
    updateConnection: (connection) => mutate((current) => ({
      ...current,
      sourceConnections: current.sourceConnections.map((item) => item.id === connection.id ? connection : item),
      auditLog: [audit("connection", connection.id, "updated", `${connection.platform}: ${connection.status}`), ...current.auditLog],
    })),
    updateSettings: (settings) => mutate((current) => ({
      ...current,
      settings,
      auditLog: [audit("settings", "organization", "updated", "Zmieniono ustawienia organizacji"), ...current.auditLog],
    })),
    replaceWithImportedBookings: (bookings) => mutate((current) => {
      const existingById = new Map(current.bookings.map((booking) => [booking.id, booking]));
      const created = bookings.filter((booking) => !existingById.has(booking.id));
      const merged = current.bookings.map((booking) => bookings.find((candidate) => candidate.id === booking.id) ?? booking);
      const tasks = created.flatMap(createTasksForBooking);
      return {
        ...current,
        bookings: [...created, ...merged],
        tasks: [...tasks, ...current.tasks],
        checklistItems: [...defaultChecklist(tasks), ...current.checklistItems],
        auditLog: [audit("import", uid("IMP"), "committed", `Scalono ${bookings.length} rekordów z Mobile-Calendar`), ...current.auditLog],
      };
    }),
    exportSnapshot: () => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `stawy-os-backup-${todayInPoland()}.json`;
      link.click();
      URL.revokeObjectURL(url);
    },
    resetDemo: () => {
      if (process.env.NODE_ENV === "production") return;
      setData(normalizeData());
      window.localStorage.removeItem(storageKey);
    },
  }), [data, lastSavedAt, mutate, syncMode]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useAppStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useAppStore must be used inside AppStoreProvider");
  return store;
}
