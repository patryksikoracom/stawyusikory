import { bookingLanguage } from "@/lib/crm/guest-identity";
import type {
  AppData,
  AutomationRule,
  Booking,
  ContactConsent,
  MessageTemplate,
  ScheduledMessage,
} from "../types";
import { addLocalDays, polishDateTime } from "../date";
import { todayInPoland } from "../date";
import { nightsBetween, unitName } from "./rules";
import { calculateBookingFinance } from "../metrics/finance";
import { hasActiveConsent } from "../compliance/consent-ledger";
import { messageDate, paymentMessage, transferDateRange } from "./payment-message";
import mobileCalendarTemplateSources from "./mobile-calendar-template-sources.json";

const variables = [
  "guest_name", "guest_first_name", "unit_name", "check_in", "check_out",
  "arrival_time", "departure_time", "booking_id", "balance_due", "booking_price",
  "deposit_amount", "deposit_to_pay", "deposit_due", "payment_instructions", "transfer_reference", "bank_account", "travel_guide", "route_warning", "sender_name",
];

const polishMessageTemplates: MessageTemplate[] = [
  template("TPL-CONFIRM", "Potwierdzenie rezerwacji i zaliczka", "Potwierdzenie", "E-mail", "Twój pobyt w Stawach u Sikory · {{check_in}}", "Dzień dobry,\n\ndziękujemy za rezerwację w Stawach u Sikory.\n\nDomek: {{unit_name}}\nPrzyjazd: {{check_in}} od {{arrival_time}}\nWyjazd: {{check_out}} do {{departure_time}}\nCena pobytu: {{booking_price}}\n\n{{payment_instructions}}\n\nInformacje o dojeździe prześlemy w osobnym mailu przed przyjazdem. Przy rezerwacji na ostatnią chwilę otrzymasz je od razu po potwierdzeniu.\n\nJeśli masz pytania, odpowiedz na tego maila — chętnie pomożemy.\n\nDo zobaczenia,\n{{sender_name}}"),
  template("TPL-DEPOSIT-CONFIRMED", "Potwierdzenie zaliczki i materiały", "Płatność", "E-mail", "Wpłata dotarła · pobyt od {{check_in}}", "Dzień dobry,\n\nwpłata dotarła — dziękujemy!\n\nDomek: {{unit_name}}\nPobyt: {{check_in}} – {{check_out}}\nPozostało do zapłaty za pobyt: {{balance_due}}\n\nJeśli coś wymaga wyjaśnienia, wystarczy odpowiedzieć na tego maila.\n\nPozdrawiamy,\n{{sender_name}}"),
  template("TPL-PAYMENT", "Przypomnienie o płatności", "Płatność", "SMS", undefined, "Dzień dobry, za pobyt {{check_in}}–{{check_out}} pozostało do zapłaty {{balance_due}}. Jeśli przelew jest już zlecony, daj nam znać. {{sender_name}}"),
  template("TPL-PREARRIVAL", "Informacje przed przyjazdem", "Przed przyjazdem", "E-mail", "Dojazd i informacje na przyjazd · {{check_in}}", "Dzień dobry,\n\nprzesyłamy informacje na przyjazd do Stawów u Sikory.\n\nDomek: {{unit_name}}\nPrzyjazd: {{check_in}} od {{arrival_time}}\nWyjazd: {{check_out}} do {{departure_time}}\n\nDojazd\n{{route_warning}}\n\nPrzewodnik i wskazówki na pobyt\n{{travel_guide}}\n\nDaj znać, o której mniej więcej planujesz dotrzeć. Jeśli plan się zmieni, wystarczy krótka odpowiedź na tego maila.\n\nDo zobaczenia,\n{{sender_name}}"),
  template("TPL-ARRIVAL-REMINDER", "Krótkie przypomnienie przed przyjazdem", "Przed przyjazdem", "E-mail", "Do zobaczenia jutro · {{unit_name}}", "Dzień dobry,\n\njutro czekamy na Ciebie w Stawach u Sikory.\n\nDomek: {{unit_name}}\nPrzyjazd: {{check_in}} od {{arrival_time}}\n\nJeśli orientacyjna godzina przyjazdu się zmieniła, daj nam znać w odpowiedzi. Dojazd i przewodnik są w poprzedniej wiadomości.\n\nDo zobaczenia,\n{{sender_name}}"),
  template("TPL-WELCOME", "Powitanie", "Powitanie", "OTA", undefined, "Dzień dobry,\n\nmamy nadzieję, że podróż minęła spokojnie i wszystko w domku jest w porządku. Jeśli czegoś brakuje albo masz pytanie, napisz do nas.\n\nMiłego pobytu,\n{{sender_name}}"),
  template("TPL-CHECK", "Czy wszystko w porządku?", "W trakcie pobytu", "OTA", undefined, "Dzień dobry,\n\njak mija pobyt? Jeśli możemy w czymś pomóc albo coś wymaga naszej uwagi, daj nam znać.\n\n{{sender_name}}"),
  template("TPL-CHECKOUT", "Instrukcja wyjazdu", "Wyjazd", "OTA", undefined, "Dzień dobry,\n\njutro kończy się pobyt w domku {{unit_name}}. Prosimy o wyjazd do {{departure_time}}, żebyśmy mogli przygotować domek dla kolejnych gości.\n\nJeśli coś wymaga naszej uwagi przed wyjazdem, daj nam znać.\n\nDziękujemy za pobyt i życzymy dobrej drogi,\n{{sender_name}}"),
  template("TPL-THANKS", "Podziękowanie i prywatny feedback", "Prywatny feedback", "E-mail", "Dziękujemy za pobyt", "Dzień dobry,\n\ndziękujemy za pobyt w Stawach u Sikory. Mamy nadzieję, że był to dobry czas na odpoczynek.\n\nJeśli coś warto poprawić, daj nam znać w odpowiedzi na tego maila. Twoje uwagi pomogą nam lepiej zadbać o kolejne pobyty.\n\nPozdrawiamy,\n{{sender_name}}"),
  template("TPL-REVIEW", "Prośba o opinię", "Opinia publiczna", "SMS", undefined, "Dziękujemy za pobyt w Stawach u Sikory. Jeśli masz chwilę i ochotę, będzie nam miło przeczytać Twoją opinię. {{sender_name}}"),
  template("TPL-REVIEW-REMINDER", "Przypomnienie o opinii", "Przypomnienie opinii", "E-mail", "Kilka słów o pobycie w Stawach u Sikory", "Dzień dobry,\n\njeśli masz ochotę podzielić się opinią o pobycie, będzie nam miło. Jeśli opinia jest już dodana — dziękujemy, nic więcej nie trzeba robić.\n\nPozdrawiamy,\n{{sender_name}}"),
  template("TPL-REPAIR", "Informacja po naprawie", "Naprawa", "E-mail", "Zgłoszona sprawa jest już rozwiązana", "Dzień dobry,\n\nzgłoszona sprawa jest już rozwiązana. Dziękujemy za informację.\n\nJeśli problem wróci albo coś nadal nie działa, daj nam znać.\n\nPozdrawiamy,\n{{sender_name}}"),
];

