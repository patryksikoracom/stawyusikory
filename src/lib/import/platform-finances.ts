import { todayInPoland } from "@/lib/date";
import type {
  Booking,
  CostSetting,
  Currency,
  PlatformImport,
} from "@/lib/types";
import {
  parseDelimited,
  parseMobileCalendar,
  type ImportPreview,
} from "./mobile-calendar";

export type PlatformFinanceInput = {
  mobileCalendarRaw: string;
  airbnbRaw?: string;
  bookingRaw?: string;
};

type Match = {
  index: number;
  method: NonNullable<PlatformImport["matchMethod"]>;
  confidence: NonNullable<PlatformImport["matchConfidence"]>;
};

type FinancialValues = {
  platform: "Booking" | "Airbnb";
  reservationNo: string;
  bookingDate?: string;
  checkIn: string;
  checkOut: string;
  unitId: string;
  listing?: string;
  guestName?: string;
  grossPrice?: number;
  guestPaidTotal?: number;
  guestServiceFee?: number;
  priceAdjustment?: number;
  currency: Currency;
  commission?: number;
  hostServiceFee?: number;
  paymentProcessingFee?: number;
  payout?: number;
  payoutDate?: string;
  payoutReference?: string;
  financialAdjustments?: number;
  sourceFile: string;
};

function amount(value: string | undefined) {
  const trimmed = (value ?? "").trim();
  if (!trimmed || trimmed === "-") return undefined;
  const negativeParentheses = /^\(.*\)$/.test(trimmed);
  let normalized = trimmed
    .replace(/[^\d,.\-]/g, "")
    .replace(/^\((.*)\)$/, "$1");
  const comma = normalized.lastIndexOf(",");
  const dot = normalized.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    normalized = comma > dot
      ? normalized.replace(/\./g, "").replace(",", ".")
      : normalized.replace(/,/g, "");
  } else if (comma >= 0) {
    normalized = normalized.replace(",", ".");
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return undefined;
  return negativeParentheses ? -Math.abs(parsed) : parsed;
}

function positive(value: number | undefined) {
  return value != null && Number.isFinite(value) ? Math.max(0, value) : undefined;
}

