import { z } from "zod";
import { operationalChecklistItemSchema } from "./checklist-command";
import { operationalTaskSchema } from "./task-command";

const optionalText = (max: number) => z.string().trim().max(max).optional();
const consentValue = z.enum(["Tak", "Nie", "Do dopytania", "Nie dotyczy"]);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const operationalBookingSchema = z.object({
  id: z.string().trim().min(1).max(128),
  bookingDate: z.iso.date(),
  source: z.string().trim().min(1).max(500),
  platform: z.enum([
    "Bezpośrednio", "Booking", "Airbnb", "Facebook", "Google", "AI/czat",
    "Polecenie", "Telefon", "E-mail", "Strona www", "Agoda", "Expedia",
    "VRBO", "Slowhop", "Aloha Camp", "Influencer/barter", "Inne",
  ]),
  platformReservationNo: optionalText(200),
  unitId: z.string().trim().min(1).max(128),
  checkIn: z.iso.date(),
  checkOut: z.iso.date(),
  arrivalTime: time.optional(),
  departureTime: time.optional(),
  adults: z.number().int().min(1).max(100),
  children: z.number().int().min(0).max(100),
  guestLabel: z.string().trim().min(1).max(500),
  cityArea: optionalText(500),
  grossPrice: z.number().finite().nonnegative().optional(),
  pricePerNight: z.number().finite().nonnegative().optional(),
  pricingMode: z.enum(["rate-card", "manual"]).optional(),
  commission: z.number().finite().nonnegative().optional(),
  payout: z.number().finite().nonnegative().optional(),
  guestPaidTotal: z.number().finite().nonnegative().optional(),
  guestServiceFee: z.number().finite().nonnegative().optional(),
  priceAdjustment: z.number().finite().optional(),
  depositAmount: z.number().finite().nonnegative().optional(),
  depositDueDate: z.iso.date().optional(),
  paymentMethod: z.enum(["Brak", "Przelew", "Gotówka", "Karta", "Online"]).optional(),
  currency: z.enum(["PLN", "EUR"]).optional(),
  paymentStatus: z.enum([
    "Do uzupełnienia", "Zaliczka", "Opłacone", "Częściowo", "Do dopłaty",
    "Anulowane", "Barter",
  ]),
  workflowStatus: z.enum([
    "Nowa", "Potwierdzona", "Przed przyjazdem", "W trakcie", "Po pobycie",
    "Zamknięta", "Anulowana",
  ]),
  specialRequests: optionalText(5_000),
  createdBy: z.string().trim().min(1).max(200),
  version: z.number().int().positive().optional(),
  needsReview: z.boolean().optional(),
  historicalImport: z.boolean().optional(),
  importRef: z.object({
    source: z.literal("mobile-calendar"),
    key: z.string().trim().min(1).max(500),
  }).optional(),
  importWarnings: z.array(z.string().trim().min(1).max(1_000)).max(100).optional(),
  openingPaidAmount: z.number().finite().nonnegative().optional(),
  openingPaidCurrency: z.enum(["PLN", "EUR"]).optional(),
  openingPaidSource: optionalText(500),
  updatedAt: z.iso.datetime().optional(),
  deletedAt: z.iso.datetime().optional(),
  purgeAfter: z.iso.date().optional(),
  workflowStatusBeforeDeletion: z.enum([
    "Nowa", "Potwierdzona", "Przed przyjazdem", "W trakcie", "Po pobycie",
    "Zamknięta", "Anulowana",
  ]).optional(),
}).superRefine((booking, context) => {
  if (booking.checkOut <= booking.checkIn) {
    context.addIssue({
      code: "custom",
      message: "Data wyjazdu musi być późniejsza niż data przyjazdu.",
      path: ["checkOut"],
    });
  }
});

export const operationalContactConsentSchema = z.object({
  bookingId: z.string().trim().min(1).max(128),
  phone: optionalText(100),
  email: z.email().max(320).optional(),
  marketingConsent: consentValue,
  photoFbConsent: consentValue,
  photoSiteAdsConsent: consentValue,
  consentScope: optionalText(2_000),
  consentSource: optionalText(500),
  consentDate: z.iso.date().optional(),
  consentWithdrawnAt: z.iso.datetime().optional(),
  version: z.number().int().positive().optional(),
  updatedAt: z.iso.datetime().optional(),
});

