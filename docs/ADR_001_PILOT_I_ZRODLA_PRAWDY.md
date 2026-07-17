# ADR-001 — pilot, odpowiedzialność i źródła prawdy

**Status:** zaakceptowany do kontynuacji 17 lipca 2026
**Data:** 17 lipca 2026
**Zakres:** Etap 0 planu wdrożenia poprawek

## Decyzja

Przyjmujemy ścieżkę A:

> Stawy OS pozostaje kontrolowanym pilotem i operacyjnym read modelem. Nie jest jeszcze nadrzędnym źródłem rezerwacji, dostępności, cen ani rozliczeń. Zapis domenowy będzie przebudowywany inkrementalnie, a źródło prawdy zostanie przełączone dopiero po wdrożeniu gatewaya OTA, uzgodnieniu danych i sprawdzonym rollbacku.

Nie akceptujemy dalszego rozszerzania pełnego snapshotu jako docelowego kontraktu zapisu. Dozwolone są poprawki bezpieczeństwa pilota oraz małe, wersjonowane komendy domenowe zgodne z docelowym modelem.

## Odpowiedzialność decyzyjna

| Obszar | Właściciel roli | Odpowiedzialność |
|---|---|---|
| Produkt i ryzyko biznesowe | administrator/właściciel organizacji Stawy u Sikory | priorytety, zakres pilota, akceptacja go-live i źródeł prawdy |
| Technologia i wdrożenie | maintainer repozytorium oraz środowiska Vercel/Supabase | architektura, migracje, testy, monitoring i rollback |
| Rezerwacje oraz dostępność | osoba administrująca Mobile-Calendar i panelami OTA | rozstrzyganie konfliktów do czasu uruchomienia gatewaya |
| Finanse | właściciel organizacji z księgową | definicje raportowe, dowody wpłat, dokumenty i polityka walut |
| Dane gości i zgody | administrator organizacji | legalność celu, dowód zgody, korekty i wycofania |

Zmiana osoby pełniącej rolę nie zmienia decyzji. Imienne delegowanie roli należy dopisać przed zaproszeniem kolejnych członków zespołu.

## Tabela źródeł prawdy w pilocie

| Domena | Nadrzędne źródło w pilocie | Rola Stawy OS | Dozwolony zapis w Stawy OS | Rozstrzygnięcie konfliktu |
|---|---|---|---|---|
| Rezerwacje i anulacje | Mobile-Calendar; dla statusu rezerwacji OTA ostatecznym dowodem jest panel danego OTA | import, wzbogacenie operacyjne, wykrywanie różnic | notatki, zadania i rekord roboczy; nowa rezerwacja nie jest bezpiecznie potwierdzona bez potwierdzenia w źródle nadrzędnym | wygrywa rekord Mobile-Calendar/OTA; lokalna zmiana ma stan oczekujący lub konflikt |
| Blokady i dostępność | kalendarz Mobile-Calendar zsynchronizowany z OTA | wspólny podgląd, lokalne blokady robocze, ostrzeżenia | blokada lokalna jest propozycją do czasu potwierdzenia w nadrzędnym kalendarzu | termin uznaje się za zablokowany dopiero po potwierdzeniu w źródle nadrzędnym |
| Ceny i ograniczenia sprzedaży | aktywny cennik Mobile-Calendar oraz ustawienia właściwego OTA | model kosztów, scenariusze i przyszłe rekomendacje | ceny lokalne są założeniem/analityką, nie publikacją do kanału | wygrywa cena widoczna w kanale sprzedaży; różnica trafia do uzgodnienia |
| Płatności, zwroty i wypłaty | bank, operator płatności i raport wypłat OTA | rejestr uzgodnieniowy i raport zarządczy | tylko zaksięgowane transakcje z identyfikowalnym dowodem; ręczne wpisy oznaczone źródłem | wygrywa dokument/rachunek operatora; Stawy OS koryguje rekord po uzgodnieniu |
| Kontakty rezerwacyjne | rekord kanału, z którego pochodzi rezerwacja | operacyjna kopia kontaktu i korekty zweryfikowane z gościem | uzupełnienie/korekta z datą i źródłem; brak danych nie może być zgadywany | najnowsza zweryfikowana korekta wygrywa, przy zachowaniu historii i źródła |
| Zgody marketingowe i publikacyjne | rejestr zgód Stawy OS wraz z dowodem pozyskania | docelowe źródło prawdy dla celu, zakresu i wycofania | wyłącznie jawny status z zakresem, źródłem i datą; brak dowodu oznacza brak zgody | wycofanie zawsze wygrywa; `Do dopytania` i brak rekordu blokują użycie |
| Operacje, sprzątanie i usterki | Stawy OS | źródło prawdy | pełny zapis operacyjny z historią zmian | najnowsza autoryzowana zmiana domenowa; konflikt musi być jawny |
| Treści komunikacji | Stawy OS jako biblioteka szkiców; faktyczne wysłanie potwierdza dostawca kanału | przygotowanie, zatwierdzenie i audyt | w pilocie automaty wyłącznie tworzą szkice | status `wysłana` tylko po odpowiedzi dostawcy; brak odpowiedzi nie oznacza wysłania |

