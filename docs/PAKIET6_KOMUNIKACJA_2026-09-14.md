# Pakiet 6 — komunikacja, pierwsza poprawka

14 września 2026. Wyłącznie kod lokalny; nie wysłano wiadomości, nie zmieniono ustawień dostawców.

## A10 — ograniczenie ponowień e-mail

- Błąd bez `next_attempt_at` jest traktowany jako zakończony, a nie natychmiast kwalifikujący się do próby.
- Worker odrzuca przejęcie rekordu z wyczerpanym limitem, nawet gdy istnieje stara data ponowienia.
- Odroczenie po limicie dostawcy nie omija maksymalnej liczby prób.
- Test endpointu przetwarzania potwierdza brak wywołania dostawcy i brak ponownego przejęcia dla błędu trwałego i wyczerpania prób.

## Pozostały zakres

Pakiet 6 nie jest zamknięty: potrzebny świeży preflight danych/salda przed wysyłką (A09), obsługa kolejności webhooków i rzeczywisty odbiór na uzgodnionym adresie testowym. Rekordy terminalne mogą nadal występować na początku ograniczonej listy `scheduled_messages`; należy atomowo oznaczać zakończenie również w harmonogramie, żeby nie zajmowały miejsc kolejnych wiadomości. Worker SMS wymaga odrębnego sprawdzenia i izolacji kanału. Nie włączono wysyłek produkcyjnych.

Wynik pełnej pętli: **565/565 testów w 116 plikach**, TypeScript, produkcyjny build i `git diff --check` zaliczone. Odbiór przeglądarkowy i wcześniejszy problem ESLint nadal otwarte.

## Następna część — lokalnie wykonana

- Worker e-mail odczytuje pełny bieżący stan organizacji przed próbą dostawy. Nie wysyła przy błędzie odczytu, zmianie kontaktu/kwot/terminu/konfiguracji, usunięciu rezerwacji, wyłączeniu reguły ani różnicy między harmonogramem i rekordem operacyjnym.
- Fingerprint zatwierdzenia obejmuje wyrenderowane kwoty, instrukcję dojazdu, temat, język i termin. Stare zatwierdzenia wymagają ponownej oceny; jest to zamierzona zmiana.
- Ręcznie edytowana treść pozostaje zamrożona przy niezmienionych danych źródłowych. Wysłane/dostarczone wiadomości zachowują historyczną treść także po zakończeniu pobytu.
- Przejęcie starej dzierżawy e-mail porównuje również liczbę prób i poprzedni termin dzierżawy.
- Spóźniony webhook `email.sent` nie obniża już odczytanego statusu `delivered`/`error`. To poprawka kolejności zdarzeń, nie dowód atomowości całego webhooka.
- Worker SMS filtruje kanał SMS, pomija błędy terminalne i warunkowo przejmuje rekord przed wysyłką. Pierwsza bezpośrednia wysyłka wpisuje rekord jako `processing`, żeby nie konkurowała z workerem.
- SMS wymaga poprawnej odpowiedzi dostawcy z identyfikatorem wiadomości. Sam HTTP 200 z błędem nie oznacza sukcesu. Nieznany wynik/timeout nie jest automatycznie ponawiany bez uzgodnienia z dostawcą; jawny limit 429 może być ponowiony.
- Formularz szkicu/zatwierdzenia zachowuje edytowaną treść przy nieudanym zapisie.

Dokumentacja odpowiedzi SMSAPI sprawdzona przy implementacji: https://www.smsapi.pl/docs/ . Nie wykonano rzeczywistych dostaw.

Nadal otwarte: atomowa aktualizacja harmonogramu i webhooków w bazie, usuwanie terminalnych rekordów z początku kolejki, scenariusze współbieżne obejmujące zapis rezerwacji w ostatniej chwili, odbiór dostaw na zatwierdzonym adresie/numerze oraz próba na izolowanej bazie. Pakiet pozostaje częściowo zakończony; sam zielony test jednostkowy nie zamyka tych punktów.
