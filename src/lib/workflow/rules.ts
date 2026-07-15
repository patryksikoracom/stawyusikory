import type {
  AppData,
  Booking,
  CalendarBlock,
  MediaAsset,
  OpsTask,
  Unit,
} from "../types";
import { addLocalDays, dateDiffDays, todayInPoland } from "../date";

export function nightsBetween(checkIn?: string, checkOut?: string) {
  if (!checkIn || !checkOut) return 0;
  return Math.max(0, dateDiffDays(checkIn, checkOut));
}

export function overlaps(aStart?: string, aEnd?: string, bStart?: string, bEnd?: string) {
  if (!aStart || !aEnd || !bStart || !bEnd) return false;
  return aStart < bEnd && aEnd > bStart;
}

export function calendarBarPlacement(checkIn: string, checkOut: string, anchor: string, daysCount: number, dayWidth: number) {
  const rawStart = dateDiffDays(anchor, checkIn);
  const rawFinish = dateDiffDays(anchor, checkOut);
  const start = Math.max(0, rawStart);
  const finish = Math.min(daysCount, rawFinish);
  const halfDay = dayWidth / 2;
  return {
    start,
    span: Math.max(1, finish - start),
    marginLeft: rawStart >= 0 && rawStart < daysCount ? halfDay + 2 : 2,
    marginRight: rawFinish === 0 ? halfDay + 2 : rawFinish > 0 && rawFinish < daysCount ? -(halfDay - 2) : 2,
  };
}

export function boundaryTimesOverlap(booking: Booking, candidate: Booking) {
  if (booking.checkIn === candidate.checkOut && booking.arrivalTime && candidate.departureTime) {
    return timeInMinutes(booking.arrivalTime) < timeInMinutes(candidate.departureTime);
  }
  if (booking.checkOut === candidate.checkIn && booking.departureTime && candidate.arrivalTime) {
    return timeInMinutes(candidate.arrivalTime) < timeInMinutes(booking.departureTime);
  }
  return false;
}

function timeInMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return Number.POSITIVE_INFINITY;
  return hours * 60 + minutes;
}

export function unitName(units: Unit[], unitId?: string) {
  return units.find((unit) => unit.id === unitId)?.name ?? "Nieznany domek";
}

export function getBookingConflicts(bookings: Booking[], blocks: CalendarBlock[], booking: Booking) {
  if (!booking.unitId || !booking.checkIn || !booking.checkOut) return [];

  const bookingConflicts = bookings
    .filter((candidate) => candidate.id !== booking.id)
    .filter((candidate) => candidate.unitId === booking.unitId)
    .filter((candidate) => candidate.workflowStatus !== "Anulowana")
    .filter((candidate) => overlaps(booking.checkIn, booking.checkOut, candidate.checkIn, candidate.checkOut) || boundaryTimesOverlap(booking, candidate))
    .map((candidate) => boundaryTimesOverlap(booking, candidate)
      ? `Godziny nachodzą się z rezerwacją ${candidate.id}`
      : `Konflikt z rezerwacją ${candidate.id}`);

  const blockConflicts = blocks
    .filter((block) => block.unitId === booking.unitId)
    .filter((block) => block.status !== "Anulowana" && block.status !== "Zakończona")
    .filter((block) => overlaps(booking.checkIn, booking.checkOut, block.dateFrom, block.dateTo))
    .map((block) => `Blokada: ${block.reason}`);

  return [...bookingConflicts, ...blockConflicts];
}

export function canConfirm(data: AppData, booking: Booking) {
  const missing = [];
  if (!booking.unitId) missing.push("brak domku");
  if (!booking.checkIn) missing.push("brak daty przyjazdu");
  if (!booking.checkOut) missing.push("brak daty wyjazdu");
  if (getBookingConflicts(data.bookings, data.blocks, booking).length > 0) {
    missing.push("konflikt kalendarza");
  }
  return { ok: missing.length === 0, missing };
}

