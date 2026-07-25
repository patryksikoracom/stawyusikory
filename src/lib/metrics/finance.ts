import type { Booking, Currency, PaymentTransaction, Unit } from "@/lib/types";
import { isActiveBooking } from "@/lib/metrics/commercial";

export type FinanceCompleteness = "complete" | "partial" | "unavailable";

export type FinanceIssueCode =
  | "missing_booking_price"
  | "missing_booking_currency"
  | "invalid_opening_balance"
  | "opening_balance_currency_missing"
  | "opening_balance_currency_mismatch"
  | "opening_balance_source_missing"
  | "invalid_transaction_amount"
  | "transaction_currency_missing"
  | "transaction_currency_mismatch"
  | "payment_status_without_evidence";

export type FinanceIssue = {
  code: FinanceIssueCode;
  recordId: string;
};

export type FinancePerspective = {
  metricId:
    | "sales_booking_value_v1"
    | "receivables_guest_balance_v1"
    | "cashflow_posted_transactions_v1"
    | "management_result_inputs_v1";
  currency: Currency | null;
  completeness: FinanceCompleteness;
};

export type BookingFinance = {
  bookingId: string;
  currency: Currency | null;
  bookingValue: number | null;
  openingPaid: number;
  openingPaidSource: string | null;
  guestPayments: number;
  guestRefunds: number;
  guestPaidNet: number;
  balance: number | null;
  amountDue: number | null;
  overpayment: number | null;
  balanceStatus: "due" | "settled" | "overpaid" | "unavailable";
  cashflow: {
    inflows: number;
    outflows: number;
    net: number;
  };
  managementInputs: {
    commission: number;
    costs: number;
    otaPayout: number;
  };
  perspectives: {
    sales: FinancePerspective;
    receivables: FinancePerspective;
    cashflow: FinancePerspective;
    management: FinancePerspective;
  };
  issues: FinanceIssue[];
};

export type MoneyByCurrency = Record<Currency, number>;

export type FinanceOverview = {
  bookingCount: number;
  transactionCount: number;
  managementTransactionCount: number;
  sales: MoneyByCurrency;
  receivables: MoneyByCurrency;
  overpayments: MoneyByCurrency;
  cashflow: MoneyByCurrency;
  commissions: MoneyByCurrency;
  costs: MoneyByCurrency;
  otaPayouts: MoneyByCurrency;
  completeness: {
    sales: FinanceCompleteness;
    receivables: FinanceCompleteness;
    cashflow: FinanceCompleteness;
    management: FinanceCompleteness;
  };
  bookingFinances: BookingFinance[];
};

const GUEST_INFLOW_TYPES = new Set<PaymentTransaction["type"]>(["Wpłata", "Zaliczka"]);
const CASH_INFLOW_TYPES = new Set<PaymentTransaction["type"]>(["Wpłata", "Zaliczka", "Wypłata OTA"]);
const CASH_OUTFLOW_TYPES = new Set<PaymentTransaction["type"]>(["Zwrot", "Prowizja", "Koszt"]);

function isValidAmount(value: number | undefined): value is number {
  return value != null && Number.isFinite(value) && value >= 0;
}

function uniqueIssues(issues: FinanceIssue[]) {
  return issues.filter((issue, index) => issues.findIndex(
    (candidate) => candidate.code === issue.code && candidate.recordId === issue.recordId,
  ) === index);
}

function completeness(unavailable: boolean, issues: FinanceIssue[]): FinanceCompleteness {
  if (unavailable) return "unavailable";
  return issues.length ? "partial" : "complete";
}