## Reguły zapobiegające split brain

1. Rezerwacja lub blokada utworzona tylko w Stawy OS nie może być opisana jako potwierdzona w kanałach.
2. Import nie usuwa rekordów i nie rozstrzyga różnicy po cichu.
3. Każdy rekord zewnętrzny docelowo ma parę `(provider, external_id)` oraz wersję lub znacznik czasu źródła.
4. Zmiana wysyłana do gatewaya ma klucz idempotencji i stan `oczekuje`, `potwierdzona` albo `błąd`.
5. Supabase przechowuje read model i domeny własne Stawy OS, ale sama obecność rekordu w Postgresie nie czyni go nadrzędnym wobec gatewaya.
6. Tabele dostępne przez Data API muszą pozostać objęte RLS i minimalnymi grantami zgodnie z [aktualnymi zaleceniami Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).
7. Konfliktów nie naprawia się przez wybór „ostatni zapis wygrywa” bez informacji o źródle i wersji.

## Bramka komunikacji wychodzącej

W pilocie automaty komunikacyjne mogą tworzyć i aktualizować wyłącznie szkice. Wysyłka SMS jest fail-closed:

- `STAWY_OS_SMS_ENABLED` domyślnie ma wartość `false`;
- sam `SMSAPI_TOKEN` nie otwiera kanału;
- ręczny endpoint i worker kolejki odrzucają próbę wysłania przed zapisem do kolejki;
- proces automatyzacji raportuje wiadomości wymagające działania, ale ich nie wysyła.

Kanał można otworzyć dopiero po jednoczesnym spełnieniu warunków:

1. test na numerach kontrolnych i potwierdzony nadawca,
2. zatwierdzony szablon oraz lista dozwolonych zmiennych,
3. zweryfikowany odbiorca i wymagana zgoda/cel komunikacji,
4. idempotencja, limit dzienny, retry oraz widoczny status dostawcy,
5. monitoring błędów i procedura natychmiastowego ustawienia flagi na `false`,
6. pisemna akceptacja właściciela kanału.

## Granice pilota

- Stawy OS nie jest jeszcze podstawą księgową ani podatkową.
- KPI finansowe i wzrostowe nie mogą sterować decyzją bez metadanych opisanych w `SLOWNIK_KPI_V1.md`.
- AI nie wysyła wiadomości, nie publikuje kampanii i nie zmienia cen.
- Integracja iCal pozostaje sygnałem dostępności o ograniczonej kompletności i opóźnieniu.
- Nowe funkcje muszą wskazać domenę, źródło prawdy, uprawnienie i sposób uzgodnienia.

## Bramka przyszłego przełączenia źródła prawdy

Stawy OS może przejąć zapis rezerwacji i dostępności dopiero po:

1. wyborze i przetestowaniu Mobile-Calendar Premium albo Beds24 na kopii danych,
2. wdrożeniu podpisanych webhooków, idempotentnych komend i inboxu błędów,
3. uzgodnieniu wszystkich aktywnych rezerwacji, anulacji, blokad, cen i sald,
4. minimum 7 dniach shadow mode bez niewyjaśnionych różnic,
5. pomiarze RTO/RPO oraz sprawdzonym rollbacku,
6. jawnej akceptacji właściciela organizacji.

## Konsekwencje decyzji

### Korzyści

- ograniczamy ryzyko overbookingu i błędnych rozliczeń,
- możemy poprawiać aplikację bez udawania gotowego channel managera,
- migracja odbywa się domenami i ma odwracalny przebieg.

### Koszty

- część operacji wymaga czasowo potwierdzenia w Mobile-Calendar,
- raporty mają jawnie obniżony poziom zaufania do czasu uzgodnienia,
- pełna automatyzacja zostaje odłożona do przejścia bramek bezpieczeństwa.

## Rejestr akceptacji

| Element | Status |
|---|---|
| Ścieżka A | zaakceptowana do kontynuacji pilota |
| Właściciele ról | przypisani rolami; delegowanie imienne przed rozszerzeniem zespołu |
| Tabela źródeł prawdy | zaakceptowana dla pilota |
| Bramka komunikacji | wdrożona jako domyślnie zamknięta |
| Przejście do PR-2 | odblokowane po akceptacji ADR i słownika KPI |
