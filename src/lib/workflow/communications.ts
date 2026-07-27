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
  "arrival_time", "departure_time", "booking_id", "balance_due", "booking_price",
  "deposit_amount", "deposit_due", "bank_account", "travel_guide", "route_warning", "sender_name",
];

const polishMessageTemplates: MessageTemplate[] = [
  template("TPL-CONFIRM", "Potwierdzenie rezerwacji i zaliczka", "Potwierdzenie", "E-mail", "Potwierdzenie pobytu w Stawach u Sikory", "Dzień dobry {{guest_first_name}}, potwierdzamy pobyt w {{unit_name}} od {{check_in}} do {{check_out}}. Cena: {{booking_price}}, zaliczka: {{deposit_amount}} do {{deposit_due}}. Konto: {{bank_account}}. Numer rezerwacji: {{booking_id}}. Pozdrawiamy, {{sender_name}}."),
  template("TPL-DEPOSIT-CONFIRMED", "Potwierdzenie zaliczki i materiały", "Płatność", "E-mail", "Potwierdzenie wpłaty – Stawy u Sikory", "Dzień dobry {{guest_first_name}}, potwierdzamy zaliczkę dla rezerwacji {{booking_id}}. Najważniejsze informacje pobytowe i dojazd prześlemy przed przyjazdem. Pozdrawiamy, {{sender_name}}."),
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

const translatedMessageTemplates: MessageTemplate[] = [
  template("TPL-CONFIRM-DE", "Buchungsbestätigung", "Potwierdzenie", "E-mail", "Aufenthaltsbestätigung – Stawy u Sikory", "Guten Tag {{guest_first_name}}, wir bestätigen Ihren Aufenthalt im {{unit_name}} vom {{check_in}} bis {{check_out}}. Preis: {{booking_price}}, Anzahlung: {{deposit_amount}} bis {{deposit_due}}. Konto: {{bank_account}}. Buchungsnummer: {{booking_id}}. Viele Grüße, {{sender_name}}", "de", "TPL-CONFIRM"),
  template("TPL-CONFIRM-EN", "Booking confirmation", "Potwierdzenie", "E-mail", "Your stay at Stawy u Sikory", "Hello {{guest_first_name}}, we confirm your stay at {{unit_name}} from {{check_in}} to {{check_out}}. Price: {{booking_price}}, deposit: {{deposit_amount}} due {{deposit_due}}. Account: {{bank_account}}. Booking: {{booking_id}}. Kind regards, {{sender_name}}", "en", "TPL-CONFIRM"),
  template("TPL-DEPOSIT-CONFIRMED-DE", "Bestätigung der Anzahlung", "Płatność", "E-mail", "Zahlung bestätigt – Stawy u Sikory", "Guten Tag {{guest_first_name}}, wir bestätigen die Anzahlung für {{booking_id}}. Die wichtigsten Informationen senden wir vor der Anreise. {{sender_name}}", "de", "TPL-DEPOSIT-CONFIRMED"),
  template("TPL-DEPOSIT-CONFIRMED-EN", "Deposit confirmation", "Płatność", "E-mail", "Payment confirmed – Stawy u Sikory", "Hello {{guest_first_name}}, we confirm the deposit for {{booking_id}}. We will send the key stay information before arrival. {{sender_name}}", "en", "TPL-DEPOSIT-CONFIRMED"),
  template("TPL-PAYMENT-DE", "Zahlungserinnerung", "Płatność", "SMS", undefined, "Guten Tag {{guest_first_name}}, für die Buchung {{booking_id}} sind noch {{balance_due}} offen. Viele Grüße, {{sender_name}}", "de", "TPL-PAYMENT"),
  template("TPL-PAYMENT-EN", "Payment reminder", "Płatność", "SMS", undefined, "Hello {{guest_first_name}}, {{balance_due}} remains due for booking {{booking_id}}. Kind regards, {{sender_name}}", "en", "TPL-PAYMENT"),
  template("TPL-PREARRIVAL-DE", "Informationen vor der Anreise", "Przed przyjazdem", "OTA", undefined, "Guten Tag {{guest_first_name}}, wir erwarten Sie am {{check_in}} ab {{arrival_time}} im {{unit_name}}. {{route_warning}}\n{{travel_guide}}", "de", "TPL-PREARRIVAL"),
  template("TPL-PREARRIVAL-EN", "Pre-arrival information", "Przed przyjazdem", "OTA", undefined, "Hello {{guest_first_name}}, we expect you on {{check_in}} from {{arrival_time}} at {{unit_name}}. {{route_warning}}\n{{travel_guide}}", "en", "TPL-PREARRIVAL"),
  template("TPL-CHECK-DE", "Ist alles in Ordnung?", "W trakcie pobytu", "OTA", undefined, "Guten Tag {{guest_first_name}}, ist alles in Ordnung oder können wir Ihnen helfen? {{sender_name}}", "de", "TPL-CHECK"),
  template("TPL-CHECK-EN", "Is everything all right?", "W trakcie pobytu", "OTA", undefined, "Hello {{guest_first_name}}, is everything all right or can we help with anything? {{sender_name}}", "en", "TPL-CHECK"),
  template("TPL-CHECKOUT-DE", "Abreiseinformation", "Wyjazd", "OTA", undefined, "Guten Tag {{guest_first_name}}, die Abreise ist morgen bis {{departure_time}}. Vielen Dank für Ihren Aufenthalt im {{unit_name}}. {{sender_name}}", "de", "TPL-CHECKOUT"),
  template("TPL-CHECKOUT-EN", "Departure information", "Wyjazd", "OTA", undefined, "Hello {{guest_first_name}}, check-out is tomorrow by {{departure_time}}. Thank you for staying at {{unit_name}}. {{sender_name}}", "en", "TPL-CHECKOUT"),
  template("TPL-REVIEW-DE", "Bitte um eine Bewertung", "Opinia publiczna", "SMS", undefined, "Vielen Dank für Ihren Aufenthalt, {{guest_first_name}}. Wir freuen uns über Ihre ehrliche Bewertung. {{sender_name}}", "de", "TPL-REVIEW"),
  template("TPL-REVIEW-EN", "Review request", "Opinia publiczna", "SMS", undefined, "Thank you for staying with us, {{guest_first_name}}. We would appreciate your honest review. {{sender_name}}", "en", "TPL-REVIEW"),
];

export const defaultMessageTemplates: MessageTemplate[] = [
  ...polishMessageTemplates,
  ...translatedMessageTemplates,
];

export const defaultAutomationRules: AutomationRule[] = [
  rule("RULE-CONFIRM", "Potwierdzenie po rezerwacji", "TPL-CONFIRM", "Po utworzeniu rezerwacji", 0, "12:00"),
  { ...rule("RULE-DEPOSIT-CONFIRMED", "Potwierdzenie zaliczki", "TPL-DEPOSIT-CONFIRMED", "Termin płatności", 0, "12:00"), paymentStatuses: ["Zaliczka", "Opłacone", "Częściowo"] },
  { ...rule("RULE-PAYMENT", "Saldo dwa dni przed przyjazdem", "TPL-PAYMENT", "Przed przyjazdem", -2, "10:00"), paymentStatuses: ["Do uzupełnienia", "Zaliczka", "Częściowo", "Do dopłaty"] },
  rule("RULE-PREARRIVAL", "Informacje dwa dni przed przyjazdem", "TPL-PREARRIVAL", "Przed przyjazdem", -2, "10:00"),
  rule("RULE-WELCOME", "Powitanie po przyjeździe", "TPL-WELCOME", "Po przyjeździe", 0, "18:00"),
  rule("RULE-CHECKOUT", "Instrukcja przed wyjazdem", "TPL-CHECKOUT", "Przed wyjazdem", -1, "18:00"),
  rule("RULE-THANKS", "Podziękowanie po wyjeździe", "TPL-THANKS", "Po wyjeździe", 0, "14:00"),
  rule("RULE-REVIEW", "Prośba o opinię", "TPL-REVIEW", "Po wyjeździe", 1, "11:00"),
  rule("RULE-REVIEW-REMINDER", "Przypomnienie o opinii", "TPL-REVIEW-REMINDER", "Po wyjeździe", 4, "11:00"),
];

function template(id: string, name: string, purpose: MessageTemplate["purpose"], channel: MessageTemplate["channel"], subject: string | undefined, body: string, language: MessageTemplate["language"] = "pl", family = id): MessageTemplate {
  return { id, family, name, purpose, channel, language, subject, body, allowedVariables: variables, version: 1, active: true };
}

function rule(id: string, name: string, templateId: string, trigger: AutomationRule["trigger"], offsetDays: number, sendTime: string): AutomationRule {
  return { id, name, templateId, trigger, offsetDays, sendTime, mode: "Wersja robocza", active: true };
}

export function bookingFingerprint(booking: Booking) {
  return [booking.checkIn, booking.checkOut, booking.arrivalTime, booking.departureTime, booking.guestLabel, booking.paymentStatus, booking.workflowStatus, booking.unitId].join("|");
}

function communicationFingerprint(booking: Booking, language?: string, recipient?: string, templateVersion?: number) {
  return [bookingFingerprint(booking), language, recipient, templateVersion].join("|");
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

export function renderTemplate(template: MessageTemplate, booking: Booking, data: Pick<AppData, "units" | "payments" | "communicationConfigs">) {
  const finance = calculateBookingFinance(booking, data.payments);
  const config = data.communicationConfigs.find((item) => item.id === "communication") ?? data.communicationConfigs[0];
  const guide = config?.travelGuides
    .filter((item) => item.language === template.language && item.approvedAt)
    .sort((left, right) => right.version - left.version)[0];
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
    booking_price: booking.grossPrice == null ? "do ustalenia" : `${booking.grossPrice.toLocaleString("pl-PL")} ${booking.currency ?? "PLN"}`,
    deposit_amount: booking.depositAmount == null ? "do ustalenia" : `${booking.depositAmount.toLocaleString("pl-PL")} ${booking.currency ?? "PLN"}`,
    deposit_due: booking.depositDueDate || "do ustalenia",
    bank_account: config?.bankAccountNumber || "{{bank_account}}",
    travel_guide: guide?.body || "{{travel_guide}}",
    route_warning: guide?.routeWarning || "{{route_warning}}",
    sender_name: config?.senderName || "Stawy u Sikory",
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
      const baseTemplate = data.messageTemplates.find((item) => item.id === rule.templateId && item.active);
      if (!baseTemplate) continue;
      const profile = data.guests.find((item) => item.bookingId === booking.id);
      const person = data.people.find((item) => item.id === profile?.personId);
      const language = person?.preferredLanguage;
      const template = data.messageTemplates.find((item) => (
        item.active
        && item.family === (baseTemplate.family ?? baseTemplate.id)
        && item.language === language
      )) ?? baseTemplate;
      if (rule.channels?.length && !rule.channels.includes(booking.platform)) continue;
      if (rule.unitIds?.length && !rule.unitIds.includes(booking.unitId)) continue;
      if (rule.paymentStatuses?.length && !rule.paymentStatuses.includes(booking.paymentStatus)) continue;
      if (rule.minimumNights && nightsBetween(booking.checkIn, booking.checkOut) < rule.minimumNights) continue;
      const candidateDueAt = dueDate(rule, booking);
      if (!existing && booking.importRef?.source === "mobile-calendar" && candidateDueAt.slice(0, 10) < today) continue;
      const rendered = renderTemplate(template, booking, data);
      const consent = data.consents.find((item) => item.bookingId === booking.id);
      const recipient = contactFor(template, consent);
      const fingerprint = language
        ? communicationFingerprint(booking, language, recipient, template.version)
        : bookingFingerprint(booking);
      const blockingReasons = [
        !language ? "Brak jawnie wybranego języka gościa" : undefined,
        language && template.language !== language ? `Brak szablonu w języku ${language.toUpperCase()}` : undefined,
        rendered.unresolved.length ? `Brakujące zmienne: ${rendered.unresolved.join(", ")}` : undefined,
        !recipient ? `Brak kontaktu dla kanału ${template.channel}` : undefined,
      ].filter(Boolean);
      const blockedReason = blockingReasons.length ? blockingReasons.join(" · ") : undefined;
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
        deliveryPolicy: "draft_only",
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        version: existing?.version,
        updatedAt: existing?.updatedAt,
      });
    }
  }
  return output.sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}