export const operationalScheduledMessageSchema = z.object({
  id: z.string().trim().min(1).max(256),
  bookingId: z.string().trim().min(1).max(128),
  ruleId: z.string().trim().min(1).max(128),
  templateId: z.string().trim().min(1).max(128),
  templateVersion: z.number().int().positive(),
  dueAt: z.iso.datetime({ local: true }),
  channel: z.enum(["SMS", "E-mail", "OTA"]),
  recipient: optionalText(500),
  subject: optionalText(1_000),
  renderedBody: z.string().max(20_000),
  status: z.enum([
    "Wersja robocza", "Zatwierdzona", "Wysłana", "Dostarczona", "Błąd",
    "Anulowana", "Wymaga sprawdzenia",
  ]),
  blockedReason: optionalText(2_000),
  approvedAt: z.iso.datetime().optional(),
  providerResult: optionalText(5_000),
  idempotencyKey: z.string().trim().min(1).max(500),
  bookingFingerprint: z.string().max(2_000),
  statusBeforeBookingDeletion: z.enum([
    "Wersja robocza", "Zatwierdzona", "Wysłana", "Dostarczona", "Błąd",
    "Anulowana", "Wymaga sprawdzenia",
  ]).optional(),
  bookingFingerprintBeforeDeletion: z.string().max(2_000).optional(),
  createdAt: z.iso.datetime(),
  version: z.number().int().positive().optional(),
  updatedAt: z.iso.datetime().optional(),
});

export const bookingAggregateSchema = z.object({
  booking: operationalBookingSchema,
  contact: operationalContactConsentSchema.optional(),
  tasks: z.array(operationalTaskSchema).min(1).max(20),
  checklistItems: z.array(operationalChecklistItemSchema).max(100),
  scheduledMessages: z.array(operationalScheduledMessageSchema).max(50),
});

export const createBookingCommandSchema = z.object({
  aggregate: bookingAggregateSchema,
  requestId: z.string().trim().min(8).max(128),
  clientSentAt: z.iso.datetime(),
  tabId: z.string().trim().min(8).max(128),
}).superRefine(({ aggregate }, context) => {
  const bookingId = aggregate.booking.id;
  const taskIds = new Set<string>();
  for (const [index, task] of aggregate.tasks.entries()) {
    if (taskIds.has(task.id)) {
      context.addIssue({ code: "custom", message: "Identyfikatory zadań muszą być unikalne.", path: ["aggregate", "tasks", index, "id"] });
    }
    taskIds.add(task.id);
    if (task.bookingId !== bookingId || (task.unitId && task.unitId !== aggregate.booking.unitId)) {
      context.addIssue({ code: "custom", message: "Zadanie nie należy do rezerwacji.", path: ["aggregate", "tasks", index] });
    }
  }
  if (aggregate.contact?.bookingId !== undefined && aggregate.contact.bookingId !== bookingId) {
    context.addIssue({ code: "custom", message: "Kontakt nie należy do rezerwacji.", path: ["aggregate", "contact", "bookingId"] });
  }

  const checklistIds = new Set<string>();
  for (const [index, item] of aggregate.checklistItems.entries()) {
    if (checklistIds.has(item.id)) {
      context.addIssue({ code: "custom", message: "Identyfikatory checklisty muszą być unikalne.", path: ["aggregate", "checklistItems", index, "id"] });
    }
    checklistIds.add(item.id);
    if (!taskIds.has(item.taskId)) {
      context.addIssue({ code: "custom", message: "Punkt checklisty nie należy do zadania agregatu.", path: ["aggregate", "checklistItems", index, "taskId"] });
    }
  }

  const messageIds = new Set<string>();
  for (const [index, message] of aggregate.scheduledMessages.entries()) {
    if (messageIds.has(message.id)) {
      context.addIssue({ code: "custom", message: "Identyfikatory wiadomości muszą być unikalne.", path: ["aggregate", "scheduledMessages", index, "id"] });
    }
    messageIds.add(message.id);
    if (message.bookingId !== bookingId) {
      context.addIssue({ code: "custom", message: "Wiadomość nie należy do rezerwacji.", path: ["aggregate", "scheduledMessages", index, "bookingId"] });
    }
  }
});

