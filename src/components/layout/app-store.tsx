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
  CostSetting,
  DepartureDebrief,
  GuestProfile,
  IssueReport,
  InvoiceRecord,
  MessageRecord,
  MediaAsset,
  OpsTask,
  PaymentTransaction,
  RateRule,
  SourceConnection,
  ScheduledMessage,
  TaskChecklistItem,
  Unit,
} from "@/lib/types";
import { cancelOpenStayTasks, createTasksForBooking, rescheduleOpenTasksForBooking } from "@/lib/workflow/rules";
import { defaultAutomationRules, defaultMessageTemplates, reconcileScheduledMessages } from "@/lib/workflow/communications";
import { guestInsightAfterDeparture, repairTaskForIssue } from "@/lib/workflow/departures";
import { downloadEncryptedJson, downloadPricingAnalysisDataset } from "@/lib/security/data-exports";
import { isTrashExpired, trashExpiryDate } from "@/lib/booking-trash";
import {
  conflictBackup,
  summarizeSyncChanges,
  type SyncConflict,
} from "@/lib/sync/state-conflict";

export type SyncMode = "checking" | "cloud" | "local" | "error" | "conflict";
export type DataStatus = "loading" | "ready" | "error";

type AppStore = {
  data: AppData;
  dataStatus: DataStatus;
  syncMode: SyncMode;
  syncConflict?: SyncConflict;
  lastSavedAt?: string;
  retryDataLoad: () => void;
  copyConflictChanges: () => Promise<boolean>;
  reloadAfterConflict: () => void;
  addBooking: (booking: Booking, contact?: ContactConsent) => void;
  updateBooking: (booking: Booking) => void;
  cancelBooking: (bookingId: string) => void;
  deleteBooking: (bookingId: string) => void;
  restoreBooking: (bookingId: string) => void;
  updateTask: (task: OpsTask) => void;
  toggleChecklistItem: (item: TaskChecklistItem) => void;
  addIssue: (issue: IssueReport) => void;
  updateIssue: (issue: IssueReport) => void;
  prepareDepartureDebriefs: (bookingIds: string[]) => void;
  markDeparturePrompted: (bookingId: string) => void;
  snoozeDepartureDebrief: (bookingId: string) => void;
  skipDepartureDebrief: (bookingId: string, reason: string) => void;
  saveDepartureDebrief: (debrief: DepartureDebrief, issue?: IssueReport) => void;
  updateScheduledMessage: (message: ScheduledMessage) => void;
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
  updateUnit: (unit: Unit) => void;
  upsertRate: (rate: RateRule) => void;
  deleteRate: (rateId: string) => void;
  upsertCostSetting: (cost: CostSetting) => void;
  deleteCostSetting: (costId: string) => void;
  updateSettings: (settings: AppData["settings"]) => void;
  replaceWithImportedBookings: (bookings: Booking[], contacts?: ContactConsent[]) => void;
  exportSnapshot: () => Promise<void>;
  exportPricingAnalysis: () => void;
  resetDemo: () => void;
};

const StoreContext = createContext<AppStore | null>(null);
const storageKey = "stawy-u-sikory-app-data-v3";
const oldStorageKey = "stawy-u-sikory-app-data-v2";
const syncChannelName = "stawy-os-state-sync-v1";
const cloudConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

type StateCommittedMessage = {
  type: "state-committed";
  tabId: string;
  requestId: string;
  version: number;
  savedAt: string;
};

type CloudStatePayload = {
  data?: Partial<AppData> | null;
  updatedAt?: string;
  version?: number;
  quarantinedDemo?: boolean;
};

export function clearPersistedAppData() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(storageKey);
  window.localStorage.removeItem(oldStorageKey);
}

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

