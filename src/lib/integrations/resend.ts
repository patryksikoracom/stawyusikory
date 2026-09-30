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

export function renderEmailHtml(body: string, options: { language?: "pl" | "en" | "de"; subject?: string } = {}) {
  const language = options.language ?? "pl";
  const footer = { pl: "Wiadomość dotycząca Twojego pobytu w Stawach u Sikory. Możesz na nią odpowiedzieć.", en: "A message about your stay at Stawy u Sikory. You can reply to this email.", de: "Eine Nachricht zu Ihrem Aufenthalt bei Stawy u Sikory. Sie können auf diese E-Mail antworten." }[language];
  const guideLabel = { pl: "Przewodnik pobytu", en: "Your stay guide", de: "Hinweise für Ihren Aufenthalt" }[language];
  const guideUrl = "https://stawyusikory.pl/przewodnik/";
  const paragraphs = body.replace(/\r\n?/g, "\n").trim().split(/\n\s*\n/)
    .filter(Boolean)
    .map(paragraph => `<p style="margin:0 0 20px">${escapeHtml(paragraph)
      .replaceAll(guideUrl, `<a href="${guideUrl}" style="color:#174d3b;text-decoration:underline">${guideLabel}</a>`)
      .replaceAll("\n", "<br>")}</p>`).join("");
  const subject = escapeHtml(options.subject ?? "Stawy u Sikory");
  return `<!doctype html><html lang="${language}" dir="ltr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${subject}</title></head><body style="margin:0;background:#f4f1e9;color:#243c32;font-family:Arial,sans-serif;-webkit-text-size-adjust:100%"><table lang="${language}" dir="ltr" role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f1e9"><tr><td align="center" style="padding:20px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fffdf8;border:1px solid #ded7ca;border-radius:14px"><tr><td style="padding:24px 22px 12px"><div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#49633d">Stawy u Sikory</div>${options.subject ? `<h1 style="font-size:22px;line-height:1.35;margin:16px 0 0;font-weight:600">${subject}</h1>` : ""}</td></tr><tr><td style="padding:8px 22px 12px;font-size:16px;line-height:1.65;overflow-wrap:anywhere;word-break:break-word">${paragraphs}</td></tr><tr><td style="padding:16px 22px;border-top:1px solid #e7e0d4;font-size:12px;line-height:1.5;color:#53635b">${footer}</td></tr></table></td></tr></table></body></html>`;
}

type ResendEmailClient = Pick<Resend["emails"], "send">;

export type SendResendEmailInput = {
  to: string;
  subject: string;
  text: string;
  idempotencyKey: string;
  bookingId: string;
  category: string;
  language?: "pl" | "en" | "de";
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
      html: renderEmailHtml(input.text, { language: input.language, subject: input.subject }),
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
