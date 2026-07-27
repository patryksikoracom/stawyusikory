import { z } from "zod";
import {
  operationalBookingSchema,
  operationalContactConsentSchema,
  operationalScheduledMessageSchema,
} from "./booking-command";
import { operationalChecklistItemSchema } from "./checklist-command";
import { operationalTaskSchema } from "./task-command";

export const batchEntityTypes = [
  "units",
  "bookings",
  "guests",
  "consents",
  "tasks",
  "media",
  "rates",
  "costSettings",
  "imports",
  "sourceConnections",
  "invoices",
  "checklistItems",
  "issues",
  "messages",
  "departureDebriefs",
  "scheduledMessages",
  "marketingTouchpoints",
] as const;

export type BatchEntityType = (typeof batchEntityTypes)[number];

const id = z.string().trim().min(1).max(256);
const optionalText = (max: number) => z.string().trim().max(max).optional();
const versionMetadata = {
  version: z.number().int().positive().optional(),
  updatedAt: z.iso.datetime().optional(),
};

const schemas: Record<BatchEntityType, z.ZodType<Record<string, unknown>>> = {
  units: z.object({
    id,
    name: z.string().trim().min(1).max(200),
    maxPeople: z.number().int().positive().max(100),
    bedrooms: z.number().int().nonnegative().max(100),
    defaultPricePerNight: z.number().finite().nonnegative(),
    defaultCleaningCost: z.number().finite().nonnegative(),
    notes: z.string().max(5_000),
    ...versionMetadata,
  }),
  bookings: operationalBookingSchema,
  guests: z.object({
    bookingId: id,
    nps: z.number().int().min(0).max(10).optional(),
    satisfaction: z.number().int().min(0).max(10).optional(),
    ...versionMetadata,
  }).passthrough(),
  consents: operationalContactConsentSchema,
  tasks: operationalTaskSchema,
  media: z.object({
    id,
    bookingId: id,
    type: z.enum(["Zdjęcie", "Wideo", "Cytat", "Opinia", "Post", "Inne"]),
    usageStatus: z.enum(["Do zgody", "Można użyć", "Opublikowane", "Nie używać", "Wygasło/wycofane"]),
    publishChannel: z.string().trim().min(1).max(100),
    privacyRisk: z.string().trim().min(1).max(100),
    ...versionMetadata,
  }).passthrough(),
  rates: z.object({
    id,
    unitId: id,
    dateFrom: z.iso.date().optional(),
    dateTo: z.iso.date().optional(),
    season: z.enum(["Niski", "Średni", "Wysoki", "Święta/długi weekend", "Promocja", "Specjalny"]),
    pricePerNight: z.number().finite().nonnegative(),
    minNights: z.number().int().positive().max(365),
    occupancyTargetPercent: z.number().finite().positive().max(100).optional(),
    active: z.boolean(),
    ...versionMetadata,
  }).superRefine((rate, context) => {
    if (rate.dateFrom && rate.dateTo && rate.dateTo < rate.dateFrom) {
      context.addIssue({ code: "custom", path: ["dateTo"], message: "Koniec stawki poprzedza początek." });
    }
  }),
  costSettings: z.object({
    id,
    unitId: id.optional(),
    label: z.string().trim().min(1).max(300),
    value: z.number().finite().nonnegative(),
    unit: z.enum(["miesiąc", "rok", "pobyt", "noc", "% przychodu"]),
    active: z.boolean(),
    ...versionMetadata,
  }).passthrough(),
  imports: z.object({ id, transferStatus: z.string().trim().min(1).max(100), ...versionMetadata }).passthrough(),
  sourceConnections: z.object({
    id,
    platform: z.enum(["Booking", "Airbnb"]),
    connectionType: z.enum(["API", "iCal", "CSV/email", "Channel manager", "Ręcznie"]),
    status: z.enum(["Aktywne", "Do podłączenia", "Wymaga sprawdzenia", "Ręczny backup", "Błąd"]),
    coverage: z.number().finite().min(0).max(100),
    nextStep: z.string().max(2_000),
    notes: z.string().max(5_000),
    priority: z.enum(["Teraz", "Następne", "Później"]),
    ...versionMetadata,
  }).passthrough(),
  invoices: z.object({
    id,
    bookingId: id.optional(),
    number: z.string().trim().min(1).max(200),
    issuedAt: z.iso.date(),
    amount: z.number().finite().nonnegative(),
    status: z.enum(["Do wystawienia", "Wystawiona", "Opłacona", "Anulowana"]),
    note: optionalText(2_000),
    ...versionMetadata,
  }),
  checklistItems: operationalChecklistItemSchema,
  issues: z.object({
    id,
    title: z.string().trim().min(1).max(500),
    status: z.enum(["Otwarte", "W toku", "Rozwiązane"]),
    createdAt: z.iso.datetime(),
    ...versionMetadata,
  }).passthrough(),
  messages: z.object({
    id,
    channel: z.enum(["SMS", "E-mail", "OTA", "Notatka"]),
    direction: z.enum(["Wychodząca", "Przychodząca"]),
    body: z.string().trim().min(1).max(20_000),
    status: z.enum(["Wersja robocza", "W kolejce", "Wysłana", "Dostarczona", "Błąd"]),
    createdAt: z.iso.datetime(),
    ...versionMetadata,
  }).passthrough(),
  departureDebriefs: z.object({
    id,
    bookingId: id,
    status: z.enum(["Oczekuje", "Ukończony", "Pominięty"]),
    keysSettled: z.boolean(),
    urgentNextArrivalRisk: z.boolean(),
    publicQuotePermission: z.enum(["Tak", "Nie", "Do dopytania"]),
    ...versionMetadata,
  }).passthrough(),
  scheduledMessages: operationalScheduledMessageSchema,
  marketingTouchpoints: z.object({
    id,
    bookingId: id,
    recordedAt: z.iso.datetime(),
    ...versionMetadata,
  }).passthrough(),
};

