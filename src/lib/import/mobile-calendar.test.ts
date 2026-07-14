import { describe, expect, it } from "vitest";
import { parseMobileCalendar } from "./mobile-calendar";

describe("Mobile-Calendar import", () => {
  it("previews valid rows without silently accepting broken dates", () => {
    const result=parseMobileCalendar("566\tAnna Kowalska\tDomek Rybaka\t2026-07-15\t2026-07-19\tZadatek\tBooking\t2400\n567;Błąd;Czapla;2026-08-20;2026-08-18;Brak wpłaty");
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({id:"MC-566",unitId:"domek-rybaka",paymentStatus:"Zaliczka",platform:"Booking",grossPrice:2400,needsReview:true});
    expect(result.errors).toHaveLength(1);
  });
});