function moneyTotal(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function absoluteAmount(value: string | undefined) {
  const parsed = amount(value);
  return parsed == null ? undefined : Math.abs(parsed);
}

function isoUsDate(value: string | undefined) {
  const match = (value ?? "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[1]}-${match[2]}` : "";
}

function unitId(value: string | undefined) {
  const normalized = (value ?? "").toLowerCase();
  if (/rybaka|rybak/.test(normalized)) return "domek-rybaka";
  if (normalized.includes("czapla")) return "domek-4";
  return "";
}

function rowObject(headers: string[], record: string[]) {
  return Object.fromEntries(headers.map((header, index) => [
    header.replace(/^\uFEFF/, "").trim(),
    (record[index] ?? "").trim(),
  ]));
}

function compactText(values: Array<string | undefined>) {
  return values.map((value) => value?.trim()).filter(Boolean).join(" · ");
}

function bookingCandidates(rows: Booking[], values: FinancialValues) {
  return rows.map((booking, index) => ({ booking, index })).filter(({ booking }) => (
    booking.unitId === values.unitId
    && booking.checkIn === values.checkIn
    && booking.checkOut === values.checkOut
  ));
}

function nameTokens(value: string | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function likelySameGuest(left: string | undefined, right: string | undefined) {
  const a = nameTokens(left);
  const b = nameTokens(right);
  if (!a.length || !b.length) return false;
  if (a.join(" ") === b.join(" ")) return true;
  const firstMatches = a[0] === b[0]
    || a[0][0] === b[0][0] && (a[0].length === 1 || b[0].length === 1)
    || Math.min(a[0].length, b[0].length) >= 4
      && a[0].slice(0, 5) === b[0].slice(0, 5);
  const lastMatches = a.at(-1) === b.at(-1)
    || a.at(-1)?.[0] === b.at(-1)?.[0]
      && (a.at(-1)?.length === 1 || b.at(-1)?.length === 1);
  return firstMatches && lastMatches;
}

function overlaps(booking: Booking, values: FinancialValues) {
  return booking.checkIn < values.checkOut && values.checkIn < booking.checkOut;
}

function findMatch(rows: Booking[], values: FinancialValues): Match | null {
  const candidates = bookingCandidates(rows, values);
  const samePlatform = candidates.filter(({ booking }) => booking.platform === values.platform);
  if (samePlatform.length === 1) {
    return {
      index: samePlatform[0].index,
      method: "platform-unit-dates",
      confidence: "Pewne",
    };
  }
  if (candidates.length === 1 && candidates[0].booking.platform === "Inne") {
    return {
      index: candidates[0].index,
      method: "unit-dates-source-correction",
      confidence: "Wysokie",
    };
  }
  const overlappingGuest = rows
    .map((booking, index) => ({ booking, index }))
    .filter(({ booking }) => (
      booking.platform === values.platform
      && booking.unitId === values.unitId
      && overlaps(booking, values)
      && likelySameGuest(booking.guestLabel, values.guestName)
    ));
  if (overlappingGuest.length === 1) {
    return {
      index: overlappingGuest[0].index,
      method: "guest-unit-overlap",
      confidence: "Wysokie",
    };
  }
  return null;
}

function settledHistorical(booking: Booking, source: string) {
  if (booking.workflowStatus === "Anulowana" || booking.checkOut > todayInPoland()) return booking;
  return {
    ...booking,
    paymentStatus: "Opłacone" as const,
    workflowStatus: "Zamknięta" as const,
    historicalImport: true,
    openingPaidAmount: booking.grossPrice,
    openingPaidCurrency: booking.grossPrice != null ? booking.currency ?? "PLN" : undefined,
    openingPaidSource: booking.grossPrice != null
      ? `Uzgodnienie migracyjne · odbyty pobyt rozliczony · ${source}`
      : undefined,
  };
}

function financialImport(
  values: FinancialValues,
  booking: Booking,
  match: Pick<Match, "method" | "confidence">,
  mobileCalendarGrossPrice?: number,
): PlatformImport {
  const commission = positive(values.commission);
  const paymentProcessingFee = positive(values.paymentProcessingFee);
  const totalOtaFees = moneyTotal((commission ?? 0) + (paymentProcessingFee ?? 0));
  const missingFields = [
    !values.guestName ? "gość w źródle finansowym" : "",
    commission == null ? "prowizja/opłata gospodarza" : "",
    values.payout == null ? "wypłata netto" : "",
  ].filter(Boolean);
  return {
    id: `OTA-${values.platform.toUpperCase()}-${values.reservationNo}`,
    platform: values.platform,
    importedAt: new Date().toISOString(),
    syncSource: "CSV/email",
    reservationNo: values.reservationNo,
    bookingDate: values.bookingDate,
    status: "Rozliczenie finansowe",
    listing: values.listing,
    guestName: values.guestName || booking.guestLabel,
    checkIn: values.checkIn,
    checkOut: values.checkOut,
    adults: booking.adults,
    children: booking.children,
    grossPrice: values.grossPrice,
    mobileCalendarGrossPrice,
    guestPaidTotal: positive(values.guestPaidTotal) ?? booking.guestPaidTotal,
    guestServiceFee: positive(values.guestServiceFee) ?? booking.guestServiceFee,
    priceAdjustment: values.priceAdjustment ?? booking.priceAdjustment,
    currency: values.currency,
    commission,
    hostServiceFee: positive(values.hostServiceFee),
    paymentProcessingFee,
    totalOtaFees,
    payout: positive(values.payout),
    payoutDate: values.payoutDate,
    payoutReference: values.payoutReference,
    financialAdjustments: values.financialAdjustments,
    paymentStatus: booking.paymentStatus,
    rawSource: compactText([
      values.sourceFile,
      values.payoutReference ? `referencja ${values.payoutReference}` : undefined,
      mobileCalendarGrossPrice != null && values.grossPrice != null
        ? `Mobile Calendar ${mobileCalendarGrossPrice} ${values.currency}; OTA ${values.grossPrice} ${values.currency}`
        : undefined,
    ]),
    missingFields: missingFields.length ? missingFields : undefined,
    dataQuality: missingFields.length ? "Częściowe" : "Pełne",
    matchedBookingId: booking.id,
    matchMethod: match.method,
    matchConfidence: match.confidence,
    sourceFile: values.sourceFile,
    transferStatus: match.confidence === "Do sprawdzenia" ? "Wymaga sprawdzenia" : "Przeniesione",
  };
}

function enrichBooking(booking: Booking, values: FinancialValues, match: Match) {
  const grossPrice = positive(values.grossPrice) ?? booking.grossPrice;
  const dateDiscrepancy = match.method === "guest-unit-overlap"
    ? `Termin Mobile Calendar ${booking.checkIn}–${booking.checkOut} różni się od rozliczenia ${values.platform} ${values.checkIn}–${values.checkOut}; zachowano termin operacyjny z Mobile Calendar.`
    : undefined;
  const next: Booking = {
    ...booking,
    source: booking.source.includes(values.platform)
      ? booking.source
      : `${booking.source} · uzgodniono z ${values.platform}`,
    platform: values.platform,
    platformReservationNo: values.reservationNo,
    grossPrice,
    guestPaidTotal: positive(values.guestPaidTotal) ?? booking.guestPaidTotal,
    guestServiceFee: positive(values.guestServiceFee) ?? booking.guestServiceFee,
    priceAdjustment: values.priceAdjustment ?? booking.priceAdjustment,
    commission: positive(values.commission),
    payout: positive(values.payout),
    currency: values.currency,
    needsReview: booking.needsReview || Boolean(dateDiscrepancy),
    importWarnings: dateDiscrepancy
      ? [...(booking.importWarnings ?? []), dateDiscrepancy]
      : booking.importWarnings,
  };
  return settledHistorical(next, values.sourceFile);
}

function otaOnlyBooking(values: FinancialValues) {
  const grossPrice = positive(values.grossPrice);
  const booking: Booking = {
    id: `OTA-${values.platform.toUpperCase()}-${values.reservationNo}`,
    bookingDate: values.bookingDate || values.checkIn,
    source: `${values.platform} · ${values.sourceFile}`,
    platform: values.platform,
    platformReservationNo: values.reservationNo,
    unitId: values.unitId,
    checkIn: values.checkIn,
    checkOut: values.checkOut,
    adults: 1,
    children: 0,
    guestLabel: values.guestName || `Rezerwacja ${values.platform} #${values.reservationNo}`,
    grossPrice,
    guestPaidTotal: positive(values.guestPaidTotal),
    guestServiceFee: positive(values.guestServiceFee),
    priceAdjustment: values.priceAdjustment,
    commission: positive(values.commission),
    payout: positive(values.payout),
    currency: values.currency,
    pricingMode: "manual",
    paymentStatus: "Opłacone",
    workflowStatus: "Zamknięta",
    createdBy: `Import ${values.platform}`,
    historicalImport: true,
    needsReview: true,
    importWarnings: [
      "Rezerwacja występuje w rozliczeniu OTA, ale nie ma jej w eksporcie Mobile Calendar.",
      "Liczba gości i dane kontaktowe wymagają uzupełnienia.",
    ],
    openingPaidAmount: grossPrice,
    openingPaidCurrency: grossPrice != null ? values.currency : undefined,
    openingPaidSource: grossPrice != null
      ? `Uzgodnienie migracyjne · odbyty pobyt rozliczony · ${values.sourceFile}`
      : undefined,
    version: 1,
  };
  return booking;
}

function airbnbValues(raw: string, errors: ImportPreview["errors"]) {
  if (!raw.trim()) return {
    reservations: [] as FinancialValues[],
    adjustments: [] as PlatformImport[],
    reservationRows: 0,
  };
  const records = parseDelimited(raw, ",");
  const headers = records[0]?.map((value) => value.replace(/^\uFEFF/, "").trim()) ?? [];
  if (!headers.includes("Kod potwierdzenia") || !headers.includes("Zarobki brutto")) {
    errors.push({ line: 1, message: "Plik Airbnb nie ma oczekiwanych kolumn rozliczenia." });
    return { reservations: [], adjustments: [], reservationRows: 0 };
  }
  const rows = records.slice(1).map((record) => rowObject(headers, record));
  const payoutDates = new Map<string, string[]>();
  for (const row of rows.filter((item) => item["Typ"] === "Payout")) {
    const transactionDate = isoUsDate(row["Data"]);
    const payoutDate = isoUsDate(row["Termin wypłaty"]);
    if (!transactionDate || !payoutDate) continue;
    payoutDates.set(transactionDate, [...(payoutDates.get(transactionDate) ?? []), payoutDate]);
  }

  const grouped = new Map<string, Record<string, string>[]>();
  for (const row of rows.filter((item) => item["Typ"] === "Rezerwacja")) {
    const reservationNo = row["Kod potwierdzenia"];
    if (!reservationNo) continue;
    grouped.set(reservationNo, [...(grouped.get(reservationNo) ?? []), row]);
  }
  const reservations: FinancialValues[] = [];
  for (const [reservationNo, group] of grouped) {
    const first = group[0];
    const checkIn = isoUsDate(first["Data rozpoczęcia"]);
    const checkOut = isoUsDate(first["Data zakończenia"]);
    const mappedUnit = unitId(first["Oferta"]);
    if (!checkIn || !checkOut || !mappedUnit) {
      errors.push({ line: 1, message: `Airbnb ${reservationNo}: brak poprawnego terminu albo domku.` });
      continue;
    }
    const dates = group.flatMap((row) => payoutDates.get(isoUsDate(row["Data"])) ?? []);
    reservations.push({
      platform: "Airbnb",
      reservationNo,
      bookingDate: isoUsDate(first["Data rezerwacji"]) || undefined,
      checkIn,
      checkOut,
      unitId: mappedUnit,
      listing: first["Oferta"],
      guestName: first["Gość"],
      grossPrice: moneyTotal(group.reduce((sum, row) => sum + (amount(row["Zarobki brutto"]) ?? 0), 0)),
      currency: first["Waluta"] === "EUR" ? "EUR" : "PLN",
      commission: moneyTotal(group.reduce((sum, row) => sum + Math.abs(amount(row["Opłata serwisowa"]) ?? 0), 0)),
      hostServiceFee: moneyTotal(group.reduce((sum, row) => sum + Math.abs(amount(row["Opłata serwisowa"]) ?? 0), 0)),
      paymentProcessingFee: moneyTotal(group.reduce((sum, row) => sum + Math.abs(amount(row["Opłata za szybką płatność"]) ?? 0), 0)),
      payout: moneyTotal(group.reduce((sum, row) => sum + (amount(row["Kwota"]) ?? 0), 0)),
      payoutDate: dates.sort().at(-1),
      sourceFile: "airbnb_.csv",
    });
  }
  const adjustments = rows
    .filter((row) => row["Typ"] !== "Rezerwacja" && row["Typ"] !== "Payout")
    .map((row, index): PlatformImport => ({
      id: `OTA-AIRBNB-ADJUSTMENT-${row["Kod potwierdzenia"] || index + 1}-${isoUsDate(row["Data"]) || index + 1}`,
      platform: "Airbnb",
      importedAt: new Date().toISOString(),
      syncSource: "CSV/email",
      reservationNo: row["Kod potwierdzenia"] || undefined,
      bookingDate: isoUsDate(row["Data rezerwacji"]) || undefined,
      status: row["Typ"],
      listing: row["Oferta"] || undefined,
      guestName: row["Gość"] || undefined,
      checkIn: isoUsDate(row["Data rozpoczęcia"]) || undefined,
      checkOut: isoUsDate(row["Data zakończenia"]) || undefined,
      currency: row["Waluta"] || "PLN",
      financialAdjustments: amount(row["Kwota"]),
      rawSource: `airbnb_.csv · ${row["Typ"]} · ${row["Kwota"]} ${row["Waluta"]}`,
      missingFields: ["potwierdzenie, czy korektę przypisać do wyniku zarządczego"],
      dataQuality: "Minimalne",
      matchMethod: "ota-only",
      matchConfidence: "Do sprawdzenia",
      sourceFile: "airbnb_.csv",
      transferStatus: "Wymaga sprawdzenia",
    }));
  return {
    reservations,
    adjustments,
    reservationRows: rows.filter((row) => row["Typ"] === "Rezerwacja").length,
  };
}

function bookingValues(raw: string, errors: ImportPreview["errors"]) {
  if (!raw.trim()) return {
    reservations: [] as FinancialValues[],
    adjustments: [] as PlatformImport[],
    reservationRows: 0,
  };
  const records = parseDelimited(raw, ",");
  const headers = records[0]?.map((value) => value.replace(/^\uFEFF/, "").trim()) ?? [];
  if (!headers.includes("Numer referencyjny") || !headers.includes("Prowizja")) {
    errors.push({ line: 1, message: "Plik Booking nie ma oczekiwanych kolumn rozliczenia." });
    return { reservations: [], adjustments: [], reservationRows: 0 };
  }
  const rows = records.slice(1).map((record) => rowObject(headers, record));
  const reservationRows = rows.filter((row) => row["Typ / typ transakcji"] === "Rezerwacja");
  const adjustmentsByPayout = new Map<string, number>();
  for (const row of rows.filter((item) => item["Typ / typ transakcji"] === "Korekta prowizji")) {
    const reference = row["Opis oświadczenia"];
    if (!reference) continue;
    adjustmentsByPayout.set(
      reference,
      (adjustmentsByPayout.get(reference) ?? 0) + (amount(row["Kwota transakcji"]) ?? 0),
    );
  }
  const reservations = reservationRows.flatMap((row): FinancialValues[] => {
    const reservationNo = row["Numer referencyjny"];
    const mappedUnit = unitId(row["Nazwa obiektu"]);
    const checkIn = row["Data zameldowania"];
    const checkOut = row["Data wymeldowania"];
    if (!reservationNo || !mappedUnit || !/^\d{4}-\d{2}-\d{2}$/.test(checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut)) {
      errors.push({ line: 1, message: `Booking ${reservationNo || "bez numeru"}: brak poprawnego terminu albo domku.` });
      return [];
    }
    const payoutReference = row["Opis oświadczenia"] || undefined;
    return [{
      platform: "Booking",
      reservationNo,
      checkIn,
      checkOut,
      unitId: mappedUnit,
      listing: row["Nazwa obiektu"],
      grossPrice: positive(amount(row["Kwota brutto"])),
      currency: row["Waluta transakcji"] === "EUR" ? "EUR" : "PLN",
      commission: absoluteAmount(row["Prowizja"]),
      paymentProcessingFee: absoluteAmount(row["Opłata za usługę płatniczą"]),
      payout: positive(amount(row["Kwota transakcji"])),
      payoutDate: /^\d{4}-\d{2}-\d{2}$/.test(row["Data wypłaty"]) ? row["Data wypłaty"] : undefined,
      payoutReference,
      financialAdjustments: payoutReference ? adjustmentsByPayout.get(payoutReference) : undefined,
      sourceFile: "Payout_from_2019-01-01_until_2026-07-27.csv",
    }];
  });
  const matchedReferences = new Set(reservations.map((item) => item.payoutReference).filter(Boolean));
  const adjustments = rows
    .filter((row) => row["Typ / typ transakcji"] === "Korekta prowizji")
    .filter((row) => !matchedReferences.has(row["Opis oświadczenia"]))
    .map((row, index): PlatformImport => ({
      id: `OTA-BOOKING-ADJUSTMENT-${row["Opis oświadczenia"] || index + 1}`,
      platform: "Booking",
      importedAt: new Date().toISOString(),
      syncSource: "CSV/email",
      status: row["Typ / typ transakcji"],
      listing: row["Nazwa obiektu"] || undefined,
      currency: row["Waluta transakcji"] || row["Waluta wypłaty"] || "PLN",
      financialAdjustments: amount(row["Kwota transakcji"]),
      payoutDate: row["Data wypłaty"] || undefined,
      payoutReference: row["Opis oświadczenia"] || undefined,
      rawSource: `Payout_from_2019-01-01_until_2026-07-27.csv · korekta ${row["Kwota transakcji"]} ${row["Waluta transakcji"]}`,
      missingFields: ["rezerwacja powiązana z korektą"],
      dataQuality: "Minimalne",
      matchMethod: "ota-only",
      matchConfidence: "Do sprawdzenia",
      sourceFile: "Payout_from_2019-01-01_until_2026-07-27.csv",
      transferStatus: "Wymaga sprawdzenia",
    }));
  return { reservations, adjustments, reservationRows: reservationRows.length };
}

function airbnbCurrentFee(): CostSetting {
  return {
    id: "COMMISSION-AIRBNB-SPLIT-FEE-3-20260727",
    label: "Airbnb · opłata gospodarza w modelu dzielonym",
    value: 3,
    unit: "% przychodu",
    notes: "Obecne ustawienie podane przez właściciela: Airbnb obniża zarobek gospodarza o 3%. Faktyczna opłata z importu ma pierwszeństwo.",
    active: true,
    kind: "commission",
    category: "Prowizja OTA",
    currency: "PLN",
    source: "Ustawienie Airbnb przekazane przez właściciela · 2026-07-27",
    dateFrom: "2026-07-27",
    dateTo: "2099-12-31",
    platform: "Airbnb",
    allocation: "revenue",
  };
}

function mobileOnlyImport(booking: Booking): PlatformImport {
  return {
    id: `MC-OTA-${booking.id}`,
    platform: booking.platform as "Booking" | "Airbnb",
    importedAt: new Date().toISOString(),
    syncSource: "CSV/email",
    reservationNo: booking.platformReservationNo,
    bookingDate: booking.bookingDate,
    status: booking.workflowStatus,
    guestName: booking.guestLabel,
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    adults: booking.adults,
    children: booking.children,
    grossPrice: booking.grossPrice,
    mobileCalendarGrossPrice: booking.grossPrice,
    currency: booking.currency,
    paymentStatus: booking.paymentStatus,
    rawSource: "mobile-calendar-export.csv · brak odpowiadającego rozliczenia finansowego OTA",
    missingFields: ["numer rezerwacji OTA", "prowizja/opłata gospodarza", "wypłata netto"],
    dataQuality: "Częściowe",
    matchedBookingId: booking.id,
    matchMethod: "mobile-calendar-only",
    matchConfidence: "Pewne",
    sourceFile: "mobile-calendar-export.csv",
    transferStatus: "Przeniesione",
  };
}

export function parsePlatformFinances(input: PlatformFinanceInput): ImportPreview {
  const preview = parseMobileCalendar(input.mobileCalendarRaw);
  const rows = [...preview.rows];
  const settledBefore = rows.filter((row) => (
    row.checkOut <= todayInPoland()
    && row.workflowStatus !== "Anulowana"
    && row.paymentStatus === "Opłacone"
  )).length;
  const imports: PlatformImport[] = [];
  const errors = [...preview.errors];
  const airbnb = airbnbValues(input.airbnbRaw ?? "", errors);
  const booking = bookingValues(input.bookingRaw ?? "", errors);
  let matchedFinancial = 0;
  let sourceCorrections = 0;
  let dateDiscrepancyMatches = 0;
  let otaOnlyBookings = 0;

  for (const values of [...airbnb.reservations, ...booking.reservations]) {
    const match = findMatch(rows, values);
    if (match) {
      const original = rows[match.index];
      const originalGross = original.grossPrice;
      rows[match.index] = enrichBooking(original, values, match);
      imports.push(financialImport(values, rows[match.index], match, originalGross));
      matchedFinancial += 1;
      if (match.method === "unit-dates-source-correction") sourceCorrections += 1;
      if (match.method === "guest-unit-overlap") dateDiscrepancyMatches += 1;
      continue;
    }
    const bookingOnly = otaOnlyBooking(values);
    rows.push(bookingOnly);
    imports.push(financialImport(
      values,
      bookingOnly,
      { method: "ota-only", confidence: "Do sprawdzenia" },
    ));
    otaOnlyBookings += 1;
  }

  for (let index = 0; index < rows.length; index += 1) {
    rows[index] = settledHistorical(rows[index], "mobile-calendar-export.csv");
  }
  const settledAfter = rows.filter((row) => (
    row.checkOut <= todayInPoland()
    && row.workflowStatus !== "Anulowana"
    && row.paymentStatus === "Opłacone"
  )).length;

  const matchedBookingIds = new Set(imports.map((item) => item.matchedBookingId).filter(Boolean));
  for (const row of rows) {
    if (
      (row.platform === "Booking" || row.platform === "Airbnb")
      && !matchedBookingIds.has(row.id)
    ) {
      imports.push(mobileOnlyImport(row));
    }
  }
  imports.push(...airbnb.adjustments, ...booking.adjustments);

  const summary = {
    total: rows.length,
    historical: rows.filter((row) => row.historicalImport).length,
    active: rows.filter((row) => !row.historicalImport).length,
    needsReview: rows.filter((row) => row.needsReview).length,
    plnTotal: rows
      .filter((row) => (row.currency ?? "PLN") === "PLN")
      .reduce((sum, row) => sum + (row.grossPrice ?? 0), 0),
    eurTotal: rows
      .filter((row) => row.currency === "EUR")
      .reduce((sum, row) => sum + (row.grossPrice ?? 0), 0),
  };
  const financialImports = imports.filter((item) => (
    item.matchedBookingId && item.sourceFile !== "mobile-calendar-export.csv"
  ));
  return {
    rows,
    contacts: preview.contacts,
    imports,
    costSettings: [airbnbCurrentFee()],
    errors,
    summary,
    financialSummary: {
      airbnbReservations: airbnb.reservationRows,
      bookingReservations: booking.reservationRows,
      matchedFinancial,
      sourceCorrections,
      dateDiscrepancyMatches,
      otaOnlyBookings,
      historicalSettled: Math.max(0, settledAfter - settledBefore),
      financialReview: imports.filter((item) => item.transferStatus === "Wymaga sprawdzenia").length,
      plnGross: moneyTotal(financialImports
        .filter((item) => item.currency === "PLN")
        .reduce((sum, item) => sum + (item.grossPrice ?? 0), 0)),
      plnCommission: moneyTotal(financialImports
        .filter((item) => item.currency === "PLN")
        .reduce((sum, item) => sum + (item.commission ?? 0), 0)),
      plnPaymentProcessing: moneyTotal(financialImports
        .filter((item) => item.currency === "PLN")
        .reduce((sum, item) => sum + (item.paymentProcessingFee ?? 0), 0)),
      plnPayout: moneyTotal(financialImports
        .filter((item) => item.currency === "PLN")
        .reduce((sum, item) => sum + (item.payout ?? 0), 0)),
    },
  };
}
