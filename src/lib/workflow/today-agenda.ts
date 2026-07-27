import type { AppData, Channel, OpsTask } from "@/lib/types";
import { deriveUnitOperationalStates, type UnitOperationalState } from "@/lib/cleaning/operations";

export type TodayAgendaKind = "Wyjazd" | "Turnover" | "Przyjazd" | "Wiadomość" | "Zadanie";

export type TodayAgendaEvent = {
  id: string;
  kind: TodayAgendaKind;
  time: string;
  sortMinutes: number;
  title: string;
  detail: string;
  unitId?: string;
  bookingId?: string;
  channel?: Channel;
  status: string;
  href?: string;
  actionLabel: string;
};

export type TodayUnitState = {
  unitId: string;
  unitName: string;
  state: UnitOperationalState;
  currentGuest?: string;
  nextChange: string;
  blocker?: string;
  sameDayTurnover?: {
    windowLabel: string;
    risky: boolean;
  };
};

function minutes(time: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return 23 * 60 + 59;
  return Number(match[1]) * 60 + Number(match[2]);
}

function timeAfter(time: string, offset: number) {
  const total = Math.min(23 * 60 + 59, minutes(time) + offset);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function windowLabel(from: string, to: string) {
  const duration = Math.max(0, minutes(to) - minutes(from));
  const hours = Math.floor(duration / 60);
  const remaining = duration % 60;
  return remaining ? `${hours} godz. ${remaining} min` : `${hours} godz.`;
}

function activeTask(task: OpsTask) {
  return !["Zrobione", "Nie dotyczy"].includes(task.status);
}

const eventRank: Record<TodayAgendaKind, number> = {
  Wyjazd: 0,
  Turnover: 1,
  Przyjazd: 2,
  Wiadomość: 3,
  Zadanie: 4,
};

export function buildTodayAgenda(data: AppData, today: string): TodayAgendaEvent[] {
  const bookings = data.bookings.filter(
    (booking) => booking.workflowStatus !== "Anulowana" && !booking.deletedAt,
  );
  const events: TodayAgendaEvent[] = [];

  for (const booking of bookings) {
    if (booking.checkOut === today) {
      const time = booking.departureTime || data.settings.defaultCheckOut;
      events.push({
        id: `departure-${booking.id}`,
        kind: "Wyjazd",
        time,
        sortMinutes: minutes(time),
        title: booking.guestLabel,
        detail: data.units.find((unit) => unit.id === booking.unitId)?.name ?? "Domek",
        unitId: booking.unitId,
        bookingId: booking.id,
        channel: booking.platform,
        status: "Do podsumowania",
        actionLabel: "Podsumuj wyjazd",
      });
    }
    if (booking.checkIn === today) {
      const time = booking.arrivalTime || data.settings.defaultCheckIn;
      events.push({
        id: `arrival-${booking.id}`,
        kind: "Przyjazd",
        time,
        sortMinutes: minutes(time),
        title: booking.guestLabel,
        detail: data.units.find((unit) => unit.id === booking.unitId)?.name ?? "Domek",
        unitId: booking.unitId,
        bookingId: booking.id,
        channel: booking.platform,
        status: booking.workflowStatus,
        href: `/bookings/${booking.id}`,
        actionLabel: "Otwórz przyjazd",
      });
    }
  }

  for (const task of data.tasks.filter((item) => item.dueDate === today && activeTask(item))) {
    const booking = bookings.find((item) => item.id === task.bookingId);
    const unit = data.units.find((item) => item.id === task.unitId);
    if (task.type === "Sprzątanie") {
      const departureTime = booking?.departureTime || data.settings.defaultCheckOut;
      const time = task.proposedStartTime || timeAfter(departureTime, 15);
      events.push({
        id: `turnover-${task.id}`,
        kind: "Turnover",
        time,
        sortMinutes: minutes(time),
        title: task.title,
        detail: data.units.find((unit) => unit.id === task.unitId)?.name ?? "Domek",
        unitId: task.unitId,
        bookingId: booking?.id,
        channel: booking?.platform,
        status: task.status,
        href: "/tasks",
        actionLabel: "Otwórz turnover",
      });
      continue;
    }
    events.push({
      id: `task-${task.id}`,
      kind: "Zadanie",
      time: "Do końca dnia",
      sortMinutes: 23 * 60 + 59,
      title: task.title,
      detail: [unit?.name, booking?.guestLabel, task.owner].filter(Boolean).join(" · "),
      unitId: task.unitId,
      bookingId: booking?.id,
      channel: booking?.platform,
      status: task.status,
      href: "/tasks",
      actionLabel: "Otwórz zadanie",
    });
  }

  for (const message of data.scheduledMessages.filter(
    (item) => item.dueAt.startsWith(today) && !["Anulowana", "Wysłana", "Dostarczona"].includes(item.status),
  )) {
    const booking = bookings.find((item) => item.id === message.bookingId);
    const template = data.messageTemplates.find((item) => item.id === message.templateId);
    const time = message.dueAt.slice(11, 16);
    events.push({
      id: `message-${message.id}`,
      kind: "Wiadomość",
      time,
      sortMinutes: minutes(time),
      title: template?.name ?? "Wiadomość do gościa",
      detail: message.channel,
      unitId: booking?.unitId,
      bookingId: booking?.id,
      channel: booking?.platform,
      status: message.status,
      href: booking ? `/bookings/${booking.id}?tab=messages` : undefined,
      actionLabel: "Sprawdź wiadomość",
    });
  }

  return events.sort((left, right) =>
    left.sortMinutes - right.sortMinutes
    || eventRank[left.kind] - eventRank[right.kind]
    || left.id.localeCompare(right.id),
  );
}

export function buildTodayUnitStates(data: AppData, today: string): TodayUnitState[] {
  const operationalStates = deriveUnitOperationalStates(data, today);
  const bookings = data.bookings.filter(
    (booking) => booking.workflowStatus !== "Anulowana" && !booking.deletedAt,
  );

  return data.units.map((unit) => {
    const unitBookings = bookings.filter((booking) => booking.unitId === unit.id);
    const current = unitBookings.find((booking) => booking.checkIn <= today && booking.checkOut > today);
    const departure = unitBookings
      .filter((booking) => booking.checkOut >= today)
      .sort((left, right) => `${left.checkOut}${left.departureTime ?? data.settings.defaultCheckOut}`.localeCompare(
        `${right.checkOut}${right.departureTime ?? data.settings.defaultCheckOut}`,
      ))[0];
    const arrival = unitBookings
      .filter((booking) => booking.checkIn >= today)
      .sort((left, right) => `${left.checkIn}${left.arrivalTime ?? data.settings.defaultCheckIn}`.localeCompare(
        `${right.checkIn}${right.arrivalTime ?? data.settings.defaultCheckIn}`,
      ))[0];
    const nextArrival = unitBookings
      .filter((booking) => booking.checkIn >= today && booking.id !== current?.id)
      .sort((left, right) => `${left.checkIn}${left.arrivalTime ?? data.settings.defaultCheckIn}`.localeCompare(
        `${right.checkIn}${right.arrivalTime ?? data.settings.defaultCheckIn}`,
      ))[0];
    const state = operationalStates.find((item) => item.unitId === unit.id)?.state ?? "Do sprzątania";
    const cleaning = data.tasks
      .filter((task) => task.type === "Sprzątanie" && task.unitId === unit.id && task.dueDate === today)
      .sort((left, right) => (right.updatedAt ?? "").localeCompare(left.updatedAt ?? ""))[0];
    const issue = data.issues.find((item) => item.unitId === unit.id && item.status !== "Rozwiązane");
    const sameDay = departure?.checkOut === today && arrival?.checkIn === today;
    const departureTime = departure?.departureTime || data.settings.defaultCheckOut;
    const arrivalTime = arrival?.arrivalTime || data.settings.defaultCheckIn;
    const nextArrivalTime = nextArrival?.arrivalTime || data.settings.defaultCheckIn;
    const nextChange = departure && (!nextArrival || `${departure.checkOut}${departureTime}` <= `${nextArrival.checkIn}${nextArrivalTime}`)
      ? `Wyjazd ${departure.checkOut === today ? "dzisiaj" : departure.checkOut} · ${departureTime}`
      : nextArrival
        ? `Przyjazd ${nextArrival.checkIn === today ? "dzisiaj" : nextArrival.checkIn} · ${nextArrivalTime}`
        : "Brak kolejnej zmiany";

    return {
      unitId: unit.id,
      unitName: unit.name,
      state,
      currentGuest: current?.guestLabel,
      nextChange,
      blocker: cleaning?.blocker || issue?.title,
      sameDayTurnover: sameDay ? {
        windowLabel: windowLabel(departureTime, arrivalTime),
        risky: state !== "Gotowy" || Boolean(cleaning?.blocker || issue),
      } : undefined,
    };
  });
}
