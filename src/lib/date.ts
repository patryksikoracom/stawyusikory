const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

export function todayInPoland(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function parseLocalDate(value: string) {
  const match = datePattern.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0, 0);
}

type PolishDateOptions = {
  year?: boolean;
  month?: "short" | "long";
  weekday?: "short" | "long";
};

/** Formats date-only values without shifting them across time zones. */
export function formatPolishDate(value?: string | Date, options: PolishDateOptions = {}) {
  if (!value) return "—";
  const date = typeof value === "string" ? parseLocalDate(value.slice(0, 10)) : value;
  if (!date || Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pl-PL", {
    weekday: options.weekday ?? "short",
    day: "numeric",
    month: options.month ?? "short",
    ...(options.year === false ? {} : { year: "numeric" }),
  }).format(date);
}

export function formatPolishDateTime(value?: string | Date) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pl-PL", {
    timeZone: "Europe/Warsaw",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addLocalDays(value: string, amount: number) {
  const date = parseLocalDate(value);
  if (!date) return value;
  date.setDate(date.getDate() + amount);
  return formatLocalDate(date);
}

export function dateDiffDays(start: string, end: string) {
  const from = parseLocalDate(start);
  const to = parseLocalDate(end);
  if (!from || !to) return 0;
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}
