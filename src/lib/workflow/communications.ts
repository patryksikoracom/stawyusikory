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
import { hasActiveConsent } from "../compliance/consent-ledger";
import mobileCalendarTemplateSources from "./mobile-calendar-template-sources.json";

const variables = [
  "guest_name", "guest_first_name", "unit_name", "check_in", "check_out",
  "arrival_time", "departure_time", "booking_id", "balance_due", "booking_price",
  "deposit_amount", "deposit_due", "bank_account", "travel_guide", "route_warning", "sender_name",
];

const polishMessageTemplates: MessageTemplate[] = [
  template("TPL-CONFIRM", "Potwierdzenie rezerwacji i zaliczka", "Potwierdzenie", "E-mail", "Potwierdzenie pobytu w Stawach u Sikory", "Dzień dobry {{guest_first_name}}, potwierdzamy pobyt w {{unit_name}} od {{check_in}} do {{check_out}}. Cena: {{booking_price}}, zaliczka: {{deposit_amount}} do {{deposit_due}}. Konto: {{bank_account}}. Numer rezerwacji: {{booking_id}}. Pozdrawiamy, {{sender_name}}."),
  template("TPL-DEPOSIT-CONFIRMED", "Potwierdzenie zaliczki i materiały", "Płatność", "E-mail", "Potwierdzenie wpłaty – Stawy u Sikory", "Dzień dobry {{guest_first_name}}, potwierdzamy zaliczkę dla rezerwacji {{booking_id}}. Najważniejsze informacje pobytowe i dojazd prześlemy przed przyjazdem. Pozdrawiamy, {{sender_name}}."),
  template("TPL-PAYMENT", "Przypomnienie o płatności", "Płatność", "SMS", undefined, "Dzień dobry {{guest_first_name}}, przypominamy o rozliczeniu rezerwacji {{booking_id}}. Pozostało: {{balance_due}}."),
  template("TPL-PREARRIVAL", "Informacje przed przyjazdem", "Przed przyjazdem", "E-mail", "Przed przyjazdem do Stawów u Sikory", "Dzień dobry {{guest_first_name}},\n\nczekamy na Państwa {{check_in}} od {{arrival_time}} w {{unit_name}}.\n\n{{route_warning}}\n\n{{travel_guide}}\n\nProsimy dać znać, jeśli godzina przyjazdu się zmieni.\n\nPozdrawiamy,\n{{sender_name}}"),
  template("TPL-ARRIVAL-REMINDER", "Krótkie przypomnienie przed przyjazdem", "Przed przyjazdem", "E-mail", "Jutro widzimy się w Stawach u Sikory", "Dzień dobry {{guest_first_name}},\n\nprzypominamy, że jutro od {{arrival_time}} czeka na Państwa {{unit_name}}. Jeśli godzina przyjazdu się zmieni, prosimy o krótką odpowiedź na tę wiadomość.\n\nPozdrawiamy,\n{{sender_name}}"),
  template("TPL-WELCOME", "Powitanie", "Powitanie", "OTA", undefined, "Witamy w {{unit_name}}! Mamy nadzieję, że wszystko jest w porządku. W razie pytań prosimy napisać."),
  template("TPL-CHECK", "Czy wszystko w porządku?", "W trakcie pobytu", "OTA", undefined, "Dzień dobry {{guest_first_name}}, czy wszystko jest w porządku i czy możemy w czymś pomóc?"),
  template("TPL-CHECKOUT", "Instrukcja wyjazdu", "Wyjazd", "OTA", undefined, "Dzień dobry {{guest_first_name}}, przypominamy, że wyjazd jest jutro do {{departure_time}}. Dziękujemy za pobyt w {{unit_name}}."),
  template("TPL-THANKS", "Podziękowanie i prywatny feedback", "Prywatny feedback", "E-mail", "Dziękujemy za pobyt w Stawach u Sikory", "Dzień dobry {{guest_first_name}},\n\ndziękujemy za pobyt w {{unit_name}}. Mamy nadzieję, że udało się Państwu odpocząć. Jeśli jest coś, co możemy poprawić, prosimy odpowiedzieć bezpośrednio na tę wiadomość — każdą uwagę czytamy osobiście.\n\nPozdrawiamy,\n{{sender_name}}"),
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
  template("TPL-PREARRIVAL-DE", "Informationen vor der Anreise", "Przed przyjazdem", "E-mail", "Vor Ihrer Anreise zu Stawy u Sikory", "Guten Tag {{guest_first_name}},\n\nwir erwarten Sie am {{check_in}} ab {{arrival_time}} im {{unit_name}}.\n\n{{route_warning}}\n\n{{travel_guide}}\n\nViele Grüße,\n{{sender_name}}", "de", "TPL-PREARRIVAL"),
  template("TPL-PREARRIVAL-EN", "Pre-arrival information", "Przed przyjazdem", "E-mail", "Before your arrival at Stawy u Sikory", "Hello {{guest_first_name}},\n\nwe expect you on {{check_in}} from {{arrival_time}} at {{unit_name}}.\n\n{{route_warning}}\n\n{{travel_guide}}\n\nKind regards,\n{{sender_name}}", "en", "TPL-PREARRIVAL"),
  template("TPL-ARRIVAL-REMINDER-DE", "Kurze Erinnerung vor der Anreise", "Przed przyjazdem", "E-mail", "Bis morgen bei Stawy u Sikory", "Guten Tag {{guest_first_name}}, morgen ab {{arrival_time}} erwartet Sie {{unit_name}}. Falls sich Ihre Ankunftszeit ändert, antworten Sie bitte kurz auf diese Nachricht. Viele Grüße, {{sender_name}}", "de", "TPL-ARRIVAL-REMINDER"),
  template("TPL-ARRIVAL-REMINDER-EN", "Short arrival reminder", "Przed przyjazdem", "E-mail", "See you tomorrow at Stawy u Sikory", "Hello {{guest_first_name}}, {{unit_name}} will be ready for you tomorrow from {{arrival_time}}. If your arrival time changes, please reply to this email. Kind regards, {{sender_name}}", "en", "TPL-ARRIVAL-REMINDER"),
  template("TPL-CHECK-DE", "Ist alles in Ordnung?", "W trakcie pobytu", "OTA", undefined, "Guten Tag {{guest_first_name}}, ist alles in Ordnung oder können wir Ihnen helfen? {{sender_name}}", "de", "TPL-CHECK"),
  template("TPL-CHECK-EN", "Is everything all right?", "W trakcie pobytu", "OTA", undefined, "Hello {{guest_first_name}}, is everything all right or can we help with anything? {{sender_name}}", "en", "TPL-CHECK"),
  template("TPL-CHECKOUT-DE", "Abreiseinformation", "Wyjazd", "OTA", undefined, "Guten Tag {{guest_first_name}}, die Abreise ist morgen bis {{departure_time}}. Vielen Dank für Ihren Aufenthalt im {{unit_name}}. {{sender_name}}", "de", "TPL-CHECKOUT"),
  template("TPL-CHECKOUT-EN", "Departure information", "Wyjazd", "OTA", undefined, "Hello {{guest_first_name}}, check-out is tomorrow by {{departure_time}}. Thank you for staying at {{unit_name}}. {{sender_name}}", "en", "TPL-CHECKOUT"),
  template("TPL-REVIEW-DE", "Bitte um eine Bewertung", "Opinia publiczna", "SMS", undefined, "Vielen Dank für Ihren Aufenthalt, {{guest_first_name}}. Wir freuen uns über Ihre ehrliche Bewertung. {{sender_name}}", "de", "TPL-REVIEW"),
  template("TPL-REVIEW-EN", "Review request", "Opinia publiczna", "SMS", undefined, "Thank you for staying with us, {{guest_first_name}}. We would appreciate your honest review. {{sender_name}}", "en", "TPL-REVIEW"),
  template("TPL-THANKS-DE", "Danke für Ihren Aufenthalt", "Prywatny feedback", "E-mail", "Vielen Dank für Ihren Aufenthalt", "Guten Tag {{guest_first_name}}, vielen Dank für Ihren Aufenthalt im {{unit_name}}. Wenn wir etwas verbessern können, antworten Sie bitte direkt auf diese Nachricht. Viele Grüße, {{sender_name}}", "de", "TPL-THANKS"),
  template("TPL-THANKS-EN", "Thank you for your stay", "Prywatny feedback", "E-mail", "Thank you for staying at Stawy u Sikory", "Hello {{guest_first_name}}, thank you for staying at {{unit_name}}. If there is anything we can improve, please reply directly to this email. Kind regards, {{sender_name}}", "en", "TPL-THANKS"),
];

