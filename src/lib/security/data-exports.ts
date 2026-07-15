import type { AppData } from "@/lib/types";
import { nightsBetween } from "@/lib/workflow/rules";

function bytesToBase64(value: Uint8Array) {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function download(content: string, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function downloadEncryptedJson(data: unknown, passphrase: string, filename: string) {
  if (passphrase.length < 12) throw new Error("Hasło kopii musi mieć co najmniej 12 znaków.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: 600_000 },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(JSON.stringify(data)),
  ));
  download(JSON.stringify({
    format: "stawy-os-encrypted-backup",
    version: 1,
    cipher: "AES-256-GCM",
    kdf: { name: "PBKDF2-SHA-256", iterations: 600_000 },
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(ciphertext),
  }), "application/octet-stream", filename);
}

function daysBetween(from?: string, to?: string) {
  if (!from || !to) return undefined;
  const milliseconds = new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime();
  return Number.isFinite(milliseconds) ? Math.round(milliseconds / 86_400_000) : undefined;
}

export function buildPricingAnalysisDataset(data: AppData) {
  const importsByBooking = new Map(data.imports.filter((item) => item.matchedBookingId).map((item) => [item.matchedBookingId!, item]));
  return {
    format: "stawy-os-pricing-analysis",
    version: 1,
    generatedAt: new Date().toISOString(),
    privacy: "Zestaw nie zawiera nazwisk, telefonów, e-maili, treści wiadomości ani notatek gości.",
    units: data.units.map((unit) => ({
      id: unit.id,
      capacity: unit.maxPeople,
      bedrooms: unit.bedrooms,
      defaultPricePerNight: unit.defaultPricePerNight,
      defaultCleaningCost: unit.defaultCleaningCost,
    })),
    bookings: data.bookings.map((booking, index) => {
      const imported = importsByBooking.get(booking.id);
      const nights = nightsBetween(booking.checkIn, booking.checkOut);
      const checkIn = new Date(`${booking.checkIn}T00:00:00Z`);
      return {
        row: index + 1,
        unitId: booking.unitId,
        bookingDate: booking.bookingDate || undefined,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        nights,
        bookingLeadDays: daysBetween(booking.bookingDate, booking.checkIn),
        arrivalYear: checkIn.getUTCFullYear(),
        arrivalMonth: checkIn.getUTCMonth() + 1,
        arrivalWeekday: checkIn.getUTCDay(),
        adults: booking.adults,
        children: booking.children,
        platform: booking.platform,
        currency: booking.currency ?? "PLN",
        grossPrice: booking.grossPrice,
        pricePerNight: booking.pricePerNight ?? (booking.grossPrice && nights ? booking.grossPrice / nights : undefined),
        commission: booking.commission ?? imported?.commission,
        payout: booking.payout ?? imported?.payout,
        paymentStatus: booking.paymentStatus,
        workflowStatus: booking.workflowStatus,
        cancelled: booking.workflowStatus === "Anulowana",
      };
    }),
    rateRules: data.rates.map(({ id, unitId, dateFrom, dateTo, season, pricePerNight, minNights, active }) => ({ id, unitId, dateFrom, dateTo, season, pricePerNight, minNights, active })),
    costSettings: data.costSettings.filter((item) => item.active).map(({ id, unitId, label, value, unit }) => ({ id, unitId, label, value, unit })),
  };
}

export function downloadPricingAnalysisDataset(data: AppData, filename: string) {
  download(JSON.stringify(buildPricingAnalysisDataset(data), null, 2), "application/json", filename);
}
