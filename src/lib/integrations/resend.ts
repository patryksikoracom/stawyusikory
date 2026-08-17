import { createHash } from "node:crypto";
import { Resend } from "resend";

export const emailDeliveryDisabledMessage = "Wysyłka e-mail jest wyłączona na czas konfiguracji i testów.";
export const defaultResendFromEmail = "rezerwacja@stawyusikory.pl";
export const mandatoryResendCcEmail = "marcin@stawyusikory.pl";

export function isEmailDeliveryEnabled(value = process.env.STAWY_OS_EMAIL_ENABLED) {
  return value === "true";
}

export function resendIdempotencyKey(value: string) {
  return `stawy/${createHash("sha256").update(value).digest("hex")}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function renderEmailHtml(body: string) {
  const paragraphs = body
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => `<p style="margin:0 0 16px;white-space:pre-line">${escapeHtml(paragraph)}</p>`)
    .join("");
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"></head><body style="margin:0;background:#f4f1e9;color:#243c32;font-family:Arial,sans-serif"><div style="display:none;max-height:0;overflow:hidden">Wiadomość dotycząca pobytu w Stawach u Sikory</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f1e9"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fffdf8;border:1px solid #ded7ca;border-radius:18px"><tr><td style="padding:28px 28px 12px"><div style="font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#74854a">Stawy u Sikory</div></td></tr><tr><td style="padding:8px 28px 20px;font-size:16px;line-height:1.65">${paragraphs}</td></tr><tr><td style="padding:18px 28px;border-top:1px solid #e7e0d4;font-size:12px;line-height:1.5;color:#68756f">Ta wiadomość dotyczy rezerwacji lub pobytu w Stawach u Sikory.</td></tr></table></td></tr></table></body></html>`;
}

type ResendEmailClient = Pick<Resend["emails"], "send">;

export type SendResendEmailInput = {
  to: string;
  subject: string;
  text: string;
  idempotencyKey: string;
  bookingId: string;
  category: string;
};

export async function sendResendEmail(input: SendResendEmailInput, client?: ResendEmailClient) {
  const apiKey = process.env.RESEND_API_KEY;
  const senderEmail = process.env.RESEND_FROM_EMAIL ?? defaultResendFromEmail;
  const senderName = process.env.RESEND_FROM_NAME ?? "Stawy u Sikory";
  const replyTo = process.env.RESEND_REPLY_TO ?? mandatoryResendCcEmail;
  if (!apiKey && !client) return { ok: false as const, retryable: false, error: "missing_api_key" };

  const emails = client ?? new Resend(apiKey).emails;
  let response: Awaited<ReturnType<ResendEmailClient["send"]>>;
  try {
    response = await emails.send({
      from: `${senderName} <${senderEmail}>`,
      to: input.to,
      cc: mandatoryResendCcEmail,
      replyTo,
      subject: input.subject,
      text: input.text,
      html: renderEmailHtml(input.text),
      tags: [
        { name: "category", value: input.category.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 256) || "transactional" },
        { name: "booking_id", value: input.bookingId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 256) || "unknown" },
      ],
    }, { idempotencyKey: resendIdempotencyKey(input.idempotencyKey) });
  } catch (error) {
    return {
      ok: false as const,
      retryable: true,
      error: "network_exception",
      message: error instanceof Error ? error.message : "Nieznany błąd połączenia z Resend.",
    };
  }
  const { data, error } = response;

  if (error) {
    const statusCode = "statusCode" in error && typeof error.statusCode === "number" ? error.statusCode : undefined;
    return {
      ok: false as const,
      retryable: statusCode === 429 || (statusCode != null && statusCode >= 500),
      error: error.name || "provider_error",
      message: error.message,
      statusCode,
    };
  }
  if (!data?.id) return { ok: false as const, retryable: true, error: "missing_provider_id" };
  return { ok: true as const, providerMessageId: data.id };
}

export function verifyResendWebhook(payload: string, headers: Headers, secret = process.env.RESEND_WEBHOOK_SECRET) {
  if (!secret) throw new Error("missing_webhook_secret");
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signature = headers.get("svix-signature");
  if (!id || !timestamp || !signature) throw new Error("missing_webhook_headers");
  return {
    eventId: id,
    event: new Resend(process.env.RESEND_API_KEY).webhooks.verify({
      payload,
      headers: { id, timestamp, signature },
      webhookSecret: secret,
    }),
  };
}
