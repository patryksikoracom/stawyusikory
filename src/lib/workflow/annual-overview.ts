import type { AppData, Currency, RateRule } from "@/lib/types";
import { addLocalDays, dateDiffDays } from "@/lib/date";

export type AnnualMetric = "occupancy" | "revenue" | "adr" | "leadTime";
export type GapClass = "1 noc" | "2–3 noce" | "4–6 nocy" | "7+ nocy";

export type AnnualMonthSummary = {
  month: number;
  unitId: string;
  soldNights: number;
  availableNights: number;
  occupancyPercent: number | null;
  revenue: Partial<Record<Currency, number>>;
  adr: Partial<Record<Currency, number>>;
  leadTimeDays: number | null;
  bookingsCount: number;
  pricedBookingsCount: number;
  targetPercent?: number;
};

export type AnnualGap = {
  unitId: string;
  dateFrom: string;
  dateTo: string;
  nights: number;
  classification: GapClass;
  season: RateRule["season"] | "Brak reguły";
  minNights?: number;
  occupancyTargetPercent?: number;
  daysUntilStart: number;
};

const activeBooking = (booking: AppData["bookings"][number]) =>
  booking.workflowStatus !== "Anulowana" && !booking.deletedAt && booking.checkOut > booking.checkIn;

const activeBlock = (block: AppData["blocks"][number]) =>
  block.status !== "Anulowana" && block.dateTo > block.dateFrom;

function yearDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function monthEnd(year: number, month: number) {
  return month === 12 ? `${year + 1}-01-01` : yearDate(year, month + 1, 1);
}

function boundedCutoff(year: number, today: string) {
  const suffix = today.slice(4);
  const candidate = `${year}${suffix}`;
  const yearEnd = `${year + 1}-01-01`;
  return candidate < yearEnd ? candidate : `${year}-12-31`;
}

function eachNight(from: string, toExclusive: string) {
  const nights: string[] = [];
  for (let date = from; date < toExclusive; date = addLocalDays(date, 1)) nights.push(date);
  return nights;
}

function rateForDate(rates: RateRule[], unitId: string, date: string) {
  return rates.find((rate) =>
    rate.active &&
    rate.unitId === unitId &&
    (!rate.dateFrom || rate.dateFrom <= date) &&
    (!rate.dateTo || rate.dateTo >= date),
  );
}

export function annualSalesCutoff(year: number, today: string) {
  return boundedCutoff(year, today);
}

export function buildAnnualOverview(data: AppData, year: number, today: string) {
  const cutoff = annualSalesCutoff(year, today);
  const bookings = data.bookings.filter((booking) => activeBooking(booking) && booking.bookingDate <= cutoff);
  const blocks = data.blocks.filter(activeBlock);
  const months: AnnualMonthSummary[] = [];

  for (const unit of data.units) {
    for (let month = 1; month <= 12; month += 1) {
      const from = yearDate(year, month, 1);
      const toExclusive = monthEnd(year, month);
      const monthNights = eachNight(from, toExclusive);
      const unitBookings = bookings.filter((booking) =>
        booking.unitId === unit.id && booking.checkIn < toExclusive && booking.checkOut > from);
      const sold = new Set<string>();
      const unavailable = new Set<string>();
      const revenue: Partial<Record<Currency, number>> = {};
      const leadTimes: number[] = [];
      let pricedBookingsCount = 0;

      for (const booking of unitBookings) {
        const overlap = eachNight(
          booking.checkIn > from ? booking.checkIn : from,
          booking.checkOut < toExclusive ? booking.checkOut : toExclusive,
        );
        overlap.forEach((date) => sold.add(date));
        if (booking.grossPrice != null && booking.currency) {
          const totalNights = Math.max(1, dateDiffDays(booking.checkIn, booking.checkOut));
          revenue[booking.currency] = (revenue[booking.currency] ?? 0) + booking.grossPrice * overlap.length / totalNights;
          pricedBookingsCount += 1;
        }
        if (booking.checkIn >= from && booking.checkIn < toExclusive) {
          leadTimes.push(Math.max(0, dateDiffDays(booking.bookingDate, booking.checkIn)));
        }
      }
      for (const block of blocks.filter((item) =>
        item.unitId === unit.id &&
        ["Serwis", "Remont"].includes(item.blockType) &&
        item.dateFrom < toExclusive &&
        item.dateTo > from)) {
        eachNight(block.dateFrom > from ? block.dateFrom : from, block.dateTo < toExclusive ? block.dateTo : toExclusive)
          .forEach((date) => unavailable.add(date));
      }
      const availableNights = Math.max(0, monthNights.length - unavailable.size);
      const adr: Partial<Record<Currency, number>> = {};
      for (const currency of Object.keys(revenue) as Currency[]) {
        if (sold.size) adr[currency] = (revenue[currency] ?? 0) / sold.size;
      }
      const monthRate = data.rates.find((rate) =>
        rate.active && rate.unitId === unit.id && rate.dateFrom && rate.dateTo &&
        rate.dateFrom < toExclusive && rate.dateTo >= from && rate.occupancyTargetPercent != null);
      months.push({
        month,
        unitId: unit.id,
        soldNights: sold.size,
        availableNights,
        occupancyPercent: availableNights ? sold.size / availableNights * 100 : null,
        revenue,
        adr,
        leadTimeDays: leadTimes.length ? leadTimes.reduce((sum, value) => sum + value, 0) / leadTimes.length : null,
        bookingsCount: unitBookings.length,
        pricedBookingsCount,
        targetPercent: monthRate?.occupancyTargetPercent,
      });
    }
  }
  return { cutoff, months };
}