export const recordBatchChangeSchema = z.object({
  entityType: z.enum(batchEntityTypes),
  entityId: id,
  operation: z.enum(["upsert", "delete"]),
  expectedRecordVersion: z.number().int().nonnegative(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export const recordBatchCommandSchema = z.object({
  changes: z.array(recordBatchChangeSchema).min(1).max(5_000),
  requestId: z.string().trim().min(8).max(128),
  clientSentAt: z.iso.datetime(),
  tabId: z.string().trim().min(8).max(128),
}).superRefine((command, context) => {
  const keys = new Set<string>();
  for (const [index, change] of command.changes.entries()) {
    const key = `${change.entityType}:${change.entityId}`;
    if (keys.has(key)) {
      context.addIssue({ code: "custom", path: ["changes", index], message: "Rekord występuje w paczce więcej niż raz." });
    }
    keys.add(key);
    if (change.operation === "delete") {
      if (change.expectedRecordVersion < 1 || change.payload !== undefined) {
        context.addIssue({ code: "custom", path: ["changes", index], message: "Usunięcie wymaga istniejącej wersji i nie przyjmuje payloadu." });
      }
      continue;
    }
    const parsed = schemas[change.entityType].safeParse(change.payload);
    if (!parsed.success) {
      context.addIssue({ code: "custom", path: ["changes", index, "payload"], message: "Payload rekordu narusza kontrakt domenowy." });
      continue;
    }
    const payloadId = change.entityType === "guests" || change.entityType === "consents"
      ? parsed.data.bookingId
      : parsed.data.id;
    if (payloadId !== change.entityId) {
      context.addIssue({ code: "custom", path: ["changes", index, "entityId"], message: "Identyfikator rekordu nie zgadza się z payloadem." });
    }
  }
});

export type RecordBatchCommandResult = {
  status: "committed" | "already_committed" | "conflict";
  stateVersion?: number;
  savedAt?: string;
  conflict?: {
    entityType: BatchEntityType;
    entityId: string;
    expectedRecordVersion: number;
    currentRecordVersion: number;
  };
  changes?: Array<{
    entityType: BatchEntityType;
    entityId: string;
    operation: "upsert" | "delete";
    recordVersion: number;
  }>;
};