export function calculateBookingFinance(
  booking: Booking,
  payments: PaymentTransaction[],
): BookingFinance {
  const issues: FinanceIssue[] = [];
  const receivablesIssues: FinanceIssue[] = [];
  const currency = booking.currency ?? null;
  const bookingValue = isValidAmount(booking.grossPrice) ? booking.grossPrice : null;

  if (bookingValue == null) {
    const issue = { code: "missing_booking_price" as const, recordId: booking.id };
    issues.push(issue);
    receivablesIssues.push(issue);
  }
  if (!currency) {
    const issue = { code: "missing_booking_currency" as const, recordId: booking.id };
    issues.push(issue);
    receivablesIssues.push(issue);
  }

  let openingPaid = 0;
  if (booking.openingPaidAmount != null) {
    if (!isValidAmount(booking.openingPaidAmount)) {
      const issue = { code: "invalid_opening_balance" as const, recordId: booking.id };
      issues.push(issue);
      receivablesIssues.push(issue);
    } else {
      const openingCurrency = booking.openingPaidCurrency ?? currency;
      if (!booking.openingPaidCurrency) {
        const issue = { code: "opening_balance_currency_missing" as const, recordId: booking.id };
        issues.push(issue);
        receivablesIssues.push(issue);
      }
      if (!booking.openingPaidSource?.trim()) {
        const issue = { code: "opening_balance_source_missing" as const, recordId: booking.id };
        issues.push(issue);
        receivablesIssues.push(issue);
      }
      if (currency && openingCurrency && openingCurrency !== currency) {
        const issue = { code: "opening_balance_currency_mismatch" as const, recordId: booking.id };
        issues.push(issue);
        receivablesIssues.push(issue);
      } else if (currency && openingCurrency === currency) {
        openingPaid = booking.openingPaidAmount;
      }
    }
  }

  let guestPayments = 0;
  let guestRefunds = 0;
  let cashInflows = 0;
  let cashOutflows = 0;
  let commission = 0;
  let costs = 0;
  let otaPayout = 0;
  let postedEvidenceCount = booking.openingPaidAmount != null ? 1 : 0;

  for (const payment of payments) {
    if (payment.bookingId !== booking.id || payment.status !== "Zaksięgowana") continue;
    if (!isValidAmount(payment.amount)) {
      const issue = { code: "invalid_transaction_amount" as const, recordId: payment.id };
      issues.push(issue);
      if (GUEST_INFLOW_TYPES.has(payment.type) || payment.type === "Zwrot") receivablesIssues.push(issue);
      continue;
    }
    const paymentCurrency = payment.currency ?? currency;
    if (!payment.currency) {
      const issue = { code: "transaction_currency_missing" as const, recordId: payment.id };
      issues.push(issue);
      if (GUEST_INFLOW_TYPES.has(payment.type) || payment.type === "Zwrot") receivablesIssues.push(issue);
    }
    if (!currency || !paymentCurrency || paymentCurrency !== currency) {
      const issue = { code: "transaction_currency_mismatch" as const, recordId: payment.id };
      issues.push(issue);
      if (GUEST_INFLOW_TYPES.has(payment.type) || payment.type === "Zwrot") receivablesIssues.push(issue);
      continue;
    }
    postedEvidenceCount += 1;
    if (GUEST_INFLOW_TYPES.has(payment.type)) guestPayments += payment.amount;
    if (payment.type === "Zwrot") guestRefunds += payment.amount;
    if (CASH_INFLOW_TYPES.has(payment.type)) cashInflows += payment.amount;
    if (CASH_OUTFLOW_TYPES.has(payment.type)) cashOutflows += payment.amount;
    if (payment.type === "Prowizja") commission += payment.amount;
    if (payment.type === "Koszt") costs += payment.amount;
    if (payment.type === "Wypłata OTA") otaPayout += payment.amount;
  }

  const guestPaidNet = openingPaid + guestPayments - guestRefunds;
  if (
    postedEvidenceCount === 0
    && ["Opłacone", "Zaliczka", "Częściowo"].includes(booking.paymentStatus)
  ) {
    const issue = { code: "payment_status_without_evidence" as const, recordId: booking.id };
    issues.push(issue);
    receivablesIssues.push(issue);
  }

  const balance = bookingValue == null || !currency ? null : bookingValue - guestPaidNet;
  const amountDue = balance == null ? null : Math.max(0, balance);
  const overpayment = balance == null ? null : Math.max(0, -balance);
  const balanceStatus = balance == null
    ? "unavailable"
    : balance > 0.005 ? "due"
      : balance < -0.005 ? "overpaid"
        : "settled";
  const issueList = uniqueIssues(issues);
  const salesIssues = issueList.filter((issue) => [
    "missing_booking_price",
    "missing_booking_currency",
  ].includes(issue.code));
  const receivablesIssueList = uniqueIssues(receivablesIssues);
  const transactionIssues = issueList.filter((issue) => [
    "invalid_transaction_amount",
    "transaction_currency_missing",
    "transaction_currency_mismatch",
  ].includes(issue.code));

  return {
    bookingId: booking.id,
    currency,
    bookingValue,
    openingPaid,
    openingPaidSource: booking.openingPaidSource?.trim() || null,
    guestPayments,
    guestRefunds,
    guestPaidNet,
    balance,
    amountDue,
    overpayment,
    balanceStatus,
    cashflow: { inflows: cashInflows, outflows: cashOutflows, net: cashInflows - cashOutflows },
    managementInputs: { commission, costs, otaPayout },
    perspectives: {
      sales: {
        metricId: "sales_booking_value_v1",
        currency,
        completeness: completeness(bookingValue == null || !currency, salesIssues),
      },
      receivables: {
        metricId: "receivables_guest_balance_v1",
        currency,
        completeness: completeness(balance == null, receivablesIssueList),
      },
      cashflow: {
        metricId: "cashflow_posted_transactions_v1",
        currency,
        completeness: completeness(!currency, transactionIssues),
      },
      management: {
        metricId: "management_result_inputs_v1",
        currency,
        completeness: completeness(!currency, transactionIssues),
      },
    },
    issues: issueList,
  };
}

