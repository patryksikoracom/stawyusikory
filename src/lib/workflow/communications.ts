import type {
  AppData,
  AutomationRule,
  Booking,
  ContactConsent,
  MessageTemplate,
  ScheduledMessage,
} from "../types";
import { addLocalDays } from "../date";
import { todayInPoland } from "../date";
import { nightsBetween, unitName } from "./rules";
import { calculateBookingFinance } from "../metrics/finance";

const variables = [
  "guest_name", "guest_first_name", "unit_name", "check_in", "check_out",
  "arrival_time", "departure_time", "booking_id", "balance_due",
];

export const defaultMessageTemplates: MessageTemplate[] = [
  template("TPL-CONFIRM", "Potwierdzenie rezerwacji", "Potwierdzenie", "E-mail", "Potwierdzenie pobytu w Stawach u Sikory", "Dzień dobry {{guest_first_name}}, potwierdzamy pobyt w {{unit_name}} od {{check_in}} do {{check_out}}. Numer rezerwacji: {{booking_id}}."),
  template("TPL-PAYMENT", "Przypomnienie o płatności", "Płatność", "SMS", undefined, "Dzień dobry {{guest_first_name}}, przypominamy o rozliczeniu rezerwacji {{booking_id}}. Pozostało: {{balance_due}}."),
  template("TPL-PREARRIVAL", "Informacje przed przyjazdem", "Przed przyjazdem", "OTA", undefined, "Dzień dobry {{guest_first_name}}, czekamy na Państwa {{check_in}} od {{arrival_time}} w {{unit_name}}. Prosimy dać znać, jeśli godzina przyjazdu się zmieni."),
  template("TPL-WELCOME", "Powitanie", "Powitanie", "OTA", undefined, "Witamy w {{unit_name}}! Mamy nadzieję, że wszystko jest w porządku. W razie pytań prosimy napisać."),
  template("TPL-CHECK", "Czy wszystko w porządku?", "W trakcie pobytu", "OTA", undefined, "Dzień dobry {{guest_first_name}}, czy wszystko jest w porządku i czy możemy w czymś pomóc?"),
  template("TPL-CHECKOUT", "Instrukcja wyjazdu", "Wyjazd", "OTA", undefined, "Dzień dobry {{guest_first_name}}, przypominamy, że wyjazd jest jutro do {{departure_time}}. Dziękujemy za pobyt w {{unit_name}}."),
  template("TPL-THANKS", "Podziękowanie i prywatny feedback", "Prywatny feedback", "SMS", undefined, "Dziękujemy za pobyt, {{guest_first_name}}. Jeśli coś możemy poprawić, prosimy odpisać bezpośrednio na tę wiadomość."),
  template("TPL-REVIEW", "Prośba o opinię", "Opinia publiczna", "SMS", undefined, "Dziękujemy za pobyt, {{guest_first_name}}. Jeśli mają Państwo chwilę, będziemy wdzięczni za szczerą opinię o Stawach u Sikory."),
  template("TPL-REVIEW-REMINDER", "Przypomnienie o opinii", "Przypomnienie opinii", "E-mail", "Czy podzielą się Państwo opinią?", "Dzień dobry {{guest_first_name}}, delikatnie przypominamy o możliwości podzielenia się opinią o pobycie. Dziękujemy niezależnie od oceny."),
  template("TPL-REPAIR", "Informacja po naprawie", "Naprawa", "E-mail", "Dziękujemy za zgłoszenie", "Dziękujemy za zwrócenie uwagi. Zgłoszona przez Państwa sprawa została rozwiązana."),
];

export const defaultAutomationRules: AutomationRule[] = [
  rule("RULE-CONFIRM", "Potwierdzenie po rezerwacji", "TPL-CONFIRM", "Po utworzeniu rezerwacji", 0, "12:00"),
  rule("RULE-PAYMENT", "Kontrola płatności", "TPL-PAYMENT", "Termin płatności", 0, "10:00"),
  rule("RULE-PREARRIVAL", "Informacje dwa dni przed przyjazdem", "TPL-PREARRIVAL", "Przed przyjazdem", -2, "10:00"),
  rule("RULE-WELCOME", "Powitanie po przyjeździe", "TPL-WELCOME", "Po przyjeździe", 0, "18:00"),
  rule("RULE-CHECKOUT", "Instrukcja przed wyjazdem", "TPL-CHECKOUT", "Przed wyjazdem", -1, "18:00"),
  rule("RULE-THANKS", "Podziękowanie po wyjeździe", "TPL-THANKS", "Po wyjeździe", 0, "14:00"),
  rule("RULE-REVIEW", "Prośba o opinię", "TPL-REVIEW", "Po wyjeździe", 1, "11:00"),
  rule("RULE-REVIEW-REMINDER", "Przypomnienie o opinii", "TPL-REVIEW-REMINDER", "Po wyjeździe", 4, "11:00"),
];

function template(id: string, name: string, purpose: MessageTemplate["purpose"], channel: MessageTemplate["channel"], subject: string | undefined, body: string): MessageTemplate {
  return { id, name, purpose, channel, language: "pl", subject, body, allowedVariables: variables, version: 1, active: true };
}

function rule(id: string, name: string, templateId: string, trigger: AutomationRule["trigger"], offsetDays: number, sendTime: string): AutomationRule {
  return { id, name, templateId, trigger, offsetDays, sendTime, mode: "Wersja robocza", active: true };
}

