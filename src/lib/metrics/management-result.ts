import type {
  Booking,
  Channel,
  CostCategory,
  CostSetting,
  Currency,
  PaymentTransaction,
  PlatformImport,
  Unit,
} from "@/lib/types";
import { isActiveBooking } from "@/lib/metrics/commercial";
import { nightsBetween } from "@/lib/workflow/rules";

export type ManagementCompleteness = "complete" | "partial" | "unavailable";

export type ManagementIssueCode =
  | "missing_booking_price"
  | "missing_booking_currency"
  | "missing_cost_inputs"
  | "cost_source_missing"
  | "cost_currency_missing"
  | "cost_period_missing"
  | "shared_allocation_missing"
  | "commission_platform_missing"
  | "actual_source_missing"
  | "actual_currency_missing"
  | "duplicate_cost_risk"
  | "ota_commission_missing";

export type ManagementIssue = {
  code: ManagementIssueCode;
  recordId: string;
  label: string;
  question: string;
  blocking: boolean;
};

export type ManagementLine = {
  id: string;
  label: string;
  kind: "actual" | "modeled";
  category: CostCategory;
  currency: Currency;
  amount: number;
  source: string | null;
  sourceRef: string | null;
  unitId: string | null;
  platform: Channel | null;
  costSettingId: string | null;
};

export type ManagementCurrencyResult = {
  currency: Currency;
  sales: number;
  actualCosts: number;
  modeledCosts: number;
  actualCommissions: number;
  modeledCommissions: number;
  totalCosts: number;
  result: number | null;
  completeness: ManagementCompleteness;
  issues: ManagementIssue[];
};

export type ManagementUnitResult = {
  unitId: string;
  currency: Currency;
  sales: number;
  costs: number;
  commissions: number;
  result: number;
};

export type ManagementReadinessCheck = {
  id: "bookings" | "operating-costs" | "commissions" | "sources" | "allocation";
  label: string;
  ready: boolean;
  note: string;
};

export type ManagementResult = {
  period: { from: string; toExclusive: string };
  bookingCount: number;
  lines: ManagementLine[];
  currencies: ManagementCurrencyResult[];
  units: ManagementUnitResult[];
  issues: ManagementIssue[];
  readiness: {
    readyCount: number;
    totalCount: number;
    checks: ManagementReadinessCheck[];
    questions: string[];
  };
};

type ManagementInput = {
  bookings: Booking[];
  payments: PaymentTransaction[];
  costSettings: CostSetting[];
  imports: PlatformImport[];
  units: Unit[];
  period: { from: string; toExclusive: string };
};

type LineAllocation = {
  line: ManagementLine;
  allocations: Array<{ unitId: string; amount: number }>;
};

const OTA_PLATFORMS = new Set<Channel>([
  "Booking",
  "Airbnb",
  "Agoda",
  "Expedia",
  "VRBO",
  "Slowhop",
  "Aloha Camp",
]);

function validAmount(value: number | undefined): value is number {
  return value != null && Number.isFinite(value) && value >= 0;
}

function costKind(cost: CostSetting) {
  return cost.kind ?? (cost.category === "Prowizja OTA" ? "commission" : "operating");
}

function overlapsPeriod(
  value: { dateFrom?: string; dateTo?: string },
  period: ManagementInput["period"],
) {
  return (!value.dateFrom || value.dateFrom < period.toExclusive)
    && (!value.dateTo || value.dateTo >= period.from);
}

