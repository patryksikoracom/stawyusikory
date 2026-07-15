import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const privateIpv4 = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^0\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  /^198\.1[89]\./,
  /^22[4-9]\./,
  /^23\d\./,
  /^24\d\./,
  /^25[0-5]\./,
];

function blockedIp(input: string) {
  const value = input.toLowerCase().split("%")[0];
  if (value.startsWith("::ffff:")) return blockedIp(value.slice(7));
  if (isIP(value) === 4) return privateIpv4.some((pattern) => pattern.test(value));
  if (isIP(value) === 6) {
    return value === "::" || value === "::1" || value.startsWith("fc") || value.startsWith("fd") || /^fe[89ab]/.test(value);
  }
  return true;
}

export function validateExternalCalendarUrl(input: string) {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { ok: false as const, error: "Nieprawidłowy adres URL." };
  }
  if (url.protocol !== "https:") return { ok: false as const, error: "Kalendarz musi używać HTTPS." };
  const host = url.hostname.toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host === "::1") {
    return { ok: false as const, error: "Lokalne adresy nie są dozwolone." };
  }
  if (isIP(host) || privateIpv4.some((pattern) => pattern.test(host))) {
    return { ok: false as const, error: "Prywatne adresy sieciowe nie są dozwolone." };
  }
  if (url.username || url.password) return { ok: false as const, error: "Adres nie może zawierać loginu ani hasła." };
  return { ok: true as const, url };
}

export async function validateExternalCalendarUrlForFetch(input: string) {
  const validated = validateExternalCalendarUrl(input);
  if (!validated.ok) return validated;
  try {
    const addresses = await lookup(validated.url.hostname, { all: true, verbatim: true });
    if (!addresses.length || addresses.some(({ address }) => blockedIp(address))) {
      return { ok: false as const, error: "Adres kalendarza prowadzi do niedozwolonej sieci." };
    }
  } catch {
    return { ok: false as const, error: "Nie udało się bezpiecznie rozpoznać adresu kalendarza." };
  }
  return validated;
}
