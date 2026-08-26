import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260826182629_restore_manager_booking_permissions.sql",
  "utf8",
);

describe("naprawa regresji uprawnień operatora rezerwacji", () => {
  it("ponownie dopuszcza managera do aktualnej funkcji edycji rezerwacji", () => {
    expect(migration).toContain("public.update_operational_booking");
    expect(migration).toContain("and role in (''owner'', ''admin'', ''manager'')");
    expect(migration).not.toContain("private.has_org_permission(organization_id, 'write')");
  });

  it("ogranicza usuwanie do blokad używanych przez jawny override", () => {
    expect(migration).toMatch(/manager deletes booking override blocks[\s\S]+entity_type = 'blocks'/);
    expect(migration).toContain("entity_id like 'ICAL-%'");
    expect(migration).toContain("payload ->> 'blockType' = 'Bufor sprzątania'");
  });

  it("pozwala managerowi anulować blokadę z audytem, bez tworzenia ogólnego write", () => {
    expect(migration).toMatch(/manager updates booking command records[\s\S]+'blocks'/);
    expect(migration).toMatch(/manager inserts calendar block command audit[\s\S]+actor_id = \(select auth\.uid\(\)\)/);
    expect(migration).toContain("public.mutate_operational_calendar_block");
  });
});
