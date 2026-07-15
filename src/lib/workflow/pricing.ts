import type { AppData, Booking, CostSetting, RateRule, Unit } from "../types";
import { addLocalDays } from "../date";
import { nightsBetween } from "./rules";

const seasonPriority: Record<RateRule["season"], number> = {
  Specjalny: 6,
  Promocja: 5,
  "Święta/długi weekend": 4,
  Wysoki: 3,
  Średni: 2,
  Niski: 1,
};

export type StayQuote = {
  nights: number;
  total: number;
  averagePerNight: number;
  minimumNights: number;
  belowMinimum: boolean;
  breakdown: Array<{ key: string; label: string; nights: number; pricePerNight: number; total: number }>;
};

function rateApplies(rate: RateRule, date: string) {
  return rate.active && Boolean(rate.dateFrom || rate.dateTo) && (!rate.dateFrom || rate.dateFrom <= date) && (!rate.dateTo || rate.dateTo >= date);
}

function rateScore(rate: RateRule) {
  return (rate.dateFrom || rate.dateTo ? 100 : 0) + seasonPriority[rate.season];
}

export function quoteStay(units: Unit[], rates: RateRule[], unitId: string, checkIn: string, checkOut: string): StayQuote {
  const nights = nightsBetween(checkIn, checkOut);
  const unit = units.find((item) => item.id === unitId);
  const lines: StayQuote["breakdown"] = [];
  let minimumNights = 1;
  for (let index = 0; index < nights; index += 1) {
    const date = addLocalDays(checkIn, index);
    const rate = rates
      .filter((item) => item.unitId === unitId && rateApplies(item, date))
      .sort((a, b) => rateScore(b) - rateScore(a))[0];
    const key = rate?.id ?? `DEFAULT-${unitId}`;
    const label = rate ? `Sezon: ${rate.season}` : "Cena bazowa";
    const pricePerNight = rate?.pricePerNight ?? unit?.defaultPricePerNight ?? 0;
    minimumNights = Math.max(minimumNights, rate?.minNights ?? 1);
    const previous = lines[lines.length - 1];
    if (previous?.key === key && previous.pricePerNight === pricePerNight) {
      previous.nights += 1;
      previous.total += pricePerNight;
    } else {
      lines.push({ key, label, nights: 1, pricePerNight, total: pricePerNight });
    }
  }
  const total = lines.reduce((sum, item) => sum + item.total, 0);
  return { nights, total, averagePerNight: nights ? total / nights : 0, minimumNights, belowMinimum: nights > 0 && nights < minimumNights, breakdown: lines };
}

function scopedBookings(bookings: Booking[], cost: CostSetting) {
  return bookings.filter((booking) => booking.workflowStatus !== "Anulowana" && (!cost.unitId || booking.unitId === cost.unitId));
}

export function calculateModeledCosts(costs: CostSetting[], bookings: Booking[], periodMonths = 12) {
  const active = costs.filter((cost) => cost.active && cost.value > 0);
  const lines = active.map((cost) => {
    const scoped = scopedBookings(bookings, cost);
    const revenue = scoped.filter((booking) => (booking.currency ?? "PLN") === "PLN").reduce((sum, booking) => sum + (booking.grossPrice ?? 0), 0);
    const nights = scoped.reduce((sum, booking) => sum + nightsBetween(booking.checkIn, booking.checkOut), 0);
    const total = cost.unit === "miesiąc" ? cost.value * periodMonths
      : cost.unit === "rok" ? cost.value * periodMonths / 12
        : cost.unit === "pobyt" ? cost.value * scoped.length
          : cost.unit === "noc" ? cost.value * nights
            : revenue * cost.value / 100;
    return { cost, total };
  });
  return { total: lines.reduce((sum, item) => sum + item.total, 0), lines };
}

export function pricingReadiness(data: Pick<AppData, "units" | "rates" | "costSettings" | "bookings">) {
  const historicalYears = new Set(data.bookings.filter((item) => item.workflowStatus !== "Anulowana" && (item.currency ?? "PLN") === "PLN" && item.grossPrice != null).map((item) => item.checkIn.slice(0, 4))).size;
  const checks = [
    { id: "base", label: "Ceny bazowe wszystkich domków", ready: data.units.length > 0 && data.units.every((unit) => unit.defaultPricePerNight > 0) },
    { id: "seasons", label: "Datowane sezony dla wszystkich domków", ready: data.units.length > 0 && data.units.every((unit) => data.rates.some((rate) => rate.unitId === unit.id && rate.active && rate.dateFrom && rate.dateTo)) },
    { id: "costs", label: "Koszty stałe lub zmienne", ready: data.costSettings.some((cost) => cost.active && cost.value > 0) },
    { id: "history", label: "Co najmniej dwa lata rezerwacji z cenami", ready: historicalYears >= 2 },
  ];
  return { checks, readyCount: checks.filter((item) => item.ready).length, ready: checks.every((item) => item.ready) };
}
