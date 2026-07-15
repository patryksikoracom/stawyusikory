import { describe, expect, it } from "vitest";
import { parseMobileCalendar } from "./mobile-calendar";

describe("Mobile-Calendar import", () => {
  it("previews valid rows without silently accepting broken dates", () => {
    const result=parseMobileCalendar("566\tAnna Kowalska\tDomek Rybaka\t2026-07-15\t2026-07-19\tZadatek\tBooking\t2400\n567;Błąd;Czapla;2026-08-20;2026-08-18;Brak wpłaty");
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({id:"MC-566",unitId:"domek-rybaka",paymentStatus:"Zaliczka",platform:"Booking",grossPrice:2400,needsReview:true});
    expect(result.errors).toHaveLength(1);
  });

  it("accepts anonymized historical rows with pricing fields", () => {
    const result = parseMobileCalendar("numer;gość;domek;przyjazd;wyjazd;płatność;kanał;cena;data rezerwacji;dorośli;dzieci;prowizja;wypłata;status\nH-1;-;Domek Rybaka;2024-06-10;2024-06-14;Opłacone;Booking;3200;2024-02-01;4;1;480;2720;Zakończona");
    expect(result.errors).toHaveLength(0);
    expect(result.rows[0]).toMatchObject({
      guestLabel: "Historyczna rezerwacja #H-1",
      bookingDate: "2024-02-01",
      adults: 4,
      children: 1,
      grossPrice: 3200,
      commission: 480,
      payout: 2720,
      workflowStatus: "Zamknięta",
      historicalImport: true,
    });
  });
});
