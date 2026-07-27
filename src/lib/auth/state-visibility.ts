import type { UserRole } from "@/lib/types";

type OperationalRecord = {
  entity_type: string;
  entity_id: string;
  payload: unknown;
  record_version?: number;
  updated_at?: string;
};

const financeEntities = new Set(["payments", "invoices", "costSettings"]);
const marketingEntities = new Set([
  "media",
  "messages",
  "messageTemplates",
  "scheduledMessages",
  "marketingTouchpoints",
  "consents",
]);
const viewerEntities = new Set(["units", "bookings", "tasks", "checklistItems", "issues", "blocks", "settings"]);

const piiKeys = /^(guest(Name|Label)?|name|firstName|lastName|email|phone|address|recipient|taxId|companyName)$/i;
const financeKeys = /(amount|price|deposit|balance|paid|cost|commission|currency|revenue|profit|invoice)/i;

function redact(value: unknown, options: { pii: boolean; finance: boolean }): unknown {
  if (Array.isArray(value)) return value.map((item) => redact(item, options));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => (options.pii || !piiKeys.test(key)) && (options.finance || !financeKeys.test(key)))
      .map(([key, item]) => [key, redact(item, options)]),
  );
}

function managerOperationalPayload(record: OperationalRecord) {
  const redacted = redact(record.payload, { pii: true, finance: false });
  if (!redacted || typeof redacted !== "object" || Array.isArray(redacted)) return redacted;
  const source = record.payload && typeof record.payload === "object" && !Array.isArray(record.payload)
    ? record.payload as Record<string, unknown>
    : {};
  const allowedPricingKeys = record.entity_type === "units"
    ? ["defaultPricePerNight"]
    : record.entity_type === "rates"
      ? ["pricePerNight"]
      : record.entity_type === "bookings"
        ? ["grossPrice", "pricePerNight", "pricingMode", "depositAmount", "depositDueDate", "paymentMethod", "currency", "paymentStatus"]
        : [];
  const result = { ...redacted as Record<string, unknown> };
  for (const key of ["commission", "payout", "guestServiceFee", "guestPaidTotal", "openingPaidAmount"]) {
    delete result[key];
  }
  return {
    ...result,
    ...Object.fromEntries(
      allowedPricingKeys
        .filter((key) => source[key] !== undefined)
        .map((key) => [key, source[key]]),
    ),
  };
}

export function visibleOperationalRecord(record: OperationalRecord, role: UserRole): OperationalRecord | null {
  if (role === "owner" || role === "admin") return record;
  if (role === "cleaning") return null;
  if (role === "accounting") {
    if (!financeEntities.has(record.entity_type) && !["bookings", "settings"].includes(record.entity_type)) return null;
    return { ...record, payload: redact(record.payload, { pii: true, finance: true }) };
  }
  if (role === "marketing") {
    if (!marketingEntities.has(record.entity_type)) return null;
    return { ...record, payload: redact(record.payload, { pii: false, finance: false }) };
  }
  if (role === "viewer" && !viewerEntities.has(record.entity_type)) return null;
  if (role === "manager" && financeEntities.has(record.entity_type)) return null;
  if (role === "manager") return { ...record, payload: managerOperationalPayload(record) };
  return { ...record, payload: redact(record.payload, { pii: false, finance: false }) };
}
