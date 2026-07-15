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

  it("parses the native Mobile Calendar export with quoted multiline notes", () => {
    const raw = '\uFEFFID;Numer rezerwacji;Grupa;Nazwa pomieszczenia;ID pokoju;Przyjazd;Wyjazd;Dorośli;Dzieci;Status płatności;Kwota zadatku;Termin zadatku;Cena za dobę;Cena za pobyt;Razem;Waluta;Nazwisko;Imię;Telefon;E-mail;Źródło rezerwacji;Informacje dodatkowe;Wyżywienie;Porcje Dorośli;Porcje Dzieci;Usługi dodatkowe;Data dodania;Data edycji;Status\r\n8395593;566;;Dom Rybaka;26905;2026-07-15;2026-07-19;1;0;Brak wpłaty;0;;575;2300;2500;PLN;Noack;Bianka;+49123;;Booking.com;"przyjazd 18:30\r\nprosi o ciszę";OV - Bez wyżywienia;0;0;Opłata za sprzątanie - 200PLN;2026-07-11;2026-07-11;Rezerwacja';
    const result = parseMobileCalendar(raw);
    expect(result.errors).toHaveLength(0);
    expect(result.summary).toMatchObject({ total: 1, active: 1, plnTotal: 2500 });
    expect(result.contacts[0]).toMatchObject({ bookingId: "MC-8395593", phone: "+49123" });
    expect(result.rows[0]).toMatchObject({
      guestLabel: "Bianka Noack",
      unitId: "domek-rybaka",
      platform: "Booking",
      bookingDate: "2026-07-11",
      grossPrice: 2500,
      pricePerNight: 575,
      pricingMode: "manual",
      paymentStatus: "Do dopłaty",
      importRef: { source: "mobile-calendar", key: "8395593" },
      needsReview: false,
    });
    expect(result.rows[0].specialRequests).toContain("prosi o ciszę");
    expect(result.rows[0].specialRequests).not.toContain("sprzątanie");
  });

  it("flags unexplained totals, capacity and missing paid deposits", () => {
    const header = "ID;Numer rezerwacji;Grupa;Nazwa pomieszczenia;ID pokoju;Przyjazd;Wyjazd;Dorośli;Dzieci;Status płatności;Kwota zadatku;Termin zadatku;Cena za dobę;Cena za pobyt;Razem;Waluta;Nazwisko;Imię;Telefon;E-mail;Źródło rezerwacji;Informacje dodatkowe;Wyżywienie;Porcje Dorośli;Porcje Dzieci;Usługi dodatkowe;Data dodania;Data edycji;Status";
    const row = "1;1;;Czapla;99;2024-01-01;2024-01-04;4;2;Wpłacony zadatek;0;;500;1500;1200;PLN;Test;Jan;;;własne;;OV;0;0;;2023-12-01;2023-12-02;Rezerwacja";
    const result = parseMobileCalendar(`${header}\n${row}`);
    expect(result.summary.needsReview).toBe(1);
    expect(result.rows[0].importWarnings).toHaveLength(3);
    expect(result.rows[0]).toMatchObject({ platform: "Bezpośrednio", historicalImport: true, openingPaidAmount: 0 });
  });
});