export const defaultMessageTemplates: MessageTemplate[] = [
  ...polishMessageTemplates.map(markCurrentEmailTemplate),
  ...translatedMessageTemplates.map(markCurrentEmailTemplate),
  ...mobileCalendarTemplateSources.map((source): MessageTemplate => ({
    id: `TPL-MC-${source.sourceId}`,
    family: `TPL-MC-${source.sourceId}`,
    name: `[Import MC] ${source.name}`,
    purpose: /potwierdzenie/i.test(source.name)
      ? "Potwierdzenie"
      : /pobyt|podzięk/i.test(source.name)
        ? "Opinia publiczna"
        : "Przed przyjazdem",
    channel: "E-mail",
    language: source.language as MessageTemplate["language"],
    subject: source.subject || undefined,
    body: source.body,
    allowedVariables: [],
    version: 1,
    active: false,
  })),
];

export const defaultAutomationRules: AutomationRule[] = [
  automaticRule("RULE-CONFIRM", "Potwierdzenie po rezerwacji", "TPL-CONFIRM", "Po utworzeniu rezerwacji", 0, "12:00"),
  { ...automaticRule("RULE-DEPOSIT-CONFIRMED", "Potwierdzenie zaliczki", "TPL-DEPOSIT-CONFIRMED", "Po zarejestrowaniu płatności", 0, "12:00"), paymentStatuses: ["Zaliczka", "Opłacone", "Częściowo"] },
  { ...rule("RULE-PAYMENT", "Saldo dwa dni przed przyjazdem", "TPL-PAYMENT", "Przed przyjazdem", -2, "10:00"), paymentStatuses: ["Do uzupełnienia", "Zaliczka", "Częściowo", "Do dopłaty"] },
  automaticRule("RULE-PREARRIVAL", "Informacje pięć dni przed przyjazdem", "TPL-PREARRIVAL", "Przed przyjazdem", -5, "10:00"),
  automaticRule("RULE-ARRIVAL-REMINDER", "Krótkie przypomnienie dzień przed przyjazdem", "TPL-ARRIVAL-REMINDER", "Przed przyjazdem", -1, "10:00"),
  rule("RULE-WELCOME", "Powitanie po przyjeździe", "TPL-WELCOME", "Po przyjeździe", 0, "18:00"),
  rule("RULE-CHECKOUT", "Instrukcja przed wyjazdem", "TPL-CHECKOUT", "Przed wyjazdem", -1, "18:00"),
  automaticRule("RULE-THANKS", "Podziękowanie dzień po wyjeździe", "TPL-THANKS", "Po wyjeździe", 1, "11:00"),
  rule("RULE-REVIEW", "Prośba o opinię", "TPL-REVIEW", "Po wyjeździe", 1, "11:00"),
  rule("RULE-REVIEW-REMINDER", "Przypomnienie o opinii", "TPL-REVIEW-REMINDER", "Po wyjeździe", 4, "11:00"),
];

