export async function sendSmsApi(token: string, to: string, message: string) {
  const body = new URLSearchParams({ to: to.replace(/\s/g, ""), message, format: "json" });
  const response = await fetch("https://api.smsapi.pl/sms.do", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  const provider = await response.json().catch(() => ({ status: response.status }));
  return { ok: response.ok, provider };
}

