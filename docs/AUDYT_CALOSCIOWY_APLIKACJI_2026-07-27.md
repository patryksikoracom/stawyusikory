# Audyt całościowy Stawy OS

**Data:** 27 lipca 2026  
**Zakres:** bieżący working tree gałęzi `agent/pr-10i-on-11-12-production`, aplikacja uruchomiona lokalnie z produkcyjnym Supabase, kod, API, migracje, dokumentacja, historia PR-ów, widoki desktop/mobile i bezpieczne interakcje w formularzach.  
**Decyzja:** **NO-GO dla przełączenia całej pracy na Stawy OS.** Aplikacja może pozostać w pilocie równoległym, ale najpierw trzeba naprawić zapis danych, zgodność kodu z bazą i bezpieczeństwo iCal.

## 1. Wniosek zarządczy

Stawy OS ma już wartościowy rdzeń: rezerwacje, kalendarz, wycena, finanse, zadania, importy, role, historię zmian i sensowne zabezpieczenia dialogów. Problemem nie jest brak funkcji. Problemem jest brak jednolitego, wiarygodnego produktu.

Najważniejsze rozpoznania:

1. **Część ekranów pokazuje funkcje, których produkcyjna baza nie potrafi zapisać.** Bieżąca gałąź zawiera PR-11a–PR-11d i fundament PR-12, ale produkcyjna funkcja `mutate_operational_record_batch` nie zna nowych typów rekordów.
2. **Interfejs potrafi pokazać lokalny sukces mimo odrzucenia zapisu.** Po błędzie użytkownik nie dostaje komunikatu przy formularzu, a zmiana znika po odświeżeniu.
3. **Dodawanie reguły cenowej ma rzeczywisty błąd inicjalizacji.** Pierwszy domek wygląda na wybrany, chociaż wewnętrzna wartość może być pusta po asynchronicznym wczytaniu danych. Walidacja pokazuje tylko ogólny komunikat.
4. **iCal istnieje, ale błąd jednego feedu może usunąć wcześniejsze blokady tego feedu.** To może chwilowo pokazać zajęty termin jako wolny.
5. **Ustawienia, Goście, Zadania i Finanse są przeładowane.** Zamiast prowadzić do najczęstszych decyzji, pokazują wiele warstw produktu naraz.
6. **„AI” nie jest jeszcze funkcją AI.** Nie ma dostawcy, modelu ani wywołania LLM. Istnieje eksport danych, wskaźnik gotowości i tekst o przyszłym modelu.
7. **Dokumenty i statusy PR-ów nie są źródłem prawdy.** GitHub, `main`, bieżąca gałąź, migracje produkcyjne i plany opisują różne stany.

## 2. Co zostało sprawdzone

- 225 plików w `src`, w tym 22 Route Handlery API;
- 90 plików testowych;
- 31 migracji Supabase;
- 17 dokumentów Markdown i 2 dokumenty DOCX;
- wszystkie główne trasy aplikacji:
  - `/dashboard`;
  - `/calendar`;
  - `/calendar/year`;
  - `/bookings`;
  - `/bookings/[id]`;
  - `/guests`;
  - `/finances`;
  - `/tasks`;
  - `/imports`;
  - `/settings`;
  - `/media`;
  - `/offline`;
- formularz nowej i edytowanej rezerwacji;
- wyszukiwarkę i alerty;
- profil gościa i rejestr zgód;
- konfigurację iCal;
- szyfrowany backup;
- reset danych demo bez wykonania resetu;
- dodawanie materiału;
- widoki desktop i telefon 390 px;
- stan GitHub PR 1–34;
- zgodność lokalnych migracji z produkcyjnym Supabase.

Nie wykonywano wysyłki SMS/e-mail, anulowania ani tworzenia prawdziwej rezerwacji, resetu danych, importu produkcyjnego ani podłączenia prawdziwego sekretnego URL iCal.

## 3. Stan techniczny

### Automatyczna weryfikacja

| Kontrola | Wynik |
|---|---:|
| Testy | 444/444 przechodzą |
| Build produkcyjny | przechodzi, 36 tras |
| TypeScript | przechodzi po zakończeniu builda |
| Lint | 1 błąd |
| Błąd lint | `src/components/ui/dialog.tsx`: synchroniczny `setState` w efekcie |

Pierwszy błąd TypeScript podczas równoległego uruchomienia z buildem wynikał ze współdzielonego katalogu `.next`; osobne uruchomienie przeszło.

Working tree zawiera pięć istniejących zmian użytkownika. Audyt ich nie nadpisuje:

- `src/app/globals.css`;
- `src/components/layout/app-shell.tsx`;
- `src/components/ui/dialog.test.tsx`;
- `src/components/ui/dialog.tsx`;
- `src/components/views/calendar-view.tsx`.

### Rozjazd gałęzi

GitHub nie ma otwartego PR-a. PR-y 1–7 i 9–34 są scalone. PR #8 został zamknięty bez scalenia i zastąpiony późniejszą paczką.

Bieżąca gałąź nie jest jednak zgodna z `main`:

