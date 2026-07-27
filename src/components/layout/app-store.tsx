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
  AdSpendRecord,
  AuditEvent,
  Booking,
  CalendarBlock,
  CommunicationConfig,
  ConsentRecord,
  ContactConsent,
  CostSetting,
  DepartureDebrief,
  GuestPerson,
  GuestProfile,
  GrowthExperiment,
  IssueReport,
  InvoiceRecord,
  InvestmentModel,
  MessageRecord,
  MediaAsset,
  MeterReading,
  OpsTask,
  PaymentTransaction,
  RateRule,
  ReviewRequest,
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
import type {
  BookingAggregate,
  BookingMutationAggregate,
  BookingMutationOperation,
} from "@/lib/domain/booking-command";
import type {
  BatchEntityType,
  RecordBatchCommandResult,
} from "@/lib/domain/record-batch-command";
import {
  conflictBackup,
  summarizeSyncChanges,
  type SyncConflict,
} from "@/lib/sync/state-conflict";
import { instantiateCleaningChecklist } from "@/lib/cleaning/operations";
import { ensureGuestPeople, mergeGuestPeople } from "@/lib/crm/guest-identity";

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
  updateBooking: (booking: Booking, contact?: ContactConsent) => void;
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
  addBlock: (block: CalendarBlock) => Promise<boolean>;
  updateBlock: (block: CalendarBlock) => Promise<boolean>;
  addPayment: (payment: PaymentTransaction) => void;
  addInvoice: (invoice: InvoiceRecord) => void;
  addMessage: (message: MessageRecord) => void;
  addMedia: (media: MediaAsset) => void;
  updateMedia: (media: MediaAsset) => void;
  upsertPerson: (person: GuestPerson) => void;
  mergePeople: (sourcePersonId: string, targetPersonId: string) => void;
  updateGuest: (profile: GuestProfile) => void;
  updateConsent: (consent: ContactConsent) => void;
  upsertConsentRecord: (consent: ConsentRecord) => void;
  updateReviewRequest: (review: ReviewRequest) => void;
  upsertCommunicationConfig: (config: CommunicationConfig) => void;
  importAdSpend: (records: AdSpendRecord[]) => void;
  upsertGrowthExperiment: (experiment: GrowthExperiment) => void;
  upsertInvestmentModel: (model: InvestmentModel) => void;
  addMeterReading: (reading: MeterReading) => void;
  updateConnection: (connection: SourceConnection) => void;
  updateUnit: (unit: Unit) => void;
  upsertRate: (rate: RateRule) => void;
  deleteRate: (rateId: string) => void;
  upsertCostSetting: (cost: CostSetting) => void;
  deleteCostSetting: (costId: string) => void;
  updateSettings: (settings: AppData["settings"]) => Promise<boolean>;
  replaceWithImportedBookings: (
    bookings: Booking[],
    contacts?: ContactConsent[],
    imports?: AppData["imports"],
    costSettings?: CostSetting[],
  ) => void;
  exportSnapshot: (passphrase: string) => Promise<void>;
  exportPricingAnalysis: () => void;
  resetDemo: () => void;
};

const StoreContext = createContext<AppStore | null>(null);
const storageKey = "stawy-u-sikory-app-data-v3";
const oldStorageKey = "stawy-u-sikory-app-data-v2";
const syncChannelName = "stawy-os-state-sync-v1";
const cloudConfigured = process.env.NEXT_PUBLIC_LOCAL_MODE !== "1"
  && Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

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
  recordVersions?: Record<string, number>;
  quarantinedDemo?: boolean;
};

type BatchCollectionKey =
  | "units"
  | "bookings"
  | "people"
  | "guests"
  | "consents"
  | "consentLedger"
  | "reviewRequests"
  | "communicationConfigs"
  | "adSpend"
  | "growthExperiments"
  | "investmentModels"
  | "meterReadings"
  | "tasks"
  | "media"
  | "rates"
  | "costSettings"
  | "imports"
  | "sourceConnections"
  | "invoices"
  | "checklistItems"
  | "issues"
  | "messages"
  | "departureDebriefs"
  | "scheduledMessages"
  | "marketingTouchpoints";

const batchCollections: Array<{
  key: BatchCollectionKey;
  entityType: BatchEntityType;
  id: (record: Record<string, unknown>) => string;
}> = [
  { key: "units", entityType: "units", id: (record) => String(record.id ?? "") },
  { key: "bookings", entityType: "bookings", id: (record) => String(record.id ?? "") },
  { key: "people", entityType: "people", id: (record) => String(record.id ?? "") },
  { key: "guests", entityType: "guests", id: (record) => String(record.bookingId ?? "") },
  { key: "consents", entityType: "consents", id: (record) => String(record.bookingId ?? "") },
  { key: "consentLedger", entityType: "consentLedger", id: (record) => String(record.id ?? "") },
  { key: "reviewRequests", entityType: "reviewRequests", id: (record) => String(record.id ?? "") },
  { key: "communicationConfigs", entityType: "communicationConfigs", id: (record) => String(record.id ?? "") },
  { key: "adSpend", entityType: "adSpend", id: (record) => String(record.id ?? "") },
  { key: "growthExperiments", entityType: "growthExperiments", id: (record) => String(record.id ?? "") },
  { key: "investmentModels", entityType: "investmentModels", id: (record) => String(record.id ?? "") },
  { key: "meterReadings", entityType: "meterReadings", id: (record) => String(record.id ?? "") },
  { key: "tasks", entityType: "tasks", id: (record) => String(record.id ?? "") },
  { key: "media", entityType: "media", id: (record) => String(record.id ?? "") },
  { key: "rates", entityType: "rates", id: (record) => String(record.id ?? "") },
  { key: "costSettings", entityType: "costSettings", id: (record) => String(record.id ?? "") },
  { key: "imports", entityType: "imports", id: (record) => String(record.id ?? "") },
  { key: "sourceConnections", entityType: "sourceConnections", id: (record) => String(record.id ?? "") },
  { key: "invoices", entityType: "invoices", id: (record) => String(record.id ?? "") },
  { key: "checklistItems", entityType: "checklistItems", id: (record) => String(record.id ?? "") },
  { key: "issues", entityType: "issues", id: (record) => String(record.id ?? "") },
  { key: "messages", entityType: "messages", id: (record) => String(record.id ?? "") },
  { key: "departureDebriefs", entityType: "departureDebriefs", id: (record) => String(record.id ?? "") },
  { key: "scheduledMessages", entityType: "scheduledMessages", id: (record) => String(record.id ?? "") },
  { key: "marketingTouchpoints", entityType: "marketingTouchpoints", id: (record) => String(record.id ?? "") },
];

type RecordBatchChange = {
  entityType: BatchEntityType;
  entityId: string;
  operation: "upsert" | "delete";
  expectedRecordVersion: number;
  payload?: Record<string, unknown>;
};

function withoutRecordMetadata(record: Record<string, unknown>) {
  const payload = { ...record };
  delete payload.version;
  delete payload.updatedAt;
  return payload;
}

function buildRecordBatchChanges(
  previous: AppData,
  next: AppData,
  versions: Map<string, number>,
) {
  const changes: RecordBatchChange[] = [];
  for (const collection of batchCollections) {
    const previousRecords = previous[collection.key] as unknown as Record<string, unknown>[];
    const nextRecords = next[collection.key] as unknown as Record<string, unknown>[];
    const previousById = new Map(previousRecords.map((record) => [collection.id(record), record]));
    const nextById = new Map(nextRecords.map((record) => [collection.id(record), record]));
    for (const [entityId, record] of nextById) {
      if (!entityId) continue;
      const previousRecord = previousById.get(entityId);
      if (
        previousRecord
        && JSON.stringify(withoutRecordMetadata(previousRecord))
          === JSON.stringify(withoutRecordMetadata(record))
      ) continue;
      changes.push({
        entityType: collection.entityType,
        entityId,
        operation: "upsert",
        expectedRecordVersion: versions.get(`${collection.entityType}:${entityId}`) ?? 0,
        payload: record,
      });
    }
    for (const [entityId] of previousById) {
      if (!entityId || nextById.has(entityId)) continue;
      const expectedRecordVersion = versions.get(`${collection.entityType}:${entityId}`) ?? 0;
      if (expectedRecordVersion > 0) {
        changes.push({
          entityType: collection.entityType,
          entityId,
          operation: "delete",
          expectedRecordVersion,
        });
      }
    }
  }
  return changes;
}

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

function defaultChecklist(tasks: OpsTask[]): TaskChecklistItem[] {
  return tasks
    .filter((task) => task.type === "Sprzątanie")
    .flatMap((task) => instantiateCleaningChecklist(task, task.dueDate ?? todayInPoland()));
}

