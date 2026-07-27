import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260727132908_manager_booking_commands.sql",
  "utf8",
);

describe("migracja komend rezerwacji managera", () => {
  it("ogranicza zapis managera do rekordów agregatu rezerwacji", () => {
    expect(migration).toMatch(/manager inserts booking command records[\s\S]+entity_type in \([\s\S]+'bookings'[\s\S]+'consents'[\s\S]+'tasks'[\s\S]+'checklistItems'[\s\S]+'scheduledMessages'/);
    expect(migration).not.toMatch(/private\.has_org_permission\(organization_id, 'write'\)[\s\S]+manager/);
  });

  it("rozszerza wyłącznie atomowe funkcje rezerwacji o rolę manager", () => {
    expect(migration).toContain("public.create_operational_booking");
    expect(migration).toContain("public.update_operational_booking");
    expect(migration).toContain("and role in (''owner'', ''admin'', ''manager'')");
    expect(migration).not.toContain("update_operational_settings");
    expect(migration).not.toContain("create_operational_payment");
  });

  it("zachowuje audyt i stan wersjonowany dla komendy", () => {
    expect(migration).toMatch(/manager inserts booking command audit[\s\S]+actor_id = \(select auth\.uid\(\)\)/);
    expect(migration).toMatch(/manager updates booking state version/);
  });
});