export function canClose(data: AppData, booking: Booking) {
  const blockingTasks = data.tasks.filter(
    (task) =>
      task.bookingId === booking.id &&
      ["Opinia", "Content", "Płatność"].includes(task.type) &&
      !["Zrobione", "Nie dotyczy"].includes(task.status),
  );
  return { ok: blockingTasks.length === 0, blockingTasks };
}

export function createTasksForBooking(booking: Booking): OpsTask[] {
  const base = `${booking.id}-${Date.now()}`;
  return [
    {
      id: `${base}-pay`,
      bookingId: booking.id,
      type: "Płatność",
      priority: booking.paymentStatus === "Do uzupełnienia" ? "Wysoki" : "Średni",
      status: "Do zrobienia",
      dueDate: booking.depositDueDate || addLocalDays(booking.checkIn, -3),
      owner: "Patryk",
      unitId: booking.unitId,
      title: "Sprawdzić/uzupełnić płatność i zaliczkę.",
    },
    {
      id: `${base}-prep`,
      bookingId: booking.id,
      type: "Przed przyjazdem",
      priority: "Wysoki",
      status: "Do zrobienia",
      dueDate: addLocalDays(booking.checkIn, -1),
      owner: "Operacje",
      unitId: booking.unitId,
      title: "Przygotować domek i sprawdzić godzinę przyjazdu.",
    },
    {
      id: `${base}-review`,
      bookingId: booking.id,
      type: "Opinia",
      priority: "Wysoki",
      status: "Do zrobienia",
      dueDate: addLocalDays(booking.checkOut, 1),
      owner: "Patryk",
      unitId: booking.unitId,
      title: "Poprosić o opinię po pobycie.",
    },
    {
      id: `${base}-clean`,
      bookingId: booking.id,
      type: "Sprzątanie",
      priority: "Wysoki",
      status: "Do zrobienia",
      dueDate: booking.checkOut,
      owner: "Pani Ewa",
      unitId: booking.unitId,
      title: "Wykonać turnover domku po wyjeździe.",
    },
    {
      id: `${base}-consent`,
      bookingId: booking.id,
      type: "Content",
      priority: "Średni",
      status: "Do zrobienia",
      owner: "Patryk",
      unitId: booking.unitId,
      title: "Dopytać o zgody na zdjęcia/content, jeśli pojawiły się materiały.",
    },
  ];
}

export function rescheduleOpenTasksForBooking(tasks: OpsTask[], booking: Booking) {
  return tasks.map((task) => {
    if (task.bookingId !== booking.id || ["Zrobione", "Nie dotyczy"].includes(task.status)) return task;
    if (task.type === "Naprawa") return task;
    const dueDate = task.type === "Płatność" ? booking.depositDueDate || addLocalDays(booking.checkIn, -3)
      : task.type === "Przed przyjazdem" ? addLocalDays(booking.checkIn, -1)
        : task.type === "Opinia" ? addLocalDays(booking.checkOut, 1)
          : task.type === "Sprzątanie" ? booking.checkOut
            : undefined;
    return { ...task, unitId: booking.unitId, dueDate: dueDate ?? task.dueDate };
  });
}

export function cancelOpenStayTasks(tasks: OpsTask[], bookingId: string) {
  return tasks.map((task) => task.bookingId === bookingId
    && task.type !== "Naprawa"
    && !["Zrobione", "Nie dotyczy"].includes(task.status)
    ? { ...task, status: "Nie dotyczy" as const }
    : task);
}

export type CheckItem = {
  label: string;
  count: number;
  where: string;
  why: string;
  severity: "critical" | "warning" | "info";
};