function normalizeData(parsed?: Partial<AppData> | null, fallback: AppData = initialData): AppData {
  const base = { ...fallback, ...parsed };
  const tasks = parsed?.tasks ?? fallback.tasks;
  const rates = parsed?.rates ?? fallback.rates;
  const normalized: AppData = {
    ...base,
    units: (parsed?.units ?? fallback.units).map((unit) => ({
      ...unit,
      defaultPricePerNight: unit.defaultPricePerNight ?? rates.find((rate) => rate.unitId === unit.id && rate.active)?.pricePerNight ?? 0,
    })),
    bookings: (parsed?.bookings ?? fallback.bookings).filter((booking) => !isTrashExpired(booking)).map((booking) => ({
      ...booking,
      pricingMode: booking.pricingMode ?? (booking.grossPrice ? "manual" : "rate-card"),
      needsReview: booking.needsReview ?? (booking.createdBy === "Import Mobile-Calendar" && (!booking.grossPrice || booking.adults + booking.children === 0)),
      version: booking.version ?? 1,
    })),
    guests: parsed?.guests ?? fallback.guests,
    consents: parsed?.consents ?? fallback.consents,
    tasks: tasks.map((task) => ({
      ...task,
      version: task.version ?? 1,
    })),
    media: parsed?.media ?? fallback.media,
    blocks: parsed?.blocks ?? fallback.blocks,
    rates,
    costSettings: parsed?.costSettings ?? fallback.costSettings,
    imports: parsed?.imports ?? fallback.imports,
    sourceConnections: (parsed?.sourceConnections ?? fallback.sourceConnections).map((connection) => connection.id === "SRC-BOOKING" ? {
      ...connection,
      connectionType: "iCal",
      coverage: connection.importUrl ? connection.coverage : 0,
      lastSyncAt: connection.lastSyncAt === "demo" ? undefined : connection.lastSyncAt,
      nextStep: connection.importUrl ? connection.nextStep : "Sprawdź w Extranecie, czy konto udostępnia adres iCal dla każdego domku.",
      notes: "iCal blokuje terminy, ale nie pobiera ceny, prowizji ani danych gościa.",
      staleAfterMinutes: connection.staleAfterMinutes ?? 240,
    } : { ...connection, coverage: connection.importUrl ? connection.coverage : 0, lastSyncAt: connection.lastSyncAt === "demo" ? undefined : connection.lastSyncAt, staleAfterMinutes: connection.staleAfterMinutes ?? 240 }),
    payments: parsed?.payments ?? fallback.payments,
    invoices: parsed?.invoices ?? fallback.invoices,
    checklistItems: parsed?.checklistItems ?? defaultChecklist(tasks),
    issues: parsed?.issues ?? fallback.issues,
    messages: parsed?.messages ?? fallback.messages,
    departureDebriefs: parsed?.departureDebriefs ?? fallback.departureDebriefs,
    messageTemplates: parsed?.messageTemplates?.length ? parsed.messageTemplates : fallback.messageTemplates.length ? fallback.messageTemplates : defaultMessageTemplates,
    automationRules: parsed?.automationRules?.length ? parsed.automationRules : fallback.automationRules.length ? fallback.automationRules : defaultAutomationRules,
    scheduledMessages: parsed?.scheduledMessages ?? fallback.scheduledMessages,
    marketingTouchpoints: parsed?.marketingTouchpoints ?? fallback.marketingTouchpoints,
    auditLog: parsed?.auditLog ?? fallback.auditLog,
    settings: parsed?.settings ?? fallback.settings,
  };
  normalized.scheduledMessages = reconcileScheduledMessages(normalized);
  return normalized;
}

function emptyCloudData(): AppData {
  return normalizeData({
    units: initialData.units,
    bookings: [],
    guests: [],
    consents: [],
    tasks: [],
    media: [],
    blocks: [],
    rates: [],
    costSettings: [],
    imports: [],
    sourceConnections: initialData.sourceConnections.map((connection) => ({
      ...connection,
      coverage: 0,
      lastSyncAt: undefined,
      importUrl: undefined,
      exportToken: undefined,
    })),
    payments: [],
    invoices: [],
    checklistItems: [],
    issues: [],
    messages: [],
    departureDebriefs: [],
    messageTemplates: defaultMessageTemplates,
    automationRules: defaultAutomationRules,
    scheduledMessages: [],
    marketingTouchpoints: [],
    auditLog: [],
    settings: {
      organizationName: "Stawy u Sikory",
      timezone: "Europe/Warsaw",
      cleaningContactName: "",
      cleaningPhone: "",
      defaultCheckIn: "16:00",
      defaultCheckOut: "11:00",
      aiApprovalRequired: true,
    },
  });
}

function tasksForImportedBookings(bookings: Booking[]) {
  const today = todayInPoland();
  return bookings.flatMap((booking) => {
    if (booking.historicalImport || booking.checkOut <= today) return [];
    return createTasksForBooking(booking).filter((task) => {
      if (task.type === "Płatność") return booking.paymentStatus !== "Opłacone";
      return !task.dueDate || task.dueDate >= today;
    });
  });
}

