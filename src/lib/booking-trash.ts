import { addLocalDays, todayInPoland } from "@/lib/date";
import type { Booking } from "@/lib/types";

export const BOOKING_TRASH_RETENTION_DAYS = 30;

export function isBookingInTrash(booking: Booking) {
  return Boolean(booking.deletedAt);
}

export function trashExpiryDate(deletedOn = todayInPoland()) {
  return addLocalDays(deletedOn, BOOKING_TRASH_RETENTION_DAYS);
}

export function isTrashExpired(booking: Booking, today = todayInPoland()) {
  return Boolean(booking.deletedAt && (booking.purgeAfter ?? trashExpiryDate(booking.deletedAt.slice(0, 10))) < today);
}

export function daysLeftInTrash(booking: Booking, today = todayInPoland()) {
  if (!booking.deletedAt) return 0;
  const expiry = booking.purgeAfter ?? trashExpiryDate(booking.deletedAt.slice(0, 10));
  return Math.max(0, Math.ceil((new Date(`${expiry}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) / 86_400_000));
}