const translatedMessageTemplates: MessageTemplate[] = [
  template("TPL-CONFIRM-DE", "Buchungsbestätigung", "Potwierdzenie", "E-mail", "Ihr Aufenthalt bei Stawy u Sikory · {{check_in}}", "Guten Tag,\n\nvielen Dank für Ihre Buchung bei Stawy u Sikory.\n\nFerienhaus: {{unit_name}}\nAnreise: {{check_in}} ab {{arrival_time}}\nAbreise: {{check_out}} bis {{departure_time}}\nGesamtpreis: {{booking_price}}\n\n{{payment_instructions}}\n\nDie Anfahrtsbeschreibung und weitere Hinweise erhalten Sie vor Ihrer Anreise in einer separaten E-Mail. Bei einer kurzfristigen Buchung folgen diese direkt auf die Bestätigung.\n\nBei Fragen antworten Sie einfach auf diese E-Mail. Wir helfen Ihnen gerne.\n\nBis bald,\n{{sender_name}}", "de", "TPL-CONFIRM"),
  template("TPL-CONFIRM-EN", "Booking confirmation", "Potwierdzenie", "E-mail", "Your stay at Stawy u Sikory · {{check_in}}", "Hello,\n\nthank you for booking a stay at Stawy u Sikory.\n\nCottage: {{unit_name}}\nArrival: {{check_in}} from {{arrival_time}}\nDeparture: {{check_out}} by {{departure_time}}\nTotal price: {{booking_price}}\n\n{{payment_instructions}}\n\nWe will send directions and arrival details in a separate email before your stay. For a last-minute booking, these will follow the confirmation.\n\nIf you have any questions, just reply to this email. We are happy to help.\n\nSee you soon,\n{{sender_name}}", "en", "TPL-CONFIRM"),
  template("TPL-DEPOSIT-CONFIRMED-DE", "Bestätigung der Anzahlung", "Płatność", "E-mail", "Zahlung eingegangen · Aufenthalt ab {{check_in}}", "Guten Tag,\n\nIhre Zahlung ist eingegangen. Vielen Dank!\n\nFerienhaus: {{unit_name}}\nAufenthalt: {{check_in}} – {{check_out}}\nRestbetrag für Ihren Aufenthalt: {{balance_due}}\n\nBei Fragen antworten Sie einfach auf diese E-Mail.\n\nViele Grüße,\n{{sender_name}}", "de", "TPL-DEPOSIT-CONFIRMED"),
  template("TPL-DEPOSIT-CONFIRMED-EN", "Deposit confirmation", "Płatność", "E-mail", "Payment received · stay from {{check_in}}", "Hello,\n\nwe have received your payment. Thank you!\n\nCottage: {{unit_name}}\nStay: {{check_in}} – {{check_out}}\nRemaining balance for your stay: {{balance_due}}\n\nIf you have any questions, just reply to this email.\n\nBest wishes,\n{{sender_name}}", "en", "TPL-DEPOSIT-CONFIRMED"),
  template("TPL-PAYMENT-DE", "Zahlungserinnerung", "Płatność", "SMS", undefined, "Guten Tag, für Ihren Aufenthalt {{check_in}}–{{check_out}} sind noch {{balance_due}} offen. Falls Sie bereits überwiesen haben, geben Sie uns bitte Bescheid. {{sender_name}}", "de", "TPL-PAYMENT"),
  template("TPL-PAYMENT-EN", "Payment reminder", "Płatność", "SMS", undefined, "Hello, the remaining balance for your stay {{check_in}}–{{check_out}} is {{balance_due}}. If you have already sent the payment, please let us know. {{sender_name}}", "en", "TPL-PAYMENT"),
  template("TPL-PREARRIVAL-DE", "Informationen vor der Anreise", "Przed przyjazdem", "E-mail", "Anfahrt und Hinweise zur Anreise · {{check_in}}", "Guten Tag,\n\nhier finden Sie die Hinweise für Ihre Anreise zu Stawy u Sikory.\n\nFerienhaus: {{unit_name}}\nAnreise: {{check_in}} ab {{arrival_time}}\nAbreise: {{check_out}} bis {{departure_time}}\n\nAnfahrt\n{{route_warning}}\n\nHinweise für Ihren Aufenthalt\n{{travel_guide}}\n\nBitte teilen Sie uns Ihre ungefähre Ankunftszeit mit. Falls sich Ihre Pläne ändern, genügt eine kurze Antwort auf diese E-Mail.\n\nBis bald,\n{{sender_name}}", "de", "TPL-PREARRIVAL"),
  template("TPL-PREARRIVAL-EN", "Pre-arrival information", "Przed przyjazdem", "E-mail", "Directions and arrival details · {{check_in}}", "Hello,\n\nhere are the details for your arrival at Stawy u Sikory.\n\nCottage: {{unit_name}}\nArrival: {{check_in}} from {{arrival_time}}\nDeparture: {{check_out}} by {{departure_time}}\n\nDirections\n{{route_warning}}\n\nYour stay guide\n{{travel_guide}}\n\nPlease let us know roughly when you expect to arrive. If your plans change, a quick reply to this email is enough.\n\nSee you soon,\n{{sender_name}}", "en", "TPL-PREARRIVAL"),
  template("TPL-ARRIVAL-REMINDER-DE", "Kurze Erinnerung vor der Anreise", "Przed przyjazdem", "E-mail", "Bis morgen · {{unit_name}}", "Guten Tag,\n\nwir freuen uns auf Ihre Anreise morgen.\n\nFerienhaus: {{unit_name}}\nAnreise: {{check_in}} ab {{arrival_time}}\n\nFalls sich Ihre Ankunftszeit geändert hat, geben Sie uns bitte kurz Bescheid. Die Anfahrtsbeschreibung finden Sie in unserer vorherigen E-Mail.\n\nBis morgen,\n{{sender_name}}", "de", "TPL-ARRIVAL-REMINDER"),
  template("TPL-ARRIVAL-REMINDER-EN", "Short arrival reminder", "Przed przyjazdem", "E-mail", "See you tomorrow · {{unit_name}}", "Hello,\n\nwe look forward to welcoming you tomorrow.\n\nCottage: {{unit_name}}\nArrival: {{check_in}} from {{arrival_time}}\n\nIf your arrival time has changed, please let us know. Directions and the stay guide are in our earlier email.\n\nSee you soon,\n{{sender_name}}", "en", "TPL-ARRIVAL-REMINDER"),
  template("TPL-CHECK-DE", "Ist alles in Ordnung?", "W trakcie pobytu", "OTA", undefined, "Guten Tag,\n\nwie gefällt Ihnen Ihr Aufenthalt? Wenn wir helfen können oder etwas unsere Aufmerksamkeit braucht, geben Sie uns gerne Bescheid.\n\n{{sender_name}}", "de", "TPL-CHECK"),
  template("TPL-CHECK-EN", "Is everything all right?", "W trakcie pobytu", "OTA", undefined, "Hello,\n\nhow is your stay going? If we can help with anything or something needs our attention, please let us know.\n\n{{sender_name}}", "en", "TPL-CHECK"),
  template("TPL-CHECKOUT-DE", "Abreiseinformation", "Wyjazd", "OTA", undefined, "Guten Tag,\n\nIhr Aufenthalt im {{unit_name}} endet morgen. Bitte reisen Sie bis {{departure_time}} ab, damit wir das Ferienhaus für die nächsten Gäste vorbereiten können.\n\nWenn vor Ihrer Abreise noch etwas zu klären ist, geben Sie uns bitte Bescheid.\n\nVielen Dank für Ihren Besuch und eine gute Heimreise,\n{{sender_name}}", "de", "TPL-CHECKOUT"),
  template("TPL-CHECKOUT-EN", "Departure information", "Wyjazd", "OTA", undefined, "Hello,\n\nyour stay at {{unit_name}} ends tomorrow. Please check out by {{departure_time}} so we can prepare the cottage for the next guests.\n\nIf anything needs our attention before you leave, please let us know.\n\nThank you for staying with us, and have a safe journey,\n{{sender_name}}", "en", "TPL-CHECKOUT"),
  template("TPL-REVIEW-DE", "Bitte um eine Bewertung", "Opinia publiczna", "SMS", undefined, "Vielen Dank für Ihren Aufenthalt, {{guest_first_name}}. Wir freuen uns über Ihre ehrliche Bewertung. {{sender_name}}", "de", "TPL-REVIEW"),
  template("TPL-REVIEW-EN", "Review request", "Opinia publiczna", "SMS", undefined, "Thank you for staying with us, {{guest_first_name}}. We would appreciate your honest review. {{sender_name}}", "en", "TPL-REVIEW"),
  template("TPL-THANKS-DE", "Danke für Ihren Aufenthalt", "Prywatny feedback", "E-mail", "Vielen Dank für Ihren Besuch", "Guten Tag,\n\nvielen Dank für Ihren Aufenthalt bei Stawy u Sikory. Wir hoffen, Sie konnten sich gut erholen.\n\nWenn wir etwas verbessern können, antworten Sie gerne auf diese E-Mail. Ihre Rückmeldung hilft uns, künftige Aufenthalte noch angenehmer zu machen.\n\nViele Grüße,\n{{sender_name}}", "de", "TPL-THANKS"),
  template("TPL-THANKS-EN", "Thank you for your stay", "Prywatny feedback", "E-mail", "Thank you for staying with us", "Hello,\n\nthank you for staying at Stawy u Sikory. We hope you had time to relax.\n\nIf there is anything we could improve, please reply to this email. Your feedback helps us take better care of future stays.\n\nBest wishes,\n{{sender_name}}", "en", "TPL-THANKS"),
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
  return { ...template, version: template.channel === "E-mail" ? 3 : 2 };
}

