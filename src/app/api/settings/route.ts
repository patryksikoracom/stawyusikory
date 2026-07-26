import { NextResponse } from "next/server";
import {
  operationalSettingsSchema,
  updateSettingsCommandSchema,
  type UpdateSettingsCommandResult,
} from "@/lib/domain/settings-command";
import { isOrganizationEditor, requireOrganization } from "@/lib/supabase/auth-context";

const maxPayloadBytes = 16_000;

export async function PATCH(request: Request) {
  const context = await requireOrganization();
  if (context.error) return context.error;
  if (!isOrganizationEditor(context.role)) {
    return NextResponse.json(
      { error: "Konto nie ma dostępu do ustawień organizacji." },
      { status: 403 },
    );
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > maxPayloadBytes) {
    return NextResponse.json({ error: "Ustawienia są zbyt duże." }, { status: 413 });
  }

  let body: unknown = null;
  try {
    body = JSON.parse(rawBody);
  } catch {
    // Walidacja poniżej zwraca wspólny, bezpieczny komunikat.
  }
  const parsed = updateSettingsCommandSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Nieprawidłowe ustawienia organizacji." }, { status: 400 });
  }

  const { data, error } = await context.supabase.rpc("update_operational_settings", {
    p_organization_id: context.organizationId,
    p_expected_record_version: parsed.data.expectedRecordVersion,
    p_settings: parsed.data.settings,
    p_request_id: parsed.data.requestId,
    p_client_sent_at: parsed.data.clientSentAt,
    p_tab_id: parsed.data.tabId,
  });

  if (error) {
    if (error.code === "42501") {
      return NextResponse.json(
        { error: "Konto nie ma dostępu do ustawień organizacji." },
        { status: 403 },
      );
    }
    if (error.code === "22023" || error.code === "22007") {
      return NextResponse.json(
        { error: "Ustawienia naruszają reguły operacyjne." },
        { status: 422 },
      );
    }
    return NextResponse.json(
      { error: "Nie udało się zapisać ustawień." },
      { status: 500 },
    );
  }

  const result = data as UpdateSettingsCommandResult | null;
  if (!result) {
    return NextResponse.json(
      { error: "Baza zwróciła niepełny wynik zapisu." },
      { status: 500 },
    );
  }
  if (result.status === "conflict") {
    return NextResponse.json({
      error: "Ustawienia zmieniły się na innym urządzeniu.",
      requestId: parsed.data.requestId,
      expectedRecordVersion: parsed.data.expectedRecordVersion,
      currentRecordVersion: result.recordVersion,
      detectedAt: new Date().toISOString(),
    }, { status: 409 });
  }

  const committedSettings = operationalSettingsSchema.safeParse(result.settings);
  if (
    result.status !== "committed"
    || !committedSettings.success
    || typeof result.recordVersion !== "number"
    || typeof result.stateVersion !== "number"
  ) {
    return NextResponse.json(
      { error: "Baza zwróciła niepełny wynik zapisu." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    requestId: parsed.data.requestId,
    settings: committedSettings.data,
    recordVersion: result.recordVersion,
    stateVersion: result.stateVersion,
    savedAt: result.savedAt,
  });
}