export const bookingMutationAggregateSchema = z.object({
  booking: operationalBookingSchema,
  contact: operationalContactConsentSchema.optional(),
  tasks: z.array(operationalTaskSchema).max(100),
  scheduledMessages: z.array(operationalScheduledMessageSchema).max(100),
}).superRefine((aggregate, context) => {
  const bookingId = aggregate.booking.id;
  if (!aggregate.booking.version) {
    context.addIssue({
      code: "custom",
      message: "Brak wersji rezerwacji.",
      path: ["booking", "version"],
    });
  }
  if (aggregate.contact && aggregate.contact.bookingId !== bookingId) {
    context.addIssue({
      code: "custom",
      message: "Kontakt nie należy do rezerwacji.",
      path: ["contact", "bookingId"],
    });
  }
  if (aggregate.contact && !aggregate.contact.version) {
    context.addIssue({
      code: "custom",
      message: "Brak wersji kontaktu.",
      path: ["contact", "version"],
    });
  }

  const taskIds = new Set<string>();
  for (const [index, task] of aggregate.tasks.entries()) {
    if (taskIds.has(task.id)) {
      context.addIssue({
        code: "custom",
        message: "Identyfikatory zadań muszą być unikalne.",
        path: ["tasks", index, "id"],
      });
    }
    taskIds.add(task.id);
    if (task.bookingId !== bookingId) {
      context.addIssue({
        code: "custom",
        message: "Zadanie nie należy do rezerwacji.",
        path: ["tasks", index, "bookingId"],
      });
    }
    if (!task.version) {
      context.addIssue({
        code: "custom",
        message: "Brak wersji zadania.",
        path: ["tasks", index, "version"],
      });
    }
  }

  const messageIds = new Set<string>();
  for (const [index, message] of aggregate.scheduledMessages.entries()) {
    if (messageIds.has(message.id)) {
      context.addIssue({
        code: "custom",
        message: "Identyfikatory wiadomości muszą być unikalne.",
        path: ["scheduledMessages", index, "id"],
      });
    }
    messageIds.add(message.id);
    if (message.bookingId !== bookingId) {
      context.addIssue({
        code: "custom",
        message: "Wiadomość nie należy do rezerwacji.",
        path: ["scheduledMessages", index, "bookingId"],
      });
    }
    if (!message.version) {
      context.addIssue({
        code: "custom",
        message: "Brak wersji wiadomości.",
        path: ["scheduledMessages", index, "version"],
      });
    }
  }
});

export const updateBookingCommandSchema = z.object({
  aggregate: bookingMutationAggregateSchema,
  operation: z.enum(["update", "cancel", "trash", "restore"]),
  expectedRecordVersion: z.number().int().positive(),
  requestId: z.string().trim().min(8).max(128),
  clientSentAt: z.iso.datetime(),
  tabId: z.string().trim().min(8).max(128),
}).superRefine((command, context) => {
  const { booking } = command.aggregate;
  if (booking.version !== command.expectedRecordVersion + 1) {
    context.addIssue({
      code: "custom",
      message: "Wersja rezerwacji nie odpowiada wersji oczekiwanej.",
      path: ["aggregate", "booking", "version"],
    });
  }
  if (
    command.operation === "trash"
    && (
      booking.workflowStatus !== "Anulowana"
      || !booking.deletedAt
      || !booking.purgeAfter
      || !booking.workflowStatusBeforeDeletion
    )
  ) {
    context.addIssue({
      code: "custom",
      message: "Komenda kosza nie zawiera pełnego stanu usunięcia.",
      path: ["aggregate", "booking"],
    });
  }
  if (
    command.operation === "restore"
    && (booking.deletedAt || booking.purgeAfter || booking.workflowStatusBeforeDeletion)
  ) {
    context.addIssue({
      code: "custom",
      message: "Przywracana rezerwacja nadal zawiera stan kosza.",
      path: ["aggregate", "booking"],
    });
  }
  if (
    (command.operation === "update" || command.operation === "cancel")
    && (booking.deletedAt || booking.purgeAfter || booking.workflowStatusBeforeDeletion)
  ) {
    context.addIssue({
      code: "custom",
      message: "Zwykła zmiana rezerwacji nie może modyfikować rekordu w koszu.",
      path: ["aggregate", "booking"],
    });
  }
  if (command.operation === "cancel" && booking.workflowStatus !== "Anulowana") {
    context.addIssue({
      code: "custom",
      message: "Komenda anulowania wymaga statusu Anulowana.",
      path: ["aggregate", "booking", "workflowStatus"],
    });
  }
});

export type BookingAggregate = z.infer<typeof bookingAggregateSchema>;
export type BookingMutationAggregate = z.infer<typeof bookingMutationAggregateSchema>;
export type BookingMutationOperation = z.infer<typeof updateBookingCommandSchema>["operation"];
export type CreateBookingCommandResult = {
  status: "committed" | "already_committed" | "exists" | "availability_conflict" | "unit_not_found";
  aggregate?: BookingAggregate;
  conflictType?: "booking" | "block";
  conflictId?: string;
  stateVersion?: number;
  savedAt?: string;
};

export type UpdateBookingCommandResult = {
  status:
    | "committed"
    | "conflict"
    | "not_found"
    | "unit_not_found"
    | "availability_conflict"
    | "related_record_conflict";
  aggregate?: BookingMutationAggregate;
  recordVersion?: number;
  stateVersion?: number;
  savedAt?: string;
  conflictType?: "booking" | "block";
  conflictId?: string;
  conflictEntityType?: "contact" | "task" | "scheduled_message";
  conflictRecordVersion?: number;
};
