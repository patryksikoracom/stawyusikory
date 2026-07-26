import { isBookingInTrash } from "@/lib/booking-trash";
import { todayInPoland } from "@/lib/date";
import { formatPolishCount } from "@/lib/polish-plural";
import type { AppData } from "@/lib/types";
import { calculateBookingFinance } from "@/lib/metrics/finance";

export type ShellAlert = {
  id: string;
  icon: "warning" | "wallet" | "cleaning" | "plug";
  title: string;
  body: string;
};

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
  const paymentCount = currentBookings.filter((booking) => {
    const finance = calculateBookingFinance(booking, data.payments);
    return finance.balanceStatus !== "settled" || finance.perspectives.receivables.completeness !== "complete";
  }).length;
  const blockedTaskCount = data.tasks.filter(
    (task) => task.status === "Zablokowane"
      && !(task.type === "Sprzątanie" && task.assignmentStatus === "Odrzucone"),
  ).length;
  const rejectedTurnoverCount = data.tasks.filter(
    (task) => task.type === "Sprzątanie" && task.assignmentStatus === "Odrzucone",
  ).length;
  const unansweredTurnoverCount = data.tasks.filter(
    (task) => task.type === "Sprzątanie"
      && task.assignmentStatus === "Do przyjęcia"
      && Boolean(task.dueDate)
      && task.dueDate! <= today,
  ).length;

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
      body: "Dotyczy bieżących lub nadchodzących rezerwacji z saldem, nadpłatą albo niepełnym dowodem płatności.",
    }] : []),
    ...(rejectedTurnoverCount ? [{
      id: "rejected-turnovers",
      icon: "cleaning" as const,
      title: `${formatPolishCount(rejectedTurnoverCount, "turnover odrzucony", "turnovery odrzucone", "turnoverów odrzuconych")}`,
      body: "Przydziel zlecenie innej osobie albo uzgodnij nowe okno.",
    }] : []),
    ...(unansweredTurnoverCount ? [{
      id: "unanswered-turnovers",
      icon: "cleaning" as const,
      title: `${formatPolishCount(unansweredTurnoverCount, "turnover bez odpowiedzi", "turnovery bez odpowiedzi", "turnoverów bez odpowiedzi")}`,
      body: "Termin już nadszedł, a zlecenie nie zostało przyjęte.",
    }] : []),
    ...(blockedTaskCount ? [{
      id: "blocked-tasks",
      icon: "cleaning" as const,
      title: `${formatPolishCount(blockedTaskCount, "zadanie", "zadania", "zadań")} zablokowane`,
      body: "Otwórz kolejkę zadań i usuń opisane blokady.",
    }] : []),
  ].slice(0, 8);
}
