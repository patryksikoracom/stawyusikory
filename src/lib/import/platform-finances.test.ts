import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parsePlatformFinances } from "./platform-finances";

const mobileHeaders = [
  "ID", "Numer rezerwacji", "Grupa", "Nazwa pomieszczenia", "ID pokoju",
  "Przyjazd", "Wyjazd", "Dorośli", "Dzieci", "Status płatności",
  "Kwota zadatku", "Termin zadatku", "Cena za dobę", "Cena za pobyt",
  "Razem", "Waluta", "Nazwisko", "Imię", "Telefon", "E-mail",
  "Źródło rezerwacji", "Informacje dodatkowe", "Wyżywienie",
  "Porcje Dorośli", "Porcje Dzieci", "Usługi dodatkowe", "Data dodania",
  "Data edycji", "Status",
];

const airbnbHeaders = [
  "Data", "Termin wypłaty", "Typ", "Kod potwierdzenia", "Data rezerwacji",
  "Data rozpoczęcia", "Data zakończenia", "Dni", "Gość", "Oferta",
  "Szczegóły", "Kod referencyjny", "Waluta", "Kwota", "Wypłacono",
  "Opłata serwisowa", "Opłata za szybką płatność", "Opłata za sprzątanie",
  "Opłata za zwierzę", "Zarobki brutto", "Podatek odprowadzany przez Airbnb",
  "Rok wypłaty zarobków",
];

const bookingHeaders = [
  "Typ / typ transakcji", "Opis oświadczenia", "Numer referencyjny",
  "Data zameldowania", "Data wymeldowania", "Data wydania",
  "Status rezerwacji", "Pokoje", "Pokojonoce", "ID obiektu", "Nazwa obiektu",
  "ID podmiotu prawnego", "Nazwa prawna", "Kraj", "Typ wypłaty",
  "Kwota brutto", "Prowizja", "Prowizja (%)", "Opłata za usługę płatniczą",
  "Opłata za usługę płatniczą w %", "VAT", "Podatek", "Kwota transakcji",
  "Waluta transakcji", "Kurs wymiany walut", "Kwota do zapłaty",
  "Kwota wypłaty", "Waluta wypłaty", "Data wypłaty",
  "Częstotliwość wypłat", "Konto bankowe", "Dostawca usług płatniczych",
];

function delimited(
  headers: string[],
  rows: Array<Record<string, string>>,
  delimiter: "," | ";",
) {
  const encode = (value: string) => delimiter === ","
    ? `"${value.replaceAll("\"", "\"\"")}"`
    : value;
  return [
    headers.map(encode).join(delimiter),
    ...rows.map((row) => headers.map((header) => encode(row[header] ?? "")).join(delimiter)),
  ].join("\n");
}

function mobileRow(overrides: Record<string, string> = {}) {
  return {
    ID: "8317321",
    "Numer rezerwacji": "560",
    "Nazwa pomieszczenia": "Czapla",
    Przyjazd: "2026-07-22",
    Wyjazd: "2026-07-26",
    Dorośli: "2",
    Dzieci: "0",
    "Status płatności": "Brak wpłaty",
    "Kwota zadatku": "0",
    "Cena za dobę": "575",
    "Cena za pobyt": "2300",
    Razem: "2300",
    Waluta: "PLN",
    Nazwisko: "Kiszewski",
    Imię: "Sylvia",
    "Źródło rezerwacji": "Inne",
    Wyżywienie: "OV",
    "Porcje Dorośli": "0",
    "Porcje Dzieci": "0",
    "Data dodania": "2026-06-01",
    "Data edycji": "2026-07-26",
    Status: "Rezerwacja",
    ...overrides,
  };
}

