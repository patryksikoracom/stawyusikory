export function polishPlural(count: number, one: string, few: string, many: string) {
  const absolute = Math.abs(count);
  const lastTwo = absolute % 100;
  const last = absolute % 10;
  if (absolute === 1) return one;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return few;
  return many;
}

export function formatPolishCount(count: number, one: string, few: string, many: string) {
  return `${count} ${polishPlural(count, one, few, many)}`;
}
