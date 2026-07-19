import { isBookingInTrash } from "@/lib/booking-trash";
import { todayInPoland } from "@/lib/date";
import { formatPolishCount } from "@/lib/polish-plural";
import type { AppData } from "@/lib/types";

export type ShellAlert = {
  id: string;
  icon: "warning" | "wallet" | "cleaning" | "plug";
  title: string;
  body: string;
};

const unsettledPaymentStatuses = new Set(["Do uzupełnienia", "Do dopłaty", "Częściowo"]);

function isCurrentBooking(booking: AppData["bookings"][number], today: string) {
  return !isBookingInTrash(booking)
    && !booking.historicalImport
    && booking.workflowStatus !== "Anulowana"
    && booking.checkOut >= today;
}

export function deriveShellAlerts(data: AppData, today = todayInPoland()): ShellAlert[] {
  const connectionAlerts: ShellAlert[] = data.sourceConnections
    .filter((connection) => connection.status !== "Aktywne" || Boolean(connection.lastError))
    .map((connection) => ({
      id: `connection-${connection.id}`,
      icon: "plug",
      title: `${connection.platform}: ${connection.status.toLocaleLowerCase("pl-PL")}`,
      body: connection.lastError || connection.nextStep || "Sprawdź konfigurację połączenia.",
    }));

  const currentBookings = data.bookings.filter((booking) => isCurrentBooking(booking, today));
  const reviewCount = currentBookings.filter((booking) => booking.needsReview).length;
  const paymentCount = currentBookings.filter((booking) => unsettledPaymentStatuses.has(booking.paymentStatus)).length;
  const blockedTaskCount = data.tasks.filter((task) => task.status === "Zablokowane").length;

  return [
    ...connectionAlerts,
    ...(reviewCount ? [{
      id: "bookings-review",
      icon: "warning" as const,
      title: `${formatPolishCount(reviewCount, "rezerwacja", "rezerwacje", "rezerwacji")} do sprawdzenia`,
      body: "Uzupełnij oznaczone rekordy przed użyciem ich w operacjach i raportach.",
    }] : []),
    ...(paymentCount ? [{
      id: "payments-review",
      icon: "wallet" as const,
      title: `${formatPolishCount(paymentCount, "płatność", "płatności", "płatności")} do sprawdzenia`,
      body: "Dotyczy bieżących lub nadchodzących rezerwacji z nieuzgodnionym statusem płatności.",
    }] : []),
    ...(blockedTaskCount ? [{
      id: "blocked-tasks",
      icon: "cleaning" as const,
      title: `${formatPolishCount(blockedTaskCount, "zadanie", "zadania", "zadań")} zablokowane`,
      body: "Otwórz kolejkę zadań i usuń opisane blokady.",
    }] : []),
  ].slice(0, 8);
}
