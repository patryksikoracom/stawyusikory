import { z } from "zod";

const optionalText = z.string().trim().max(2_000).optional();
const moneyAmount = z.number()
  .finite()
  .positive()
  .max(100_000_000)
  .refine(
    (value) => Math.abs(Math.round(value * 100) - value * 100) < 1e-8,
    "Kwota może mieć najwyżej dwa miejsca po przecinku.",
  );

export const operationalPaymentSchema = z.object({
  id: z.string().trim().min(1).max(128),
  bookingId: z.string().trim().min(1).max(128),
  occurredAt: z.iso.date(),
  type: z.enum(["Wpłata", "Zaliczka", "Zwrot", "Prowizja", "Wypłata OTA", "Koszt"]),
  amount: moneyAmount,
  currency: z.enum(["PLN", "EUR"]),
  status: z.literal("Zaksięgowana"),
  method: z.enum(["Brak", "Przelew", "Gotówka", "Karta", "Online"]).optional(),
  note: optionalText,
  source: optionalText,
  sourceRef: optionalText,
  costCategory: z.enum([
    "Sprzątanie",
    "Energia",
    "Woda",
    "Szambo",
    "Serwis i naprawy",
    "Marketing",
    "Podatki i opłaty",
    "Prowizja OTA",
    "Inne",
  ]).optional(),
  costSettingId: z.string().trim().min(1).max(128).optional(),
  unitId: z.string().trim().min(1).max(128).optional(),
  version: z.number().int().positive().optional(),
  updatedAt: z.iso.datetime().optional(),
}).superRefine((payment, context) => {
  const managementInput = payment.type === "Koszt" || payment.type === "Prowizja";
  if (managementInput && !payment.source) {
    context.addIssue({
      code: "custom",
      path: ["source"],
      message: "Koszt lub prowizja wymaga źródła.",
    });
  }
  if (managementInput && !payment.unitId) {
    context.addIssue({
      code: "custom",
      path: ["unitId"],
      message: "Koszt lub prowizja wymaga domku.",
    });
  }
  if (payment.type === "Prowizja" && payment.costCategory !== "Prowizja OTA") {
    context.addIssue({
      code: "custom",
      path: ["costCategory"],
      message: "Prowizja wymaga kategorii Prowizja OTA.",
    });
  }
  if (payment.type === "Koszt" && (!payment.costCategory || payment.costCategory === "Prowizja OTA")) {
    context.addIssue({
      code: "custom",
      path: ["costCategory"],
      message: "Koszt wymaga właściwej kategorii kosztowej.",
    });
  }
  if (!managementInput && (payment.costCategory || payment.costSettingId || payment.unitId)) {
    context.addIssue({
      code: "custom",
      path: ["type"],
      message: "Pola kosztowe są dozwolone tylko dla kosztu lub prowizji.",
    });
  }
});

export const createPaymentCommandSchema = z.object({
  payment: operationalPaymentSchema,
  requestId: z.string().trim().min(8).max(128),
  clientSentAt: z.iso.datetime(),
  tabId: z.string().trim().min(8).max(128),
});

export type CreatePaymentCommandResult = {
  status:
    | "committed"
    | "already_committed"
    | "conflict"
    | "booking_not_found"
    | "cost_setting_not_found";
  payment?: z.infer<typeof operationalPaymentSchema>;
  recordVersion?: number;
  stateVersion?: number;
  savedAt?: string;
};