function template(id: string, name: string, purpose: MessageTemplate["purpose"], channel: MessageTemplate["channel"], subject: string | undefined, body: string, language: MessageTemplate["language"] = "pl", family = id): MessageTemplate {
  return { id, family, name, purpose, channel, language, subject, body, allowedVariables: variables, version: 1, active: true };
}

function markCurrentEmailTemplate(template: MessageTemplate): MessageTemplate {
  return template.channel === "E-mail" ? { ...template, version: 2 } : template;
}

function rule(id: string, name: string, templateId: string, trigger: AutomationRule["trigger"], offsetDays: number, sendTime: string): AutomationRule {
  return { id, name, templateId, trigger, offsetDays, sendTime, mode: "Wersja robocza", active: true, definitionVersion: 2 };
}

function automaticRule(id: string, name: string, templateId: string, trigger: AutomationRule["trigger"], offsetDays: number, sendTime: string): AutomationRule {
  return { ...rule(id, name, templateId, trigger, offsetDays, sendTime), mode: "Automatycznie" };
}

export function bookingFingerprint(booking: Booking) {
  return [booking.checkIn, booking.checkOut, booking.arrivalTime, booking.departureTime, booking.guestLabel, booking.paymentStatus, booking.workflowStatus, booking.unitId].join("|");
}

