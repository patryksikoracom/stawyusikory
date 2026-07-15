import { z } from "zod";
import type { Booking, Channel, ContactConsent, PaymentStatus } from "@/lib/types";
import { todayInPoland } from "@/lib/date";

const dateValue = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function money(value: string) {
  if (!value.trim()) return Number.NaN;
  return Number(value.replace(/[^\d,.]/g, "").replace(",", "."));
}

export type ImportPreview = {
  rows: Booking[];
  contacts: ContactConsent[];
  errors: { line: number; message: string }[];
  summary: {
    total: number;
    historical: number;
    active: number;
    needsReview: number;
    plnTotal: number;
    eurTotal: number;
  };
};

function parseDelimited(raw: string, delimiter: string) {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    if (char === '"') {
      if (quoted && raw[index + 1] === '"') { field += '"'; index += 1; }
      else quoted = !quoted;
      continue;
    }
    if (!quoted && char === delimiter) { record.push(field); field = ""; continue; }
    if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && raw[index + 1] === "\n") index += 1;
      record.push(field); field = "";
      if (record.some((value) => value.trim())) records.push(record);
      record = [];
      continue;
    }
    field += char;
  }
  record.push(field);
  if (record.some((value) => value.trim())) records.push(record);
  return records;
}

function emptySummary(rows: Booking[]) {
  return {
    total: rows.length,
    historical: rows.filter((row) => row.historicalImport).length,
    active: rows.filter((row) => !row.historicalImport).length,
    needsReview: rows.filter((row) => row.needsReview).length,
    plnTotal: rows.filter((row) => (row.currency ?? "PLN") === "PLN").reduce((sum, row) => sum + (row.grossPrice ?? 0), 0),
    eurTotal: rows.filter((row) => row.currency === "EUR").reduce((sum, row) => sum + (row.grossPrice ?? 0), 0),
  };
}

function channel(value: string): Channel {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("booking")) return "Booking";
  if (normalized.includes("airbnb")) return "Airbnb";
  if (normalized.includes("strona")) return "Strona www";
  if (normalized === "własne" || normalized === "wlasne") return "Bezpośrednio";
  if (normalized.includes("polecen")) return "Polecenie";
  if (normalized.includes("aloha")) return "Aloha Camp";
  if (normalized.includes("facebook") || normalized.includes("reklama fb")) return "Facebook";
  return "Inne";
}

function payment(value: string, hasPrice: boolean): PaymentStatus {
  if (/całość|calosc|opłac|oplac/i.test(value)) return "Opłacone";
  if (/wpłacony zadatek|wplacony zadatek/i.test(value)) return "Zaliczka";
  return hasPrice ? "Do dopłaty" : "Do uzupełnienia";
}