- `main` ma jeden unikalny commit względem bieżącej gałęzi;
- bieżąca gałąź ma trzy unikalne commity;
- różnica obejmuje 66 plików, około 4 073 dodanych linii i 127 usuniętych;
- zawiera razem CRM, zgody, komunikację, wzrost, bramki integracji i poprawki finansowe;
- nie istnieje dla niej otwarty PR.

To oznacza, że audytowany lokalny interfejs nie jest równoważny obecnemu `main`.

### Rozjazd bazy

Produkcja ma migracje do komend managera, ale nie ma lokalnych migracji:

- `20260727123637_pr11a_guest_identity.sql`;
- `20260727124127_pr11b_consent_review_ledger.sql`;
- `20260727124816_pr11c_multilingual_communication.sql`;
- `20260727125300_pr11d_evidence_growth.sql`;
- `20260727130702_pr12_integration_go_live_gates.sql`.

Produkcyjny batch zapisuje m.in. `rates`, `costSettings`, `media`, `sourceConnections`, lecz nie obsługuje:

- `people`;
- `consentLedger`;
- `reviewRequests`;
- `communicationConfigs`;
- `adSpend`;
- `growthExperiments`;
- `investmentModels`;
- `meterReadings`.

Widoki korzystające z tych typów są już obecne na bieżącej gałęzi. Ich zapisy są odrzucane jako naruszenie kontraktu.

## 4. Potwierdzone błędy

### P0. Pozorny zapis danych

Kontrolowany test profilu gościa:

1. wpisano tymczasowy segment;
2. aplikacja zamknęła dialog i pokazała `1/195` uzupełnionych profili;
3. w bazie pozostało `0` rekordów `people`;
4. nie powstał żaden zdarzeniowy zapis `record_batch`;
5. po odświeżeniu segment zniknął, a licznik wrócił do `0/195`.

Mechanizm `batchMutate` najpierw optymistycznie aktualizuje interfejs. Po odpowiedzi innej niż 2xx zostawia lokalny obraz i ustawia tylko ogólny stan synchronizacji na błąd. Wywołujące formularze dostają funkcje zwracające `void`, więc nie mogą pokazać wyniku przy przycisku.

**Skutek:** użytkownik nie wie, które działanie zostało utrwalone. Ten błąd dotyczy nie tylko CRM, ale całej rodziny ogólnych mutacji.

### P0. iCal może zwolnić termin po błędzie feedu

Synchronizacja:

1. pobiera wszystkie połączenia organizacji;
2. buduje nową listę blokad tylko z feedów, które w danym przebiegu zostały poprawnie pobrane;
3. `apply_ical_sync` usuwa wszystkie rekordy `ICAL-%`;
4. zapisuje wyłącznie nową listę.

Jeżeli jeden feed zwróci błąd, jego stare blokady nie trafiają do nowej listy i zostają usunięte. Bezpieczne zachowanie powinno zachować ostatni poprawny stan błędnego feedu i oznaczyć go jako nieaktualny.

### P0. Formularz reguł cenowych

`PricingSettings` inicjalizuje `unitId` z `data.units[0]`. Przy pierwszym renderze dane mogą być jeszcze puste. Po późniejszym wczytaniu lista pokazuje pierwszy domek jako domyślną opcję HTML, lecz stan React nadal zawiera pusty identyfikator.

Objaw:

- domek wygląda na wybrany;
- użytkownik wypełnia daty i cenę;
- „Dodaj sezon” kończy się komunikatem „Sprawdź daty, cenę…”;
- komunikat nie wskazuje, że problemem jest niewidocznie pusty domek.

W produkcyjnej bazie nadal są cztery reguły:

- dwa domki;
- sezon wysoki 15.06–15.09 po 550 PLN;
- sezon średni 16.09–14.06 po 500 PLN.

Stwierdzenie „nie ma reguł” mogło wynikać z lokalnego optymistycznego usunięcia lub z odczytu przed gotowością danych, nie z aktualnego stanu bazy.

### P1. iCal bez wymagania URL i bez jawnej walidacji

W dialogu wymagany jest domek, ale URL nie ma atrybutu `required`. Można zapisać połączenie bez adresu i dostać status „Do podłączenia”. Pusty submit nie daje własnego komunikatu.

### P1. Alerty nie prowadzą do działania

Okno „Powiadomienia” poprawnie pokazuje trzy problemy, ale każdy jest statycznym tekstem. Nie można z niego:

- otworzyć integracji;
- przejść do listy płatności;
- zobaczyć wskazanych rezerwacji.

To nadal łamie ustalenie z POM-004: blokada ma prowadzić do jednej jawnej akcji.

### P1. Niespójna następna akcja rezerwacji

W kontrolnym szczególe rezerwacji:

- saldo wynosiło `0 zł`;
- kompletność była oznaczona jako pełna;
- „Następna akcja” nadal mówiła „Sprawdzić/uzupełnić płatność i zaliczkę”.

### P1. Tryb offline jest tylko ekranem awaryjnym

Service worker przechowuje wyłącznie `/offline`. Nie przechowuje danych ani ekranów operacyjnych. W trybie chmurowym aplikacja nie zapisuje bieżącego stanu do `localStorage`.

Tekst „Dane zapisane lokalnie nie zniknęły” sugeruje większą odporność niż faktycznie istnieje.

