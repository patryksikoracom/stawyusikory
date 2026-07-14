const privateIpv4 = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^0\./,
];

export function validateExternalCalendarUrl(input: string) {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { ok: false as const, error: "Nieprawidłowy adres URL." };
  }
  if (url.protocol !== "https:") return { ok: false as const, error: "Kalendarz musi używać HTTPS." };
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host === "::1") {
    return { ok: false as const, error: "Lokalne adresy nie są dozwolone." };
  }
  if (privateIpv4.some((pattern) => pattern.test(host))) {
    return { ok: false as const, error: "Prywatne adresy sieciowe nie są dozwolone." };
  }
  if (url.username || url.password) return { ok: false as const, error: "Adres nie może zawierać loginu ani hasła." };
  return { ok: true as const, url };
}