function emptyMoney(): MoneyByCurrency {
  return { PLN: 0, EUR: 0 };
}

function overviewCompleteness(
  sampleSize: number,
  allUnavailable: boolean,
  hasIncomplete: boolean,
): FinanceCompleteness {
  if (sampleSize === 0 || allUnavailable) return "unavailable";
  return hasIncomplete ? "partial" : "complete";
}

export function calculateFinanceOverview(input: {
  bookings: Booking[];
  payments: PaymentTransaction[];
  period: { from: string; toExclusive: string };
}): FinanceOverview {
  const periodBookings = input.bookings.filter((booking) => (
    isActiveBooking(booking)
    && booking.checkIn >= input.period.from
    && booking.checkIn < input.period.toExclusive
  ));
  const bookingFinances = periodBookings.map((booking) => calculateBookingFinance(booking, input.payments));
  const sales = emptyMoney();
  const receivables = emptyMoney();
  const overpayments = emptyMoney();

  for (const finance of bookingFinances) {
    if (!finance.currency) continue;
    if (finance.bookingValue != null) sales[finance.currency] += finance.bookingValue;
    if (finance.amountDue != null) receivables[finance.currency] += finance.amountDue;
    if (finance.overpayment != null) overpayments[finance.currency] += finance.overpayment;
  }

  const cashflow = emptyMoney();
  const commissions = emptyMoney();
  const costs = emptyMoney();
  const otaPayouts = emptyMoney();
  const bookingById = new Map(input.bookings.map((booking) => [booking.id, booking]));
  let transactionCount = 0;
  let transactionIssues = 0;
  let managementCount = 0;

  for (const payment of input.payments) {
    if (
      payment.status !== "Zaksięgowana"
      || payment.occurredAt < input.period.from
      || payment.occurredAt >= input.period.toExclusive
    ) continue;
    if (!isValidAmount(payment.amount)) {
      transactionIssues += 1;
      continue;
    }
    const linkedBooking = bookingById.get(payment.bookingId);
    const currency = payment.currency ?? linkedBooking?.currency;
    if (!currency) {
      transactionIssues += 1;
      continue;
    }
    if (!payment.currency) transactionIssues += 1;
    transactionCount += 1;
    if (CASH_INFLOW_TYPES.has(payment.type)) cashflow[currency] += payment.amount;
    if (CASH_OUTFLOW_TYPES.has(payment.type)) cashflow[currency] -= payment.amount;
    if (payment.type === "Prowizja") {
      commissions[currency] += payment.amount;
      managementCount += 1;
    }
    if (payment.type === "Koszt") {
      costs[currency] += payment.amount;
      managementCount += 1;
    }
    if (payment.type === "Wypłata OTA") otaPayouts[currency] += payment.amount;
  }

  return {
    bookingCount: periodBookings.length,
    transactionCount,
    managementTransactionCount: managementCount,
    sales,
    receivables,
    overpayments,
    cashflow,
    commissions,
    costs,
    otaPayouts,
    completeness: {
      sales: overviewCompleteness(
        bookingFinances.length,
        bookingFinances.every((finance) => finance.perspectives.sales.completeness === "unavailable"),
        bookingFinances.some((finance) => finance.perspectives.sales.completeness !== "complete"),
      ),
      receivables: overviewCompleteness(
        bookingFinances.length,
        bookingFinances.every((finance) => finance.perspectives.receivables.completeness === "unavailable"),
        bookingFinances.some((finance) => finance.perspectives.receivables.completeness !== "complete"),
      ),
      cashflow: overviewCompleteness(transactionCount, false, transactionIssues > 0),
      management: overviewCompleteness(managementCount, false, transactionIssues > 0),
    },
    bookingFinances,
  };
}