### P2. Drobne błędy treści i formularzy

- „1 gości” zamiast „1 gość”;
- „0 pobyty” zamiast „0 pobytów”;
- dwie opcje „Nie wiadomo” w „Sposób odkrycia”;
- kwota szczegółowa `2805,5`, a w nagłówku zaokrąglona do `2806`, bez wyjaśnienia reguły;
- przycisk „Napisz” tylko przełącza kartę wiadomości, więc nazwa sugeruje mocniejszą akcję;
- karta „AI 4/4” sugeruje gotowy model, choć modelu nie ma.

## 5. Audyt widoków

| Widok | Co działa | Najważniejszy problem | Decyzja |
|---|---|---|---|
| Dzisiaj | agenda, stan domków, alerty, następne zdarzenia | na telefonie duży hero spycha operacje poniżej pierwszego ekranu; blokady bez akcji | uprościć pierwszy ekran do „co teraz” |
| Kalendarz | oś, kanały, legenda, wybór dat, blokady, rok | dużo kontrolek i dat; na telefonie treść jest ciasna | zachować jako ekran startowy operatora, uprościć pasek |
| Rok | zestawienia i luki deterministyczne | długa strona i duża ilość metryk | pozostawić jako analizę, nie codzienną obsługę |
| Rezerwacje | filtry, historia, szczegół, nowa/edycja, płatności, wiadomości, zadania | szczegół ma dużo równorzędnych sekcji; niespójna następna akcja | rdzeń produktu, wymaga uporządkowania priorytetów |
| Nowa rezerwacja | 3 czytelne kroki, konflikt, wycena, walidacja gościa | pozwala iść dalej przy naruszeniu minimum nocy; wyjątek nie wymaga powodu | zachować, dodać jawny wyjątek i audyt |
| Goście i marketing | statystyki, profil, atrybucja, zgody | około 19 817 px wysokości, 34 tys. znaków DOM; zapis PR-11 nie działa | podzielić na listę, profil i osobną analizę |
| Finanse | okresy, cztery perspektywy, ledger, dowody, eksport | około 5 387 px; zbyt wiele poziomów księgowych i zarządczych naraz | progressive disclosure i prosty widok właściciela |
| Sprzątanie i zadania | turnover, checklisty, gotowość, usterki | około 5 659 px; powtarzalne karty i akcje, historia miesza się z pracą bieżącą | pokazywać dziś/7 dni, resztę zwinąć |
| Integracje | iCal, linki eksportowe, backup, CSV, bramki go-live | niebezpieczna wymiana blokad przy błędzie; PR-12 bez migracji | P0 przed prawdziwym feedem |
| Ustawienia | dane obiektu, role, ceny, koszty, komunikacja, automatyzacje | około 6 460 px, 36 pól, 10 głównych sekcji | rozbić na osobne moduły |
| Media i zgody | reguła zgody per kanał, dialog dodania | ukryte w „Więcej”; brak pliku/URL, wybór spośród prawie 200 rezerwacji | nie jest jeszcze biblioteką mediów; scalić z profilem lub dokończyć |
| Offline | czytelny komunikat | brak faktycznej pracy offline | poprawić obietnicę albo zbudować read-only cache |

### Ustawienia — rekomendowana architektura informacji

Zamiast jednej strony:

1. **Obiekt:** nazwa, godziny, domki.
2. **Ceny:** ceny bazowe, sezony, minimum nocy.
3. **Koszty i prowizje:** tylko konfiguracja modelu.
4. **Integracje:** iCal, OTA, import, backup.
5. **Komunikacja:** nadawca, konto, dojazd, szablony.
6. **Zespół i bezpieczeństwo:** role, zaproszenia, SOP.
7. **Funkcje zaawansowane:** automatyzacje, eksperymenty, dane dla przyszłego AI.

Każda sekcja powinna mieć:

- własny stan `zapisywanie / zapisano / błąd`;
- wyłączenie przycisku podczas zapisu;
- zwracany wynik komendy;
- rollback lokalnego obrazu po jednoznacznym odrzuceniu;
- wskazanie konkretnego pola przy walidacji.

## 6. API, iCal i integracje

### Co już jest

- prywatny eksport `.ics` per domek;
- import feedu iCal;
- ochrona URL przed HTTP, localhostem, prywatnymi IP i podstawowym SSRF;
- limit 2 MB i timeout 15 s;
- autoryzacja użytkownika lub `CRON_SECRET`;
- import Mobile Calendar CSV;
- wzbogacenie finansami Airbnb i Booking;
- eksport zaszyfrowanego backupu;
- szkielety bramek OTA, webhooków i wysyłki.

### Czego iCal nie robi

- nie pobiera ceny;
- nie pobiera płatności;
- nie pobiera kontaktu gościa;
- nie gwarantuje natychmiastowej synchronizacji;
- nie zastępuje pełnego API lub channel managera.

### Warunki przed wklejeniem prawdziwych linków

