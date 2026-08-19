import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260819150720_allow_booking_status_updates_without_rechecking_availability.sql",
  ),
  "utf8",
);

describe("migracja dostępności przy aktualizacji rezerwacji", () => {
  it("nie sprawdza ponownie dostępności dla zmiany poza zakresem pobytu", () => {
    expect(migration).toContain("current_booking ->> 'unitId' is distinct from p_booking ->> 'unitId'");
    expect(migration).toContain("current_booking ->> 'checkIn' is distinct from p_booking ->> 'checkIn'");
    expect(migration).toContain("current_booking ->> 'checkOut' is distinct from p_booking ->> 'checkOut'");
    expect(migration).toContain("current_booking ->> 'arrivalTime' is distinct from p_booking ->> 'arrivalTime'");
    expect(migration).toContain("current_booking ->> 'departureTime' is distinct from p_booking ->> 'departureTime'");
  });

  it("nadal sprawdza dostępność przy ponownym aktywowaniu anulowanej rezerwacji", () => {
    expect(migration).toContain("coalesce(current_booking ->> 'workflowStatus', '') = 'Anulowana'");
    expect(migration).toContain("p_booking ->> 'workflowStatus' <> 'Anulowana'");
  });

  it("zachowuje bezpieczny kontrakt funkcji", () => {
    expect(migration).toContain("security invoker");
    expect(migration).toContain("set search_path = ''");
    expect(migration).not.toContain("security definer");
    expect(migration).toMatch(
      /revoke all on function public\.update_operational_booking[\s\S]+from public, anon;/,
    );
  });
});
