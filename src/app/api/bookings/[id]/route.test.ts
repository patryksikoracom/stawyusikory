import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "./route";

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
  id: "BOOKING-1",
  bookingDate: "2026-07-25",
  source: "Telefon",
  platform: "Telefon",
  unitId: "domek-4",
  checkIn: "2026-08-11",
  checkOut: "2026-08-14",
  arrivalTime: "16:00",
  departureTime: "11:00",
  adults: 2,
  children: 1,
  guestLabel: "Anna Zmieniona",
  grossPrice: 2200,
  paymentStatus: "Zaliczka",
  workflowStatus: "Potwierdzona",
  createdBy: "Patryk",
  version: 4,
};
const contact = {
  bookingId: booking.id,
  phone: "+48 600 000 000",
  email: "anna@example.com",
  marketingConsent: "Do dopytania",
  photoFbConsent: "Nie",
  photoSiteAdsConsent: "Nie",
  version: 3,
};
const task = {
  id: "TASK-1",
  bookingId: booking.id,
  type: "Sprzątanie",
  priority: "Wysoki",
  status: "Do zrobienia",
  dueDate: booking.checkOut,
  owner: "Pani Ewa",
  unitId: booking.unitId,
  title: "Wykonać turnover domku po wyjeździe.",
  version: 6,
};
const scheduledMessage = {
  id: "SCH-RULE-BOOKING-1",
  bookingId: booking.id,
  ruleId: "RULE-1",
  templateId: "TPL-1",
  templateVersion: 1,
  dueAt: "2026-08-09T10:00:00",
  channel: "SMS",
  recipient: contact.phone,
  renderedBody: "Dzień dobry",
  status: "Wersja robocza",
  idempotencyKey: "scheduled-rule-booking-1",
  bookingFingerprint: "fingerprint",
  createdAt: "2026-07-25T20:00:00.000Z",
  version: 2,
};
const aggregate = {
  booking,
  contact,
  tasks: [task],
  scheduledMessages: [scheduledMessage],
};

function request(overrides: Record<string, unknown> = {}) {
  return new Request("https://app.example.com/api/bookings/BOOKING-1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      aggregate,
      expectedRecordVersion: 3,
      requestId: "request-booking-update-123",
      clientSentAt: "2026-07-25T20:00:00.000Z",
      tabId: "tab-booking-update-123",
      ...overrides,
    }),
  });
}

const routeContext = { params: Promise.resolve({ id: "BOOKING-1" }) };

describe("PATCH /api/bookings/:id", () => {
  beforeEach(() => {
    mocks.context = {
      role: "owner",
      organizationId: "org-test",
      supabase: { rpc: vi.fn().mockResolvedValue({
        data: {
          status: "committed",
          aggregate: {
            ...aggregate,
            booking: { ...booking, updatedAt: "2026-07-25T20:00:01.000Z" },
            contact: { ...contact, updatedAt: "2026-07-25T20:00:01.000Z" },
            tasks: [{ ...task, updatedAt: "2026-07-25T20:00:01.000Z" }],
            scheduledMessages: [{ ...scheduledMessage, updatedAt: "2026-07-25T20:00:01.000Z" }],
          },
          recordVersion: 4,
          stateVersion: 14,
          savedAt: "2026-07-25T20:00:01.000Z",
        },
        error: null,
      }) },
    };
  });

  it("wykonuje jedną atomową komendę dla rezerwacji i jej skutków", async () => {
    const response = await PATCH(request(), routeContext);

    expect(response.status).toBe(200);
    expect(mocks.context.supabase.rpc).toHaveBeenCalledWith("update_operational_booking", {
      p_organization_id: "org-test",
      p_booking_id: booking.id,
      p_expected_record_version: 3,
      p_booking: booking,
      p_contact: contact,
      p_tasks: [task],
      p_scheduled_messages: [scheduledMessage],
      p_request_id: "request-booking-update-123",
      p_client_sent_at: "2026-07-25T20:00:00.000Z",
      p_tab_id: "tab-booking-update-123",
    });
    expect(await response.json()).toMatchObject({
      ok: true,
      recordVersion: 4,
      stateVersion: 14,
      aggregate: {
        booking: { id: booking.id, version: 4 },
        tasks: [{ id: task.id, version: 6 }],
      },
    });
  });

  it.each([
    ["booking", { status: "conflict", recordVersion: 8 }],
    ["task", {
      status: "related_record_conflict",
      conflictEntityType: "task",
      conflictId: task.id,
      conflictRecordVersion: 9,
    }],
  ])("zwraca 409 dla konfliktu %s", async (_label, result) => {
    mocks.context.supabase.rpc.mockResolvedValue({ data: result, error: null });

    const response = await PATCH(request(), routeContext);

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      requestId: "request-booking-update-123",
    });
  });

  it("zwraca 409 dla kolizji terminu z rezerwacją lub blokadą", async () => {
    mocks.context.supabase.rpc.mockResolvedValue({
      data: {
        status: "availability_conflict",
        conflictType: "block",
        conflictId: "BLOCK-1",
        recordVersion: 3,
      },
      error: null,
    });

    const response = await PATCH(request(), routeContext);

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      conflictType: "block",
      conflictId: "BLOCK-1",
    });
  });

  it("odrzuca różne identyfikatory trasy i payloadu", async () => {
    const response = await PATCH(request({
      aggregate: { ...aggregate, booking: { ...booking, id: "BOOKING-2" } },
    }), routeContext);

    expect(response.status).toBe(400);
    expect(mocks.context.supabase.rpc).not.toHaveBeenCalled();
  });

  it("odrzuca zerwane relacje i nieprawidłowy zakres przed bazą", async () => {
    const brokenTask = await PATCH(request({
      aggregate: { ...aggregate, tasks: [{ ...task, bookingId: "BOOKING-2" }] },
    }), routeContext);
    expect(brokenTask.status).toBe(400);

    const brokenDates = await PATCH(request({
      aggregate: {
        ...aggregate,
        booking: { ...booking, checkOut: booking.checkIn },
      },
    }), routeContext);
    expect(brokenDates.status).toBe(400);
    expect(mocks.context.supabase.rpc).not.toHaveBeenCalled();
  });

  it("mierzy faktyczny rozmiar payloadu", async () => {
    const response = await PATCH(request({
      aggregate: {
        ...aggregate,
        scheduledMessages: [{
          ...scheduledMessage,
          renderedBody: "x".repeat(513_000),
        }],
      },
    }), routeContext);

    expect(response.status).toBe(413);
    expect(mocks.context.supabase.rpc).not.toHaveBeenCalled();
  });

  it("blokuje rolę viewer i nie ujawnia błędu bazy", async () => {
    mocks.context.role = "viewer";
    const forbidden = await PATCH(request(), routeContext);
    expect(forbidden.status).toBe(403);
    expect(mocks.context.supabase.rpc).not.toHaveBeenCalled();

    mocks.context.role = "owner";
    mocks.context.supabase.rpc.mockResolvedValue({
      data: null,
      error: { code: "XX000", message: "sensitive database detail" },
    });
    const failure = await PATCH(request(), routeContext);
    expect(failure.status).toBe(500);
    expect(await failure.json()).toEqual({ error: "Nie udało się zapisać rezerwacji." });
  });
});
