import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CalendarBlock, SourceConnection } from "@/lib/types";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  insert: vi.fn(),
  records: [] as Array<{ entity_type: string; payload: SourceConnection | CalendarBlock }>,
  validate: vi.fn(),
}));

vi.mock("@/lib/supabase/auth-context", () => ({
  isOrganizationEditor: () => true,
  requireOrganization: vi.fn(async () => ({ role: "owner", organizationId: "org-ical" })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      if (table === "operational_records") {
        const query = { select: vi.fn(), eq: vi.fn(), in: vi.fn(async () => ({ data: mocks.records, error: null })) };
        query.select.mockReturnValue(query);
        query.eq.mockReturnValue(query);
        return query;
      }
      if (table === "integration_sync_runs") return { insert: mocks.insert };
      throw new Error(`Unexpected table: ${table}`);
    },
    rpc: mocks.rpc,
  }),
}));

vi.mock("@/lib/integrations/ical-security", () => ({
  validateExternalCalendarUrlForFetch: mocks.validate,
}));

function connection(id: string, importUrl: string): SourceConnection {
  return {
    id,
    platform: id === "AIRBNB" ? "Airbnb" : "Booking",
    connectionType: "iCal",
    status: "Aktywne",
    lastSyncAt: "2026-08-09T08:00:00.000Z",
    coverage: 100,
    nextStep: "Monitoruj",
    notes: "test",
    priority: "Teraz",
    unitId: "UNIT-1",
    importUrl,
  };
}

function block(id: string, dateFrom: string): CalendarBlock {
  return {
    id,
    unitId: "UNIT-1",
    dateFrom,
    dateTo: "2030-07-12",
    blockType: "Inne",
    reason: "Poprzedni odczyt",
    status: "Aktywna",
  };
}

describe("POST /api/integrations/ical/sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.insert.mockResolvedValue({ error: null });
    mocks.rpc.mockResolvedValue({ data: 12, error: null });
    mocks.validate.mockImplementation(async (url: string) => (
      url.includes("broken")
        ? { ok: false, error: "Feed jest chwilowo niedostępny" }
        : { ok: true, url: new URL(url) }
    ));
  });

  it("przy awarii częściowej zachowuje ostatnie blokady wyłącznie błędnego feedu", async () => {
    mocks.records = [
      { entity_type: "sourceConnections", payload: connection("BOOKING", "https://example.com/booking.ics") },
      { entity_type: "sourceConnections", payload: connection("AIRBNB", "https://broken.example.com/airbnb.ics") },
      { entity_type: "blocks", payload: block("ICAL-BOOKING-old", "2030-07-01") },
      { entity_type: "blocks", payload: block("ICAL-AIRBNB-old", "2030-07-10") },
    ];
    vi.stubGlobal("fetch", vi.fn(async () => new Response([
      "BEGIN:VCALENDAR", "BEGIN:VEVENT", "UID:new-booking-event",
      "DTSTART;VALUE=DATE:20300720", "DTEND;VALUE=DATE:20300723",
      "SUMMARY:Nowa rezerwacja", "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n"), { status: 200 })));

    const response = await POST(new Request("https://app.example.com/api/integrations/ical/sync", { method: "POST" }));
    const payload = await response.json();
    const rpcPayload = mocks.rpc.mock.calls[0]![1];

    expect(payload).toMatchObject({ ok: false, feeds: 2, blocks: 1, failures: 1, preservedBlocks: 1 });
    expect(rpcPayload.p_blocks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: expect.stringMatching(/^ICAL-BOOKING-/), dateFrom: "2030-07-20" }),
      expect.objectContaining({ id: "ICAL-AIRBNB-old", dateFrom: "2030-07-10" }),
    ]));
    expect(rpcPayload.p_blocks).not.toContainEqual(expect.objectContaining({ id: "ICAL-BOOKING-old" }));
  });

  it("pomija puste sloty i nie oznacza ich jako awarii feedu", async () => {
    const emptyAirbnb = {
      ...connection("AIRBNB", ""),
      unitId: undefined,
      importUrl: undefined,
      status: "Do podłączenia" as const,
    };
    mocks.records = [
      { entity_type: "sourceConnections", payload: connection("BOOKING", "https://example.com/booking.ics") },
      { entity_type: "sourceConnections", payload: emptyAirbnb },
    ];
    vi.stubGlobal("fetch", vi.fn(async () => new Response("BEGIN:VCALENDAR\r\nEND:VCALENDAR", { status: 200 })));

    const response = await POST(new Request("https://app.example.com/api/integrations/ical/sync", { method: "POST" }));
    const payload = await response.json();

    expect(payload).toMatchObject({ ok: true, feeds: 1, failures: 0 });
    expect(mocks.validate).toHaveBeenCalledTimes(1);
    expect(mocks.rpc.mock.calls[0]![1].p_connections).toContainEqual(emptyAirbnb);
  });
});
