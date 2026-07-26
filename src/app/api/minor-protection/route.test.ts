import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

const mocks = vi.hoisted(() => ({
  context: {
    role: "owner",
    organizationId: "00000000-0000-4000-8000-000000000001",
    user: { id: "00000000-0000-4000-8000-000000000002" },
  },
  rpc: vi.fn(),
  queryResult: { data: [] as Array<Record<string, unknown>>, error: null as null | { message: string } },
}));

vi.mock("@/lib/supabase/auth-context", () => ({
  requireOrganization: vi.fn(async () => mocks.context),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({
    rpc: mocks.rpc,
    from: () => ({
      select: () => ({
        eq: () => ({
          in: async () => mocks.queryResult,
        }),
      }),
    }),
  }),
}));

function request(body: unknown) {
  return new Request("https://app.example.com/api/minor-protection", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const standard = {
  version: "2026.1",
  approvedAt: "2026-07-20",
  effectiveFrom: "2026-07-21",
  reviewDueAt: "2028-07-20",
  fullDocumentUrl: "https://stawy.example/standardy/pelne",
  childFriendlyDocumentUrl: "https://stawy.example/standardy/skrocone",
  reviewOwner: "Właściciel",
  staffPreparationReference: "SZK-2026-01",
  publicationConfirmed: true,
  premisesDisplayConfirmed: true,
  steps: ["Wykonaj krok określony w zatwierdzonym SOP."],
};

describe("POST /api/minor-protection", () => {
  beforeEach(() => {
    mocks.context.role = "owner";
    mocks.rpc.mockReset().mockResolvedValue({ data: 18, error: null });
    mocks.queryResult = { data: [], error: null };
  });

  it("aktywuje kompletną wersję SOP w aktywnej organizacji", async () => {
    const response = await POST(request({ action: "activate_standard", standard }));

    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("mutate_minor_protection", {
      p_organization_id: mocks.context.organizationId,
      p_actor: mocks.context.user.id,
      p_action: "activate_standard",
      p_booking_id: null,
      p_details: standard,
    });
  });

  it("nie pozwala managerowi aktywować ani zamknąć SOP", async () => {
    mocks.context.role = "manager";
    expect((await POST(request({ action: "activate_standard", standard }))).status).toBe(403);
    expect((await POST(request({
      action: "close_reaction",
      bookingId: "RES-1",
      resolutionReference: "REJ-1",
    }))).status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("pozwala managerowi zapisać wyłącznie minimalny wynik wykonania", async () => {
    mocks.context.role = "manager";
    const response = await POST(request({
      action: "complete",
      bookingId: "RES-1",
      outcome: "Wymaga reakcji",
      childName: "pole zabronione",
    }));

    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("mutate_minor_protection", expect.objectContaining({
      p_action: "complete",
      p_booking_id: "RES-1",
      p_details: { outcome: "Wymaga reakcji" },
    }));
  });

  it("odrzuca URL bez TLS oraz brak potwierdzeń publikacji", async () => {
    const response = await POST(request({
      action: "activate_standard",
      standard: {
        ...standard,
        fullDocumentUrl: "http://stawy.example/standardy",
        publicationConfirmed: false,
      },
    }));

    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("nie ujawnia surowego błędu bazy", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "sekret bazy" } });
    const response = await POST(request({
      action: "complete",
      bookingId: "RES-1",
      outcome: "Bez uwag",
    }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Nie udało się zapisać procedury." });
  });

  it("pokazuje tylko bieżące i przyszłe pobyty bez PII gościa", async () => {
    mocks.queryResult = {
      error: null,
      data: [
        { entity_type: "units", entity_id: "unit-1", payload: { id: "unit-1", name: "Czapla" } },
        {
          entity_type: "bookings",
          entity_id: "OLD",
          payload: {
            unitId: "unit-1",
            children: 1,
            checkIn: "2020-07-01",
            checkOut: "2020-07-04",
            workflowStatus: "Zamknięta",
            guestLabel: "Historyczny Gość",
          },
        },
        {
          entity_type: "bookings",
          entity_id: "FUTURE",
          payload: {
            unitId: "unit-1",
            children: 2,
            checkIn: "2099-08-10",
            checkOut: "2099-08-12",
            workflowStatus: "Potwierdzona",
            guestLabel: "Dane ukryte",
          },
        },
      ],
    };

    const response = await GET(new Request("https://app.example.com/api/minor-protection"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.stays).toEqual([{
      bookingId: "FUTURE",
      unitId: "unit-1",
      unitName: "Czapla",
      checkIn: "2099-08-10",
      checkOut: "2099-08-12",
      execution: null,
      reaction: null,
    }]);
    expect(JSON.stringify(payload)).not.toContain("Dane ukryte");
    expect(JSON.stringify(payload)).not.toContain("Historyczny Gość");
  });
});