function numeric(value: string) {
  const parsed = Number(value.trim().replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function fullExport(records: string[][]): ImportPreview {
  const rows: Booking[] = [];
  const contacts: ContactConsent[] = [];
  const errors: ImportPreview["errors"] = [];
  const headers = records[0].map((value) => value.replace(/^\uFEFF/, "").trim());
  const headerIndex = new Map(headers.map((value, index) => [value, index]));
  const get = (record: string[], name: string) => (record[headerIndex.get(name) ?? -1] ?? "").trim();
  const today = todayInPoland();

  records.slice(1).forEach((record, index) => {
    const line = index + 2;
    const externalId = get(record, "ID");
    const checkIn = get(record, "Przyjazd");
    const checkOut = get(record, "Wyjazd");
    const unitLabel = get(record, "Nazwa pomieszczenia");
    if (!externalId || !dateValue.safeParse(checkIn).success || !dateValue.safeParse(checkOut).success || checkOut <= checkIn) {
      errors.push({ line, message: "Brak ID albo nieprawidłowy termin pobytu." });
      return;
    }
    const unitId = /rybaka|rybak/i.test(unitLabel) ? "domek-rybaka" : /czapla/i.test(unitLabel) ? "domek-4" : "";
    if (!unitId) { errors.push({ line, message: `Nieznany domek: ${unitLabel || "brak nazwy"}.` }); return; }
    const adults = Math.max(0, Math.trunc(numeric(get(record, "Dorośli"))));
    const children = Math.max(0, Math.trunc(numeric(get(record, "Dzieci"))));
    const grossPrice = numeric(get(record, "Razem"));
    const stayPrice = numeric(get(record, "Cena za pobyt"));
    const pricePerNight = numeric(get(record, "Cena za dobę"));
    const depositAmount = numeric(get(record, "Kwota zadatku"));
    const paymentLabel = get(record, "Status płatności");
    const paymentStatus = payment(paymentLabel, grossPrice > 0);
    const currency = get(record, "Waluta") === "EUR" ? "EUR" as const : "PLN" as const;
    const services = get(record, "Usługi dodatkowe");
    const serviceFees = Array.from(services.matchAll(/-\s*(\d+(?:[.,]\d+)?)\s*(?:PLN|EUR)/gi)).reduce((sum, match) => sum + numeric(match[1]), 0);
    const difference = Math.round((grossPrice - stayPrice) * 100) / 100;
    const warnings: string[] = [];
    if (stayPrice > 0 && Math.abs(difference) > 0.01 && Math.abs(difference - serviceFees) > 0.01) warnings.push(`Suma różni się od ceny pobytu o ${difference.toLocaleString("pl-PL")} ${currency}.`);
    const capacity = unitId === "domek-rybaka" ? 6 : 4;
    if (adults + children > capacity) warnings.push(`Liczba gości (${adults + children}) przekracza obecną pojemność domku (${capacity}).`);
    if (paymentStatus === "Zaliczka" && depositAmount <= 0) warnings.push("Status wskazuje wpłacony zadatek, ale brak jego kwoty.");
    const firstName = get(record, "Imię");
    const lastName = get(record, "Nazwisko");
    const guestLabel = [firstName, lastName].map((value) => value.trim()).filter(Boolean).join(" ") || `Gość historyczny ${checkIn}`;
    const nonCleaningServices = services.split(",").map((value) => value.trim()).filter((value) => value && !/sprzątanie/i.test(value));
    const notes = [get(record, "Informacje dodatkowe"), ...nonCleaningServices].filter(Boolean).join("\n");
    const historicalImport = checkOut <= today;
    const booking: Booking = {
      id: `MC-${externalId}`,
      bookingDate: get(record, "Data dodania"),
      source: `Mobile Calendar · ${get(record, "Źródło rezerwacji") || "Inne"}`,
      platform: channel(get(record, "Źródło rezerwacji")),
      unitId,
      checkIn,
      checkOut,
      adults,
      children,
      guestLabel,
      grossPrice: grossPrice > 0 ? grossPrice : undefined,
      pricePerNight: pricePerNight > 0 ? pricePerNight : undefined,
      pricingMode: "manual",
      depositAmount: depositAmount > 0 ? depositAmount : undefined,
      depositDueDate: dateValue.safeParse(get(record, "Termin zadatku")).success ? get(record, "Termin zadatku") : undefined,
      currency,
      paymentStatus,
      workflowStatus: checkIn <= today && checkOut > today ? "W trakcie" : historicalImport ? "Zamknięta" : "Potwierdzona",
      specialRequests: notes || undefined,
      createdBy: "Import Mobile Calendar",
      historicalImport,
      needsReview: warnings.length > 0,
      importRef: { source: "mobile-calendar", key: externalId },
      importWarnings: warnings,
      openingPaidAmount: paymentStatus === "Opłacone" ? grossPrice : paymentStatus === "Zaliczka" ? depositAmount : 0,
      version: 1,
    };
    rows.push(booking);
    const phone = get(record, "Telefon");
    const email = get(record, "E-mail");
    if (phone || email) contacts.push({ bookingId: booking.id, phone: phone || undefined, email: email || undefined, marketingConsent: "Do dopytania", photoFbConsent: "Do dopytania", photoSiteAdsConsent: "Do dopytania" });
  });
  return { rows, contacts, errors, summary: emptySummary(rows) };
}

export function parseMobileCalendar(raw: string): ImportPreview {
  const csvRecords = parseDelimited(raw, ";");
  const firstHeaders = csvRecords[0]?.map((value) => value.replace(/^\uFEFF/, "").trim()) ?? [];
  if (firstHeaders.includes("ID") && firstHeaders.includes("Nazwa pomieszczenia") && firstHeaders.includes("Data dodania")) return fullExport(csvRecords);
  const records = raw.split(/\r?\n/).filter((line) => line.trim()).map((line) => line.split(/\t|;/));
  const rows: Booking[] = [];
  const errors: ImportPreview["errors"] = [];
  const today = todayInPoland();
  records.forEach((record, index) => {
    const fields = record.map((value) => value.trim());
    if (index === 0 && /^(numer|reservation|rezerwacja)/i.test(fields[0] ?? "")) return;
    if (fields.length < 6) {
      errors.push({ line: index + 1, message: "Wymagane pola: numer, gość, domek, przyjazd, wyjazd, płatność." });
      return;
    }
    const [reservationNo, guestValue, unitLabel, checkIn, checkOut, paymentLabel, platformLabel = "Inne", priceLabel = "", bookingDateValue = "", adultsValue = "", childrenValue = "", commissionValue = "", payoutValue = "", statusValue = ""] = fields;
    if (!reservationNo || !dateValue.safeParse(checkIn).success || !dateValue.safeParse(checkOut).success || checkOut <= checkIn) {
      errors.push({ line: index + 1, message: "Brak numeru albo nieprawidłowy termin." });
      return;
    }
    const bookingDate = dateValue.safeParse(bookingDateValue).success ? bookingDateValue : "";
    const guestLabel = guestValue && guestValue !== "-" ? guestValue : `Historyczna rezerwacja #${reservationNo}`;
    const unitId = /rybaka|rybak/i.test(unitLabel) ? "domek-rybaka" : "domek-4";
    const paymentStatus: PaymentStatus = /opłac|zapłac|całość/i.test(paymentLabel)
      ? "Opłacone"
      : /zalicz|zadatek/i.test(paymentLabel) ? "Zaliczka" : "Do uzupełnienia";
    const platform = /booking/i.test(platformLabel) ? "Booking" : /airbnb/i.test(platformLabel) ? "Airbnb" : "Inne";
    const price = money(priceLabel);
    const commission = money(commissionValue);
    const payout = money(payoutValue);
    const adults = Math.max(0, Number.parseInt(adultsValue, 10) || 0);
    const children = Math.max(0, Number.parseInt(childrenValue, 10) || 0);
    const cancelled = /anul|cancel/i.test(statusValue);
    rows.push({
      id: `MC-${reservationNo}`,
      bookingDate,
      source: `Mobile-Calendar #${reservationNo}`,
      platform,
      platformReservationNo: reservationNo,
      unitId,
      checkIn,
      checkOut,
      adults,
      children,
      guestLabel,
      grossPrice: Number.isFinite(price) && price > 0 ? price : undefined,
      pricingMode: "manual",
      commission: Number.isFinite(commission) && commission >= 0 ? commission : undefined,
      payout: Number.isFinite(payout) && payout >= 0 ? payout : undefined,
      paymentStatus,
      workflowStatus: cancelled ? "Anulowana" : checkIn <= today && checkOut > today ? "W trakcie" : checkOut <= today ? "Zamknięta" : "Potwierdzona",
      specialRequests: "Zaimportowano z Mobile-Calendar. Rekord wymaga weryfikacji liczby gości, kontaktu i źródła.",
      createdBy: "Import Mobile-Calendar",
      historicalImport: checkOut <= today,
      needsReview: true,
      version: 1,
    });
  });
  return { rows, contacts: [], errors, summary: emptySummary(rows) };
}
