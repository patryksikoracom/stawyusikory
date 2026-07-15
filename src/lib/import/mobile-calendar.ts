import { z } from "zod";
import type { Booking, PaymentStatus } from "@/lib/types";
import { todayInPoland } from "@/lib/date";

const dateValue = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function money(value: string) {
  if (!value.trim()) return Number.NaN;
  return Number(value.replace(/[^\d,.]/g, "").replace(",", "."));
}

export type ImportPreview = {
  rows: Booking[];
  errors: { line: number; message: string }[];
};

export function parseMobileCalendar(raw: string): ImportPreview {
  const rows: Booking[] = [];
  const errors: ImportPreview["errors"] = [];
  const today = todayInPoland();
  raw.split(/\r?\n/).filter((line) => line.trim()).forEach((line, index) => {
    const fields = line.split(/\t|;/).map((value) => value.trim());
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
  return { rows, errors };
}
