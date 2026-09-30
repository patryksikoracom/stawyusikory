import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOrganization } from "@/lib/supabase/auth-context";
import { sendResendEmail } from "@/lib/integrations/resend";

const emailTestSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
});

export async function POST(request: Request) {
  const context = await requireOrganization(request);
  if (context.error) return context.error;
  if (context.role !== "owner" && context.role !== "admin") {
    return NextResponse.json({ error: "Tylko właściciel lub administrator może wysłać test e-mail." }, { status: 403 });
  }

  const parsed = emailTestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Podaj prawidłowy adres e-mail." }, { status: 400 });
  }

  const sentAt = new Date();
  const result = await sendResendEmail({
    to: parsed.data.email,
    subject: "[TEST] Stawy OS — sprawdzenie wysyłki e-mail",
    text: [
      "To jest testowa wiadomość ze Stawy OS.",
      `Dzień testu: ${sentAt.toISOString().slice(0, 10)}.`,
      "Jeśli ją widzisz, wiadomość dotarła. Sprawdź również nadawcę oraz adres wyświetlany po wybraniu Odpowiedz.",
    ].join("\n\n"),
    idempotencyKey: `email-test:${context.organizationId}:${parsed.data.email}:${sentAt.toISOString().slice(0, 10)}`,
    bookingId: "EMAIL-TEST",
    category: "system_test",
  });

  if (!result.ok) {
    const configurationError = result.error === "missing_api_key";
    return NextResponse.json(
      {
        error: configurationError
          ? "Brak poprawnej konfiguracji Resend w produkcji."
          : ("message" in result ? result.message : undefined) ?? "Resend nie potwierdził wysłania wiadomości.",
        code: result.error,
      },
      { status: configurationError ? 503 : 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    email: parsed.data.email,
    providerMessageId: result.providerMessageId,
  });
}