1. Zachować ostatnie poprawne blokady feedu przy błędzie.
2. Zapisywać bloki osobno per `connection.id`, bez kasowania zdrowych danych.
3. Dodać dry-run i podgląd: ile dodanych, zmienionych, usuniętych i konfliktowych terminów.
4. Wymagać HTTPS URL i domku już w formularzu.
5. Dodać przycisk „Testuj połączenie” przed „Zapisz”.
6. Pokazać czas ostatniego sukcesu, błąd, wiek danych i status „stare dane”.
7. Zweryfikować dwa kolejne przebiegi jako idempotentne.
8. Przetestować zmianę i anulowanie zdarzenia.
9. Przetestować awarię jednego feedu przy drugim zdrowym.
10. Dopiero potem uruchomić 7–14 dni shadow mode.

Prywatny URL iCal jest sekretem. Nie powinien trafiać do dokumentacji, commita ani zwykłej wiadomości. Najbezpieczniej wkleić go bezpośrednio w aplikacji podczas wspólnego testu.

### Pełne API OTA

Nie ma jeszcze wybranego gatewaya ani potwierdzonego kontraktu danych. Przed implementacją trzeba rozstrzygnąć Mobile-Calendar Premium vs Beds24 lub innego dostawcę oraz sprawdzić:

- rezerwację;
- zmianę;
- anulowanie;
- blokadę;
- cenę;
- prowizję;
- płatność;
- status wiadomości;
- webhook;
- limity i opóźnienia;
- RTO/RPO i rollback.

## 7. AI

Aktualny stan:

- brak zależności od OpenAI, Anthropic, Gemini lub Vercel AI SDK;
- brak endpointu generującego rekomendacje;
- brak modelu;
- brak ewaluacji jakości;
- brak logu prompt/model/wersja/koszt;
- istnieje eksport zbioru cenowego bez PII;
- istnieją deterministyczne metryki i readiness 4/4;
- treść poprawnie zakłada zatwierdzenie właściciela.

Rekomendacja:

1. Zmienić nazwę „Gotowość do sugestii AI” na „Kompletność danych do analizy cen”.
2. Nie dodawać czatu ani agenta przed wiarygodnym zapisem iCal/cen.
3. Pierwszy eksperyment zrobić offline na eksporcie, bez zapisu do aplikacji.
4. Porównać rekomendację z ręczną decyzją właściciela na historycznych lukach.
5. Dopiero po ocenie jakości dodać sugestię read-only z dowodami.
6. Zmiana ceny zawsze wymaga osobnej komendy i zatwierdzenia.

## 8. Dokumentacja i PR-y

### Stan dokumentów

| Dokument | Ocena |
|---|---|
| `README.md` | przydatny opis projektu, wymaga aktualizacji po ustaleniu prawdziwego release state |
| `ADR_001_PILOT_I_ZRODLA_PRAWDY.md` | decyzja nadal ważna: pilot równoległy |
| `AUDYT_APLIKACJI_2026-07-15.md` | wartościowe tło, nie jest bieżącym statusem |
| `CHANGELOG_2026-07-27_FINANSE_KASOWE.md` | bieżąca notatka finansowa |
| `CHECKLISTA_PRZYJAZDU_OD_DZIS.md` | 49 otwartych pól to szablon operacyjny, nie zaległości developerskie |
| `CHECKLISTA_SPRZATANIA_DOMKOW_V1.md` | 76 otwartych pól to szablon operacyjny |
| `INCYDENT_REZERWACJE_OPERATORA_2026-07-27.md` | przyczyna naprawiona przez PR #34, dokument nie ma statusu zamknięcia |
| `MASTER_PLAN_REALIZACJI_STAWY_OS.md` | nieaktualny: nadal wskazuje PR-10f jako następny i PR-11/12 jako lokalne |
| `PLAN_MVP_OPERATORA_TATY.md` | nadal dobry jako bramka pilota; ma 20 niezakończonych decyzji z tatą |
| `PLAN_RESTRUKTURYZACJI_STAWY_OS.md` | plan historyczny, powinien być oznaczony jako zastąpiony |
| `PLAN_WDROZENIA_POPRAWEK_2026-07-15.md` | 111 punktów ukończonych i 129 otwartych; miesza historię, pilot i backlog |
| `PR6B_MINIMALNY_PAKIET_DANYCH.md` | artefakt historyczny PR-6b |
| `RAPORT_Z_PRZEJSCIA_PRZEZ_APLIKACJE_2026-07-19.md` | dobre źródło potrzeb, nie status realizacji |
| `RAPORT_Z_PRZEJSCIA_TATY_MOBILE_2026-07-25.md` | ważne wymagania operatora, nadal wymaga realnego retestu |
| `REJESTR_POMYSLOW.md` | właściwe miejsce backlogu, ale POM-013 nadal wygląda na P0 mimo PR #34 |
| `SLOWNIK_KPI_V1.md` | użyteczne definicje metryk |
| `STANDARD_HOSPITALITY_V1.md` | przewodnik operacyjny; nie powinien automatycznie generować funkcji aplikacji |
| `STRATEGIA_WZROSTU_STAWY_U_SIKORY_V1.md` | materiał strategiczny, nie kolejka sprintu |
| SOP ochrony małoletnich 0.9 | wizualnie poprawny, 16 stron, nadal projekt i „nie obowiązuje” |
| wersja SOP dla dzieci 0.9 | czytelna, 3 strony, nadal projekt |