function readLocalData() {
  if (typeof window === "undefined") return normalizeData();
  if (cloudConfigured) return emptyCloudData();
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
  // Pierwszy render musi być identyczny na serwerze i w przeglądarce. Właściwy
  // stan lokalny lub chmurowy jest pobierany zaraz po zamontowaniu komponentu.
  const [data, setData] = useState<AppData>(() => cloudConfigured ? emptyCloudData() : normalizeData());
  const [dataStatus, setDataStatus] = useState<DataStatus>("loading");
  const [hydrated, setHydrated] = useState(false);
  const [syncMode, setSyncMode] = useState<SyncMode>("checking");
  const [syncConflict, setSyncConflict] = useState<SyncConflict>();
  const [lastSavedAt, setLastSavedAt] = useState<string>();
  const [loadRequest, setLoadRequest] = useState(0);
  const latestData = useRef(data);
  const dataReady = useRef(false);
  const cloudReady = useRef(false);
  const stateVersion = useRef(0);
  const taskRecordVersions = useRef<Map<string, number>>(new Map());
  const baseData = useRef<AppData>(cloudConfigured ? emptyCloudData() : normalizeData());
  const localRevision = useRef(0);
  const savedRevision = useRef(0);
  const tabId = useRef(uid("TAB"));
  const syncChannel = useRef<BroadcastChannel | null>(null);
  const conflictGeneration = useRef(0);
  const skipNextCloudSave = useRef(false);
  const cloudSaveQueue = useRef<Promise<void>>(Promise.resolve());

  const compareConflictWithCloud = useCallback(async (
    conflict: Omit<SyncConflict, "changes">,
    localData: AppData,
    generation: number,
  ) => {
    try {
      const response = await fetch("/api/state", { cache: "no-store" });
      if (!response.ok) throw new Error("comparison failed");
      const payload = await response.json() as CloudStatePayload;
      const remoteData = payload.data ? normalizeData(payload.data, emptyCloudData()) : emptyCloudData();
      if (conflictGeneration.current !== generation) return;
      setSyncConflict({
        ...conflict,
        currentVersion: payload.version ?? conflict.currentVersion,
        remoteSavedAt: payload.updatedAt ?? conflict.remoteSavedAt,
        changes: summarizeSyncChanges(baseData.current, localData, remoteData),
      });
    } catch {
      if (conflictGeneration.current !== generation) return;
      setSyncConflict({
        ...conflict,
        changes: summarizeSyncChanges(baseData.current, localData),
      });
    }
  }, []);

  useEffect(() => {
    latestData.current = data;
  }, [data]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (cloudConfigured) {
        clearPersistedAppData();
        setData(emptyCloudData());
      } else {
        const localData = readLocalData();
        taskRecordVersions.current = new Map(localData.tasks.map((task) => [task.id, task.version ?? 1]));
        setData(localData);
        dataReady.current = true;
        setDataStatus("ready");
        setSyncMode("local");
      }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!hydrated || !cloudConfigured || typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(syncChannelName);
    syncChannel.current = channel;
    channel.onmessage = (event: MessageEvent<StateCommittedMessage>) => {
      const message = event.data;
      if (!message || message.type !== "state-committed" || message.tabId === tabId.current) return;
      const hasLocalChanges = localRevision.current !== savedRevision.current;
      if (!hasLocalChanges && cloudReady.current) {
        dataReady.current = false;
        cloudReady.current = false;
        setDataStatus("loading");
        setSyncMode("checking");
        setLoadRequest((request) => request + 1);
        return;
      }
      cloudReady.current = false;
      const conflict = {
        source: "another-tab" as const,
        detectedAt: new Date().toISOString(),
        expectedVersion: stateVersion.current,
        currentVersion: message.version,
        requestId: message.requestId,
        remoteSavedAt: message.savedAt,
      };
      const generation = ++conflictGeneration.current;
      setSyncMode("conflict");
      setSyncConflict({
        ...conflict,
        changes: summarizeSyncChanges(baseData.current, latestData.current),
      });
      void compareConflictWithCloud(conflict, latestData.current, generation);
    };
    return () => {
      channel.close();
      if (syncChannel.current === channel) syncChannel.current = null;
    };
  }, [compareConflictWithCloud, hydrated]);

  useEffect(() => {
    if (!hydrated || !cloudConfigured) return;
    let active = true;
    async function loadCloud() {
      try {
        const response = await fetch("/api/state", { cache: "no-store" });
        if (!active) return;
        if (response.ok) {
          const payload = await response.json() as CloudStatePayload;
          const loadedData = payload.data ? normalizeData(payload.data, emptyCloudData()) : emptyCloudData();
          stateVersion.current = payload.version ?? 0;
          taskRecordVersions.current = new Map(loadedData.tasks.map((task) => [task.id, task.version ?? 1]));
          conflictGeneration.current += 1;
          baseData.current = loadedData;
          localRevision.current = 0;
          savedRevision.current = 0;
          skipNextCloudSave.current = true;
          setData(loadedData);
          cloudReady.current = true;
          dataReady.current = true;
          setDataStatus("ready");
          setSyncMode("cloud");
          setSyncConflict(undefined);
          setLastSavedAt(payload.updatedAt);
          return;
        }
        cloudReady.current = false;
        dataReady.current = false;
        setDataStatus("error");
        setSyncMode("error");
      } catch {
        if (active) {
          cloudReady.current = false;
          dataReady.current = false;
          setDataStatus("error");
          setSyncMode("error");
        }
      }
    }
    void loadCloud();
    return () => { active = false; };
  }, [hydrated, loadRequest]);

  useEffect(() => {
    if (!hydrated || dataStatus !== "ready") return;
    if (!cloudConfigured) window.localStorage.setItem(storageKey, JSON.stringify(data));
    if (!cloudReady.current) return;
    if (skipNextCloudSave.current) {
      skipNextCloudSave.current = false;
      return;
    }
    if (localRevision.current === savedRevision.current) return;
    const revisionToSave = localRevision.current;
    const timeout = window.setTimeout(() => {
      // Zmiany mogą pojawić się, gdy poprzedni PUT nadal trwa. Kolejka gwarantuje,
      // że każda operacja odczyta wersję dopiero po zakończeniu poprzedniej.
      cloudSaveQueue.current = cloudSaveQueue.current.then(async () => {
        if (!cloudReady.current) return;
        const requestId = typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : uid("REQ");
        const clientSentAt = new Date().toISOString();
        const expectedVersion = stateVersion.current;
        try {
          const response = await fetch("/api/state", {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              data,
              expectedVersion,
              requestId,
              clientSentAt,
              tabId: tabId.current,
            }),
          });
          if (response.status === 409) {
            // Konflikt wymaga świadomego przeładowania danych. Bez tej blokady
            // każda kolejna lokalna mutacja ponawiała ten sam błędny zapis.
            const payload = await response.json().catch(() => ({})) as {
              currentVersion?: number;
              requestId?: string;
              detectedAt?: string;
            };
            cloudReady.current = false;
            setSyncMode("conflict");
            const conflict = {
              source: "server-rejection",
              detectedAt: payload.detectedAt ?? new Date().toISOString(),
              expectedVersion,
              currentVersion: payload.currentVersion,
              requestId: payload.requestId ?? requestId,
            } as const;
            const generation = ++conflictGeneration.current;
            setSyncConflict({
              ...conflict,
              changes: summarizeSyncChanges(baseData.current, latestData.current),
            });
            void compareConflictWithCloud(conflict, latestData.current, generation);
            return;
          }
          if (!response.ok) throw new Error("save failed");
          const payload = await response.json() as { version?: number; savedAt?: string };
          if (typeof payload.version === "number") {
            stateVersion.current = payload.version;
            // Legacy PUT replaces every record and assigns the committed global
            // version. Keep the task lock map aligned until this domain is the
            // only remaining write path.
            taskRecordVersions.current = new Map(data.tasks.map((task) => [task.id, payload.version!]));
          }
          savedRevision.current = Math.max(savedRevision.current, revisionToSave);
          baseData.current = data;
          setSyncMode("cloud");
          const savedAt = payload.savedAt ?? new Date().toISOString();
          setLastSavedAt(savedAt);
          if (typeof payload.version === "number") {
            syncChannel.current?.postMessage({
              type: "state-committed",
              tabId: tabId.current,
              requestId,
              version: payload.version,
              savedAt,
            } satisfies StateCommittedMessage);
          }
        } catch {
          setSyncMode("error");
        }
      });
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [compareConflictWithCloud, data, dataStatus, hydrated]);

  const mutate = useCallback((fn: (current: AppData) => AppData) => {
    if (!dataReady.current) return;
    setData((current) => {
      const next = fn(current);
      if (next !== current) localRevision.current += 1;
      return next;
    });
  }, []);

  const updateTask = useCallback((task: OpsTask) => {
    if (!dataReady.current) return;
    if (!cloudConfigured) {
      mutate((current) => ({
        ...current,
        tasks: current.tasks.map((item) => item.id === task.id ? task : item),
        auditLog: [audit("task", task.id, "updated", `${task.title}: ${task.status}`), ...current.auditLog],
      }));
      return;
    }
    if (!cloudReady.current) return;

    const currentTask = latestData.current.tasks.find((item) => item.id === task.id);
    if (!currentTask) return;
    const expectedRecordVersion = taskRecordVersions.current.get(task.id) ?? currentTask.version ?? 1;
    const requestId = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : uid("REQ");
    const clientSentAt = new Date().toISOString();
    const optimisticTask = {
      ...task,
      version: expectedRecordVersion + 1,
      updatedAt: clientSentAt,
    };

    taskRecordVersions.current.set(task.id, expectedRecordVersion + 1);
    setData((current) => ({
      ...current,
      tasks: current.tasks.map((item) => item.id === task.id ? optimisticTask : item),
    }));

    cloudSaveQueue.current = cloudSaveQueue.current.then(async () => {
      if (!cloudReady.current) return;
      try {
        const response = await fetch(`/api/tasks/${encodeURIComponent(task.id)}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            task: optimisticTask,
            expectedRecordVersion,
            requestId,
            clientSentAt,
            tabId: tabId.current,
          }),
        });
        if (response.status === 409) {
          const payload = await response.json().catch(() => ({})) as {
            currentRecordVersion?: number;
            detectedAt?: string;
            requestId?: string;
          };
          cloudReady.current = false;
          setSyncMode("conflict");
          setSyncConflict({
            source: "server-rejection",
            detectedAt: payload.detectedAt ?? new Date().toISOString(),
            expectedVersion: expectedRecordVersion,
            currentVersion: payload.currentRecordVersion,
            requestId: payload.requestId ?? requestId,
            changes: summarizeSyncChanges(baseData.current, latestData.current),
          });
          return;
        }
        if (!response.ok) throw new Error("task command failed");
        const payload = await response.json() as {
          task: OpsTask;
          recordVersion: number;
          stateVersion: number;
          savedAt?: string;
        };
        taskRecordVersions.current.set(task.id, payload.recordVersion);
        stateVersion.current = payload.stateVersion;
        const committedTask = {
          ...payload.task,
          version: payload.recordVersion,
        };
        setData((current) => ({
          ...current,
          tasks: current.tasks.map((item) => item.id === task.id ? committedTask : item),
        }));
        baseData.current = {
          ...baseData.current,
          tasks: baseData.current.tasks.map((item) => item.id === task.id ? committedTask : item),
        };
        setSyncMode("cloud");
        const savedAt = payload.savedAt ?? new Date().toISOString();
        setLastSavedAt(savedAt);
        syncChannel.current?.postMessage({
          type: "state-committed",
          tabId: tabId.current,
          requestId,
          version: payload.stateVersion,
          savedAt,
        } satisfies StateCommittedMessage);
      } catch {
        // Zachowujemy optymistyczną zmianę na ekranie, ale nie udajemy, że
        // została zsynchronizowana. Ponowne pobranie przywróci stan z chmury.
        cloudReady.current = false;
        setSyncMode("error");
      }
    });
  }, [mutate]);

  const retryDataLoad = useCallback(() => {
    if (!cloudConfigured) return;
    conflictGeneration.current += 1;
    dataReady.current = false;
    cloudReady.current = false;
    setDataStatus("loading");
    setSyncMode("checking");
    setLoadRequest((request) => request + 1);
  }, []);

  const reloadAfterConflict = useCallback(() => {
    if (!cloudConfigured) return;
    conflictGeneration.current += 1;
    dataReady.current = false;
    cloudReady.current = false;
    setDataStatus("loading");
    setSyncMode("checking");
    setLoadRequest((request) => request + 1);
  }, []);

  const copyConflictChanges = useCallback(async () => {
    if (!syncConflict || !navigator.clipboard?.writeText) return false;
    try {
      await navigator.clipboard.writeText(conflictBackup(latestData.current, syncConflict));
      return true;
    } catch {
      return false;
    }
  }, [syncConflict]);

  const value = useMemo<AppStore>(() => ({
    data,
    dataStatus,
    syncMode,
    syncConflict,
    lastSavedAt,
    retryDataLoad,
    copyConflictChanges,
    reloadAfterConflict,
    addBooking: (booking, contact) => mutate((current) => {
      const tasks = createTasksForBooking(booking);
      const next: AppData = {
        ...current,
        bookings: [{ ...booking, version: 1, updatedAt: new Date().toISOString() }, ...current.bookings],
        consents: contact ? [contact, ...current.consents] : current.consents,
        tasks: [...tasks, ...current.tasks],
        checklistItems: [...defaultChecklist(tasks), ...current.checklistItems],
        auditLog: [audit("booking", booking.id, "created", `Dodano rezerwację ${booking.guestLabel}`), ...current.auditLog],
      };
      next.scheduledMessages = reconcileScheduledMessages(next);
      return next;
    }),
    updateBooking: (booking) => mutate((current) => {
      const next: AppData = {
        ...current,
        bookings: current.bookings.map((item) => item.id === booking.id
          ? { ...booking, version: (item.version ?? 1) + 1, updatedAt: new Date().toISOString() }
          : item),
        tasks: rescheduleOpenTasksForBooking(current.tasks, booking),
        auditLog: [audit("booking", booking.id, "updated", `Zmieniono rezerwację ${booking.guestLabel}`), ...current.auditLog],
      };
      next.scheduledMessages = reconcileScheduledMessages(next);
      return next;
    }),
    cancelBooking: (bookingId) => mutate((current) => {
      const next: AppData = {
        ...current,
        bookings: current.bookings.map((item) => item.id === bookingId
          ? { ...item, workflowStatus: "Anulowana", updatedAt: new Date().toISOString() }
          : item),
        tasks: cancelOpenStayTasks(current.tasks, bookingId),
        auditLog: [audit("booking", bookingId, "cancelled", "Anulowano rezerwację"), ...current.auditLog],
      };
      next.scheduledMessages = reconcileScheduledMessages(next);
      return next;
    }),
    deleteBooking: (bookingId) => mutate((current) => {
      const deletedAt = new Date().toISOString();
      const next: AppData = {
        ...current,
        bookings: current.bookings.map((item) => item.id === bookingId
          ? {
            ...item,
            workflowStatusBeforeDeletion: item.workflowStatus,
            workflowStatus: "Anulowana",
            deletedAt,
            purgeAfter: trashExpiryDate(deletedAt.slice(0, 10)),
            updatedAt: deletedAt,
          }
          : item),
        tasks: cancelOpenStayTasks(current.tasks, bookingId),
        auditLog: [audit("booking", bookingId, "deleted", "Przeniesiono rezerwację do kosza na 30 dni"), ...current.auditLog],
      };
      next.scheduledMessages = reconcileScheduledMessages(next);
      return next;
    }),
    restoreBooking: (bookingId) => mutate((current) => {
      const next: AppData = {
        ...current,
        bookings: current.bookings.map((item) => item.id === bookingId
          ? {
            ...item,
            workflowStatus: item.workflowStatusBeforeDeletion ?? "Nowa",
            workflowStatusBeforeDeletion: undefined,
            deletedAt: undefined,
            purgeAfter: undefined,
            updatedAt: new Date().toISOString(),
          }
          : item),
        tasks: current.tasks.map((task) => task.bookingId === bookingId && task.status === "Nie dotyczy"
          ? { ...task, status: "Do zrobienia", completedAt: undefined }
          : task),
        auditLog: [audit("booking", bookingId, "restored", "Przywrócono rezerwację z kosza"), ...current.auditLog],
      };
      next.scheduledMessages = reconcileScheduledMessages(next);
      return next;
    }),
    updateTask,
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
    updateIssue: (issue) => mutate((current) => ({
      ...current,
      issues: current.issues.map((item) => item.id === issue.id ? issue : item),
      tasks: current.tasks.map((task) => task.issueId === issue.id ? {
        ...task,
        planningHorizon: issue.planningHorizon,
        status: issue.status === "Rozwiązane" ? "Zrobione" : issue.status === "W toku" ? "W toku" : task.status === "Zrobione" ? "Do zrobienia" : task.status,
        completedAt: issue.status === "Rozwiązane" ? todayInPoland() : undefined,
      } : task),
      auditLog: [audit("issue", issue.id, "updated", `${issue.title}: ${issue.status}`), ...current.auditLog],
    })),
    prepareDepartureDebriefs: (bookingIds) => mutate((current) => {
      const missing = bookingIds.filter((bookingId) => !current.departureDebriefs.some((item) => item.bookingId === bookingId));
      if (!missing.length) return current;
      const next: AppData = {
        ...current,
        departureDebriefs: [...current.departureDebriefs, ...missing.map((bookingId) => ({ id: `DEB-${bookingId}`, bookingId, status: "Oczekuje" as const, keysSettled: false, urgentNextArrivalRisk: false, publicQuotePermission: "Do dopytania" as const }))],
      };
      return next;
    }),
    markDeparturePrompted: (bookingId) => mutate((current) => ({
      ...current,
      departureDebriefs: current.departureDebriefs.map((item) => item.bookingId === bookingId ? { ...item, lastPromptedAt: new Date().toISOString(), lastPromptedOn: todayInPoland() } : item),
    })),
    snoozeDepartureDebrief: (bookingId) => mutate((current) => ({
      ...current,
      departureDebriefs: current.departureDebriefs.map((item) => item.bookingId === bookingId ? { ...item, lastPromptedAt: new Date().toISOString(), lastPromptedOn: todayInPoland(), snoozedUntil: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() } : item),
    })),
    skipDepartureDebrief: (bookingId, reason) => mutate((current) => ({
      ...current,
      departureDebriefs: current.departureDebriefs.map((item) => item.bookingId === bookingId ? { ...item, status: "Pominięty", skipReason: reason, completedAt: new Date().toISOString() } : item),
      bookings: current.bookings.map((item) => item.id === bookingId ? { ...item, workflowStatus: "Po pobycie" } : item),
      auditLog: [audit("debrief", `DEB-${bookingId}`, "skipped", reason), ...current.auditLog],
    })),
    saveDepartureDebrief: (debrief, issue) => mutate((current) => {
      const booking = current.bookings.find((item) => item.id === debrief.bookingId);
      if (!booking) return current;
      const existingProfile = current.guests.find((item) => item.bookingId === booking.id) ?? { bookingId: booking.id };
      const profile = guestInsightAfterDeparture(existingProfile, debrief);
      const issueTask: OpsTask | undefined = issue ? repairTaskForIssue(issue, booking) : undefined;
      const next: AppData = {
        ...current,
        bookings: current.bookings.map((item) => item.id === booking.id ? { ...item, workflowStatus: "Po pobycie", updatedAt: new Date().toISOString() } : item),
        guests: current.guests.some((item) => item.bookingId === booking.id) ? current.guests.map((item) => item.bookingId === booking.id ? profile : item) : [profile, ...current.guests],
        departureDebriefs: current.departureDebriefs.some((item) => item.bookingId === booking.id) ? current.departureDebriefs.map((item) => item.bookingId === booking.id ? debrief : item) : [...current.departureDebriefs, debrief],
        issues: issue ? [issue, ...current.issues.filter((item) => item.id !== issue.id)] : current.issues,
        tasks: issueTask && !current.tasks.some((item) => item.issueId === issueTask.issueId) ? [issueTask, ...current.tasks] : current.tasks,
        marketingTouchpoints: debrief.discoverySource ? [{ id: `MKT-${debrief.id}`, bookingId: booking.id, recordedAt: debrief.completedAt || new Date().toISOString(), source: debrief.discoverySource, method: debrief.discoveryMethod, note: debrief.discoveryNote }, ...current.marketingTouchpoints.filter((item) => item.id !== `MKT-${debrief.id}`)] : current.marketingTouchpoints,
        auditLog: [audit("debrief", debrief.id, "completed", `Zapisano rozmowę po pobycie ${booking.guestLabel}`), ...(issue ? [audit("issue", issue.id, "created", issue.title)] : []), ...current.auditLog],
      };
      next.scheduledMessages = reconcileScheduledMessages(next);
      return next;
    }),
    updateScheduledMessage: (message) => mutate((current) => ({
      ...current,
      scheduledMessages: current.scheduledMessages.map((item) => item.id === message.id ? message : item),
      auditLog: [audit("scheduled_message", message.id, "updated", `${message.status}: ${message.channel}`), ...current.auditLog],
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
    addPayment: (payment) => mutate((current) => {
      const booking = current.bookings.find((item) => item.id === payment.bookingId);
      const normalizedPayment = {
        ...payment,
        currency: payment.currency ?? booking?.currency,
      };
      return {
        ...current,
        payments: [normalizedPayment, ...current.payments],
        auditLog: [
          audit(
            "payment",
            payment.id,
            "created",
            `${payment.type}: ${payment.amount} ${normalizedPayment.currency ?? "bez waluty"}`,
          ),
          ...current.auditLog,
        ],
      };
    }),
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
    updateUnit: (unit) => mutate((current) => ({
      ...current,
      units: current.units.map((item) => item.id === unit.id ? unit : item),
      auditLog: [audit("unit", unit.id, "updated", `Zmieniono ceny i koszty: ${unit.name}`), ...current.auditLog],
    })),
    upsertRate: (rate) => mutate((current) => ({
      ...current,
      rates: current.rates.some((item) => item.id === rate.id) ? current.rates.map((item) => item.id === rate.id ? rate : item) : [rate, ...current.rates],
      auditLog: [audit("rate", rate.id, "updated", `${rate.season}: ${rate.pricePerNight} PLN`), ...current.auditLog],
    })),
    deleteRate: (rateId) => mutate((current) => ({
      ...current,
      rates: current.rates.filter((item) => item.id !== rateId),
      auditLog: [audit("rate", rateId, "deleted", "Usunięto regułę sezonową"), ...current.auditLog],
    })),
    upsertCostSetting: (cost) => mutate((current) => ({
      ...current,
      costSettings: current.costSettings.some((item) => item.id === cost.id) ? current.costSettings.map((item) => item.id === cost.id ? cost : item) : [cost, ...current.costSettings],
      auditLog: [audit("cost", cost.id, "updated", `${cost.label}: ${cost.value}/${cost.unit}`), ...current.auditLog],
    })),
    deleteCostSetting: (costId) => mutate((current) => ({
      ...current,
      costSettings: current.costSettings.filter((item) => item.id !== costId),
      auditLog: [audit("cost", costId, "deleted", "Usunięto założenie kosztowe"), ...current.auditLog],
    })),
    updateSettings: (settings) => mutate((current) => ({
      ...current,
      settings,
      auditLog: [audit("settings", "organization", "updated", "Zmieniono ustawienia organizacji"), ...current.auditLog],
    })),
    replaceWithImportedBookings: (bookings, contacts = []) => mutate((current) => {
      const existingById = new Map(current.bookings.map((booking) => [booking.id, booking]));
      const created = bookings.filter((booking) => !existingById.has(booking.id));
      const createdIds = new Set(created.map((booking) => booking.id));
      const tasks = tasksForImportedBookings(created);
      const importedContacts = contacts.filter((contact) => createdIds.has(contact.bookingId));
      const next: AppData = {
        ...current,
        bookings: [...created, ...current.bookings],
        consents: [...importedContacts, ...current.consents],
        tasks: [...tasks, ...current.tasks],
        checklistItems: [...defaultChecklist(tasks), ...current.checklistItems],
        auditLog: [audit("import", uid("IMP"), "committed", `Dodano ${created.length} rekordów z Mobile Calendar; pominięto ${bookings.length - created.length} istniejących`), ...current.auditLog],
      };
      next.scheduledMessages = reconcileScheduledMessages(next);
      return next;
    }),
    exportSnapshot: async () => {
      const passphrase = window.prompt("Ustaw hasło do zaszyfrowanej kopii (minimum 12 znaków). Bez niego nie da się odzyskać danych.");
      if (!passphrase) return;
      try {
        await downloadEncryptedJson(data, passphrase, `stawy-os-backup-${todayInPoland()}.stawyos`);
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "Nie udało się utworzyć zaszyfrowanej kopii.");
      }
    },
    exportPricingAnalysis: () => downloadPricingAnalysisDataset(data, `stawy-os-ceny-ai-${todayInPoland()}.json`),
    resetDemo: () => {
      if (process.env.NODE_ENV === "production") return;
      setData(normalizeData());
      clearPersistedAppData();
    },
  }), [
    copyConflictChanges,
    data,
    dataStatus,
    lastSavedAt,
    mutate,
    reloadAfterConflict,
    retryDataLoad,
    syncConflict,
    syncMode,
    updateTask,
  ]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useAppStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useAppStore must be used inside AppStoreProvider");
  return store;
}