export function classifyGap(nights: number): GapClass {
  if (nights === 1) return "1 noc";
  if (nights <= 3) return "2–3 noce";
  if (nights <= 6) return "4–6 nocy";
  return "7+ nocy";
}

export function detectAnnualGaps(data: AppData, year: number, today: string): AnnualGap[] {
  const yearFrom = `${year}-01-01`;
  const yearTo = `${year + 1}-01-01`;
  const scanFrom = today.slice(0, 4) === String(year) && today > yearFrom ? today : yearFrom;
  const bookings = data.bookings.filter(activeBooking);
  const blocks = data.blocks.filter(activeBlock);
  const gaps: AnnualGap[] = [];

  for (const unit of data.units) {
    let current: Omit<AnnualGap, "dateTo" | "nights" | "classification" | "daysUntilStart"> | undefined;
    for (const date of eachNight(scanFrom, yearTo)) {
      const occupied = bookings.some((booking) => booking.unitId === unit.id && booking.checkIn <= date && booking.checkOut > date) ||
        blocks.some((block) => block.unitId === unit.id && block.dateFrom <= date && block.dateTo > date);
      const rate = rateForDate(data.rates, unit.id, date);
      const signature = `${rate?.season ?? "Brak reguły"}:${rate?.minNights ?? ""}:${rate?.occupancyTargetPercent ?? ""}`;
      const currentSignature = current
        ? `${current.season}:${current.minNights ?? ""}:${current.occupancyTargetPercent ?? ""}`
        : "";
      if (occupied || (current && signature !== currentSignature)) {
        if (current) {
          const nights = dateDiffDays(current.dateFrom, date);
          gaps.push({ ...current, dateTo: date, nights, classification: classifyGap(nights), daysUntilStart: dateDiffDays(today, current.dateFrom) });
          current = undefined;
        }
        if (occupied) continue;
      }
      if (!current) {
        current = {
          unitId: unit.id,
          dateFrom: date,
          season: rate?.season ?? "Brak reguły",
          minNights: rate?.minNights,
          occupancyTargetPercent: rate?.occupancyTargetPercent,
        };
      }
    }
    if (current) {
      const nights = dateDiffDays(current.dateFrom, yearTo);
      gaps.push({ ...current, dateTo: yearTo, nights, classification: classifyGap(nights), daysUntilStart: dateDiffDays(today, current.dateFrom) });
    }
  }
  return gaps.filter((gap) => gap.nights > 0);
}