function communicationFingerprint(booking: Booking, language?: string, recipient?: string, templateVersion?: number) {
  return [bookingFingerprint(booking), language, recipient, templateVersion].join("|");
}

function dueDate(rule: AutomationRule, booking: Booking, data: Pick<AppData, "payments">) {
  const firstRecordedPayment = data.payments
    .filter((payment) => (
      payment.bookingId === booking.id
      && payment.status === "Zaksięgowana"
      && ["Wpłata", "Zaliczka", "Wypłata OTA"].includes(payment.type)
    ))
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt))[0];
  const base = rule.trigger === "Po utworzeniu rezerwacji" ? booking.bookingDate
    : rule.trigger === "Po zarejestrowaniu płatności" ? (firstRecordedPayment?.occurredAt || booking.bookingDate)
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
    .filter((item) => (
      item.language === template.language
      && item.approvedAt
      && (!item.unitIds?.length || item.unitIds.includes(booking.unitId))
    ))
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
      const candidateDueAt = dueDate(rule, booking, data);
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
        ["Opinia publiczna", "Przypomnienie opinii"].includes(template.purpose)
          && template.channel !== "OTA"
          && !hasActiveConsent(
            data.consentLedger,
            person?.id,
            template.channel === "SMS" ? "marketing_sms" : "marketing_email",
          )
          ? `Brak aktywnej zgody marketingowej dla kanału ${template.channel}`
          : undefined,
      ].filter(Boolean);
      const blockedReason = blockingReasons.length ? blockingReasons.join(" · ") : undefined;
      const changedAfterApproval = existing?.status === "Zatwierdzona" && existing.bookingFingerprint !== fingerprint;
      const automatic = rule.mode === "Automatycznie";
      const automaticDraftReady = automatic
        && !blockedReason
        && existing?.status === "Wersja robocza"
        && existing.deliveryPolicy === "auto_send";
      const status = booking.workflowStatus === "Anulowana"
        ? "Anulowana"
        : changedAfterApproval
          ? automatic
            ? blockedReason ? "Wersja robocza" : "Zatwierdzona"
            : "Wymaga sprawdzenia"
          : automaticDraftReady
            ? "Zatwierdzona"
            : existing?.status ?? (automatic && !blockedReason ? "Zatwierdzona" : "Wersja robocza");
      const deliveryPolicy = changedAfterApproval
        ? automatic ? "auto_send" : "draft_only"
        : existing?.deliveryPolicy ?? (automatic ? "auto_send" : "draft_only");
      const preserveApprovedContent = status === "Zatwierdzona" && existing && !changedAfterApproval;
      output.push({
        id: messageId,
        bookingId: booking.id,
        ruleId: rule.id,
        templateId: template.id,
        templateVersion: template.version,
        dueAt: preserveApprovedContent ? existing.dueAt : candidateDueAt,
        channel: template.channel,
        recipient: preserveApprovedContent ? existing.recipient : recipient,
        subject: preserveApprovedContent ? existing.subject : rendered.subject,
        renderedBody: preserveApprovedContent ? existing.renderedBody : rendered.body,
        status,
        blockedReason,
        approvedAt: changedAfterApproval
          ? automatic && !blockedReason ? new Date().toISOString() : undefined
          : existing?.approvedAt ?? (automatic && !blockedReason ? new Date().toISOString() : undefined),
        providerResult: existing?.providerResult,
        idempotencyKey: existing?.idempotencyKey ?? `scheduled-${rule.id}-${booking.id}-${template.version}`,
        bookingFingerprint: fingerprint,
        deliveryPolicy,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        version: existing?.version,
        updatedAt: existing?.updatedAt,
      });
    }
  }
  return output.sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}