### Ochrona małoletnich

Przed aktywacją funkcji w aplikacji pozostają cztery decyzje:

1. formalna nazwa podmiotu;
2. koordynator i zastępca;
3. bezpieczny rejestr i lista osób z dostępem;
4. retencja po konsultacji prawnej/RODO.

Potrzebne są też zatwierdzenie wersji 1.0, szkolenie osób wydających klucze i publikacja obu wersji.

### Status pomysłów po audycie

Do pozostawienia jako P1:

- POM-014 — skrzynka uzgodnień Mobile Calendar ↔ OTA;
- POM-015 — dowód rozliczenia OTA;
- POM-009 — odizolowany test RLS;
- POM-010 — UI per rola;
- POM-011 — E2E tenantów i cache;
- POM-008 — mobilny kalendarz operatora;
- POM-006 — walidacja cennika na 10 terminach;
- POM-007 — prawdziwa wysyłka e-mail dopiero po bramkach dostawcy;
- POM-001 — pilotaż kosztów jednego zamkniętego miesiąca.

Do zmiany statusu:

- POM-013 — komendy managera zostały zrealizowane w PR #34; pozostaje retest konta taty, nie implementacja od zera;
- POM-005 — można odwiesić dopiero po trwałym zapisie cen i teście 10 rozmów;
- POM-012 — przenieść za testami ról, nie przed nimi.

Do pozostawienia później:

- POM-002 — liczniki;
- POM-003 — ogólny rejestr zdarzeń;
- POM-016 — administracyjna migracja z rollbackiem;
- POM-017 — Aloha Camp po zdobyciu przykładowego eksportu.

Nowych pomysłów nie należy teraz dodawać do realizacji. Najpierw trzeba naprawić fundament.

## 9. Priorytetyzowany plan pracy

### P0 — przed dalszym rozszerzaniem

#### PR-A: jedno źródło prawdy wydania

- utworzyć czystą gałąź od aktualnego `main`;
- zdecydować, które z trzech commitów bieżącej gałęzi mają wejść;
- nie scalać paczki 4 tys. linii jako jednego PR-a;
- rozdzielić kod, migracje i dane inicjalne;
- dodać manifest: commit aplikacji ↔ ostatnia wymagana migracja;
- blokować start/build przy niezgodnej wersji schematu;
- zaktualizować Master Plan, Incydent i POM-013.

#### PR-B: wiarygodny zapis formularzy

- `batchMutate` zwraca `Promise<Result>`;
- formularz czeka na wynik;
- przycisk ma stan „Zapisywanie…”;
- jednoznaczne 4xx cofa optymistyczną zmianę;
- niejednoznaczny błąd sieci pokazuje stan „wymaga odświeżenia”;
- błąd jest widoczny przy danej sekcji;
- test: zapis, 422, 409, timeout, reload;
- dodać telemetrykę każdej odrzuconej komendy.

#### PR-C: reguły cenowe

- zsynchronizować `unitId` po gotowości danych albo wymagać jawnego wyboru;
- walidować każde pole osobno;
- pokazać potwierdzony zapis;
- dodać potwierdzenie usunięcia;
- zablokować nakładające się reguły lub pokazać regułę pierwszeństwa;
- test E2E: dodaj, odśwież, wyłącz, usuń, odśwież;
- porównać 10 terminów z obowiązującym cennikiem.

#### PR-D: bezpieczny iCal

- zachowanie blokad błędnego feedu;
- commit per połączenie lub atomowe zachowanie ostatniego sukcesu;
- test URL i preview różnic;
- jawny stan „stare dane”;
- idempotencja, zmiana, anulowanie, awaria częściowa;
- dopiero potem dwa prawdziwe feedy i shadow mode.

#### Operacyjne P0

- zatwierdzić SOP 1.0 i przeszkolić personel;
- przejść kontrolną rezerwację na koncie taty;
- zachować Mobile Calendar/OTA jako źródło nadrzędne;
- nie włączać dostawy SMS/e-mail.

### P1 — uporządkowanie produktu

#### PR-E: mniej i czytelniej

- rozbić Ustawienia na sześć–siedem podstron;
- Gości podzielić na listę, profil i analizę;
- Zadania domyślnie ograniczyć do dziś/7 dni;
- Finanse uruchamiać w trybie podstawowym z rozwijanymi dowodami;
- usunąć duży hero z pierwszego ekranu mobilnego operatora;
- dodać akcje do alertów.

#### PR-F: PR-11a–PR-11d osobno

Każdy PR musi zawierać:

- jedną migrację;
- wdrożenie migracji na środowisku testowym;
- write/read smoke;
- test reloadu;
- rollback;
- zgodność z rolami;
- aktualizację statusu dokumentacji.

Kolejność:

1. osoba i deduplikacja;
2. zgody i opinie;
3. komunikacja;
4. wzrost i eksperymenty.

#### PR-G: role i separacja

- owner;
- admin;
- manager;
- cleaning;
- marketing;
- accounting;
- viewer;
- dwie organizacje;
- jedna przeglądarka przełączająca organizację;
- brak PII i finansów tam, gdzie nie są potrzebne.

### P2 — po stabilnym pilocie