export function bookingFingerprint(booking: Booking) {
  return [booking.checkIn, booking.checkOut, booking.arrivalTime, booking.departureTime, booking.guestLabel, booking.paymentStatus, booking.workflowStatus, booking.unitId].join("|");
}

function dueDate(rule: AutomationRule, booking: Booking) {
  const base = rule.trigger === "Po utworzeniu rezerwacji" ? booking.bookingDate
    : rule.trigger === "Termin płatności" ? (booking.depositDueDate || addLocalDays(booking.checkIn, -3))
      : ["Przed przyjazdem", "Po przyjeździe"].includes(rule.trigger) ? booking.checkIn
        : booking.checkOut;
  return `${addLocalDays(base, rule.offsetDays)}T${rule.sendTime}:00`;
}

function contactFor(template: MessageTemplate, consent?: ContactConsent) {
  if (template.channel === "SMS") return consent?.phone;
  if (template.channel === "E-mail") return consent?.email;
  return consent?.email || consent?.phone || "Kanał OTA";
}

export function renderTemplate(template: MessageTemplate, booking: Booking, data: Pick<AppData, "units" | "payments">) {
  const finance = calculateBookingFinance(booking, data.payments);
  const balanceDue = finance.amountDue == null
    ? "do ustalenia"
    : `${finance.amountDue.toLocaleString("pl-PL")} ${finance.currency ?? ""}`.trim();
  const values: Record<string, string> = {
    guest_name: booking.guestLabel,
    guest_first_name: booking.guestLabel.trim().split(/\s+/)[0] || "Gościu",
    unit_name: unitName(data.units, booking.unitId),
    check_in: booking.checkIn,
    check_out: booking.checkOut,
    arrival_time: booking.arrivalTime || "16:00",
    departure_time: booking.departureTime || "11:00",
    booking_id: booking.platformReservationNo || booking.id,
    balance_due: finance.balanceStatus === "overpaid"
      ? `0 ${finance.currency ?? ""} (nadpłata ${(finance.overpayment ?? 0).toLocaleString("pl-PL")} ${finance.currency ?? ""})`.replaceAll(/\s+/g, " ").trim()
      : balanceDue,
  };
  const replace = (value?: string) => value?.replace(/{{\s*([a-z_]+)\s*}}/g, (_, key: string) => values[key] ?? `{{${key}}}`);
  const body = replace(template.body) || "";
  const subject = replace(template.subject);
  const unresolved = Array.from(new Set([...body.matchAll(/{{\s*([^}]+)\s*}}/g)].map((match) => match[1])));
  return { body, subject, unresolved };
}

export function reconcileScheduledMessages(data: AppData): ScheduledMessage[] {
  const current = new Map(data.scheduledMessages.map((item) => [item.id, item]));
  const output: ScheduledMessage[] = [];
  const today = todayInPoland();
  for (const booking of data.bookings) {
    if (booking.historicalImport || booking.checkOut <= today) continue;
    for (const rule of data.automationRules.filter((item) => item.active)) {
      const messageId = `SCH-${rule.id}-${booking.id}`;
      const existing = current.get(messageId);
      const template = data.messageTemplates.find((item) => item.id === rule.templateId && item.active);
      if (!template) continue;
      if (rule.channels?.length && !rule.channels.includes(booking.platform)) continue;
      if (rule.unitIds?.length && !rule.unitIds.includes(booking.unitId)) continue;
      if (rule.paymentStatuses?.length && !rule.paymentStatuses.includes(booking.paymentStatus)) continue;
      if (rule.minimumNights && nightsBetween(booking.checkIn, booking.checkOut) < rule.minimumNights) continue;
      const candidateDueAt = dueDate(rule, booking);
      if (!existing && booking.importRef?.source === "mobile-calendar" && candidateDueAt.slice(0, 10) < today) continue;
      const fingerprint = bookingFingerprint(booking);
      const rendered = renderTemplate(template, booking, data);
      const consent = data.consents.find((item) => item.bookingId === booking.id);
      const recipient = contactFor(template, consent);
      const blockedReason = rendered.unresolved.length ? `Brakujące zmienne: ${rendered.unresolved.join(", ")}` : !recipient ? `Brak kontaktu dla kanału ${template.channel}` : undefined;
      const changedAfterApproval = existing?.status === "Zatwierdzona" && existing.bookingFingerprint !== fingerprint;
      const status = booking.workflowStatus === "Anulowana" ? "Anulowana" : changedAfterApproval ? "Wymaga sprawdzenia" : existing?.status ?? "Wersja robocza";
      output.push({
        id: messageId,
        bookingId: booking.id,
        ruleId: rule.id,
        templateId: template.id,
        templateVersion: template.version,
        dueAt: status === "Zatwierdzona" ? existing!.dueAt : candidateDueAt,
        channel: template.channel,
        recipient: status === "Zatwierdzona" ? existing!.recipient : recipient,
        subject: status === "Zatwierdzona" ? existing!.subject : rendered.subject,
        renderedBody: status === "Zatwierdzona" ? existing!.renderedBody : rendered.body,
        status,
        blockedReason,
        approvedAt: changedAfterApproval ? undefined : existing?.approvedAt,
        providerResult: existing?.providerResult,
        idempotencyKey: existing?.idempotencyKey ?? `scheduled-${rule.id}-${booking.id}-${template.version}`,
        bookingFingerprint: fingerprint,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
      });
    }
  }
  return output.sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}