export function getChecks(data: AppData): CheckItem[] {
  const today = todayInPoland();
  const conflicts = data.bookings.filter(
    (booking) => getBookingConflicts(data.bookings, data.blocks, booking).length > 0,
  ).length;

  return [
    {
      label: "Pobyty bez daty rezerwacji",
      count: data.bookings.filter((booking) => !booking.bookingDate).length,
      where: "Rezerwacje",
      why: "Bez tego nie policzysz wyprzedzenia rezerwacji.",
      severity: "warning",
    },
    {
      label: "Brakujące daty przyjazdu/wyjazdu",
      count: data.bookings.filter((booking) => !booking.checkIn || !booking.checkOut).length,
      where: "Rezerwacje",
      why: "Bez tego nie policzysz nocy, sezonowości ani konfliktów.",
      severity: "critical",
    },
    {
      label: "Potencjalne konflikty rezerwacji",
      count: conflicts,
      where: "Kalendarz",
      why: "Największe ryzyko operacyjne: ten sam domek w nachodzących terminach.",
      severity: "critical",
    },
    {
      label: "Pobyty bez ceny brutto",
      count: data.bookings.filter((booking) => !booking.grossPrice).length,
      where: "Finanse",
      why: "Bez tego nie policzysz ceny/noc ani marży.",
      severity: "warning",
    },
    {
      label: "Pobyty bez statusu płatności",
      count: data.bookings.filter((booking) => booking.paymentStatus === "Do uzupełnienia").length,
      where: "Operacje",
      why: "To podstawowy check przed przyjazdem.",
      severity: "critical",
    },
    {
      label: "Dzieci bez wieku/opisu",
      count: data.bookings.filter((booking) => {
        const profile = data.guests.find((guest) => guest.bookingId === booking.id);
        return booking.children > 0 && !profile?.childrenAges;
      }).length,
      where: "Profil gościa",
      why: "Wiek dzieci jest ważny dla person i oferty rodzinnej.",
      severity: "info",
    },
    {
      label: "Media bez jasnej zgody",
      count: data.media.filter((asset) => asset.usageStatus === "Do zgody" || !asset.consentScope)
        .length,
      where: "Media",
      why: "Facebook, strona i reklama to różne zakresy użycia.",
      severity: "critical",
    },
    {
      label: "Zadania po terminie",
      count: data.tasks.filter(
        (task) =>
          task.dueDate &&
          task.dueDate < today &&
          !["Zrobione", "Nie dotyczy"].includes(task.status),
      ).length,
      where: "Zadania",
      why: "Operacje mają być widoczne, a nie pamiętane w głowie.",
      severity: "warning",
    },
    {
      label: "Importy platform bez połączenia",
      count: data.imports.filter(
        (item) => item.transferStatus !== "Przeniesione" && !item.matchedBookingId,
      ).length,
      where: "Import platform",
      why: "Każdy import powinien być podpięty pod pobyt albo oznaczony jako sprawdzony.",
      severity: "info",
    },
  ];
}

export function getBookingDataIssues(data: AppData, booking: Booking) {
  const consent = data.consents.find((item) => item.bookingId === booking.id);
  const importMatch = data.imports.find((item) => item.matchedBookingId === booking.id);
  const media = data.media.filter((asset) => asset.bookingId === booking.id);
  const issues: string[] = [];

  if (!booking.bookingDate) issues.push("brak daty bookowania");
  if (!booking.checkIn || !booking.checkOut) issues.push("brak dat pobytu");
  if (!booking.grossPrice) issues.push("brak ceny brutto");
  if (booking.paymentStatus === "Do uzupełnienia") issues.push("brak statusu płatności");
  if (["Booking", "Airbnb"].includes(booking.platform) && !importMatch && !booking.importRef) {
    issues.push("brak spięcia z importem platformy");
  }
  if (!consent?.email && !consent?.phone && booking.checkOut > todayInPoland()) issues.push("brak kontaktu");
  if (media.length && (!consent || consent.photoFbConsent === "Do dopytania")) {
    issues.push("brak jasnej zgody na media");
  }

  return issues;
}

export function bookingQualityScore(data: AppData, booking: Booking) {
  const issues = getBookingDataIssues(data, booking);
  const score = Math.max(0, 100 - issues.length * 8);
  if (score >= 85) return { score, label: "mocny" };
  if (score >= 60) return { score, label: "średni" };
  return { score, label: "słaby" };
}