- pełne API/channel manager;
- Aloha Camp finances;
- prawdziwa biblioteka mediów z plikiem/URL i procesem zgód;
- read-only cache offline;
- wysyłka wiadomości z provider statusami;
- eksperyment rekomendacji cenowej.

### P3 — nie teraz

- autonomiczny agent AI;
- automatyczna zmiana cen;
- automatyczne kampanie;
- dodatkowe dashboardy i metryki bez decyzji użytkownika;
- rozbudowane liczniki przed ręcznym pilotem.

## 10. Kryterium powrotu do GO

Status można zmienić z PILOT na GO dopiero, gdy:

1. `main`, wdrożony commit i produkcyjna baza mają zgodny manifest;
2. dodanie i usunięcie reguły cenowej przechodzi po odświeżeniu;
3. każdy formularz pokazuje potwierdzony zapis lub jawny błąd;
4. konto taty przechodzi 10 rzeczywistych scenariuszy wyceny i zapisu;
5. iCal zachowuje blokady podczas błędu jednego feedu;
6. dwa feedy przechodzą minimum 7 kolejnych czystych dni;
7. aktywne rezerwacje i blokady są uzgodnione ze źródłem nadrzędnym;
8. role i dwie organizacje przechodzą E2E;
9. backup i rollback są przećwiczone;
10. SOP 1.0 jest zatwierdzony i aktywny;
11. zero błędów lint, typecheck, build i testów;
12. dokumentacja statusowa odpowiada GitHubowi i migracjom.

## 11. Kontynuacja audytu po przerwaniu — wdrożenie, role i dane produkcyjne

Ta część domyka obszary, na których audyt zatrzymał się przed przerwaniem: faktyczne wdrożenie Vercel, telemetrię zapisów, zachowanie siedmiu ról, integralność danych, dostępność interfejsu i pełniejszy kontrakt iCal. Kontrole bazy były wyłącznie odczytowe. Nie zapisano ani nie usunięto danych produkcyjnych.

### 11.1. Nie da się jednoznacznie wskazać kodu działającego na produkcji

Stan źródeł nadal jest rozjechany:

- `main` wskazuje commit `c4f6b5b`;
- audytowana gałąź wskazuje `4b0f6a1`;
- automatyczny deployment podglądowy Vercel dla `4b0f6a1` jest gotowy;
- najnowszy deployment oznaczony jako produkcyjny ma identyfikator `dpl_7RidJuCsytgSkj7fVQsdJxAHSXC2`, ale w metadanych nie ma commita GitHub;
- build tego wdrożenia został wykonany z ręcznie przesłanego zestawu 299 plików i użył cache z wcześniejszego deploymentu;
- produkcyjna baza nadal nie ma pięciu migracji PR-11/PR-12 wymienionych w rozdziale 3.

To oznacza, że nie można audytowalnie odpowiedzieć na podstawowe pytanie: „jaki dokładnie commit wraz z jakim schematem bazy jest teraz produkcją?”. Sam fakt, że build ma 36 tras i przechodzi, nie rozwiązuje braku pochodzenia źródła.

**Decyzja:** wdrożenie ręczne bez identyfikatora commita nie powinno być promowane jako wersja operacyjna. Manifest wydania z PR-A jest bramką P0, a nie porządkiem administracyjnym.

### 11.2. Produkcja potwierdza błędy najważniejszych zapisów

Logi Vercel z ostatnich siedmiu dni zawierają:

| Status | Liczba |
|---|---:|
| 200 | 410 |
| 307 | 9 |
| 500 | 3 |
| 403 | 1 |

Trzy odpowiedzi 500 dotyczą dokładnie ścieżek krytycznych:

- `POST /api/bookings` — najnowszy deployment produkcyjny;
- `POST /api/records/batch` — poprzedni deployment produkcyjny;
- `PATCH /api/bookings/[id]` — poprzedni deployment produkcyjny.

W bazie istnieje pięć potwierdzonych zdarzeń `booking command_committed`, ale:

- nie ma żadnego potwierdzonego `record_batch command_committed`;
- nie ma konfliktu `record_batch command_conflict`;
- nie ma ani jednego przebiegu `integration_sync_runs`.

Brak zdarzenia batch przy odpowiedzi 500 oznacza, że telemetria nie pozwala obecnie wskazać użytkownikowi, co zostało odrzucone i dlaczego. Błąd tworzenia rezerwacji na najnowszym wdrożeniu wymaga osobnej diagnozy przed kolejnym testem konta operatora.

Siedem starszych błędów middleware dotyczyło nieważnego refresh tokenu. Ostatni wystąpił przed obecną implementacją czyszczenia odrzuconych ciasteczek i jej testami, dlatego traktuję je jako ślad historyczny do obserwacji, a nie otwarty P0.

### 11.3. Interfejs nie jest dopasowany do ról

Backend ma sensowną separację danych, ale główny shell nie filtruje nawigacji ani ogólnych akcji według roli. Poza `cleaning` każda rola dostaje ten sam zestaw modułów, przycisk „Nowa rezerwacja” oraz odnośnik do Ustawień.

