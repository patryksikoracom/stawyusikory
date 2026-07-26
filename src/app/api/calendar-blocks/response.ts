import { NextResponse } from "next/server";
import {
  operationalCalendarBlockSchema,
  type CalendarBlockCommandResult,
} from "@/lib/domain/calendar-block-command";

export function calendarBlockResponse(
  response: {
    data: unknown;
    error: { code?: string; message?: string } | null;
  },
  requestId: string,
  expectedRecordVersion: number,
) {
  if (response.error) {
    if (response.error.code === "42501") {
      return NextResponse.json(
        { error: "Konto nie ma dostępu do zmiany blokad kalendarza." },
        { status: 403 },
      );
    }
    if (["22003", "22007", "22023"].includes(response.error.code ?? "")) {
      return NextResponse.json(
        { error: "Blokada narusza reguły kalendarza." },
        { status: 422 },
      );
    }
    if (response.error.code === "40001") {
      return NextResponse.json({
        error: "Blokada zmieniła się podczas zapisu. Odśwież kalendarz.",
        requestId,
        expectedRecordVersion,
        detectedAt: new Date().toISOString(),
      }, { status: 409 });
    }
    return NextResponse.json(
      { error: "Nie udało się zapisać blokady kalendarza." },
      { status: 500 },
    );
  }

  const result = response.data as CalendarBlockCommandResult | null;
  if (!result) {
    return NextResponse.json(
      { error: "Baza zwróciła niepełny wynik zapisu." },
      { status: 500 },
    );
  }
  if (result.status === "unit_not_found") {
    return NextResponse.json({ error: "Wybrany domek nie istnieje." }, { status: 422 });
  }
  if (result.status === "not_found") {
    return NextResponse.json({ error: "Blokada kalendarza nie istnieje." }, { status: 404 });
  }
  if (result.status === "availability_conflict") {
    return NextResponse.json({
      error: result.conflictType === "booking"
        ? "Termin koliduje z aktywną rezerwacją."
        : "Termin koliduje z inną aktywną blokadą.",
      requestId,
      conflictType: result.conflictType,
      conflictId: result.conflictId,
      detectedAt: new Date().toISOString(),
    }, { status: 409 });
  }
  if (result.status === "exists" || result.status === "conflict") {
    return NextResponse.json({
      error: result.status === "exists"
        ? "Blokada o tym identyfikatorze już istnieje."
        : "Blokada zmieniła się na innym urządzeniu.",
      requestId,
      expectedRecordVersion,
      currentRecordVersion: result.recordVersion,
      detectedAt: new Date().toISOString(),
    }, { status: 409 });
  }

  const committedBlock = operationalCalendarBlockSchema.safeParse(result.block);
  if (
    !["committed", "already_committed"].includes(result.status)
    || !committedBlock.success
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
    idempotentReplay: result.status === "already_committed",
    requestId,
    block: committedBlock.data,
    recordVersion: result.recordVersion,
    stateVersion: result.stateVersion,
    savedAt: result.savedAt,
  });
}