function rule(id: string, name: string, templateId: string, trigger: AutomationRule["trigger"], offsetDays: number, sendTime: string): AutomationRule {
  return { id, name, templateId, trigger, offsetDays, sendTime, mode: "Wersja robocza", active: true, definitionVersion: 2 };
}

function automaticRule(id: string, name: string, templateId: string, trigger: AutomationRule["trigger"], offsetDays: number, sendTime: string): AutomationRule {
  return { ...rule(id, name, templateId, trigger, offsetDays, sendTime), mode: "Automatycznie" };
}

export function bookingFingerprint(booking: Booking) {
  return [booking.checkIn, booking.checkOut, booking.arrivalTime, booking.departureTime, booking.guestLabel, booking.paymentStatus, booking.workflowStatus, booking.unitId,
    booking.grossPrice, booking.currency, booking.depositAmount, booking.depositDueDate].join("|");
}

function communicationFingerprint(booking: Booking, language?: string, recipient?: string, templateVersion?: number, renderedContent?: string) {
  return [bookingFingerprint(booking), language, recipient, templateVersion, renderedContent].join("|");
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
  const eventTriggered = ["Po utworzeniu rezerwacji", "Po zarejestrowaniu płatności"].includes(rule.trigger);
  // Date-only events are immediately eligible; a booking made after noon must
  // not wait until the following day's scheduler window.
  const plannedDay = addLocalDays(base.slice(0, 10), rule.offsetDays);
  const lateArrivalInfo = rule.id === "RULE-PREARRIVAL" && plannedDay < booking.bookingDate;
  return polishDateTime(lateArrivalInfo ? booking.bookingDate : plannedDay,
    eventTriggered || lateArrivalInfo ? "00:00" : rule.sendTime);
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
    check_in: messageDate(booking.checkIn),
    check_out: messageDate(booking.checkOut),
    transfer_reference: `${booking.guestLabel.trim()} ${transferDateRange(booking.checkIn, booking.checkOut)}`,
    arrival_time: booking.arrivalTime || "16:00",
    departure_time: booking.departureTime || "11:00",
    booking_id: booking.platformReservationNo || booking.id,
    balance_due: finance.balanceStatus === "overpaid"
      ? `0 ${finance.currency ?? ""} (nadpłata ${(finance.overpayment ?? 0).toLocaleString("pl-PL")} ${finance.currency ?? ""})`.replaceAll(/\s+/g, " ").trim()
      : balanceDue,
    booking_price: booking.grossPrice == null ? "{{booking_price}}" : `${booking.grossPrice.toLocaleString("pl-PL")} ${booking.currency ?? "PLN"}`,
    deposit_amount: booking.depositAmount == null ? "{{deposit_amount}}" : `${booking.depositAmount.toLocaleString("pl-PL")} ${booking.currency ?? "PLN"}`,
    deposit_to_pay: booking.depositAmount == null ? "{{deposit_amount}}" : `${Math.min(finance.amountDue ?? booking.depositAmount, Math.max(0, booking.depositAmount - finance.guestPaidNet)).toLocaleString("pl-PL")} ${booking.currency ?? "PLN"}`,
    deposit_due: booking.depositDueDate ? messageDate(booking.depositDueDate < booking.bookingDate ? booking.bookingDate : booking.depositDueDate) : "{{deposit_due}}",
    bank_account: config?.bankAccountNumber ? `${config.bankAccountNumber}${config.bankAccountRecipient ? ` (${config.bankAccountRecipient})` : ""}` : "{{bank_account}}",
    travel_guide: guide?.body || "{{travel_guide}}",
    route_warning: guide?.routeWarning || "{{route_warning}}",
    sender_name: config?.senderName || "Stawy u Sikory",
  };
  const replace = (value?: string) => value?.replace(/{{\s*([a-z_]+)\s*}}/g, (_, key: string) => values[key] ?? `{{${key}}}`);
  const body = replace(template.body.replaceAll("{{payment_instructions}}", paymentMessage(booking, finance, template.language))) || "";
  const subject = replace(template.subject);
  const unresolved = Array.from(new Set([...`${subject ?? ""}\n${body}`.matchAll(/{{\s*([^}]+)\s*}}/g)].map((match) => match[1])));
  return { body, subject, unresolved };
}

