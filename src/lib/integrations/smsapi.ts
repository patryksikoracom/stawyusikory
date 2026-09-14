// Provider response contract: https://www.smsapi.pl/docs/#2-sms
export async function sendSmsApi(token: string, to: string, message: string) {
  const body = new URLSearchParams({ to: to.replace(/\s/g, ""), message, format: "json" });
  try {
    const response = await fetch("https://api.smsapi.pl/sms.do", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(15_000),
    });
    const provider = await response.json().catch(() => null);
    const accepted = response.ok && provider?.error == null && provider?.count === 1
      && Array.isArray(provider.list) && provider.list.length === 1
      && typeof provider.list[0]?.id === "string" && provider.list[0].id.length > 0;
    return { ok: Boolean(accepted), retryable: response.status === 429 && !provider?.list?.length, provider: provider ?? { error: "unrecognized_response", status: response.status } };
  } catch {
    // A timeout may follow provider acceptance. Retrying without provider
    // idempotency could send the same SMS twice; require reconciliation first.
    return { ok: false, retryable: false, provider: { error: "delivery_unknown" } };
  }
}
