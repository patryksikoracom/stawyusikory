import { NextResponse } from "next/server";
import {
  createCalendarBlockCommandSchema,
} from "@/lib/domain/calendar-block-command";
import { isOrganizationEditor, requireOrganization } from "@/lib/supabase/auth-context";
import { calendarBlockResponse } from "./response";

const maxPayloadBytes = 24_000;

export async function POST(request: Request) {
  const context = await requireOrganization();
  if (context.error) return context.error;
  if (!isOrganizationEditor(context.role)) {
    return NextResponse.json(
      { error: "Konto nie ma dostępu do tworzenia blokad kalendarza." },
      { status: 403 },
    );
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
  const parsed = createCalendarBlockCommandSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Nieprawidłowe dane blokady kalendarza." }, { status: 400 });
  }

  const response = await context.supabase.rpc("mutate_operational_calendar_block", {
    p_organization_id: context.organizationId,
    p_operation: "create",
    p_block_id: parsed.data.block.id,
    p_expected_record_version: parsed.data.expectedRecordVersion,
    p_block: parsed.data.block,
    p_request_id: parsed.data.requestId,
    p_client_sent_at: parsed.data.clientSentAt,
    p_tab_id: parsed.data.tabId,
  });

  return calendarBlockResponse(response, parsed.data.requestId, 0);
}
