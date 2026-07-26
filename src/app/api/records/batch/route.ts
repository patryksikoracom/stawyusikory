import { NextResponse } from "next/server";
import {
  recordBatchCommandSchema,
  type RecordBatchCommandResult,
} from "@/lib/domain/record-batch-command";
import { isOrganizationEditor, requireOrganization } from "@/lib/supabase/auth-context";

const maxPayloadBytes = 4_000_000;

export async function POST(request: Request) {
  const context = await requireOrganization();
  if (context.error) return context.error;
  if (!isOrganizationEditor(context.role)) {
    return NextResponse.json({ error: "Konto nie ma dostępu do zapisu rekordów." }, { status: 403 });
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > maxPayloadBytes) {
    return NextResponse.json({ error: "Paczka zmian jest zbyt duża." }, { status: 413 });
  }
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > maxPayloadBytes) {
    return NextResponse.json({ error: "Paczka zmian jest zbyt duża." }, { status: 413 });
  }
  const parsed = recordBatchCommandSchema.safeParse(
    (() => {
      try { return JSON.parse(rawBody); }
      catch { return null; }
    })(),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Paczka zmian narusza kontrakt domenowy." }, { status: 400 });
  }

  const response = await context.supabase.rpc("mutate_operational_record_batch", {
    p_organization_id: context.organizationId,
    p_changes: parsed.data.changes,
    p_request_id: parsed.data.requestId,
    p_client_sent_at: parsed.data.clientSentAt,
    p_tab_id: parsed.data.tabId,
  });
  if (response.error) {
    if (response.error.code === "42501") {
      return NextResponse.json({ error: "Konto nie ma dostępu do zapisu rekordów." }, { status: 403 });
    }
    if (["22003", "22007", "22023"].includes(response.error.code ?? "")) {
      return NextResponse.json({ error: "Paczka zmian narusza reguły operacyjne." }, { status: 422 });
    }
    if (response.error.code === "40001") {
      return NextResponse.json({ error: "Rekord zmienił się podczas zapisu." }, { status: 409 });
    }
    return NextResponse.json({ error: "Nie udało się zapisać paczki rekordów." }, { status: 500 });
  }

  const result = response.data as RecordBatchCommandResult | null;
  if (!result) return NextResponse.json({ error: "Baza zwróciła niepełny wynik zapisu." }, { status: 500 });
  if (result.status === "conflict") {
    return NextResponse.json({
      error: "Jeden z rekordów zmienił się na innym urządzeniu.",
      requestId: parsed.data.requestId,
      ...result.conflict,
      detectedAt: new Date().toISOString(),
    }, { status: 409 });
  }
  if (
    !["committed", "already_committed"].includes(result.status)
    || typeof result.stateVersion !== "number"
    || !Array.isArray(result.changes)
  ) {
    return NextResponse.json({ error: "Baza zwróciła niepełny wynik zapisu." }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    idempotentReplay: result.status === "already_committed",
    requestId: parsed.data.requestId,
    stateVersion: result.stateVersion,
    savedAt: result.savedAt,
    changes: result.changes,
  });
}