export function leadTimeDays(booking: Booking) {
  if (!booking.bookingDate || !booking.checkIn) return null;
  return Math.max(0, dateDiffDays(booking.bookingDate, booking.checkIn));
}

export function getNextAction(data: AppData, booking: Booking) {
  const conflicts = getBookingConflicts(data.bookings, data.blocks, booking);
  if (conflicts.length) return "Sprawdzić konflikt kalendarza";

  const debrief = data.departureDebriefs.find((item) => item.bookingId === booking.id);
  if (booking.checkOut <= todayInPoland() && (!debrief || debrief.status === "Oczekuje")) {
    return "Uzupełnić podsumowanie wyjazdu";
  }

  const openTask = data.tasks.find(
    (task) => task.bookingId === booking.id && !["Zrobione", "Nie dotyczy"].includes(task.status),
  );
  if (openTask) return openTask.title;

  const [firstIssue] = getBookingDataIssues(data, booking);
  if (firstIssue) return `Uzupełnić: ${firstIssue}`;
  return "Gotowe do analizy";
}

export function getImportIssues(item: AppData["imports"][number]) {
  const issues = [...(item.missingFields ?? [])];
  if (!item.bookingDate) issues.push("data bookowania");
  if (!item.checkIn || !item.checkOut) issues.push("daty pobytu");
  if (!item.grossPrice) issues.push("cena brutto");
  if (!item.guestName) issues.push("nazwa gościa");
  if (!item.matchedBookingId) issues.push("połączenie z rezerwacją");
  return Array.from(new Set(issues));
}

export function dashboardMetrics(data: AppData) {
  const nights = data.bookings.reduce(
    (sum, booking) => sum + nightsBetween(booking.checkIn, booking.checkOut),
    0,
  );
  const revenue = data.bookings.reduce((sum, booking) => sum + (booking.grossPrice ?? 0), 0);
  const directCount = data.bookings.filter((booking) => booking.platform === "Bezpośrednio").length;
  const mediaToConsent = data.media.filter((asset) => asset.usageStatus === "Do zgody").length;
  const readyMedia = data.media.filter(canUseMedia).length;
  const reviewsToAsk = data.tasks.filter(
    (task) => task.type === "Opinia" && !["Zrobione", "Nie dotyczy"].includes(task.status),
  ).length;
  const qualityScores = data.bookings.map((booking) => bookingQualityScore(data, booking).score);
  const leadTimes = data.bookings
    .map(leadTimeDays)
    .filter((value): value is number => value !== null);
  const importedBookings = data.bookings.filter((booking) =>
    data.imports.some((item) => item.matchedBookingId === booking.id),
  ).length;
  const missingMarketingFields = data.bookings.reduce(
    (sum, booking) => sum + getBookingDataIssues(data, booking).length,
    0,
  );

  return {
    bookings: data.bookings.length,
    revenue,
    averageNightPrice: nights > 0 ? Math.round(revenue / nights) : 0,
    directShare: data.bookings.length ? Math.round((directCount / data.bookings.length) * 100) : 0,
    openTasks: data.tasks.filter((task) => !["Zrobione", "Nie dotyczy"].includes(task.status))
      .length,
    mediaToConsent,
    readyMedia,
    reviewsToAsk,
    importedShare: data.bookings.length ? Math.round((importedBookings / data.bookings.length) * 100) : 0,
    dataQuality:
      qualityScores.length > 0
        ? Math.round(qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length)
        : 0,
    averageLeadTime:
      leadTimes.length > 0
        ? Math.round(leadTimes.reduce((sum, value) => sum + value, 0) / leadTimes.length)
        : 0,
    missingMarketingFields,
  };
}

export function canUseMedia(asset: MediaAsset) {
  return asset.usageStatus !== "Do zgody" && asset.usageStatus !== "Nie używać";
}
