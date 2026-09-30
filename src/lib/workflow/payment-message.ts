import type { Booking, MessageTemplate } from "../types";
import type { BookingFinance } from "../metrics/finance";

/** Compact stay dates for the bank transfer reference, including year changes. */
export function transferDateRange(from: string, to: string) {
  const [fy, fm, fd] = from.split("-");
  const [ty, tm, td] = to.split("-");
  if (fy !== ty) return `${fd}.${fm}/${fy.slice(-2)}-${td}.${tm}/${ty.slice(-2)}`;
  if (fm !== tm) return `${fd}.${fm}-${td}.${tm}/${fy.slice(-2)}`;
  return `${fd}-${td}.${tm}/${fy.slice(-2)}`;
}

export function messageDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}

/** Returns template copy, not rendered values. No bank request for a paid stay or OTA booking. */
export function paymentMessage(booking: Booking, finance: BookingFinance, language: MessageTemplate["language"]) {
  const copy = {
    pl: {
      platform: "Szczegóły rozliczenia znajdziesz w potwierdzeniu z platformy, przez którą powstała rezerwacja. Ten mail nie jest prośbą o dodatkową wpłatę.",
      settled: "Pobyt jest opłacony. Nie trzeba wpłacać kolejnej zaliczki.",
      noDeposit: "Zgodnie z ustaleniami nie wymagamy zaliczki. Pozostałe rozliczenie odbędzie się na uzgodnionych warunkach.",
      depositPaid: "Zaliczka jest rozliczona — dziękujemy. Pozostało do zapłaty za pobyt: {{balance_due}}.",
      custom: "Rozliczenie pobytu pozostaje zgodne z naszymi indywidualnymi ustaleniami.",
      request: "Do wpłaty na poczet zaliczki: {{deposit_to_pay}}\nTermin wpłaty: {{deposit_due}}\nKonto i odbiorca: {{bank_account}}\n\nTytuł przelewu:\n{{transfer_reference}}\n\nTytuł zawiera dane osoby z rezerwacji i daty pobytu — dzięki temu łatwo dopasujemy wpłatę.",
    },
    en: {
      platform: "Please refer to your booking platform's confirmation for payment details. This email is not a request for an additional payment.",
      settled: "Your stay is fully paid. No further deposit is needed.",
      noDeposit: "As agreed, no deposit is required. The remaining payment follows our agreed arrangements.",
      depositPaid: "Your deposit is settled. Thank you. The remaining balance for your stay is {{balance_due}}.",
      custom: "Payment for your stay follows our individual arrangements.",
      request: "Deposit still to pay: {{deposit_to_pay}}\nPayment deadline: {{deposit_due}}\nBank account and recipient: {{bank_account}}\n\nTransfer reference:\n{{transfer_reference}}\n\nThe reference contains the name on the booking and the stay dates, so we can match your payment.",
    },
    de: {
      platform: "Die Zahlungsdetails finden Sie in der Bestätigung Ihrer Buchungsplattform. Diese E-Mail ist keine Aufforderung zu einer zusätzlichen Zahlung.",
      settled: "Ihr Aufenthalt ist vollständig bezahlt. Eine weitere Anzahlung ist nicht erforderlich.",
      noDeposit: "Wie vereinbart ist keine Anzahlung erforderlich. Die weitere Abrechnung erfolgt nach unserer Vereinbarung.",
      depositPaid: "Ihre Anzahlung ist beglichen. Vielen Dank. Der Restbetrag für Ihren Aufenthalt beträgt {{balance_due}}.",
      custom: "Die Abrechnung Ihres Aufenthalts erfolgt nach unserer individuellen Vereinbarung.",
      request: "Noch zu zahlende Anzahlung: {{deposit_to_pay}}\nZahlungsfrist: {{deposit_due}}\nBankverbindung und Empfänger: {{bank_account}}\n\nVerwendungszweck:\n{{transfer_reference}}\n\nDer Verwendungszweck enthält den Namen der buchenden Person und die Aufenthaltsdaten, damit wir Ihre Zahlung zuordnen können.",
    },
  }[language];
  if (["Booking", "Airbnb", "Agoda", "Expedia", "VRBO", "Slowhop", "Aloha Camp"].includes(booking.platform)) return copy.platform;
  if (booking.paymentStatus === "Barter") return copy.custom;
  if (finance.perspectives.receivables.completeness !== "complete") return "{{payment_details}}";
  if (finance.amountDue === 0) return copy.settled;
  if (booking.depositAmount == null) return "{{deposit_amount}}";
  if (booking.depositAmount === 0) return copy.noDeposit;
  if (finance.guestPaidNet >= booking.depositAmount) return copy.depositPaid;
  return copy.request;
}
