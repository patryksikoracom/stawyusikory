# Pakiet 5 — pierwsza kontrola uzgodnienia danych

14 września 2026. Kontrola bazy tylko do odczytu; bez poprawiania wartości źródłowych.

## Wynik

- 104 rekordy importu, 103 powiązane z rezerwacjami; zero wskazań na nieistniejącą rezerwację.
- Dla powiązanych rekordów zero wykrytych różnic waluty i kwoty brutto, gdy pola występują po obu stronach.
- Prowizja: 71 porównań, zero różnic.
- Wypłata: 71 porównań, zero różnic.
- Kwota pobrana od gościa i korekta ceny: po 4 porównania, zero różnic.
- 207 rezerwacji, zero brakujących walut, 3 brakujące kwoty brutto, 32 rekordy z `needsReview`.

Brak kwoty brutto dotyczy zamkniętych importów historycznych: `MC-1897781`, `MC-2564793`, `MC-261451`.

Niepowiązana pozycja to korekta Airbnb `OTA-AIRBNB-ADJUSTMENT-HMB3CNT5PX-2020-07-18`, oznaczona „Do sprawdzenia” i „Wymaga sprawdzenia”. Nie przypisano jej automatycznie do rezerwacji.

## Granice dowodu

Porównano rezerwacje z zapisanymi w tej samej bazie rekordami importu, po organizacji i `matchedBookingId`. Nie jest to niezależne potwierdzenie z aktualnymi wyciągami bankowymi lub portalami OTA. Kontrola nie uzasadnia wyzerowania brakujących kwot, zdjęcia wszystkich oznaczeń jakości ani zamknięcia pakietu 5.

Dalszy odbiór: oryginalne dokumenty dla trzech historycznych braków, interpretacja korekty Airbnb, próbka bieżących sald z niezależnymi potwierdzeniami wpłat i zwrotów.