describe("platform finance reconciliation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-27T10:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("corrects a Mobile Calendar source and keeps Booking commission and payment fee separate", () => {
    const mobileCalendarRaw = delimited(mobileHeaders, [mobileRow()], ";");
    const bookingRaw = delimited(bookingHeaders, [{
      "Typ / typ transakcji": "Rezerwacja",
      "Opis oświadczenia": "PAYOUT-1",
      "Numer referencyjny": "6441967495",
      "Data zameldowania": "2026-07-22",
      "Data wymeldowania": "2026-07-26",
      "Nazwa obiektu": "Stawy u Sikory - Domek Czapla",
      "Kwota brutto": "2481.33",
      Prowizja: "-248.13",
      "Opłata za usługę płatniczą": "-29.78",
      "Kwota transakcji": "2203.42",
      "Waluta transakcji": "PLN",
      "Data wypłaty": "2026-07-27",
    }], ",");

    const result = parsePlatformFinances({ mobileCalendarRaw, bookingRaw });
    const booking = result.rows[0];
    const imported = result.imports.find((item) => item.matchedBookingId === booking.id);

    expect(booking).toMatchObject({
      platform: "Booking",
      platformReservationNo: "6441967495",
      grossPrice: 2481.33,
      paymentStatus: "Opłacone",
      workflowStatus: "Zamknięta",
      openingPaidAmount: 2481.33,
    });
    expect(imported).toMatchObject({
      commission: 248.13,
      paymentProcessingFee: 29.78,
      totalOtaFees: 277.91,
      payout: 2203.42,
      matchMethod: "unit-dates-source-correction",
      matchConfidence: "Wysokie",
    });
    expect(result.financialSummary).toMatchObject({
      matchedFinancial: 1,
      sourceCorrections: 1,
      otaOnlyBookings: 0,
      historicalSettled: 1,
    });
  });

  it("aggregates split Airbnb earnings and creates a review booking when Mobile Calendar is missing it", () => {
    const mobileCalendarRaw = delimited(mobileHeaders, [mobileRow({
      ID: "1",
      Przyjazd: "2026-08-10",
      Wyjazd: "2026-08-14",
      "Źródło rezerwacji": "własne",
    })], ";");
    const airbnbRaw = delimited(airbnbHeaders, [
      {
        Data: "11/04/2023",
        Typ: "Rezerwacja",
        "Kod potwierdzenia": "HM8MDQPJF9",
        "Data rezerwacji": "10/01/2023",
        "Data rozpoczęcia": "11/03/2023",
        "Data zakończenia": "11/12/2023",
        Gość: "Levente Truczkai",
        Oferta: "Stawy u Sikory. Rybak. Agroturystyka.",
        Waluta: "PLN",
        Kwota: "1746.00",
        "Opłata serwisowa": "54,00",
        "Zarobki brutto": "1800.00",
      },
      {
        Data: "11/06/2023",
        Typ: "Rezerwacja",
        "Kod potwierdzenia": "HM8MDQPJF9",
        "Data rezerwacji": "10/01/2023",
        "Data rozpoczęcia": "11/03/2023",
        "Data zakończenia": "11/12/2023",
        Gość: "Levente Truczkai",
        Oferta: "Stawy u Sikory. Rybak. Agroturystyka.",
        Waluta: "PLN",
        Kwota: "392.85",
        "Opłata serwisowa": "12,15",
        "Zarobki brutto": "405.00",
      },
    ], ",");

    const result = parsePlatformFinances({ mobileCalendarRaw, airbnbRaw });
    const booking = result.rows.find((item) => item.platformReservationNo === "HM8MDQPJF9");
    const imported = result.imports.find((item) => item.reservationNo === "HM8MDQPJF9");

    expect(booking).toMatchObject({
      id: "OTA-AIRBNB-HM8MDQPJF9",
      grossPrice: 2205,
      commission: 66.15,
      payout: 2138.85,
      paymentStatus: "Opłacone",
      needsReview: true,
    });
    expect(imported).toMatchObject({
      grossPrice: 2205,
      hostServiceFee: 66.15,
      totalOtaFees: 66.15,
      matchMethod: "ota-only",
      transferStatus: "Wymaga sprawdzenia",
    });
  });

  it("merges a uniquely overlapping Airbnb stay for the same guest and flags the date discrepancy", () => {
    const mobileCalendarRaw = delimited(mobileHeaders, [mobileRow({
      ID: "3",
      Przyjazd: "2025-12-24",
      Wyjazd: "2025-12-28",
      Imię: "Jenny",
      Nazwisko: "Kapp",
      "Źródło rezerwacji": "Airbnb",
    })], ";");
    const airbnbRaw = delimited(airbnbHeaders, [{
      Data: "12/24/2025",
      Typ: "Rezerwacja",
      "Kod potwierdzenia": "HM5KQ3RZY3",
      "Data rezerwacji": "10/01/2025",
      "Data rozpoczęcia": "12/23/2025",
      "Data zakończenia": "12/28/2025",
      Gość: "Jenny Kapp",
      Oferta: "Stawy u Sikory. Domek Czapla.",
      Waluta: "PLN",
      Kwota: "2721.33",
      "Opłata serwisowa": "84.17",
      "Zarobki brutto": "2805.50",
    }], ",");

    const result = parsePlatformFinances({ mobileCalendarRaw, airbnbRaw });
    const booking = result.rows[0];
    const imported = result.imports.find((item) => item.matchedBookingId === booking.id);

    expect(result.rows).toHaveLength(1);
    expect(booking).toMatchObject({
      id: "MC-3",
      platformReservationNo: "HM5KQ3RZY3",
      grossPrice: 2805.5,
      needsReview: true,
    });
    expect(booking.importWarnings?.join(" ")).toContain("zachowano termin operacyjny");
    expect(imported).toMatchObject({
      matchMethod: "guest-unit-overlap",
      matchConfidence: "Wysokie",
      mobileCalendarGrossPrice: 2300,
    });
    expect(result.financialSummary).toMatchObject({
      matchedFinancial: 1,
      dateDiscrepancyMatches: 1,
      otaOnlyBookings: 0,
    });
  });

  it("marks every completed non-cancelled stay as settled without changing future stays", () => {
    const mobileCalendarRaw = delimited(mobileHeaders, [
      mobileRow(),
      mobileRow({
        ID: "2",
        Przyjazd: "2026-08-10",
        Wyjazd: "2026-08-14",
        "Status płatności": "Brak wpłaty",
      }),
    ], ";");

    const result = parsePlatformFinances({ mobileCalendarRaw });

    expect(result.rows.find((item) => item.id === "MC-8317321")).toMatchObject({
      paymentStatus: "Opłacone",
      workflowStatus: "Zamknięta",
      openingPaidAmount: 2300,
    });
    expect(result.rows.find((item) => item.id === "MC-2")).toMatchObject({
      paymentStatus: "Do dopłaty",
      workflowStatus: "Potwierdzona",
    });
    expect(result.costSettings[0]).toMatchObject({
      platform: "Airbnb",
      value: 3,
      unit: "% przychodu",
      dateFrom: "2026-07-27",
    });
  });
});