function csvCell(value: string | number | null) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export function buildBookingFinanceCsv(input: {
  bookings: Booking[];
  payments: PaymentTransaction[];
  units: Unit[];
}) {
  const units = new Map(input.units.map((unit) => [unit.id, unit.name]));
  const lines: Array<Array<string | number | null>> = [[
    "rezerwacja",
    "gość",
    "domek",
    "waluta",
    "wartość_rezerwacji",
    "saldo_otwarcia",
    "źródło_salda_otwarcia",
    "wpłaty_i_zaliczki",
    "zwroty",
    "wpłacono_od_gościa",
    "saldo_surowe",
    "pozostało",
    "nadpłata",
    "kompletność",
  ]];
  for (const booking of input.bookings) {
    const finance = calculateBookingFinance(booking, input.payments);
    lines.push([
      booking.id,
      booking.guestLabel,
      units.get(booking.unitId) ?? booking.unitId,
      finance.currency,
      finance.bookingValue,
      finance.openingPaid,
      finance.openingPaidSource,
      finance.guestPayments,
      finance.guestRefunds,
      finance.guestPaidNet,
      finance.balance,
      finance.amountDue,
      finance.overpayment,
      finance.perspectives.receivables.completeness,
    ]);
  }
  return lines.map((line) => line.map(csvCell).join(",")).join("\n");
}

export function financeIssueLabel(code: FinanceIssueCode) {
  const labels: Record<FinanceIssueCode, string> = {
    missing_booking_price: "Brak wartości rezerwacji.",
    missing_booking_currency: "Brak waluty rezerwacji.",
    invalid_opening_balance: "Saldo otwarcia ma nieprawidłową kwotę.",
    opening_balance_currency_missing: "Saldo otwarcia nie ma zapisanej waluty; przyjęto walutę rezerwacji.",
    opening_balance_currency_mismatch: "Waluta salda otwarcia nie zgadza się z rezerwacją.",
    opening_balance_source_missing: "Saldo otwarcia nie ma zapisanego źródła.",
    invalid_transaction_amount: "Transakcja ma nieprawidłową kwotę.",
    transaction_currency_missing: "Transakcja nie ma zapisanej waluty; przyjęto walutę rezerwacji.",
    transaction_currency_mismatch: "Waluta transakcji nie zgadza się z rezerwacją.",
    payment_status_without_evidence: "Status płatności nie ma potwierdzenia w rejestrze transakcji.",
  };
  return labels[code];
}