function normalizeData(parsed?: Partial<AppData> | null, fallback: AppData = initialData): AppData {
  const base = { ...fallback, ...parsed };
  const tasks = parsed?.tasks ?? fallback.tasks;
  const rates = parsed?.rates ?? fallback.rates;
  const normalized = ensureGuestPeople({
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
    people: parsed?.people ?? fallback.people,
    guests: parsed?.guests ?? fallback.guests,
    consents: (parsed?.consents ?? fallback.consents).map((consent) => ({
      ...consent,
      version: consent.version ?? 1,
    })),
    consentLedger: parsed?.consentLedger ?? fallback.consentLedger,
    reviewRequests: parsed?.reviewRequests ?? fallback.reviewRequests,
    communicationConfigs: parsed?.communicationConfigs ?? fallback.communicationConfigs,
    adSpend: parsed?.adSpend ?? fallback.adSpend,
    growthExperiments: parsed?.growthExperiments ?? fallback.growthExperiments,
    investmentModels: parsed?.investmentModels ?? fallback.investmentModels,
    meterReadings: parsed?.meterReadings ?? fallback.meterReadings,
    tasks: tasks.map((task) => ({
      ...task,
      version: task.version ?? 1,
    })),
    media: parsed?.media ?? fallback.media,
    blocks: (parsed?.blocks ?? fallback.blocks).map((block) => ({
      ...block,
      version: block.version ?? 1,
    })),
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
    checklistItems: (parsed?.checklistItems ?? defaultChecklist(tasks)).map((item) => ({
      ...item,
      version: item.version ?? 1,
    })),
    issues: parsed?.issues ?? fallback.issues,
    messages: parsed?.messages ?? fallback.messages,
    departureDebriefs: parsed?.departureDebriefs ?? fallback.departureDebriefs,
    messageTemplates: parsed?.messageTemplates?.length ? parsed.messageTemplates : fallback.messageTemplates.length ? fallback.messageTemplates : defaultMessageTemplates,
    automationRules: parsed?.automationRules?.length ? parsed.automationRules : fallback.automationRules.length ? fallback.automationRules : defaultAutomationRules,
    scheduledMessages: (parsed?.scheduledMessages ?? fallback.scheduledMessages).map((message) => ({
      ...message,
      version: message.version ?? 1,
    })),
    marketingTouchpoints: parsed?.marketingTouchpoints ?? fallback.marketingTouchpoints,
    auditLog: parsed?.auditLog ?? fallback.auditLog,
    settings: parsed?.settings ?? fallback.settings,
  });
  normalized.scheduledMessages = reconcileScheduledMessages(normalized);
  return normalized;
}

