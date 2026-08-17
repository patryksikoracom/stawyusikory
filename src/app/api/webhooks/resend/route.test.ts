import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  insert: vi.fn(),
  deleteEvent: vi.fn(),
  update: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/integrations/resend", () => ({
  verifyResendWebhook: mocks.verify,
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      if (table === "outbound_messages") {
        const selectQuery = {
          select: vi.fn(),
          eq: vi.fn(),
          maybeSingle: vi.fn(async () => ({
            data: {
              id: "OUT-1",
              organization_id: "ORG-1",
              scheduled_message_id: "SCH-1",
              status: "sent",
            },
            error: null,
          })),
        };
        selectQuery.select.mockReturnValue(selectQuery);
        selectQuery.eq.mockReturnValue(selectQuery);
        const updateQuery = { eq: vi.fn(async () => ({ error: null })) };
        mocks.update.mockReturnValue(updateQuery);
        return { ...selectQuery, update: mocks.update };
      }
      if (table === "email_webhook_events") {
        const deleteQuery = { eq: vi.fn(async () => ({ error: null })) };
        mocks.deleteEvent.mockReturnValue(deleteQuery);
        return { insert: mocks.insert, delete: mocks.deleteEvent };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
    rpc: mocks.rpc,
  }),
}));

import { POST } from "./route";

function request() {
  return new Request("https://app.example.com/api/webhooks/resend", {
    method: "POST",
    body: "{}",
    headers: {
      "svix-id": "evt_1",
      "svix-timestamp": "1700000000",
      "svix-signature": "v1,test",
    },
  });
}

describe("POST /api/webhooks/resend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.insert.mockResolvedValue({ error: null });
    mocks.rpc.mockResolvedValue({ error: null });
  });

  it("rejects an invalid webhook signature before touching the database", async () => {
    mocks.verify.mockImplementation(() => { throw new Error("invalid"); });
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("records delivery and synchronizes the scheduled message", async () => {
    mocks.verify.mockReturnValue({
      eventId: "evt_1",
      event: {
        type: "email.delivered",
        created_at: "2026-08-10T20:00:00.000Z",
        data: { email_id: "email_1" },
      },
    });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      id: "evt_1",
      provider_message_id: "email_1",
      event_type: "email.delivered",
    }));
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ status: "delivered" }));
    expect(mocks.rpc).toHaveBeenCalledWith("record_email_delivery_event", expect.objectContaining({
      p_scheduled_message_id: "SCH-1",
      p_status: "Dostarczona",
    }));
  });

  it("acknowledges duplicate events without applying status twice", async () => {
    mocks.verify.mockReturnValue({
      eventId: "evt_1",
      event: {
        type: "email.sent",
        created_at: "2026-08-10T19:59:00.000Z",
        data: { email_id: "email_1" },
      },
    });
    mocks.insert.mockResolvedValue({ error: { code: "23505" } });
    const response = await POST(request());
    expect(await response.json()).toEqual({ ok: true, duplicate: true });
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
