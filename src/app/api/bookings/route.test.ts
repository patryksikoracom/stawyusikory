import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  context: {
    role: "owner",
    organizationId: "org-test",
    supabase: { rpc: vi.fn() },
  } as {
    role: string;
    organizationId: string;
    supabase: { rpc: ReturnType<typeof vi.fn> };
    error?: Response;
  },
}));

vi.mock("@/lib/supabase/auth-context", () => ({
  isOrganizationEditor: (role: unknown) => role === "owner" || role === "admin",
  requireOrganization: vi.fn(async () => mocks.context),
}));

const booking = {
  id: "BOOKING-NEW-1",
  bookingDate: "2026-07-25",
  source: "Telefon",
  platform: "Telefon",
  unitId: "domek-4",
  checkIn: "2026-08-10",
  checkOut: "2026-08-13",
  arrivalTime: "16:00",
  departureTime: "11:00",
  adults: 2,
  children: 1,
  guestLabel: "Anna Testowa",
  grossPrice: 2100,
  paymentStatus: "Zaliczka",
  workflowStatus: "Nowa",
  createdBy: "Patryk",
};
const contact = {
  bookingId: booking.id,
  phone: "+48 600 000 000",
  email: "anna@example.com",
  marketingConsent: "Do dopytania",
  photoFbConsent: "Nie",
  photoSiteAdsConsent: "Nie",
};
const task = {
  id: "TASK-NEW-1",
  bookingId: booking.id,
  type: "Sprzątanie",
  priority: "Wysoki",
  status: "Do zrobienia",
  dueDate: booking.checkOut,
  owner: "Pani Ewa",
  unitId: booking.unitId,
  title: "Wykonać turnover domku po wyjeździe.",
};
const checklistItem = {
  id: "CHECK-NEW-1",
  taskId: task.id,
  label: "Pościel i ręczniki",
  done: false,
};
const scheduledMessage = {
  id: "SCH-RULE-NEW-BOOKING-NEW-1",
  bookingId: booking.id,
  ruleId: "RULE-NEW",
  templateId: "TPL-NEW",
  templateVersion: 1,
  dueAt: "2026-08-08T10:00:00",
  channel: "SMS",
  recipient: contact.phone,
  renderedBody: "Dzień dobry",
  status: "Wersja robocza",
  idempotencyKey: "scheduled-rule-new-booking-new-1",
  bookingFingerprint: "fingerprint",
  createdAt: "2026-07-25T20:00:00.000Z",
};
const aggregate = {
  booking,
  contact,
  tasks: [task],
  checklistItems: [checklistItem],
  scheduledMessages: [scheduledMessage],
};

function request(overrides: Record<string, unknown> = {}) {
  return new Request("https://app.example.com/api/bookings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      aggregate,
      requestId: "request-booking-123",
      clientSentAt: "2026-07-25T20:00:00.000Z",
      tabId: "tab-booking-123",
      ...overrides,
    }),
  });
}