export type CommunicationData = Pick<AppData, "bookings" | "units" | "payments" | "communicationConfigs" | "guests" | "people" | "consents" | "consentLedger" | "messageTemplates" | "automationRules" | "scheduledMessages">;

export function reconcileScheduledMessages(data: CommunicationData, now = new Date()): ScheduledMessage[] {
  const current = new Map(data.scheduledMessages.map((item) => [item.id, item]));
  const output: ScheduledMessage[] = [];
  const today = todayInPoland(now);
  for (const booking of data.bookings) {
    if (booking.historicalImport) continue;
    for (const rule of data.automationRules.filter((item) => item.active)) {
      const messageId = `SCH-${rule.id}-${booking.id}`;
      const existing = current.get(messageId);
      if (existing && ["Wysłana", "Dostarczona", "Anulowana"].includes(existing.status)) {
        output.push(existing);
        continue;
      }
      const afterDeparture = rule.trigger === "Po wyjeździe";
      if (!existing && booking.checkOut <= today && !afterDeparture) continue;
      if (!existing && afterDeparture && today > addLocalDays(booking.checkOut, rule.offsetDays + 2)) continue;
      const baseTemplate = data.messageTemplates.find((item) => item.id === rule.templateId && item.active);
      if (!baseTemplate) continue;
      const profile = data.guests.find((item) => item.bookingId === booking.id);
      const person = data.people.find((item) => item.id === profile?.personId);
      const language = bookingLanguage(data, booking.id);
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
      if (!existing && booking.importRef?.source === "mobile-calendar" && todayInPoland(new Date(candidateDueAt)) < today) continue;
      const rendered = renderTemplate(template, booking, data);
      const consent = data.consents.find((item) => item.bookingId === booking.id);
      const recipient = contactFor(template, consent);
      const fingerprint = language
        ? communicationFingerprint(booking, language, recipient, template.version, `${rendered.subject ?? ""}\n${rendered.body}`)
        : bookingFingerprint(booking);
      const blockingReasons = [
        booking.deletedAt ? "Rezerwacja została usunięta" : undefined,
        rule.trigger === "Po utworzeniu rezerwacji" && today > booking.checkIn
          ? "Termin potwierdzenia nowej rezerwacji minął" : undefined,
        rule.id === "RULE-ARRIVAL-REMINDER" && today >= booking.checkIn
          ? "Termin przypomnienia o jutrzejszym przyjeździe minął" : undefined,
        rule.trigger === "Przed przyjazdem" && today > booking.checkIn
          ? "Termin wiadomości przed przyjazdem minął" : undefined,
        rule.trigger === "Przed wyjazdem" && today >= booking.checkOut
          ? "Termin wiadomości przed wyjazdem minął" : undefined,
        afterDeparture && today > addLocalDays(booking.checkOut, rule.offsetDays + 2)
          ? "Termin wiadomości po pobycie minął" : undefined,
        rule.id === "RULE-ARRIVAL-REMINDER" && booking.bookingDate >= addLocalDays(booking.checkIn, -1)
          ? "Przy późnej rezerwacji wystarczy wiadomość z informacjami na przyjazd" : undefined,
        rule.id === "RULE-DEPOSIT-CONFIRMED" && (calculateBookingFinance(booking, data.payments).guestPaidNet <= 0
          || calculateBookingFinance(booking, data.payments).perspectives.receivables.completeness !== "complete")
          ? "Brak potwierdzonej wpłaty od gościa" : undefined,
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
  // Keep delivery history and cancel pending messages whose rule or booking
  // disappeared. Never silently erase evidence of an attempted delivery.
  const retained = new Set(output.map(item => item.id));
  for (const saved of data.scheduledMessages) {
    if (!retained.has(saved.id)) output.push(["Wysłana", "Dostarczona", "Anulowana"].includes(saved.status)
      ? saved : { ...saved, status: "Anulowana", blockedReason: "Rezerwacja lub reguła nie jest już aktywna" });
  }
  return output.sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}