| Rola | Co faktycznie dopuszcza backend | Co pokazuje UI | Ocena |
|---|---|---|---|
| owner | pełny odczyt i zapis | pełny interfejs | zgodne funkcjonalnie |
| admin | pełny odczyt i zapis, ograniczone zapraszanie | pełny interfejs | zasadniczo zgodne |
| manager | odczyt operacyjny bez finansów zbiorczych; dedykowane tworzenie i edycja rezerwacji | wszystkie moduły i wiele niedozwolonych zapisów | niespójne |
| cleaning | osobny panel sprzątania | osobny panel | najlepsza separacja |
| marketing | wybrane dane marketingowe bez PII i finansów; brak ogólnego zapisu | kalendarz, rezerwacje, finanse, zadania, integracje i ustawienia | poważnie niespójne |
| accounting | rezerwacje, ustawienia i finanse; brak ogólnego zapisu | wszystkie moduły i przyciski edycji | niespójne |
| viewer | ograniczony odczyt | pełna nawigacja i akcje wyglądające na aktywne | poważnie niespójne |

Produkcja ma obecnie czterech członków: jednego `owner`, dwóch `admin` i jednego `cleaning`. Nie ma kont `manager`, `marketing`, `accounting` ani `viewer`, więc nie istnieje dowód rzeczywistego E2E dla tych ról. Nie należy tworzyć kont w produkcji tylko po to, aby zamknąć test. Potrzebna jest odizolowana gałąź Supabase lub osobny projekt testowy.

**Konsekwencja produktowa:** użytkownik roli read-only może poświęcić czas na formularz, który backend słusznie odrzuci. Przy mutacjach optymistycznych może dodatkowo zobaczyć chwilowy lokalny „sukces”. PR-G musi więc obejmować zarówno RLS/API, jak i ukrywanie albo wyłączanie niedozwolonych ekranów i akcji z jasnym wyjaśnieniem.

### 11.4. Pełna macierz mutacji batch

Kod klienta i walidator API znają 25 kolekcji zapisywanych przez `batchMutate`. Produkcyjna funkcja bazy zna starszy kontrakt. Osiem typów widocznych w interfejsie jest poza produkcyjną listą:

| Typ | Widok wywołujący zapis | Stan produkcji |
|---|---|---|
| `people` | profil gościa | odrzucany |
| `consentLedger` | rejestr zgód per cel | odrzucany |
| `reviewRequests` | status prośby o opinię | odrzucany |
| `communicationConfigs` | Ustawienia → komunikacja i dojazd | odrzucany |
| `adSpend` | import kosztów reklam | odrzucany |
| `growthExperiments` | Goście i marketing → eksperyment | odrzucany |
| `investmentModels` | model payback | odrzucany |
| `meterReadings` | ręczny odczyt prądu | odrzucany |

Ponieważ jedna paczka jest atomowa, dodanie profilu gościa może połączyć obsługiwane `guests` i `consents` z nieobsługiwanym `people`. Wtedy odrzucona zostaje całość. Brak obietnicy wyniku w interfejsie sprawia, że dialog może się zamknąć przed potwierdzeniem.

Typy `rates`, `costSettings`, `units`, `sourceConnections` i pozostałe starsze rekordy są znane produkcyjnej funkcji. Nie usuwa to błędu formularza cenowego ani ogólnego braku potwierdzenia zapisu. Fakt, że w bazie nie ma dotąd żadnego potwierdzonego batch commit, oznacza, że ta ścieżka nie ma jeszcze produkcyjnego dowodu działania.

### 11.5. Integralność bieżących danych

Kontrola agregatowa 196 rezerwacji dała:

| Kontrola | Wynik |
|---|---:|
| Nieprawidłowy zakres dat | 0 |
| Brak istniejącego domku | 0 |
| Ujemna liczba osób | 0 |
| Nakładające się aktywne pobyty w jednym domku | 0 par |
| Przyszłe aktywne pobyty | 8 |
| Przyszłe aktywne pobyty bez ceny | 0 |
| Rekordy `needsReview` | 32 |
| Pobyty ponad `maxPeople` | 10 |

Cztery reguły cenowe są aktywne, mają poprawne daty i ceny oraz nie nachodzą na siebie. Baza nie potwierdza więc trwałego usunięcia cennika.

32 rekordy `needsReview` oraz 10 przekroczeń pojemności wymagają kolejki uzgodnień, nie automatycznej korekty. Część może wynikać z importu historycznego albo sposobu liczenia dzieci, dlatego aplikacja powinna pokazać konkretne rekordy jako decyzje operatora z dowodem źródłowym.

### 11.6. iCal nie jest gotowy do podania prawdziwych linków

Stan produkcyjny:

- dwa rekordy połączeń: Booking i Airbnb;
- oba bez przypisanego domku;
- oba bez URL importu;
- zero poprawnych i błędnych przebiegów synchronizacji;
- zero blokad `ICAL-%`;
- zero potwierdzonego shadow mode.

Oprócz ryzyka kasowania blokad przy częściowej awarii parser nie ma testów kontraktowych dla rzeczywistych wariantów ICS. Implementacja:

