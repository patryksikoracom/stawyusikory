import { NextResponse } from "next/server";
import {
  updateCalendarBlockCommandSchema,
} from "@/lib/domain/calendar-block-command";
import { isOrganizationEditor, requireOrganization } from "@/lib/supabase/auth-context";
import { calendarBlockResponse } from "../response";

const maxPayloadBytes = 24_000;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await requireOrganization();
  if (context.error) return context.error;
  if (!isOrganizationEditor(context.role)) {
    return NextResponse.json(
      { error: "Konto nie ma dostępu do zmiany blokad kalendarza." },
      { status: 403 },
    );
  }

  const { id } = await params;
  const blockId = id.trim();
  if (!blockId || blockId.length > 128) {
    return NextResponse.json({ error: "Nieprawidłowy identyfikator blokady." }, { status: 400 });
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > maxPayloadBytes) {
    return NextResponse.json({ error: "Blokada kalendarza jest zbyt duża." }, { status: 413 });
  }

  let body: unknown = null;
  try {
    body = JSON.parse(rawBody);
  } catch {
    // Walidacja poniżej zwraca wspólny komunikat bez ujawniania szczegółów.
  }
  const parsed = updateCalendarBlockCommandSchema.safeParse(body);
  if (!parsed.success || parsed.data.block.id !== blockId) {
    return NextResponse.json({ error: "Nieprawidłowe dane blokady kalendarza." }, { status: 400 });
  }

  const response = await context.supabase.rpc("mutate_operational_calendar_block", {
    p_organization_id: context.organizationId,
    p_operation: "update",
    p_block_id: blockId,
    p_expected_record_version: parsed.data.expectedRecordVersion,
    p_block: parsed.data.block,
    p_request_id: parsed.data.requestId,
    p_client_sent_at: parsed.data.clientSentAt,
    p_tab_id: parsed.data.tabId,
  });

  return calendarBlockResponse(
    response,
    parsed.data.requestId,
    parsed.data.expectedRecordVersion,
  );
}
