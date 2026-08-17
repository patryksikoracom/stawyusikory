import type { AdSpendRecord, Currency } from "@/lib/types";

function delimiterFor(header: string) {
  return header.split(";").length > header.split(",").length ? ";" : ",";
}

function numberValue(value: string) {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseAdSpendCsv(raw: string, sourceFile: string) {
  const lines = raw.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return { records: [] as AdSpendRecord[], errors: ["Pusty plik"] };
  const delimiter = delimiterFor(lines[0]);
  const headers = lines[0].split(delimiter).map((value) => value.trim().toLocaleLowerCase("pl-PL"));
  const key = (names: string[]) => names.map((name) => headers.indexOf(name)).find((index) => index >= 0) ?? -1;
  const indexes = {
    date: key(["data", "date"]),
    channel: key(["kanał", "kanal", "channel"]),
    campaign: key(["kampania", "campaign"]),
    cost: key(["koszt", "cost", "spend"]),
    currency: key(["waluta", "currency"]),
    result: key(["wynik", "result"]),
    code: key(["kod/utm", "utm", "kod", "code"]),
  };
  const errors: string[] = [];
  const records = lines.slice(1).flatMap((line, rowIndex) => {
    const cells = line.split(delimiter).map((value) => value.trim());
    const date = cells[indexes.date];
    const cost = numberValue(cells[indexes.cost] ?? "");
    const channel = cells[indexes.channel];
    const campaign = cells[indexes.campaign];
    const currency = (cells[indexes.currency] || "PLN").toUpperCase() as Currency;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || cost == null || cost < 0 || !channel || !campaign || !["PLN", "EUR"].includes(currency)) {
      errors.push(`Wiersz ${rowIndex + 2}: nieprawidłowa data, kanał, kampania, koszt lub waluta`);
      return [];
    }
    return [{
      id: `AD-${sourceFile}-${rowIndex + 2}`,
      date,
      channel,
      campaign,
      cost,
      currency,
      result: indexes.result >= 0 ? numberValue(cells[indexes.result] ?? "") : undefined,
      codeOrUtm: indexes.code >= 0 ? cells[indexes.code] || undefined : undefined,
      sourceFile,
    }];
  });
  return { records, errors };
}
