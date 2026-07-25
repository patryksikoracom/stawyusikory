import { NextResponse } from "next/server";
import {
  updateChecklistItemCommandSchema,
  type UpdateChecklistItemCommandResult,
} from "@/lib/domain/checklist-command";
import { isOrganizationEditor, requireOrganization } from "@/lib/supabase/auth-context";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const context = await requireOrganization();
  if (context.error) return context.error;
  if (!isOrganizationEditor(context.role)) {
    return NextResponse.json({ error: "Konto nie ma dostępu do zapisu checklisty." }, { status: 403 });
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > 32_000) {
    return NextResponse.json({ error: "Punkt checklisty jest zbyt duży." }, { status: 413 });
  }

  const { id } = await params;
  let body: unknown = null;
  try {
    body = JSON.parse(rawBody);
  } catch {
    // Walidacja poniżej zwraca wspólny, bezpieczny komunikat.
  }
  const parsed = updateChecklistItemCommandSchema.safeParse(body);
  if (!parsed.success || parsed.data.item.id !== id) {
    return NextResponse.json({ error: "Nieprawidłowe dane punktu checklisty." }, { status: 400 });
  }

  const { data, error } = await context.supabase.rpc("update_operational_checklist_item", {
    p_organization_id: context.organizationId,
    p_item_id: id,
    p_expected_record_version: parsed.data.expectedRecordVersion,
    p_item: parsed.data.item,
    p_request_id: parsed.data.requestId,
    p_client_sent_at: parsed.data.clientSentAt,
    p_tab_id: parsed.data.tabId,
  });

  if (error) {
    if (error.code === "42501") {
      return NextResponse.json({ error: "Konto nie ma dostępu do zapisu checklisty." }, { status: 403 });
    }
    if (error.code === "22023" || error.code === "22007") {
      return NextResponse.json({ error: "Punkt checklisty narusza reguły operacyjne." }, { status: 422 });
    }
    return NextResponse.json({ error: "Nie udało się zapisać checklisty." }, { status: 500 });
  }

  const result = data as UpdateChecklistItemCommandResult | null;
  if (!result || result.status === "not_found") {
    return NextResponse.json({ error: "Punkt checklisty nie istnieje." }, { status: 404 });
  }
  if (result.status === "task_not_found") {
    return NextResponse.json({ error: "Powiązane zadanie nie istnieje." }, { status: 422 });
  }
  if (result.status === "conflict") {
    return NextResponse.json({
      error: "Ten punkt checklisty zmienił się na innym urządzeniu.",
      requestId: parsed.data.requestId,
      expectedRecordVersion: parsed.data.expectedRecordVersion,
      currentRecordVersion: result.recordVersion,
      detectedAt: new Date().toISOString(),
    }, { status: 409 });
  }
  if (!result.item || !result.recordVersion || typeof result.stateVersion !== "number") {
    return NextResponse.json({ error: "Baza zwróciła niepełny wynik zapisu." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    requestId: parsed.data.requestId,
    item: result.item,
    recordVersion: result.recordVersion,
    stateVersion: result.stateVersion,
    savedAt: result.savedAt,
  });
}