- nie rozwija `RRULE`;
- nie obsługuje `EXDATE` ani `RECURRENCE-ID`;
- nie interpretuje `STATUS:CANCELLED`;
- dla zdarzeń godzinowych obcina wartość do pierwszych ośmiu cyfr bez przeliczenia strefy czasowej;
- nie odrzuca jawnie zdarzenia, w którym koniec nie jest po początku;
- nie wykonuje preview różnic przed zapisem.

Feed OTA może być prostszy niż pełna specyfikacja iCalendar, ale dopóki nie znamy jego rzeczywistego kontraktu, nie wolno zakładać, że proste dzielenie tekstu wystarczy.

Przed testem prywatnego adresu należy dodać zestaw anonimowych fixture’ów: wydarzenie całodniowe, godzinowe z `TZID`, zmiana terminu, anulowanie, powtórzenie, usunięcie z feedu, zduplikowany `UID`, uszkodzony plik i częściową awarię dwóch feedów. Prawdziwe URL-e należy wkleić bezpośrednio w aplikacji, nigdy w czacie, repozytorium ani raporcie.

### 11.7. Dostępność i ergonomia

Automatyczna inspekcja gotowych widoków desktopowych nie wykazała:

- poziomego przepełnienia całej strony;
- zduplikowanych identyfikatorów DOM;
- przeskoków poziomów nagłówków;
- przycisków całkowicie bez nazwy dostępności.

Potwierdzone problemy:

- wyszukiwarka i filtr segmentu w Gościach nie mają jawnych etykiet;
- filtr w Zadaniach nie ma jawnej etykiety;
- widok Rezerwacji umieszcza element `<main>` wewnątrz głównego `<main>`, przez co powstają dwa główne landmarki;
- wiele kluczowych kontrolek ma około 32–40 px: edycja profilu, szybkie akcje zadań i część sterowania kalendarzem; na telefonie są zbyt małe dla operatora pracującego jedną ręką lub z powiększonym tekstem;
- interfejs nie ma linku „przejdź do treści”;
- alerty operacyjne są poprawnie nazwane, ale nadal nie mają akcji.

Przy szerokości 390 px nie wystąpiło globalne poziome przepełnienie, lecz wysokość treści przy rzeczywistym zestawie danych wynosiła orientacyjnie:

| Widok | Wysokość treści mobilnej |
|---|---:|
| Dzisiaj | 5 585 px |
| Rezerwacje | 2 408 px |
| Goście i marketing | 23 831 px |
| Finanse | 9 727 px |
| Zadania | 7 081 px |
| Integracje | 4 978 px |
| Ustawienia | 11 225 px |

To nie jest wyłącznie kwestia estetyki. Tak długie widoki zwiększają koszt znalezienia bieżącej decyzji i ryzyko edycji niewłaściwej sekcji. Wynik wzmacnia rekomendację rozdzielenia modułów i domyślnego filtrowania do bieżącej pracy.

### 11.8. Zależności

Build Vercel zgłosił dziewięć podatności wysokiej kategorii. Osobna kontrola rozdzieliła ich wpływ:

- zależności produkcyjne: `0` znanych podatności;
- pełne drzewo wraz z narzędziami developerskimi: `9 high`, związane z `eslint`, `eslint-config-next`, `minimatch` i `brace-expansion`;
- automatyczna naprawa proponuje zmiany głównych wersji, więc nie powinna być wykonywana bez osobnego PR-a i pełnej weryfikacji lint/build.

To nie jest powód do zatrzymania pracy operacyjnej, ale powinno wejść jako zadanie utrzymaniowe P1 po zamknięciu błędów zapisu.

### 11.9. Zaktualizowana kolejność wykonania

Po uzupełnieniu audytu kolejność jest następująca:

1. **P0 — manifest wydania i rollback:** jeden wskazany commit, komplet wymaganych migracji, identyfikator deploymentu, backup i droga cofnięcia.
2. **P0 — diagnoza trzech 500:** dodać bezpieczny kod przyczyny i `requestId` do logów, odtworzyć create/update booking oraz batch na środowisku testowym.
3. **P0 — wiarygodne formularze:** `Promise<Result>`, oczekiwanie na serwer, błąd przy sekcji, rollback po jednoznacznym 4xx.
4. **P0 — ceny:** naprawić `unitId`, dodać E2E add/reload/disable/delete/reload i porównać 10 terminów.
5. **P0 — iCal:** commit per feed, zachowanie ostatniego sukcesu, fixture’y parsera, preview i dopiero później dwa prywatne feedy.
6. **P1 — UI per rola:** osobna macierz tras i akcji, test siedmiu ról i dwóch organizacji na izolowanym środowisku.
7. **P1 — kolejka jakości danych:** 32 `needsReview`, 10 przekroczeń pojemności oraz uzgodnienia OTA jako jawne decyzje z dowodem.
8. **P1 — uproszczenie widoków i dostępność:** podział Gości/Ustawień/Finansów/Zadań, etykiety, landmarki i większe cele dotykowe.
9. **P1 — aktualizacja zależności developerskich:** osobny PR bez automatycznego wymuszania niezgodnych wersji.
10. **P2/P3 — dopiero potem:** wysyłka dostawców, pełne API OTA i eksperyment AI read-only.

Decyzja końcowa pozostaje bez zmian: **PILOT / PARALLEL RUN, NO-GO dla pełnego przełączenia**.
