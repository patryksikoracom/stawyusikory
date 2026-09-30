import { describe, expect, it } from "vitest";
import { renderEmailHtml, resendIdempotencyKey, sendResendEmail } from "./resend";

describe("Resend email adapter", () => {
  it("escapes guest-controlled HTML while preserving paragraphs", () => {
    const html = renderEmailHtml("Dzień dobry <Anna>\n\nZapraszamy & dziękujemy");
    expect(html).toContain("&lt;Anna&gt;");
    expect(html).toContain("Zapraszamy &amp; dziękujemy");
    expect(html).not.toContain("<Anna>");
  });

  it("preserves single line breaks without relying on email-client CSS", () => {
    const html = renderEmailHtml("Hello,\r\n\r\nAccount: <test>\r\nReference: Test 12-19.06/26", { language: "en", subject: "Stay <confirmation>" });
    expect(html).toContain("Account: &lt;test&gt;<br>Reference:");
    expect(html).toContain('<html lang="en" dir="ltr">');
    expect(html).toContain('<table lang="en" dir="ltr" role="presentation"');
    expect(html).toContain("<title>Stay &lt;confirmation&gt;</title>");
    expect(html).not.toContain("white-space:pre-line");
  });

  it("creates stable provider-safe idempotency keys", () => {
    const first = resendIdempotencyKey("scheduled/RULE/BOOKING/1");
    expect(first).toBe(resendIdempotencyKey("scheduled/RULE/BOOKING/1"));
    expect(first).not.toBe(resendIdempotencyKey("scheduled/RULE/BOOKING/2"));
    expect(first.length).toBeLessThanOrEqual(256);
  });

  it("sends from the reservation address and always copies Marcin", async () => {
    let request: unknown;
    let options: unknown;
    const client = {
      send: async (nextRequest: unknown, nextOptions: unknown) => {
        request = nextRequest;
        options = nextOptions;
        return { data: { id: "email_123" }, error: null };
      },
    };
    const result = await sendResendEmail({
      to: "guest@example.com",
      subject: "Potwierdzenie",
      text: "Witaj <Anna>",
      idempotencyKey: "message-1",
      bookingId: "BOOKING-1",
      category: "confirmation",
    }, client as never);
    expect(result).toEqual({ ok: true, providerMessageId: "email_123" });
    expect(request).toMatchObject({
      from: "Stawy u Sikory <rezerwacja@stawyusikory.pl>",
      to: "guest@example.com",
      cc: "marcin@stawyusikory.pl",
      replyTo: "marcin@stawyusikory.pl",
      text: "Witaj <Anna>",
      html: expect.stringContaining("Witaj &lt;Anna&gt;"),
    });
    expect(options).toMatchObject({ idempotencyKey: expect.stringMatching(/^stawy\/[a-f0-9]{64}$/) });
  });

  it("turns a provider exception into a retryable result", async () => {
    const client = { send: async () => { throw new Error("socket closed"); } };
    await expect(sendResendEmail({
      to: "guest@example.com",
      subject: "Potwierdzenie",
      text: "Treść",
      idempotencyKey: "message-2",
      bookingId: "BOOKING-2",
      category: "confirmation",
    }, client as never)).resolves.toMatchObject({
      ok: false,
      retryable: true,
      error: "network_exception",
    });
  });
});