function calendarMonths(period: ManagementInput["period"]) {
  const start = new Date(`${period.from}T00:00:00Z`);
  const end = new Date(`${period.toExclusive}T00:00:00Z`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) return 0;
  let count = 0;
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  while (cursor < end) {
    count += 1;
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return count;
}

function nextLocalDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function issue(
  code: ManagementIssueCode,
  recordId: string,
  label: string,
  question: string,
  blocking = false,
): ManagementIssue {
  return { code, recordId, label, question, blocking };
}

function uniqueIssues(issues: ManagementIssue[]) {
  return issues.filter((item, index) => issues.findIndex(
    (candidate) => candidate.code === item.code && candidate.recordId === item.recordId,
  ) === index);
}

function allocate(
  amount: number,
  cost: CostSetting,
  scopedBookings: Booking[],
  units: Unit[],
) {
  if (cost.unitId) return [{ unitId: cost.unitId, amount }];
  const eligibleUnits = units.filter((unit) => (
    !cost.platform || scopedBookings.some((booking) => booking.unitId === unit.id)
  ));
  if (!eligibleUnits.length) return [];
  if (cost.allocation === "revenue") {
    const revenue = eligibleUnits.map((unit) => ({
      unitId: unit.id,
      amount: scopedBookings
        .filter((booking) => booking.unitId === unit.id)
        .reduce((sum, booking) => sum + (booking.grossPrice ?? 0), 0),
    }));
    const total = revenue.reduce((sum, item) => sum + item.amount, 0);
    if (total > 0) {
      return revenue.map((item) => ({ unitId: item.unitId, amount: amount * item.amount / total }));
    }
  }
  return eligibleUnits.map((unit) => ({ unitId: unit.id, amount: amount / eligibleUnits.length }));
}

function modeledAmount(cost: CostSetting, bookings: Booking[], months: number) {
  const revenue = bookings.reduce((sum, booking) => sum + (booking.grossPrice ?? 0), 0);
  const nights = bookings.reduce(
    (sum, booking) => sum + nightsBetween(booking.checkIn, booking.checkOut),
    0,
  );
  return cost.unit === "miesiąc" ? cost.value * months
    : cost.unit === "rok" ? cost.value * months / 12
      : cost.unit === "pobyt" ? cost.value * bookings.length
        : cost.unit === "noc" ? cost.value * nights
          : revenue * cost.value / 100;
}

function completeness(issues: ManagementIssue[], hasInputs: boolean): ManagementCompleteness {
  if (!hasInputs || issues.some((item) => item.blocking)) return "unavailable";
  return issues.length ? "partial" : "complete";
}

export function calculateManagementResult(input: ManagementInput): ManagementResult {
  const issues: ManagementIssue[] = [];
  const periodBookings = input.bookings.filter((booking) => (
    isActiveBooking(booking)
    && booking.checkIn >= input.period.from
    && booking.checkIn < input.period.toExclusive
  ));
  const bookingById = new Map(input.bookings.map((booking) => [booking.id, booking]));
  const bookingCurrency = new Map<string, Currency>();

  for (const booking of periodBookings) {
    if (!validAmount(booking.grossPrice)) {
      issues.push(issue(
        "missing_booking_price",
        booking.id,
        `${booking.guestLabel}: brak ceny pobytu`,
        `Jaka była pełna cena pobytu ${booking.guestLabel} (${booking.checkIn}–${booking.checkOut})?`,
        true,
      ));
    }
    if (!booking.currency) {
      issues.push(issue(
        "missing_booking_currency",
        booking.id,
        `${booking.guestLabel}: brak waluty`,
        `Czy cena pobytu ${booking.guestLabel} była w PLN czy EUR?`,
        true,
      ));
    } else {
      bookingCurrency.set(booking.id, booking.currency);
    }
  }

  const actualAllocations: LineAllocation[] = [];
  const actualCommissionBookings = new Set<string>();
  const actualBySetting = new Set<string>();

  for (const payment of input.payments) {
    if (
      payment.status !== "Zaksięgowana"
      || !["Koszt", "Prowizja"].includes(payment.type)
      || payment.occurredAt < input.period.from
      || payment.occurredAt >= input.period.toExclusive
      || !validAmount(payment.amount)
    ) continue;
    const booking = bookingById.get(payment.bookingId);
    const currency = payment.currency ?? booking?.currency;
    if (!currency) {
      issues.push(issue(
        "actual_currency_missing",
        payment.id,
        `${payment.type} ${payment.id}: brak waluty`,
        `W jakiej walucie zaksięgowano pozycję „${payment.note || payment.type}” z ${payment.occurredAt}?`,
        true,
      ));
      continue;
    }
    if (!payment.source?.trim()) {
      issues.push(issue(
        "actual_source_missing",
        payment.id,
        `${payment.type} ${payment.id}: brak źródła`,
        `Z jakiego dokumentu lub rozliczenia pochodzi ${payment.amount} ${currency} — „${payment.note || payment.type}”?`,
      ));
    }
    const isCommission = payment.type === "Prowizja";
    if (isCommission) actualCommissionBookings.add(payment.bookingId);
    if (payment.costSettingId) actualBySetting.add(payment.costSettingId);
    const unitId = payment.unitId ?? booking?.unitId ?? null;
    const line: ManagementLine = {
      id: payment.id,
      label: payment.note?.trim() || payment.type,
      kind: "actual",
      category: isCommission ? "Prowizja OTA" : payment.costCategory ?? "Inne",
      currency,
      amount: payment.amount,
      source: payment.source?.trim() || null,
      sourceRef: payment.sourceRef?.trim() || null,
      unitId,
      platform: isCommission ? booking?.platform ?? null : null,
      costSettingId: payment.costSettingId ?? null,
    };
    actualAllocations.push({
      line,
      allocations: unitId ? [{ unitId, amount: line.amount }] : [],
    });
  }

  for (const booking of periodBookings) {
    if (!OTA_PLATFORMS.has(booking.platform) || actualCommissionBookings.has(booking.id)) continue;
    const imported = input.imports.find((item) => (
      item.matchedBookingId === booking.id
      && validAmount(item.commission)
    ));
    const currency = booking.currency;
    if (!imported || !currency) continue;
    actualCommissionBookings.add(booking.id);
    actualAllocations.push({
      line: {
        id: `IMPORT-COMMISSION-${imported.id}`,
        label: `Prowizja ${booking.platform}`,
        kind: "actual",
        category: "Prowizja OTA",
        currency,
        amount: imported.commission!,
        source: `Import ${booking.platform}`,
        sourceRef: imported.reservationNo ?? imported.id,
        unitId: booking.unitId,
        platform: booking.platform,
        costSettingId: null,
      },
      allocations: [{ unitId: booking.unitId, amount: imported.commission! }],
    });
  }

  const modeledAllocations: LineAllocation[] = [];
  const activeSettings = input.costSettings.filter((cost) => (
    cost.active && validAmount(cost.value) && cost.value > 0 && overlapsPeriod(cost, input.period)
  ));

  for (const cost of activeSettings) {
    const kind = costKind(cost);
    const currency = cost.currency ?? "PLN";
    if (!cost.currency) {
      issues.push(issue(
        "cost_currency_missing",
        cost.id,
        `${cost.label}: brak zapisanej waluty`,
        `Czy założenie „${cost.label}” jest podane w PLN czy EUR?`,
      ));
    }
    if (!cost.source?.trim()) {
      issues.push(issue(
        "cost_source_missing",
        cost.id,
        `${cost.label}: brak źródła`,
        `Skąd pochodzi kwota lub stawka „${cost.label}” — faktura, umowa, panel OTA czy szacunek właściciela?`,
      ));
    }
    if (!cost.dateFrom || !cost.dateTo) {
      issues.push(issue(
        "cost_period_missing",
        cost.id,
        `${cost.label}: niepełny okres obowiązywania`,
        `Od kiedy do kiedy obowiązuje kwota lub stawka „${cost.label}”?`,
      ));
    }
    if (!cost.unitId && !cost.allocation) {
      issues.push(issue(
        "shared_allocation_missing",
        cost.id,
        `${cost.label}: brak podziału między domki`,
        `Czy koszt „${cost.label}” dzielimy równo między domki, czy proporcjonalnie do ich przychodu?`,
      ));
    }
    if (kind === "commission" && !cost.platform) {
      issues.push(issue(
        "commission_platform_missing",
        cost.id,
        `${cost.label}: brak platformy`,
        `Której platformy dotyczy stawka „${cost.label}”?`,
        true,
      ));
    }

    if (actualBySetting.has(cost.id)) continue;
    const costPeriod = {
      from: cost.dateFrom && cost.dateFrom > input.period.from ? cost.dateFrom : input.period.from,
      toExclusive: cost.dateTo && nextLocalDate(cost.dateTo) < input.period.toExclusive
        ? nextLocalDate(cost.dateTo)
        : input.period.toExclusive,
    };
    const costMonths = calendarMonths(costPeriod);
    let scoped = periodBookings.filter((booking) => (
      booking.currency === currency
      && (!cost.unitId || booking.unitId === cost.unitId)
      && (!cost.platform || booking.platform === cost.platform)
      && (!cost.dateFrom || booking.checkIn >= cost.dateFrom)
      && (!cost.dateTo || booking.checkIn <= cost.dateTo)
    ));
    if (kind === "commission") {
      scoped = scoped.filter((booking) => !actualCommissionBookings.has(booking.id));
    }
    const amount = modeledAmount(cost, scoped, costMonths);
    if (amount <= 0) continue;
    const line: ManagementLine = {
      id: `MODEL-${cost.id}`,
      label: cost.label,
      kind: "modeled",
      category: kind === "commission" ? "Prowizja OTA" : cost.category ?? "Inne",
      currency,
      amount,
      source: cost.source?.trim() || null,
      sourceRef: cost.id,
      unitId: cost.unitId ?? null,
      platform: cost.platform ?? null,
      costSettingId: cost.id,
    };
    modeledAllocations.push({ line, allocations: allocate(amount, cost, scoped, input.units) });
  }

  for (const unit of input.units) {
    if (unit.defaultCleaningCost <= 0) continue;
    const stays = periodBookings.filter((booking) => (
      booking.unitId === unit.id
      && booking.currency === "PLN"
      && !actualAllocations.some(({ line }) => (
        line.category === "Sprzątanie" && line.unitId === unit.id
      ))
    ));
    if (!stays.length) continue;
    const amount = unit.defaultCleaningCost * stays.length;
    modeledAllocations.push({
      line: {
        id: `MODEL-CLEANING-${unit.id}`,
        label: `Sprzątanie — ${unit.name}`,
        kind: "modeled",
        category: "Sprzątanie",
        currency: "PLN",
        amount,
        source: "Ustawienie domku",
        sourceRef: unit.id,
        unitId: unit.id,
        platform: null,
        costSettingId: null,
      },
      allocations: [{ unitId: unit.id, amount }],
    });
    issues.push(issue(
      "cost_period_missing",
      `CLEANING-${unit.id}`,
      `Sprzątanie — ${unit.name}: stawka wymaga potwierdzenia`,
      `Czy ${unit.defaultCleaningCost} PLN za sprzątanie domku ${unit.name} jest nadal aktualne i od kiedy obowiązuje?`,
    ));
  }

  const operatingInputs = [
    ...actualAllocations.filter(({ line }) => line.category !== "Prowizja OTA"),
    ...modeledAllocations.filter(({ line }) => line.category !== "Prowizja OTA"),
  ];
  if (!operatingInputs.length) {
    issues.push(issue(
      "missing_cost_inputs",
      "OPERATING-COSTS",
      "Brak kosztów operacyjnych",
      "Jakie koszty ponosimy niezależnie od pobytów i jakie za każdy pobyt (sprzątanie, energia, woda, szambo, serwis, podatki)?",
      true,
    ));
  }

  const modeledCommissionPlatforms = new Set(
    activeSettings
      .filter((cost) => costKind(cost) === "commission" && cost.platform)
      .map((cost) => cost.platform!),
  );
  for (const booking of periodBookings) {
    if (
      OTA_PLATFORMS.has(booking.platform)
      && !actualCommissionBookings.has(booking.id)
      && !modeledCommissionPlatforms.has(booking.platform)
    ) {
      issues.push(issue(
        "ota_commission_missing",
        booking.id,
        `${booking.platform}: brak prowizji dla ${booking.guestLabel}`,
        `Jaka prowizja obowiązywała dla ${booking.platform}, domku ${input.units.find((unit) => unit.id === booking.unitId)?.name ?? booking.unitId} i pobytu ${booking.checkIn}–${booking.checkOut}?`,
        true,
      ));
    }
  }

  for (const { line } of modeledAllocations) {
    const overlapsUnlinkedActual = actualAllocations.some(({ line: actual }) => (
      !actual.costSettingId
      && actual.category === line.category
      && actual.currency === line.currency
      && (!actual.unitId || !line.unitId || actual.unitId === line.unitId)
    ));
    if (overlapsUnlinkedActual) {
      issues.push(issue(
        "duplicate_cost_risk",
        line.id,
        `${line.label}: możliwe podwójne policzenie`,
        `Czy faktyczny koszt z kategorii „${line.category}” zastępuje model „${line.label}” w tym okresie?`,
        true,
      ));
    }
  }

  const allAllocations = [...actualAllocations, ...modeledAllocations];
  const lines = allAllocations.map(({ line }) => line);
  const issueList = uniqueIssues(issues);
  const currencies = (["PLN", "EUR"] as const)
    .filter((currency) => (
      periodBookings.some((booking) => booking.currency === currency)
      || lines.some((line) => line.currency === currency)
    ))
    .map((currency): ManagementCurrencyResult => {
      const sales = periodBookings
        .filter((booking) => booking.currency === currency)
        .reduce((sum, booking) => sum + (booking.grossPrice ?? 0), 0);
      const currencyLines = lines.filter((line) => line.currency === currency);
      const actualCosts = currencyLines
        .filter((line) => line.kind === "actual" && line.category !== "Prowizja OTA")
        .reduce((sum, line) => sum + line.amount, 0);
      const modeledCosts = currencyLines
        .filter((line) => line.kind === "modeled" && line.category !== "Prowizja OTA")
        .reduce((sum, line) => sum + line.amount, 0);
      const actualCommissions = currencyLines
        .filter((line) => line.kind === "actual" && line.category === "Prowizja OTA")
        .reduce((sum, line) => sum + line.amount, 0);
      const modeledCommissions = currencyLines
        .filter((line) => line.kind === "modeled" && line.category === "Prowizja OTA")
        .reduce((sum, line) => sum + line.amount, 0);
      const relevantIssues = issueList.filter((item) => {
        const booking = bookingById.get(item.recordId);
        if (booking) return !booking.currency || booking.currency === currency;
        const line = lines.find((candidate) => (
          candidate.id === item.recordId
          || candidate.costSettingId === item.recordId
          || candidate.id === `MODEL-${item.recordId}`
        ));
        if (line) return line.currency === currency;
        const setting = input.costSettings.find((candidate) => candidate.id === item.recordId);
        return setting ? (setting.currency ?? "PLN") === currency : true;
      });
      const hasOperatingInput = currencyLines.some((line) => line.category !== "Prowizja OTA");
      const state = completeness(relevantIssues, hasOperatingInput);
      const totalCosts = actualCosts + modeledCosts + actualCommissions + modeledCommissions;
      return {
        currency,
        sales,
        actualCosts,
        modeledCosts,
        actualCommissions,
        modeledCommissions,
        totalCosts,
        result: state === "unavailable" ? null : sales - totalCosts,
        completeness: state,
        issues: relevantIssues,
      };
    });

  const units = input.units.flatMap((unit) => (["PLN", "EUR"] as const).map((currency) => {
    const sales = periodBookings
      .filter((booking) => booking.unitId === unit.id && booking.currency === currency)
      .reduce((sum, booking) => sum + (booking.grossPrice ?? 0), 0);
    let costs = 0;
    let commissions = 0;
    for (const allocation of allAllocations) {
      if (allocation.line.currency !== currency) continue;
      const amount = allocation.allocations.find((item) => item.unitId === unit.id)?.amount ?? 0;
      if (allocation.line.category === "Prowizja OTA") commissions += amount;
      else costs += amount;
    }
    return { unitId: unit.id, currency, sales, costs, commissions, result: sales - costs - commissions };
  })).filter((item) => item.sales !== 0 || item.costs !== 0 || item.commissions !== 0);

  const checks: ManagementReadinessCheck[] = [
    {
      id: "bookings",
      label: "Ceny i waluty rezerwacji",
      ready: !issueList.some((item) => ["missing_booking_price", "missing_booking_currency"].includes(item.code)),
      note: "Cena pobytu i waluta dla wybranego okresu.",
    },
    {
      id: "operating-costs",
      label: "Koszty prowadzenia obiektu",
      ready: !issueList.some((item) => item.code === "missing_cost_inputs"),
      note: "Minimum: sprzątanie oraz koszty stałe lub zmienne.",
    },
    {
      id: "commissions",
      label: "Prowizje kanałów OTA",
      ready: !issueList.some((item) => ["ota_commission_missing", "commission_platform_missing"].includes(item.code)),
      note: "Fakt z rozliczenia albo jawna stawka modelowa.",
    },
    {
      id: "sources",
      label: "Źródła i okres obowiązywania",
      ready: !issueList.some((item) => [
        "cost_source_missing",
        "cost_currency_missing",
        "cost_period_missing",
        "actual_source_missing",
        "actual_currency_missing",
      ].includes(item.code)),
      note: "Dokument, panel lub szacunek oraz daty obowiązywania.",
    },
    {
      id: "allocation",
      label: "Podział kosztów wspólnych",
      ready: !issueList.some((item) => ["shared_allocation_missing", "duplicate_cost_risk"].includes(item.code)),
      note: "Równo między domki albo proporcjonalnie do przychodu.",
    },
  ];
  const questions = Array.from(new Set(issueList.map((item) => item.question)));

  return {
    period: input.period,
    bookingCount: periodBookings.length,
    lines,
    currencies,
    units,
    issues: issueList,
    readiness: {
      readyCount: checks.filter((check) => check.ready).length,
      totalCount: checks.length,
      checks,
      questions,
    },
  };
}