describe("POST /api/bookings", () => {
  beforeEach(() => {
    mocks.context = {
      role: "owner",
      organizationId: "org-test",
      supabase: { rpc: vi.fn().mockResolvedValue({
        data: {
          status: "committed",
          aggregate: {
            ...aggregate,
            booking: { ...booking, version: 1, updatedAt: "2026-07-25T20:00:01.000Z" },
            tasks: [{ ...task, version: 1, updatedAt: "2026-07-25T20:00:01.000Z" }],
            checklistItems: [{ ...checklistItem, version: 1, updatedAt: "2026-07-25T20:00:01.000Z" }],
          },
          stateVersion: 8,
          savedAt: "2026-07-25T20:00:01.000Z",
        },
        error: null,
      }) },
    };
  });

  it("przekazuje pełny agregat do jednej transakcyjnej funkcji", async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.context.supabase.rpc).toHaveBeenCalledWith("create_operational_booking", {
      p_organization_id: "org-test",
      p_booking_id: booking.id,
      p_booking: booking,
      p_contact: contact,
      p_tasks: [task],
      p_checklist_items: [checklistItem],
      p_scheduled_messages: [scheduledMessage],
      p_request_id: "request-booking-123",
      p_client_sent_at: "2026-07-25T20:00:00.000Z",
      p_tab_id: "tab-booking-123",
    });
    expect(await response.json()).toMatchObject({
      ok: true,
      idempotentReplay: false,
      stateVersion: 8,
      aggregate: {
        booking: { id: booking.id, version: 1 },
        tasks: [{ id: task.id, version: 1 }],
        checklistItems: [{ id: checklistItem.id, version: 1 }],
      },
    });
  });

  it("akceptuje bezpieczne ponowienie tej samej komendy", async () => {
    mocks.context.supabase.rpc.mockResolvedValue({
      data: {
        status: "already_committed",
        aggregate,
        stateVersion: 9,
        savedAt: "2026-07-25T20:00:01.000Z",
      },
      error: null,
    });

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, idempotentReplay: true, stateVersion: 9 });
  });

  it.each([
    ["exists", { status: "exists" }, "booking_id"],
    ["availability booking", { status: "availability_conflict", conflictType: "booking", conflictId: "BOOKING-OLD" }, "booking"],
    ["availability block", { status: "availability_conflict", conflictType: "block", conflictId: "BLOCK-1" }, "block"],
  ])("zwraca 409 dla konfliktu %s", async (_label, result, expectedType) => {
    mocks.context.supabase.rpc.mockResolvedValue({ data: result, error: null });

    const response = await POST(request());

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ conflictType: expectedType });
  });

  it("odrzuca zerwane relacje agregatu przed wywołaniem bazy", async () => {
    const response = await POST(request({
      aggregate: {
        ...aggregate,
        checklistItems: [{ ...checklistItem, taskId: "TASK-SPOZA-AGREGATU" }],
      },
    }));

    expect(response.status).toBe(400);
    expect(mocks.context.supabase.rpc).not.toHaveBeenCalled();
  });

  it("odrzuca nieprawidłowy zakres pobytu", async () => {
    const response = await POST(request({
      aggregate: {
        ...aggregate,
        booking: { ...booking, checkOut: booking.checkIn },
      },
    }));

    expect(response.status).toBe(400);
    expect(mocks.context.supabase.rpc).not.toHaveBeenCalled();
  });

  it("mierzy rzeczywisty payload niezależnie od Content-Length", async () => {
    const oversized = request({
      aggregate: {
        ...aggregate,
        scheduledMessages: [{
          ...scheduledMessage,
          renderedBody: "x".repeat(513_000),
        }],
      },
    });

    const response = await POST(oversized);

    expect(response.status).toBe(413);
    expect(mocks.context.supabase.rpc).not.toHaveBeenCalled();
  });

  it("blokuje rolę viewer", async () => {
    mocks.context.role = "viewer";

    const response = await POST(request());

    expect(response.status).toBe(403);
    expect(mocks.context.supabase.rpc).not.toHaveBeenCalled();
  });

  it("mapuje brak domku i nie ujawnia błędu bazy", async () => {
    mocks.context.supabase.rpc.mockResolvedValueOnce({ data: { status: "unit_not_found" }, error: null });
    const missingUnit = await POST(request());
    expect(missingUnit.status).toBe(422);

    mocks.context.supabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "XX000", message: "sensitive database detail" },
    });
    const failure = await POST(request());
    expect(failure.status).toBe(500);
    expect(await failure.json()).toEqual({ error: "Nie udało się utworzyć rezerwacji." });
  });

  it("nie przepuszcza niepełnego agregatu zwróconego przez RPC", async () => {
    mocks.context.supabase.rpc.mockResolvedValue({
      data: {
        status: "committed",
        aggregate: { booking },
        stateVersion: 8,
      },
      error: null,
    });

    const response = await POST(request());

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Baza zwróciła niepełny wynik zapisu." });
  });
});