function emptyCloudData(): AppData {
  return normalizeData({
    units: initialData.units,
    bookings: [],
    people: [],
    guests: [],
    consents: [],
    consentLedger: [],
    reviewRequests: [],
    communicationConfigs: initialData.communicationConfigs,
    adSpend: [],
    growthExperiments: [],
    investmentModels: [],
    meterReadings: [],
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

function mergedImportNotes(existing?: string, incoming?: string) {
  const current = existing?.trim();
  const next = incoming?.trim();
  if (!current) return next;
  if (!next || current.includes(next)) return current;
  if (next.includes(current)) return next;
  return `${current}\n${next}`;
}

function mergeImportedBooking(existing: Booking, incoming: Booking): Booking {
  const historical = incoming.historicalImport || incoming.checkOut <= todayInPoland();
  return {
    ...existing,
    ...incoming,
    arrivalTime: existing.arrivalTime ?? incoming.arrivalTime,
    departureTime: existing.departureTime ?? incoming.departureTime,
    cityArea: existing.cityArea ?? incoming.cityArea,
    paymentMethod: existing.paymentMethod ?? incoming.paymentMethod,
    specialRequests: mergedImportNotes(existing.specialRequests, incoming.specialRequests),
    createdBy: existing.createdBy,
    workflowStatus: existing.workflowStatus === "Anulowana"
      ? "Anulowana"
      : historical ? incoming.workflowStatus : existing.workflowStatus,
    paymentStatus: existing.paymentStatus === "Barter" || existing.paymentStatus === "Anulowane"
      ? existing.paymentStatus
      : incoming.paymentStatus,
    version: existing.version,
    updatedAt: existing.updatedAt,
    deletedAt: existing.deletedAt,
    purgeAfter: existing.purgeAfter,
    workflowStatusBeforeDeletion: existing.workflowStatusBeforeDeletion,
  };
}

function mergeImportedContact(existing: ContactConsent, incoming: ContactConsent): ContactConsent {
  return {
    ...incoming,
    ...existing,
    phone: incoming.phone || existing.phone,
    email: incoming.email || existing.email,
  };
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

function bookingAggregate(
  current: AppData,
  booking: Booking,
  contact: ContactConsent | undefined,
  createdAt: string,
): BookingAggregate {
  const committedBooking = { ...booking, version: 1, updatedAt: createdAt };
  const committedContact = contact
    ? { ...contact, version: 1, updatedAt: createdAt }
    : undefined;
  const tasks = createTasksForBooking(committedBooking).map((task) => ({
    ...task,
    version: 1,
    updatedAt: createdAt,
  }));
  const checklistItems = defaultChecklist(tasks).map((item) => ({
    ...item,
    version: 1,
    updatedAt: createdAt,
  }));
  const candidate: AppData = {
    ...current,
    bookings: [committedBooking, ...current.bookings],
    consents: committedContact ? [committedContact, ...current.consents] : current.consents,
    tasks: [...tasks, ...current.tasks],
    checklistItems: [...checklistItems, ...current.checklistItems],
  };
  const scheduledMessages = reconcileScheduledMessages(candidate)
    .filter((message) => message.bookingId === booking.id)
    .map((message) => ({ ...message, version: 1, updatedAt: createdAt }));
  return {
    booking: committedBooking,
    contact: committedContact,
    tasks,
    checklistItems,
    scheduledMessages,
  };
}

function mergeBookingAggregate(current: AppData, aggregate: BookingAggregate): AppData {
  const bookingId = aggregate.booking.id;
  const taskIds = new Set(aggregate.tasks.map((task) => task.id));
  const checklistIds = new Set(aggregate.checklistItems.map((item) => item.id));
  const messageIds = new Set(aggregate.scheduledMessages.map((message) => message.id));
  return {
    ...current,
    bookings: [aggregate.booking, ...current.bookings.filter((booking) => booking.id !== bookingId)],
    consents: aggregate.contact
      ? [aggregate.contact, ...current.consents.filter((contact) => contact.bookingId !== bookingId)]
      : current.consents.filter((contact) => contact.bookingId !== bookingId),
    tasks: [...aggregate.tasks, ...current.tasks.filter((task) => !taskIds.has(task.id) && task.bookingId !== bookingId)],
    checklistItems: [
      ...aggregate.checklistItems,
      ...current.checklistItems.filter((item) => !checklistIds.has(item.id) && !taskIds.has(item.taskId)),
    ],
    scheduledMessages: [
      ...aggregate.scheduledMessages,
      ...current.scheduledMessages.filter((message) => !messageIds.has(message.id) && message.bookingId !== bookingId),
    ].sort((a, b) => a.dueAt.localeCompare(b.dueAt)),
  };
}

function removeBookingAggregate(current: AppData, aggregate: BookingAggregate): AppData {
  const bookingId = aggregate.booking.id;
  const taskIds = new Set(aggregate.tasks.map((task) => task.id));
  return {
    ...current,
    bookings: current.bookings.filter((booking) => booking.id !== bookingId),
    consents: current.consents.filter((contact) => contact.bookingId !== bookingId),
    tasks: current.tasks.filter((task) => task.bookingId !== bookingId),
    checklistItems: current.checklistItems.filter((item) => !taskIds.has(item.taskId)),
    scheduledMessages: current.scheduledMessages.filter((message) => message.bookingId !== bookingId),
  };
}

type BookingMutationVersions = {
  booking: number;
  contact?: number;
  tasks: Map<string, number>;
  scheduledMessages: Map<string, number>;
};

function tasksForBookingMutation(
  tasks: OpsTask[],
  booking: Booking,
  operation: BookingMutationOperation,
) {
  if (operation === "trash") {
    return tasks.map((task) => task.bookingId === booking.id
      && task.type !== "Naprawa"
      && !["Zrobione", "Nie dotyczy"].includes(task.status)
      ? {
        ...task,
        statusBeforeBookingDeletion: task.status,
        status: "Nie dotyczy" as const,
      }
      : task);
  }
  if (operation === "restore") {
    return tasks.map((task) => task.bookingId === booking.id && task.statusBeforeBookingDeletion
      ? {
        ...task,
        status: task.statusBeforeBookingDeletion,
        statusBeforeBookingDeletion: undefined,
      }
      : task);
  }
  return booking.workflowStatus === "Anulowana"
    ? cancelOpenStayTasks(tasks, booking.id)
    : rescheduleOpenTasksForBooking(tasks, booking);
}

function messagesForBookingRestore(
  messages: ScheduledMessage[],
  bookingId: string,
) {
  return messages.map((message) => message.bookingId === bookingId
    && message.statusBeforeBookingDeletion
    ? {
      ...message,
      status: message.statusBeforeBookingDeletion,
      bookingFingerprint: message.bookingFingerprintBeforeDeletion
        ?? message.bookingFingerprint,
      statusBeforeBookingDeletion: undefined,
      bookingFingerprintBeforeDeletion: undefined,
    }
    : message);
}

function bookingMutationAggregate(
  current: AppData,
  booking: Booking,
  contact: ContactConsent | undefined,
  versions: BookingMutationVersions,
  updatedAt: string,
  operation: BookingMutationOperation,
): BookingMutationAggregate {
  const committedBooking = {
    ...booking,
    version: versions.booking + 1,
    updatedAt,
  };
  const committedContact = contact
    ? {
      ...contact,
      version: (versions.contact ?? 0) + 1,
      updatedAt,
    }
    : undefined;
  const tasks = tasksForBookingMutation(current.tasks, committedBooking, operation)
    .filter((task) => task.bookingId === committedBooking.id)
    .map((task) => ({
      ...task,
      version: (versions.tasks.get(task.id) ?? task.version ?? 1) + 1,
      updatedAt,
    }));
  const candidate: AppData = {
    ...current,
    bookings: current.bookings.map((item) => item.id === committedBooking.id ? committedBooking : item),
    consents: committedContact
      ? current.consents.some((item) => item.bookingId === committedBooking.id)
        ? current.consents.map((item) => item.bookingId === committedBooking.id ? committedContact : item)
        : [committedContact, ...current.consents]
      : current.consents,
    tasks: current.tasks.map((task) => tasks.find((candidateTask) => candidateTask.id === task.id) ?? task),
    scheduledMessages: operation === "restore"
      ? messagesForBookingRestore(current.scheduledMessages, committedBooking.id)
      : current.scheduledMessages,
  };
  const scheduledMessages = reconcileScheduledMessages(candidate)
    .filter((message) => message.bookingId === committedBooking.id)
    .map((message) => {
      const existing = current.scheduledMessages.find((item) => item.id === message.id);
      if (
        operation === "trash"
        && existing
        && ["Wysłana", "Dostarczona"].includes(existing.status)
      ) {
        return {
          ...message,
          status: existing.status,
          bookingFingerprint: existing.bookingFingerprint,
          version: (versions.scheduledMessages.get(message.id) ?? message.version ?? 0) + 1,
          updatedAt,
        };
      }
      if (operation === "trash" && existing?.status !== "Anulowana") {
        return {
          ...message,
          statusBeforeBookingDeletion: existing?.status ?? message.status,
          bookingFingerprintBeforeDeletion: existing?.bookingFingerprint
            ?? message.bookingFingerprint,
          version: (versions.scheduledMessages.get(message.id) ?? message.version ?? 0) + 1,
          updatedAt,
        };
      }
      return {
        ...message,
        statusBeforeBookingDeletion: operation === "restore"
          ? undefined
          : message.statusBeforeBookingDeletion,
        bookingFingerprintBeforeDeletion: operation === "restore"
          ? undefined
          : message.bookingFingerprintBeforeDeletion,
        version: (versions.scheduledMessages.get(message.id) ?? message.version ?? 0) + 1,
        updatedAt,
      };
    });
  return {
    booking: committedBooking,
    contact: committedContact,
    tasks,
    scheduledMessages,
  };
}

function mergeBookingMutation(
  current: AppData,
  aggregate: BookingMutationAggregate,
  preserveNewer = false,
): AppData {
  const bookingId = aggregate.booking.id;
  const incomingContact = aggregate.contact;
  const incomingTasks = new Map(aggregate.tasks.map((task) => [task.id, task]));
  const incomingMessages = new Map(aggregate.scheduledMessages.map((message) => [message.id, message]));
  const shouldReplace = (currentVersion: number | undefined, incomingVersion: number | undefined) =>
    !preserveNewer || (currentVersion ?? 1) <= (incomingVersion ?? 1);

  return {
    ...current,
    bookings: current.bookings.map((booking) => booking.id === bookingId
      && shouldReplace(booking.version, aggregate.booking.version)
      ? aggregate.booking
      : booking),
    consents: incomingContact
      ? current.consents.some((contact) => contact.bookingId === bookingId)
        ? current.consents.map((contact) => contact.bookingId === bookingId
          && shouldReplace(contact.version, incomingContact.version)
          ? incomingContact
          : contact)
        : [incomingContact, ...current.consents]
      : current.consents,
    tasks: current.tasks.map((task) => {
      const incoming = incomingTasks.get(task.id);
      return incoming && shouldReplace(task.version, incoming.version) ? incoming : task;
    }),
    scheduledMessages: [
      ...current.scheduledMessages.map((message) => {
        const incoming = incomingMessages.get(message.id);
        return incoming && shouldReplace(message.version, incoming.version) ? incoming : message;
      }),
      ...aggregate.scheduledMessages.filter(
        (incoming) => !current.scheduledMessages.some((message) => message.id === incoming.id),
      ),
    ].sort((a, b) => a.dueAt.localeCompare(b.dueAt)),
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
  const bookingRecordVersions = useRef<Map<string, number>>(new Map());
  const consentRecordVersions = useRef<Map<string, number>>(new Map());
  const taskRecordVersions = useRef<Map<string, number>>(new Map());
  const checklistRecordVersions = useRef<Map<string, number>>(new Map());
  const paymentRecordVersions = useRef<Map<string, number>>(new Map());
  const scheduledMessageRecordVersions = useRef<Map<string, number>>(new Map());
  const blockRecordVersions = useRef<Map<string, number>>(new Map());
  const batchRecordVersions = useRef<Map<string, number>>(new Map());
  const blockCommandsInFlight = useRef<Set<string>>(new Set());
  const settingsRecordVersion = useRef(0);
  const pendingRecordCommands = useRef(0);
  const reloadAfterRecordCommands = useRef(false);
  const baseData = useRef<AppData>(cloudConfigured ? emptyCloudData() : normalizeData());
  const localRevision = useRef(0);
  const savedRevision = useRef(0);
  const tabId = useRef(uid("TAB"));
  const syncChannel = useRef<BroadcastChannel | null>(null);
  const conflictGeneration = useRef(0);
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
        bookingRecordVersions.current = new Map(localData.bookings.map((booking) => [booking.id, booking.version ?? 1]));
        consentRecordVersions.current = new Map(localData.consents.map((consent) => [consent.bookingId, consent.version ?? 1]));
        taskRecordVersions.current = new Map(localData.tasks.map((task) => [task.id, task.version ?? 1]));
        checklistRecordVersions.current = new Map(localData.checklistItems.map((item) => [item.id, item.version ?? 1]));
        paymentRecordVersions.current = new Map(localData.payments.map((payment) => [payment.id, payment.version ?? 1]));
        scheduledMessageRecordVersions.current = new Map(
          localData.scheduledMessages.map((message) => [message.id, message.version ?? 1]),
        );
        blockRecordVersions.current = new Map(
          localData.blocks.map((block) => [block.id, block.version ?? 1]),
        );
        settingsRecordVersion.current = localData.settings.version ?? 0;
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
      const hasLegacyLocalChanges = localRevision.current !== savedRevision.current;
      if (!hasLegacyLocalChanges && pendingRecordCommands.current > 0) {
        reloadAfterRecordCommands.current = true;
        return;
      }
      if (!hasLegacyLocalChanges && cloudReady.current) {
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
          batchRecordVersions.current = new Map(Object.entries(payload.recordVersions ?? {}));
          bookingRecordVersions.current = new Map(loadedData.bookings.map((booking) => [booking.id, booking.version ?? 1]));
          consentRecordVersions.current = new Map(loadedData.consents.map((consent) => [consent.bookingId, consent.version ?? 1]));
          taskRecordVersions.current = new Map(loadedData.tasks.map((task) => [task.id, task.version ?? 1]));
          checklistRecordVersions.current = new Map(loadedData.checklistItems.map((item) => [item.id, item.version ?? 1]));
          paymentRecordVersions.current = new Map(loadedData.payments.map((payment) => [payment.id, payment.version ?? 1]));
          scheduledMessageRecordVersions.current = new Map(
            loadedData.scheduledMessages.map((message) => [message.id, message.version ?? 1]),
          );
          blockRecordVersions.current = new Map(
            loadedData.blocks.map((block) => [block.id, block.version ?? 1]),
          );
          settingsRecordVersion.current = loadedData.settings.version ?? 0;
          conflictGeneration.current += 1;
          baseData.current = loadedData;
          localRevision.current = 0;
          savedRevision.current = 0;
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
  }, [data, dataStatus, hydrated]);

  const mutate = useCallback((fn: (current: AppData) => AppData) => {
    if (!dataReady.current) return;
    setData((current) => {
      const next = fn(current);
      if (next !== current) localRevision.current += 1;
      return next;
    });
  }, []);

  const finishRecordCommand = useCallback(() => {
    pendingRecordCommands.current = Math.max(0, pendingRecordCommands.current - 1);
    if (pendingRecordCommands.current > 0 || !reloadAfterRecordCommands.current) return;
    reloadAfterRecordCommands.current = false;
    if (!cloudReady.current) return;
    dataReady.current = false;
    cloudReady.current = false;
    setDataStatus("loading");
    setSyncMode("checking");
    setLoadRequest((request) => request + 1);
  }, []);

  const batchMutate = useCallback((fn: (current: AppData) => AppData) => {
    if (!dataReady.current) return;
    if (!cloudConfigured) {
      mutate(fn);
      return;
    }
    if (!cloudReady.current) return;

    const previous = latestData.current;
    const next = fn(previous);
    if (next === previous) return;
    const revision = ++localRevision.current;
    pendingRecordCommands.current += 1;
    latestData.current = next;
    setData(next);

    cloudSaveQueue.current = cloudSaveQueue.current.then(async () => {
      if (!cloudReady.current) {
        finishRecordCommand();
        return;
      }
      const changes = buildRecordBatchChanges(previous, next, batchRecordVersions.current);
      if (!changes.length) {
        savedRevision.current = Math.max(savedRevision.current, revision);
        finishRecordCommand();
        return;
      }

      const requestId = typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : uid("REQ");
      const clientSentAt = new Date().toISOString();
      try {
        const response = await fetch("/api/records/batch", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            changes,
            requestId,
            clientSentAt,
            tabId: tabId.current,
          }),
        });
        if (response.status === 409) {
          const conflictPayload = await response.json().catch(() => ({})) as {
            currentRecordVersion?: number;
            requestId?: string;
            detectedAt?: string;
          };
          latestData.current = previous;
          setData(previous);
          cloudReady.current = false;
          setSyncMode("conflict");
          const conflict = {
            source: "server-rejection" as const,
            detectedAt: conflictPayload.detectedAt ?? new Date().toISOString(),
            expectedVersion: stateVersion.current,
            currentVersion: stateVersion.current,
            requestId: conflictPayload.requestId ?? requestId,
          };
          const generation = ++conflictGeneration.current;
          setSyncConflict({
            ...conflict,
            changes: summarizeSyncChanges(baseData.current, next),
          });
          void compareConflictWithCloud(conflict, next, generation);
          return;
        }
        if (!response.ok) throw new Error("batch save failed");
        const payload = await response.json() as RecordBatchCommandResult;
        if (
          typeof payload.stateVersion !== "number"
          || !Array.isArray(payload.changes)
        ) throw new Error("incomplete batch result");

        for (const committed of payload.changes) {
          const key = `${committed.entityType}:${committed.entityId}`;
          if (committed.operation === "delete") batchRecordVersions.current.delete(key);
          else batchRecordVersions.current.set(key, committed.recordVersion);
          if (committed.entityType === "bookings") {
            if (committed.operation === "delete") bookingRecordVersions.current.delete(committed.entityId);
            else bookingRecordVersions.current.set(committed.entityId, committed.recordVersion);
          } else if (committed.entityType === "consents") {
            if (committed.operation === "delete") consentRecordVersions.current.delete(committed.entityId);
            else consentRecordVersions.current.set(committed.entityId, committed.recordVersion);
          } else if (committed.entityType === "tasks") {
            if (committed.operation === "delete") taskRecordVersions.current.delete(committed.entityId);
            else taskRecordVersions.current.set(committed.entityId, committed.recordVersion);
          } else if (committed.entityType === "checklistItems") {
            if (committed.operation === "delete") checklistRecordVersions.current.delete(committed.entityId);
            else checklistRecordVersions.current.set(committed.entityId, committed.recordVersion);
          } else if (committed.entityType === "scheduledMessages") {
            if (committed.operation === "delete") scheduledMessageRecordVersions.current.delete(committed.entityId);
            else scheduledMessageRecordVersions.current.set(committed.entityId, committed.recordVersion);
          }
        }
        stateVersion.current = payload.stateVersion;
        savedRevision.current = Math.max(savedRevision.current, revision);
        baseData.current = next;
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
        // Wynik sieci może być niejednoznaczny. Zostawiamy lokalny obraz i
        // wymagamy ponownego pobrania zamiast ryzykować wtórną komendę.
        cloudReady.current = false;
        setSyncMode("error");
      } finally {
        finishRecordCommand();
      }
    });
  }, [compareConflictWithCloud, finishRecordCommand, mutate]);

  const createBooking = useCallback((booking: Booking, contact?: ContactConsent) => {
    if (!dataReady.current) return;
    const clientSentAt = new Date().toISOString();
    const aggregate = bookingAggregate(latestData.current, booking, contact, clientSentAt);

    if (!cloudConfigured) {
      mutate((current) => ({
        ...mergeBookingAggregate(current, aggregate),
        auditLog: [
          audit("booking", booking.id, "created", `Dodano rezerwację ${booking.guestLabel}`),
          ...current.auditLog,
        ],
      }));
      return;
    }
    if (!cloudReady.current) return;

    const requestId = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : uid("REQ");
    bookingRecordVersions.current.set(booking.id, 1);
    if (aggregate.contact) consentRecordVersions.current.set(booking.id, 1);
    for (const task of aggregate.tasks) taskRecordVersions.current.set(task.id, 1);
    for (const item of aggregate.checklistItems) checklistRecordVersions.current.set(item.id, 1);
    for (const message of aggregate.scheduledMessages) scheduledMessageRecordVersions.current.set(message.id, 1);
    pendingRecordCommands.current += 1;
    setData((current) => mergeBookingAggregate(current, aggregate));

    cloudSaveQueue.current = cloudSaveQueue.current.then(async () => {
      if (!cloudReady.current) {
        finishRecordCommand();
        return;
      }
      try {
        const response = await fetch("/api/bookings", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            aggregate,
            requestId,
            clientSentAt,
            tabId: tabId.current,
          }),
        });
        if (!response.ok) {
          setData((current) => removeBookingAggregate(current, aggregate));
          bookingRecordVersions.current.delete(booking.id);
          consentRecordVersions.current.delete(booking.id);
          for (const task of aggregate.tasks) taskRecordVersions.current.delete(task.id);
          for (const item of aggregate.checklistItems) checklistRecordVersions.current.delete(item.id);
          for (const message of aggregate.scheduledMessages) scheduledMessageRecordVersions.current.delete(message.id);
          cloudReady.current = false;
          setSyncMode(response.status === 409 ? "conflict" : "error");
          if (response.status === 409) {
            const payload = await response.json().catch(() => ({})) as {
              requestId?: string;
              detectedAt?: string;
            };
            setSyncConflict({
              source: "server-rejection",
              detectedAt: payload.detectedAt ?? new Date().toISOString(),
              expectedVersion: stateVersion.current,
              requestId: payload.requestId ?? requestId,
              changes: summarizeSyncChanges(baseData.current, latestData.current),
            });
          }
          return;
        }

        const payload = await response.json() as {
          aggregate: BookingAggregate;
          stateVersion: number;
          savedAt?: string;
        };
        stateVersion.current = payload.stateVersion;
        bookingRecordVersions.current.set(
          booking.id,
          payload.aggregate.booking.version ?? 1,
        );
        if (payload.aggregate.contact) {
          consentRecordVersions.current.set(
            booking.id,
            payload.aggregate.contact.version ?? 1,
          );
        }
        for (const task of payload.aggregate.tasks) {
          taskRecordVersions.current.set(task.id, task.version ?? 1);
        }
        for (const item of payload.aggregate.checklistItems) {
          checklistRecordVersions.current.set(item.id, item.version ?? 1);
        }
        for (const message of payload.aggregate.scheduledMessages) {
          scheduledMessageRecordVersions.current.set(message.id, message.version ?? 1);
        }
        setData((current) => mergeBookingAggregate(current, payload.aggregate));
        baseData.current = mergeBookingAggregate(baseData.current, payload.aggregate);
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
        // Nie wycofujemy zapisu przy niejednoznacznym błędzie sieci: transakcja
        // mogła dojść do bazy. Ponowne pobranie rozstrzygnie stan bez duplikacji.
        cloudReady.current = false;
        setSyncMode("error");
      } finally {
        finishRecordCommand();
      }
    });
  }, [finishRecordCommand, mutate]);

  const commitBookingMutation = useCallback((
    booking: Booking,
    contact: ContactConsent | undefined,
    operation: BookingMutationOperation,
  ) => {
    if (!dataReady.current) return;
    const currentBooking = latestData.current.bookings.find((item) => item.id === booking.id);
    if (!currentBooking) return;

    if (!cloudConfigured) {
      mutate((current) => {
        const currentContact = current.consents.find((item) => item.bookingId === booking.id);
        const localAggregate = bookingMutationAggregate(
          current,
          booking,
          contact,
          {
            booking: currentBooking.version ?? 1,
            contact: contact ? currentContact?.version ?? 0 : undefined,
            tasks: new Map(current.tasks
              .filter((task) => task.bookingId === booking.id)
              .map((task) => [task.id, task.version ?? 1])),
            scheduledMessages: new Map(current.scheduledMessages
              .filter((message) => message.bookingId === booking.id)
              .map((message) => [message.id, message.version ?? 1])),
          },
          new Date().toISOString(),
          operation,
        );
        return {
          ...mergeBookingMutation(current, localAggregate),
          auditLog: [
            audit(
              "booking",
              booking.id,
              operation === "trash"
                ? "deleted"
                : operation === "restore"
                  ? "restored"
                  : operation === "cancel"
                    ? "cancelled"
                    : "updated",
              operation === "trash"
                ? "Przeniesiono rezerwację do kosza na 30 dni"
                : operation === "restore"
                  ? "Przywrócono rezerwację z kosza"
                  : operation === "cancel"
                    ? "Anulowano rezerwację"
                    : `Zmieniono rezerwację ${booking.guestLabel}`,
            ),
            ...current.auditLog,
          ],
        };
      });
      return;
    }
    if (!cloudReady.current) return;

    const expectedRecordVersion = bookingRecordVersions.current.get(booking.id)
      ?? currentBooking.version
      ?? 1;
    const existingContact = latestData.current.consents.find((item) => item.bookingId === booking.id);
    const versions: BookingMutationVersions = {
      booking: expectedRecordVersion,
      contact: contact
        ? consentRecordVersions.current.get(booking.id) ?? existingContact?.version ?? 0
        : undefined,
      tasks: new Map(
        latestData.current.tasks
          .filter((task) => task.bookingId === booking.id)
          .map((task) => [
            task.id,
            taskRecordVersions.current.get(task.id) ?? task.version ?? 1,
          ]),
      ),
      scheduledMessages: new Map(
        latestData.current.scheduledMessages
          .filter((message) => message.bookingId === booking.id)
          .map((message) => [
            message.id,
            scheduledMessageRecordVersions.current.get(message.id) ?? message.version ?? 1,
          ]),
      ),
    };
    const requestId = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : uid("REQ");
    const clientSentAt = new Date().toISOString();
    const aggregate = bookingMutationAggregate(
      latestData.current,
      booking,
      contact,
      versions,
      clientSentAt,
      operation,
    );

    bookingRecordVersions.current.set(booking.id, expectedRecordVersion + 1);
    if (aggregate.contact) {
      consentRecordVersions.current.set(booking.id, aggregate.contact.version ?? 1);
    }
    for (const task of aggregate.tasks) {
      taskRecordVersions.current.set(task.id, task.version ?? 1);
    }
    for (const message of aggregate.scheduledMessages) {
      scheduledMessageRecordVersions.current.set(message.id, message.version ?? 1);
    }
    pendingRecordCommands.current += 1;
    setData((current) => mergeBookingMutation(current, aggregate));

    cloudSaveQueue.current = cloudSaveQueue.current.then(async () => {
      if (!cloudReady.current) {
        finishRecordCommand();
        return;
      }
      try {
        const response = await fetch(`/api/bookings/${encodeURIComponent(booking.id)}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            aggregate,
            operation,
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
        if (!response.ok) throw new Error("booking command failed");
        const payload = await response.json() as {
          aggregate: BookingMutationAggregate;
          recordVersion: number;
          stateVersion: number;
          savedAt?: string;
        };

        bookingRecordVersions.current.set(
          booking.id,
          Math.max(
            bookingRecordVersions.current.get(booking.id) ?? 1,
            payload.recordVersion,
          ),
        );
        if (payload.aggregate.contact) {
          consentRecordVersions.current.set(
            booking.id,
            Math.max(
              consentRecordVersions.current.get(booking.id) ?? 0,
              payload.aggregate.contact.version ?? 1,
            ),
          );
        }
        for (const task of payload.aggregate.tasks) {
          taskRecordVersions.current.set(
            task.id,
            Math.max(
              taskRecordVersions.current.get(task.id) ?? 1,
              task.version ?? 1,
            ),
          );
        }
        for (const message of payload.aggregate.scheduledMessages) {
          scheduledMessageRecordVersions.current.set(
            message.id,
            Math.max(
              scheduledMessageRecordVersions.current.get(message.id) ?? 1,
              message.version ?? 1,
            ),
          );
        }
        stateVersion.current = payload.stateVersion;
        setData((current) => mergeBookingMutation(current, payload.aggregate, true));
        baseData.current = mergeBookingMutation(baseData.current, payload.aggregate);
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
        // Stan optymistyczny zostaje widoczny. Odświeżenie rozstrzyga, czy
        // transakcja dotarła do bazy, bez ponownego pełnego zapisu.
        cloudReady.current = false;
        setSyncMode("error");
      } finally {
        finishRecordCommand();
      }
    });
  }, [finishRecordCommand, mutate]);

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
    pendingRecordCommands.current += 1;
    setData((current) => ({
      ...current,
      tasks: current.tasks.map((item) => item.id === task.id ? optimisticTask : item),
    }));

    cloudSaveQueue.current = cloudSaveQueue.current.then(async () => {
      if (!cloudReady.current) {
        finishRecordCommand();
        return;
      }
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
        taskRecordVersions.current.set(
          task.id,
          Math.max(taskRecordVersions.current.get(task.id) ?? 1, payload.recordVersion),
        );
        stateVersion.current = payload.stateVersion;
        const committedTask = {
          ...payload.task,
          version: payload.recordVersion,
        };
        setData((current) => ({
          ...current,
          tasks: current.tasks.map((item) => item.id === task.id && (item.version ?? 1) <= payload.recordVersion
            ? committedTask
            : item),
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
      } finally {
        finishRecordCommand();
      }
    });
  }, [finishRecordCommand, mutate]);

  const updateChecklistItem = useCallback((item: TaskChecklistItem) => {
    if (!dataReady.current) return;
    if (!cloudConfigured) {
      mutate((current) => ({
        ...current,
        checklistItems: current.checklistItems.map((candidate) => candidate.id === item.id ? item : candidate),
        auditLog: [audit("checklist", item.id, item.done ? "completed" : "reopened", item.label), ...current.auditLog],
      }));
      return;
    }
    if (!cloudReady.current) return;

    const currentItem = latestData.current.checklistItems.find((candidate) => candidate.id === item.id);
    if (!currentItem) return;
    const expectedRecordVersion = checklistRecordVersions.current.get(item.id) ?? currentItem.version ?? 1;
    const requestId = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : uid("REQ");
    const clientSentAt = new Date().toISOString();
    const optimisticItem = {
      ...item,
      completedAt: item.done ? item.completedAt ?? clientSentAt : undefined,
      version: expectedRecordVersion + 1,
      updatedAt: clientSentAt,
    };

    checklistRecordVersions.current.set(item.id, expectedRecordVersion + 1);
    pendingRecordCommands.current += 1;
    setData((current) => ({
      ...current,
      checklistItems: current.checklistItems.map((candidate) => candidate.id === item.id ? optimisticItem : candidate),
    }));

    cloudSaveQueue.current = cloudSaveQueue.current.then(async () => {
      if (!cloudReady.current) {
        finishRecordCommand();
        return;
      }
      try {
        const response = await fetch(`/api/checklist-items/${encodeURIComponent(item.id)}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            item: optimisticItem,
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
        if (!response.ok) throw new Error("checklist command failed");
        const payload = await response.json() as {
          item: TaskChecklistItem;
          recordVersion: number;
          stateVersion: number;
          savedAt?: string;
        };
        checklistRecordVersions.current.set(
          item.id,
          Math.max(checklistRecordVersions.current.get(item.id) ?? 1, payload.recordVersion),
        );
        stateVersion.current = payload.stateVersion;
        const committedItem = {
          ...payload.item,
          version: payload.recordVersion,
        };
        setData((current) => ({
          ...current,
          checklistItems: current.checklistItems.map((candidate) => candidate.id === item.id && (candidate.version ?? 1) <= payload.recordVersion
            ? committedItem
            : candidate),
        }));
        baseData.current = {
          ...baseData.current,
          checklistItems: baseData.current.checklistItems.map((candidate) => candidate.id === item.id ? committedItem : candidate),
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
        cloudReady.current = false;
        setSyncMode("error");
      } finally {
        finishRecordCommand();
      }
    });
  }, [finishRecordCommand, mutate]);

  const createPayment = useCallback((payment: PaymentTransaction) => {
    if (!dataReady.current) return;
    const booking = latestData.current.bookings.find((item) => item.id === payment.bookingId);
    if (
      !booking
      || paymentRecordVersions.current.has(payment.id)
      || latestData.current.payments.some((item) => item.id === payment.id)
    ) return;
    const normalizedPayment = {
      ...payment,
      currency: payment.currency ?? booking.currency,
    };

    if (!cloudConfigured) {
      mutate((current) => ({
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
      }));
      return;
    }
    if (!cloudReady.current || !normalizedPayment.currency) return;

    const requestId = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : uid("REQ");
    const clientSentAt = new Date().toISOString();
    const optimisticPayment: PaymentTransaction = {
      ...normalizedPayment,
      currency: normalizedPayment.currency,
      version: 1,
      updatedAt: clientSentAt,
    };

    paymentRecordVersions.current.set(payment.id, 1);
    pendingRecordCommands.current += 1;
    setData((current) => ({
      ...current,
      payments: [optimisticPayment, ...current.payments],
    }));

    cloudSaveQueue.current = cloudSaveQueue.current.then(async () => {
      if (!cloudReady.current) {
        finishRecordCommand();
        return;
      }
      try {
        const response = await fetch("/api/payments", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            payment: optimisticPayment,
            requestId,
            clientSentAt,
            tabId: tabId.current,
          }),
        });
        if (!response.ok) {
          setData((current) => ({
            ...current,
            payments: current.payments.filter((item) => item.id !== payment.id),
          }));
          paymentRecordVersions.current.delete(payment.id);
          cloudReady.current = false;
          setSyncMode(response.status === 409 ? "conflict" : "error");
          if (response.status === 409) {
            const payload = await response.json().catch(() => ({})) as {
              currentRecordVersion?: number;
              detectedAt?: string;
              requestId?: string;
            };
            setSyncConflict({
              source: "server-rejection",
              detectedAt: payload.detectedAt ?? new Date().toISOString(),
              expectedVersion: 0,
              currentVersion: payload.currentRecordVersion,
              requestId: payload.requestId ?? requestId,
              changes: summarizeSyncChanges(baseData.current, latestData.current),
            });
          }
          return;
        }

        const payload = await response.json() as {
          payment: PaymentTransaction;
          recordVersion: number;
          stateVersion: number;
          savedAt?: string;
        };
        const committedPayment = {
          ...payload.payment,
          version: payload.recordVersion,
        };
        paymentRecordVersions.current.set(payment.id, payload.recordVersion);
        stateVersion.current = payload.stateVersion;
        setData((current) => ({
          ...current,
          payments: current.payments.map((item) => item.id === payment.id
            ? committedPayment
            : item),
        }));
        baseData.current = {
          ...baseData.current,
          payments: [
            committedPayment,
            ...baseData.current.payments.filter((item) => item.id !== payment.id),
          ],
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
        // Po niejednoznacznym błędzie sieci zostawiamy wpis optymistyczny.
        // Odświeżenie rozstrzygnie, czy idempotentna komenda dotarła do bazy.
        cloudReady.current = false;
        setSyncMode("error");
      } finally {
        finishRecordCommand();
      }
    });
  }, [finishRecordCommand, mutate]);

  const createCalendarBlock = useCallback(async (block: CalendarBlock) => {
    if (
      !dataReady.current
      || blockCommandsInFlight.current.has(block.id)
      || latestData.current.blocks.some((candidate) => candidate.id === block.id)
    ) return false;

    const clientSentAt = new Date().toISOString();
    const optimisticBlock: CalendarBlock = {
      ...block,
      version: 1,
      updatedAt: clientSentAt,
    };

    if (!cloudConfigured) {
      mutate((current) => ({
        ...current,
        blocks: [optimisticBlock, ...current.blocks],
        auditLog: [
          audit("block", block.id, "created", block.reason),
          ...current.auditLog,
        ],
      }));
      return true;
    }
    if (!cloudReady.current) return false;

    const requestId = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : uid("REQ");
    blockRecordVersions.current.set(block.id, 1);
    blockCommandsInFlight.current.add(block.id);
    pendingRecordCommands.current += 1;
    setData((current) => ({
      ...current,
      blocks: [optimisticBlock, ...current.blocks],
    }));

    let commandSucceeded = false;
    cloudSaveQueue.current = cloudSaveQueue.current.then(async () => {
      if (!cloudReady.current) {
        blockCommandsInFlight.current.delete(block.id);
        blockRecordVersions.current.delete(block.id);
        setData((current) => ({
          ...current,
          blocks: current.blocks.filter((candidate) => candidate.id !== block.id),
        }));
        finishRecordCommand();
        return;
      }
      try {
        const response = await fetch("/api/calendar-blocks", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            block: optimisticBlock,
            expectedRecordVersion: 0,
            requestId,
            clientSentAt,
            tabId: tabId.current,
          }),
        });
        if (!response.ok) {
          blockRecordVersions.current.delete(block.id);
          setData((current) => ({
            ...current,
            blocks: current.blocks.filter((candidate) => candidate.id !== block.id),
          }));
          cloudReady.current = false;
          setSyncMode(response.status === 409 ? "conflict" : "error");
          if (response.status === 409) {
            const payload = await response.json().catch(() => ({})) as {
              currentRecordVersion?: number;
              detectedAt?: string;
              requestId?: string;
            };
            setSyncConflict({
              source: "server-rejection",
              detectedAt: payload.detectedAt ?? new Date().toISOString(),
              expectedVersion: 0,
              currentVersion: payload.currentRecordVersion,
              requestId: payload.requestId ?? requestId,
              changes: summarizeSyncChanges(baseData.current, latestData.current),
            });
          }
          return;
        }

        const payload = await response.json() as {
          block: CalendarBlock;
          recordVersion: number;
          stateVersion: number;
          savedAt?: string;
        };
        const committedBlock = {
          ...payload.block,
          version: payload.recordVersion,
        };
        blockRecordVersions.current.set(block.id, payload.recordVersion);
        stateVersion.current = payload.stateVersion;
        setData((current) => ({
          ...current,
          blocks: current.blocks.map((candidate) => candidate.id === block.id
            ? committedBlock
            : candidate),
        }));
        baseData.current = {
          ...baseData.current,
          blocks: [
            committedBlock,
            ...baseData.current.blocks.filter((candidate) => candidate.id !== block.id),
          ],
        };
        setSyncMode("cloud");
        const savedAt = payload.savedAt ?? new Date().toISOString();
        setLastSavedAt(savedAt);
        commandSucceeded = true;
        syncChannel.current?.postMessage({
          type: "state-committed",
          tabId: tabId.current,
          requestId,
          version: payload.stateVersion,
          savedAt,
        } satisfies StateCommittedMessage);
      } catch {
        // Niepewny zapis nowej blokady pozostaje widoczny i konserwatywnie
        // pomniejsza dostępność do czasu ponownego pobrania danych.
        cloudReady.current = false;
        setSyncMode("error");
      } finally {
        blockCommandsInFlight.current.delete(block.id);
        finishRecordCommand();
      }
    });
    await cloudSaveQueue.current;
    return commandSucceeded;
  }, [finishRecordCommand, mutate]);

  const updateCalendarBlock = useCallback(async (block: CalendarBlock) => {
    if (!dataReady.current || blockCommandsInFlight.current.has(block.id)) return false;
    const currentBlock = latestData.current.blocks.find((candidate) => candidate.id === block.id);
    if (!currentBlock) return false;

    if (!cloudConfigured) {
      mutate((current) => ({
        ...current,
        blocks: current.blocks.map((candidate) => candidate.id === block.id ? block : candidate),
        auditLog: [
          audit("block", block.id, "updated", block.reason),
          ...current.auditLog,
        ],
      }));
      return true;
    }
    if (!cloudReady.current) return false;

    const expectedRecordVersion = blockRecordVersions.current.get(block.id)
      ?? currentBlock.version
      ?? 1;
    const requestId = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : uid("REQ");
    const clientSentAt = new Date().toISOString();
    const optimisticBlock: CalendarBlock = {
      ...block,
      version: expectedRecordVersion + 1,
      updatedAt: clientSentAt,
    };

    blockRecordVersions.current.set(block.id, expectedRecordVersion + 1);
    blockCommandsInFlight.current.add(block.id);
    pendingRecordCommands.current += 1;
    setData((current) => ({
      ...current,
      blocks: current.blocks.map((candidate) => candidate.id === block.id
        ? optimisticBlock
        : candidate),
    }));

    let commandSucceeded = false;
    cloudSaveQueue.current = cloudSaveQueue.current.then(async () => {
      if (!cloudReady.current) {
        blockCommandsInFlight.current.delete(block.id);
        blockRecordVersions.current.set(block.id, expectedRecordVersion);
        setData((current) => ({
          ...current,
          blocks: current.blocks.map((candidate) => candidate.id === block.id
            ? currentBlock
            : candidate),
        }));
        finishRecordCommand();
        return;
      }
      try {
        const response = await fetch(`/api/calendar-blocks/${encodeURIComponent(block.id)}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            block: optimisticBlock,
            expectedRecordVersion,
            requestId,
            clientSentAt,
            tabId: tabId.current,
          }),
        });
        if (!response.ok) {
          blockRecordVersions.current.set(block.id, expectedRecordVersion);
          setData((current) => ({
            ...current,
            blocks: current.blocks.map((candidate) => candidate.id === block.id
              ? currentBlock
              : candidate),
          }));
          cloudReady.current = false;
          setSyncMode(response.status === 409 ? "conflict" : "error");
          if (response.status === 409) {
            const payload = await response.json().catch(() => ({})) as {
              currentRecordVersion?: number;
              detectedAt?: string;
              requestId?: string;
            };
            setSyncConflict({
              source: "server-rejection",
              detectedAt: payload.detectedAt ?? new Date().toISOString(),
              expectedVersion: expectedRecordVersion,
              currentVersion: payload.currentRecordVersion,
              requestId: payload.requestId ?? requestId,
              changes: summarizeSyncChanges(baseData.current, latestData.current),
            });
          }
          return;
        }

        const payload = await response.json() as {
          block: CalendarBlock;
          recordVersion: number;
          stateVersion: number;
          savedAt?: string;
        };
        const committedBlock = {
          ...payload.block,
          version: payload.recordVersion,
        };
        blockRecordVersions.current.set(block.id, payload.recordVersion);
        stateVersion.current = payload.stateVersion;
        setData((current) => ({
          ...current,
          blocks: current.blocks.map((candidate) => candidate.id === block.id
            ? committedBlock
            : candidate),
        }));
        baseData.current = {
          ...baseData.current,
          blocks: baseData.current.blocks.map((candidate) => candidate.id === block.id
            ? committedBlock
            : candidate),
        };
        setSyncMode("cloud");
        const savedAt = payload.savedAt ?? new Date().toISOString();
        setLastSavedAt(savedAt);
        commandSucceeded = true;
        syncChannel.current?.postMessage({
          type: "state-committed",
          tabId: tabId.current,
          requestId,
          version: payload.stateVersion,
          savedAt,
        } satisfies StateCommittedMessage);
      } catch {
        // Anulowanie bez potwierdzenia nie może zwolnić terminu. Przywracamy
        // ostatni potwierdzony rekord i wymagamy ponownego pobrania danych.
        blockRecordVersions.current.set(block.id, expectedRecordVersion);
        setData((current) => ({
          ...current,
          blocks: current.blocks.map((candidate) => candidate.id === block.id
            ? currentBlock
            : candidate),
        }));
        cloudReady.current = false;
        setSyncMode("error");
      } finally {
        blockCommandsInFlight.current.delete(block.id);
        finishRecordCommand();
      }
    });
    await cloudSaveQueue.current;
    return commandSucceeded;
  }, [finishRecordCommand, mutate]);

  const updateSettings = useCallback(async (settings: AppData["settings"]) => {
    if (!dataReady.current) return false;
    if (!cloudConfigured) {
      mutate((current) => ({
        ...current,
        settings,
        auditLog: [
          audit("settings", "organization", "updated", "Zmieniono ustawienia organizacji"),
          ...current.auditLog,
        ],
      }));
      return true;
    }
    if (!cloudReady.current) return false;

    const expectedRecordVersion = settingsRecordVersion.current
      || latestData.current.settings.version
      || 0;
    const requestId = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : uid("REQ");
    const clientSentAt = new Date().toISOString();
    const optimisticSettings = {
      ...settings,
      version: expectedRecordVersion + 1,
      updatedAt: clientSentAt,
    };

    settingsRecordVersion.current = expectedRecordVersion + 1;
    pendingRecordCommands.current += 1;
    setData((current) => ({ ...current, settings: optimisticSettings }));

    let commandSucceeded = false;
    cloudSaveQueue.current = cloudSaveQueue.current.then(async () => {
      if (!cloudReady.current) {
        finishRecordCommand();
        return;
      }
      try {
        const response = await fetch("/api/settings", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            settings: optimisticSettings,
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
        if (!response.ok) throw new Error("settings command failed");

        const payload = await response.json() as {
          settings: AppData["settings"];
          recordVersion: number;
          stateVersion: number;
          savedAt?: string;
        };
        settingsRecordVersion.current = Math.max(
          settingsRecordVersion.current,
          payload.recordVersion,
        );
        stateVersion.current = payload.stateVersion;
        const committedSettings = {
          ...payload.settings,
          version: payload.recordVersion,
        };
        setData((current) => ({
          ...current,
          settings: (current.settings.version ?? 0) <= payload.recordVersion
            ? committedSettings
            : current.settings,
        }));
        baseData.current = {
          ...baseData.current,
          settings: committedSettings,
        };
        setSyncMode("cloud");
        const savedAt = payload.savedAt ?? new Date().toISOString();
        setLastSavedAt(savedAt);
        commandSucceeded = true;
        syncChannel.current?.postMessage({
          type: "state-committed",
          tabId: tabId.current,
          requestId,
          version: payload.stateVersion,
          savedAt,
        } satisfies StateCommittedMessage);
      } catch {
        cloudReady.current = false;
        setSyncMode("error");
      } finally {
        finishRecordCommand();
      }
    });
    await cloudSaveQueue.current;
    return commandSucceeded;
  }, [finishRecordCommand, mutate]);

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
    addBooking: createBooking,
    updateBooking: (booking, contact) => commitBookingMutation(booking, contact, "update"),
    cancelBooking: (bookingId) => {
      const booking = latestData.current.bookings.find((item) => item.id === bookingId);
      if (!booking) return;
      const contact = latestData.current.consents.find((item) => item.bookingId === bookingId);
      commitBookingMutation(
        { ...booking, workflowStatus: "Anulowana" },
        contact,
        "cancel",
      );
    },
    deleteBooking: (bookingId) => {
      const booking = latestData.current.bookings.find((item) => item.id === bookingId);
      if (!booking || booking.deletedAt) return;
      const deletedAt = new Date().toISOString();
      const contact = latestData.current.consents.find((item) => item.bookingId === bookingId);
      commitBookingMutation({
        ...booking,
        workflowStatusBeforeDeletion: booking.workflowStatus,
        workflowStatus: "Anulowana",
        deletedAt,
        purgeAfter: trashExpiryDate(deletedAt.slice(0, 10)),
        updatedAt: deletedAt,
      }, contact, "trash");
    },
    restoreBooking: (bookingId) => {
      const booking = latestData.current.bookings.find((item) => item.id === bookingId);
      if (!booking?.deletedAt || isTrashExpired(booking)) return;
      const contact = latestData.current.consents.find((item) => item.bookingId === bookingId);
      commitBookingMutation({
        ...booking,
        workflowStatus: booking.workflowStatusBeforeDeletion ?? "Nowa",
        workflowStatusBeforeDeletion: undefined,
        deletedAt: undefined,
        purgeAfter: undefined,
        updatedAt: new Date().toISOString(),
      }, contact, "restore");
    },
    updateTask,
    toggleChecklistItem: updateChecklistItem,
    addIssue: (issue) => batchMutate((current) => ({
      ...current,
      issues: [issue, ...current.issues],
      auditLog: [audit("issue", issue.id, "created", issue.title), ...current.auditLog],
    })),
    updateIssue: (issue) => batchMutate((current) => ({
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
    prepareDepartureDebriefs: (bookingIds) => batchMutate((current) => {
      const missing = bookingIds.filter((bookingId) => !current.departureDebriefs.some((item) => item.bookingId === bookingId));
      if (!missing.length) return current;
      const next: AppData = {
        ...current,
        departureDebriefs: [...current.departureDebriefs, ...missing.map((bookingId) => ({ id: `DEB-${bookingId}`, bookingId, status: "Oczekuje" as const, keysSettled: false, urgentNextArrivalRisk: false, publicQuotePermission: "Do dopytania" as const }))],
      };
      return next;
    }),
    markDeparturePrompted: (bookingId) => batchMutate((current) => ({
      ...current,
      departureDebriefs: current.departureDebriefs.map((item) => item.bookingId === bookingId ? { ...item, lastPromptedAt: new Date().toISOString(), lastPromptedOn: todayInPoland() } : item),
    })),
    snoozeDepartureDebrief: (bookingId) => batchMutate((current) => ({
      ...current,
      departureDebriefs: current.departureDebriefs.map((item) => item.bookingId === bookingId ? { ...item, lastPromptedAt: new Date().toISOString(), lastPromptedOn: todayInPoland(), snoozedUntil: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() } : item),
    })),
    skipDepartureDebrief: (bookingId, reason) => batchMutate((current) => ({
      ...current,
      departureDebriefs: current.departureDebriefs.map((item) => item.bookingId === bookingId ? { ...item, status: "Pominięty", skipReason: reason, completedAt: new Date().toISOString() } : item),
      bookings: current.bookings.map((item) => item.id === bookingId ? { ...item, workflowStatus: "Po pobycie" } : item),
      auditLog: [audit("debrief", `DEB-${bookingId}`, "skipped", reason), ...current.auditLog],
    })),
    saveDepartureDebrief: (debrief, issue) => batchMutate((current) => {
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
    updateScheduledMessage: (message) => batchMutate((current) => ({
      ...current,
      scheduledMessages: current.scheduledMessages.map((item) => item.id === message.id ? message : item),
      auditLog: [audit("scheduled_message", message.id, "updated", `${message.status}: ${message.channel}`), ...current.auditLog],
    })),
    addBlock: createCalendarBlock,
    updateBlock: updateCalendarBlock,
    addPayment: createPayment,
    addInvoice: (invoice) => batchMutate((current) => ({
      ...current,
      invoices: [invoice, ...current.invoices],
      auditLog: [audit("invoice", invoice.id, "created", `Dokument ${invoice.number}`), ...current.auditLog],
    })),
    addMessage: (message) => batchMutate((current) => ({
      ...current,
      messages: [message, ...current.messages],
      auditLog: [audit("message", message.id, "created", `${message.channel}: ${message.status}`), ...current.auditLog],
    })),
    addMedia: (media) => batchMutate((current) => ({
      ...current,
      media: [media, ...current.media],
      auditLog: [audit("media", media.id, "created", media.caption ?? media.type), ...current.auditLog],
    })),
    updateMedia: (media) => batchMutate((current) => ({
      ...current,
      media: current.media.map((item) => item.id === media.id ? media : item),
      auditLog: [audit("media", media.id, "updated", `Status: ${media.usageStatus}`), ...current.auditLog],
    })),
    upsertPerson: (person) => batchMutate((current) => ({
      ...current,
      people: current.people.some((item) => item.id === person.id)
        ? current.people.map((item) => item.id === person.id ? person : item)
        : [person, ...current.people],
      auditLog: [audit("person", person.id, "updated", "Zapisano tożsamość gościa"), ...current.auditLog],
    })),
    mergePeople: (sourcePersonId, targetPersonId) => batchMutate((current) => {
      const next = mergeGuestPeople(current, sourcePersonId, targetPersonId);
      if (next === current) return current;
      return {
        ...next,
        auditLog: [
          audit("person", targetPersonId, "merged", `Połączono ${sourcePersonId} po decyzji użytkownika`),
          ...current.auditLog,
        ],
      };
    }),
    updateGuest: (profile) => batchMutate((current) => ({
      ...current,
      guests: current.guests.some((item) => item.bookingId === profile.bookingId)
        ? current.guests.map((item) => item.bookingId === profile.bookingId ? profile : item)
        : [profile, ...current.guests],
      auditLog: [audit("guest", profile.bookingId, "updated", "Zaktualizowano profil gościa"), ...current.auditLog],
    })),
    updateConsent: (consent) => batchMutate((current) => {
      const normalizedConsent = {
        ...consent,
        phone: consent.phone?.trim() || undefined,
        email: consent.email?.trim() || undefined,
      };
      return {
        ...current,
        consents: current.consents.some((item) => item.bookingId === consent.bookingId)
          ? current.consents.map((item) => item.bookingId === consent.bookingId ? normalizedConsent : item)
          : [normalizedConsent, ...current.consents],
        auditLog: [audit("consent", consent.bookingId, "updated", "Zaktualizowano dane kontaktowe i zgody"), ...current.auditLog],
      };
    }),
    upsertConsentRecord: (consent) => batchMutate((current) => ({
      ...current,
      consentLedger: current.consentLedger.some((item) => item.id === consent.id)
        ? current.consentLedger.map((item) => item.id === consent.id ? consent : item)
        : [consent, ...current.consentLedger],
      auditLog: [audit("consent", consent.id, consent.decision, consent.purpose), ...current.auditLog],
    })),
    updateReviewRequest: (review) => batchMutate((current) => ({
      ...current,
      reviewRequests: current.reviewRequests.some((item) => item.id === review.id)
        ? current.reviewRequests.map((item) => item.id === review.id ? review : item)
        : [review, ...current.reviewRequests],
      auditLog: [audit("review_request", review.id, "updated", review.status), ...current.auditLog],
    })),
    upsertCommunicationConfig: (config) => batchMutate((current) => ({
      ...current,
      communicationConfigs: current.communicationConfigs.some((item) => item.id === config.id)
        ? current.communicationConfigs.map((item) => item.id === config.id ? config : item)
        : [config, ...current.communicationConfigs],
      auditLog: [audit("communication_config", config.id, "updated", "Zmieniono wersjonowaną konfigurację komunikacji"), ...current.auditLog],
    })),
    importAdSpend: (records) => batchMutate((current) => {
      const incomingIds = new Set(records.map((record) => record.id));
      return {
        ...current,
        adSpend: [...records, ...current.adSpend.filter((record) => !incomingIds.has(record.id))],
        auditLog: [audit("ad_spend", uid("AD-IMPORT"), "imported", `Zaimportowano ${records.length} wierszy kosztów reklam`), ...current.auditLog],
      };
    }),
    upsertGrowthExperiment: (experiment) => batchMutate((current) => ({
      ...current,
      growthExperiments: current.growthExperiments.some((item) => item.id === experiment.id)
        ? current.growthExperiments.map((item) => item.id === experiment.id ? experiment : item)
        : [experiment, ...current.growthExperiments],
      auditLog: [audit("growth_experiment", experiment.id, "updated", experiment.decision), ...current.auditLog],
    })),
    upsertInvestmentModel: (model) => batchMutate((current) => ({
      ...current,
      investmentModels: current.investmentModels.some((item) => item.id === model.id)
        ? current.investmentModels.map((item) => item.id === model.id ? model : item)
        : [model, ...current.investmentModels],
      auditLog: [audit("investment_model", model.id, "updated", model.source), ...current.auditLog],
    })),
    addMeterReading: (reading) => batchMutate((current) => ({
      ...current,
      meterReadings: [reading, ...current.meterReadings],
      auditLog: [audit("meter_reading", reading.id, "created", `${reading.value} ${reading.unit}`), ...current.auditLog],
    })),
    updateConnection: (connection) => batchMutate((current) => ({
      ...current,
      sourceConnections: current.sourceConnections.map((item) => item.id === connection.id ? connection : item),
      auditLog: [audit("connection", connection.id, "updated", `${connection.platform}: ${connection.status}`), ...current.auditLog],
    })),
    updateUnit: (unit) => batchMutate((current) => ({
      ...current,
      units: current.units.map((item) => item.id === unit.id ? unit : item),
      auditLog: [audit("unit", unit.id, "updated", `Zmieniono ceny i koszty: ${unit.name}`), ...current.auditLog],
    })),
    upsertRate: (rate) => batchMutate((current) => ({
      ...current,
      rates: current.rates.some((item) => item.id === rate.id) ? current.rates.map((item) => item.id === rate.id ? rate : item) : [rate, ...current.rates],
      auditLog: [audit("rate", rate.id, "updated", `${rate.season}: ${rate.pricePerNight} PLN`), ...current.auditLog],
    })),
    deleteRate: (rateId) => batchMutate((current) => ({
      ...current,
      rates: current.rates.filter((item) => item.id !== rateId),
      auditLog: [audit("rate", rateId, "deleted", "Usunięto regułę sezonową"), ...current.auditLog],
    })),
    upsertCostSetting: (cost) => batchMutate((current) => ({
      ...current,
      costSettings: current.costSettings.some((item) => item.id === cost.id) ? current.costSettings.map((item) => item.id === cost.id ? cost : item) : [cost, ...current.costSettings],
      auditLog: [audit("cost", cost.id, "updated", `${cost.label}: ${cost.value}/${cost.unit}`), ...current.auditLog],
    })),
    deleteCostSetting: (costId) => batchMutate((current) => ({
      ...current,
      costSettings: current.costSettings.filter((item) => item.id !== costId),
      auditLog: [audit("cost", costId, "deleted", "Usunięto założenie kosztowe"), ...current.auditLog],
    })),
    updateSettings,
    replaceWithImportedBookings: (
      bookings,
      contacts = [],
      imports = [],
      importedCostSettings = [],
    ) => batchMutate((current) => {
      const existingById = new Map(current.bookings.map((booking) => [booking.id, booking]));
      const created = bookings.filter((booking) => !existingById.has(booking.id));
      const updated = bookings.filter((booking) => existingById.has(booking.id));
      const createdIds = new Set(created.map((booking) => booking.id));
      const tasks = tasksForImportedBookings(created);
      const incomingById = new Map(bookings.map((booking) => [booking.id, booking]));
      const nextBookings = [
        ...created,
        ...current.bookings.map((booking) => {
          const incoming = incomingById.get(booking.id);
          return incoming ? mergeImportedBooking(booking, incoming) : booking;
        }),
      ];
      const existingContacts = new Map(current.consents.map((contact) => [contact.bookingId, contact]));
      const incomingContacts = new Map(contacts.map((contact) => [contact.bookingId, contact]));
      const newContacts = contacts.filter((contact) => (
        createdIds.has(contact.bookingId) && !existingContacts.has(contact.bookingId)
      ));
      const nextContacts = [
        ...newContacts,
        ...current.consents.map((contact) => {
          const incoming = incomingContacts.get(contact.bookingId);
          return incoming ? mergeImportedContact(contact, incoming) : contact;
        }),
      ];
      const incomingImports = new Map(imports.map((item) => [item.id, item]));
      const currentImportIds = new Set(current.imports.map((item) => item.id));
      const nextImports = [
        ...imports.filter((item) => !currentImportIds.has(item.id)),
        ...current.imports.map((item) => {
          const incoming = incomingImports.get(item.id);
          return incoming
            ? { ...item, ...incoming, version: item.version, updatedAt: item.updatedAt }
            : item;
        }),
      ];
      const existingCostIds = new Set(current.costSettings.map((item) => item.id));
      const newCostSettings = importedCostSettings.filter((item) => !existingCostIds.has(item.id));
      const next: AppData = {
        ...current,
        bookings: nextBookings,
        consents: nextContacts,
        tasks: [...tasks, ...current.tasks],
        checklistItems: [...defaultChecklist(tasks), ...current.checklistItems],
        imports: nextImports,
        costSettings: [...newCostSettings, ...current.costSettings],
        auditLog: [audit(
          "import",
          uid("IMP"),
          "committed",
          `Dodano ${created.length} rezerwacji, wzbogacono ${updated.length}, uzgodniono ${imports.length} rekordów OTA`,
        ), ...current.auditLog],
      };
      next.scheduledMessages = reconcileScheduledMessages(next);
      return next;
    }),
    exportSnapshot: async (passphrase) => {
      await downloadEncryptedJson(data, passphrase, `stawy-os-backup-${todayInPoland()}.stawyos`);
    },
    exportPricingAnalysis: () => downloadPricingAnalysisDataset(data, `stawy-os-ceny-ai-${todayInPoland()}.json`),
    resetDemo: () => {
      if (process.env.NODE_ENV === "production") return;
      setData(normalizeData());
      clearPersistedAppData();
    },
  }), [
    batchMutate,
    copyConflictChanges,
    commitBookingMutation,
    createBooking,
    createCalendarBlock,
    createPayment,
    data,
    dataStatus,
    lastSavedAt,
    reloadAfterConflict,
    retryDataLoad,
    syncConflict,
    syncMode,
    updateChecklistItem,
    updateCalendarBlock,
    updateSettings,
    updateTask,
  ]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useAppStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useAppStore must be used inside AppStoreProvider");
  return store;
}
