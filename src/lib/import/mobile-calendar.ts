import { z } from "zod";
import type { Booking, PaymentStatus } from "@/lib/types";
import { todayInPoland } from "@/lib/date";

const dateValue = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

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
    if (fields.length < 6) {
      errors.push({ line: index + 1, message: "Wymagane pola: numer, gość, domek, przyjazd, wyjazd, płatność." });
      return;
    }
    const [reservationNo, guestLabel, unitLabel, checkIn, checkOut, paymentLabel, platformLabel = "Inne", priceLabel = ""] = fields;
    if (!reservationNo || !guestLabel || !dateValue.safeParse(checkIn).success || !dateValue.safeParse(checkOut).success || checkOut <= checkIn) {
      errors.push({ line: index + 1, message: "Brak numeru/gościa albo nieprawidłowy termin." });
      return;
    }
    const unitId = /rybaka|rybak/i.test(unitLabel) ? "domek-rybaka" : "domek-4";
    const paymentStatus: PaymentStatus = /opłac|zapłac|całość/i.test(paymentLabel)
      ? "Opłacone"
      : /zalicz|zadatek/i.test(paymentLabel) ? "Zaliczka" : "Do uzupełnienia";
    const platform = /booking/i.test(platformLabel) ? "Booking" : /airbnb/i.test(platformLabel) ? "Airbnb" : "Inne";
    const price = Number(priceLabel.replace(/[^\d,.]/g, "").replace(",", "."));
    rows.push({
      id: `MC-${reservationNo}`,
      bookingDate: "",
      source: `Mobile-Calendar #${reservationNo}`,
      platform,
      platformReservationNo: reservationNo,
      unitId,
      checkIn,
      checkOut,
      adults: 0,
      children: 0,
      guestLabel,
      grossPrice: Number.isFinite(price) && price > 0 ? price : undefined,
      paymentStatus,
      workflowStatus: checkIn <= today && checkOut > today ? "W trakcie" : "Potwierdzona",
      specialRequests: "Zaimportowano z Mobile-Calendar. Rekord wymaga weryfikacji liczby gości, kontaktu i źródła.",
      createdBy: "Import Mobile-Calendar",
      needsReview: true,
      version: 1,
    });
  });
  return { rows, errors };
}
