import { NextResponse } from "next/server";
import { updateTaskCommandSchema, type UpdateTaskCommandResult } from "@/lib/domain/task-command";
import { isOrganizationEditor, requireOrganization } from "@/lib/supabase/auth-context";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const context = await requireOrganization();
  if (context.error) return context.error;
  if (!isOrganizationEditor(context.role)) {
    return NextResponse.json({ error: "Konto nie ma dostępu do zapisu zadań." }, { status: 403 });
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > 64_000) {
    return NextResponse.json({ error: "Zadanie jest zbyt duże." }, { status: 413 });
  }

  const { id } = await params;
  let body: unknown = null;
  try {
    body = JSON.parse(rawBody);
  } catch {
    // Walidacja poniżej zwraca wspólny, bezpieczny komunikat.
  }
  const parsed = updateTaskCommandSchema.safeParse(body);
  if (!parsed.success || parsed.data.task.id !== id) {
    return NextResponse.json({ error: "Nieprawidłowe dane zadania." }, { status: 400 });
  }
  const taskPayload = {
    ...parsed.data.task,
    version: parsed.data.expectedRecordVersion + 1,
    updatedAt: parsed.data.clientSentAt,
  };

  const { data, error } = await context.supabase.rpc("update_operational_task", {
    p_organization_id: context.organizationId,
    p_task_id: id,
    p_expected_record_version: parsed.data.expectedRecordVersion,
    p_task: taskPayload,
    p_request_id: parsed.data.requestId,
    p_client_sent_at: parsed.data.clientSentAt,
    p_tab_id: parsed.data.tabId,
  });

  if (error) {
    if (error.code === "42501") {
      return NextResponse.json({ error: "Konto nie ma dostępu do zapisu zadań." }, { status: 403 });
    }
    if (error.code === "22023" || error.code === "22007") {
      return NextResponse.json({ error: "Zadanie narusza reguły operacyjne." }, { status: 422 });
    }
    return NextResponse.json({ error: "Nie udało się zapisać zadania." }, { status: 500 });
  }

  const result = data as UpdateTaskCommandResult | null;
  if (!result || result.status === "not_found") {
    return NextResponse.json({ error: "Zadanie nie istnieje." }, { status: 404 });
  }
  if (result.status === "conflict") {
    return NextResponse.json({
      error: "To zadanie zmieniło się na innym urządzeniu.",
      requestId: parsed.data.requestId,
      expectedRecordVersion: parsed.data.expectedRecordVersion,
      currentRecordVersion: result.recordVersion,
      detectedAt: new Date().toISOString(),
    }, { status: 409 });
  }
  if (!result.task || !result.recordVersion || typeof result.stateVersion !== "number") {
    return NextResponse.json({ error: "Baza zwróciła niepełny wynik zapisu." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    requestId: parsed.data.requestId,
    task: result.task,
    recordVersion: result.recordVersion,
    stateVersion: result.stateVersion,
    savedAt: result.savedAt,
  });
}
