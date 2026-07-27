# Stawy OS — nadrzędny plan realizacji

**Status:** plan obowiązujący
**Data aktualizacji:** 27 lipca 2026
**Źródła:** audyt aplikacji, plan wdrożenia poprawek, plan restrukturyzacji, ADR-001, słownik KPI, raport z przejścia przez aplikację z 19 lipca oraz ustalenia z realizacji PR-1–PR-5

## Jak czytać plan

- **Etap** to większy rezultat biznesowy i bramka akceptacyjna.
- **PR** to mała paczka zmian wdrażana, testowana i sprawdzana osobno.
- Jeden Etap może zawierać kilka PR-ów.
- Nie wybieramy między „PR-2” i „Etapem 1”: **PR-2 jest kolejną paczką wewnątrz Etapu 1**.

Każdy PR przechodzi tę samą pętlę:

1. potwierdzenie zakresu na podstawie audytu i planu,
2. implementacja wyłącznie tej paczki,
3. testy jednostkowe/integracyjne, lint, TypeScript i build,
4. test właściwego przepływu w przeglądarce,
5. poprawki i ponowienie testów,
6. ręczna akceptacja właściciela,
7. dopiero potem następny PR.

Commit, push i deployment są osobnymi decyzjami. Samo ukończenie lokalnej paczki ich nie uruchamia.

## Aktualny stan

| Element | Status | Znaczenie |
|---|---|---|
| Audyt ogólny | ukończony | stan wejściowy i lista ryzyk są zapisane |
| Etap 0 | zaakceptowany do kontynuacji 17.07.2026 | wybrana ścieżka A, źródła prawdy, słownik KPI i blokada komunikacji |
| PR-1 / Etap 1.1 | ukończony i zaakceptowany do kontynuacji | loading gate, brak demo flash także dla częściowego payloadu chmurowego, bezpieczne Ustawienia |
| PR-2 / Etap 1.2a | zaakceptowany 17.07.2026 | prawdziwa tożsamość, alerty i copy; preview online zweryfikowane przez właściciela |
| PR-3 / Etap 1.2b | zaakceptowany 17.07.2026 | segmenty z rekordów źródłowych, uczciwe empty states i jawna bramka rekomendacji |
| PR-4 / Etap 1.3 | **zaakceptowany 17.07.2026 z wyjątkiem HIBP** | invitation-only, brak domyślnego `owner`, kontrola `disable_signup`; preview desktop/mobile zweryfikowane; właściciel jawnie zaakceptował pozostawienie HIBP do czasu planu Pro |
| Etap 1 jako całość | **warunkowo zamknięty 17.07.2026** | wszystkie zmiany możliwe na obecnym planie są wdrożone; jedyny przyjęty wyjątek to płatna ochrona HIBP |
| PR-5 / Etap 2.1 | **zaakceptowany do publikacji 19.07.2026** | wspólny silnik okresów i KPI, osobne PLN/EUR, metadane jakości; testy lokalne i preview desktop/mobile zakończone powodzeniem |
| PR-6a / Etap 2.2 | **draft PR #5 opublikowany 25.07.2026** | jedno saldo gościa i rozłączne perspektywy sprzedaży, należności, cashflow i wyniku; fixture'y finansowe przechodzą |
| PR-6b / Etap 2.3 | **draft PR #6 opublikowany 25.07.2026** | koszty faktyczne/modelowane, prowizje, alokacja i nieobcinany wynik zarządczy |
| PR-6c / Etap 2.4 | **draft PR #7 opublikowany 25.07.2026** | wspólna prezentacja Dashboard/Finanse/rezerwacja/CSV, filtry okresu, kompletność, deep-linki i dowody |
| Etap 2 jako całość | **implementacja gotowa do ręcznej akceptacji** | PR-5–PR-6c są zaimplementowane; 137 testów, lint, TypeScript, build i smoke test desktop/mobile przechodzą. Pozostaje akceptacja słownika przez właściciela/księgowość i scalenie stosu PR #5 → #6 → #7 |
| PR-7 / Etap 3.1 | **wdrożony online 25.07.2026** | brak zapisu przy samym otwarciu Dashboardu, request/user/version/time w audycie, `BroadcastChannel`, zachowanie lokalnych zmian i konflikt z porównaniem/kopią/odświeżeniem; 144 testy i smoke desktop/mobile przechodzą |
| PR-8a / Etap 3.2 | **wdrożony online 25.07.2026** | pierwsza komenda rekordowa `PATCH /api/tasks/:id`, Zod i inwarianty bazy, `record_version`, audyt transakcyjny i brak pełnego `PUT` po zmianie zadania; 152 testy i smoke desktop/mobile przechodzą |
| PR-8b / Etap 3.3 | **wdrożony online 25.07.2026** | wersjonowana komenda `PATCH /api/checklist-items/:id`, transakcyjny audyt, szybkie kolejne kliknięcia bez regresji i bezpieczne odświeżenie po sygnale z drugiej karty; 162 testy przechodzą |
| PR-8c / Etap 3.4 | **wdrożony online 25.07.2026** | `POST /api/bookings` tworzy atomowo rezerwację, kontakt, zadania, checklistę i szkice komunikacji; blokada per domek chroni przed równoległym double-bookingiem, a request ID zapewnia idempotencję |
| PR-8d / Etap 3.5 | **wdrożony online 26.07.2026** | `PATCH /api/bookings/:id` aktualizuje lub anuluje rezerwację razem z kontaktem, zadaniami i szkicami wiadomości; wersje rekordów, blokady domków, audyt oraz zero pełnego `PUT` są pokryte testami |
| PR-8e1 / Etap 3.6 | **wdrożony online 26.07.2026 — PR #20 scalony** | kosz i przywracanie rezerwacji używają jawnej operacji w atomowej komendzie agregatu; zachowują statusy zadań i wiadomości, blokują wygasłe/kolizyjne przywrócenie i nie wykonują pełnego `PUT` |
| PR-8e2 / Etap 3.7 | **wdrożony online 26.07.2026 — PR #20 scalony** | `POST /api/payments` księguje pojedynczą, walidowaną i idempotentną transakcję; konflikt identyfikatora, waluta, źródła kosztów/prowizji, wersja stanu i audyt są obsłużone bez pełnego `PUT` |
| PR-8e3 / Etap 3.8 | **wdrożony online 26.07.2026 — PR #20** | `PATCH /api/settings` zapisuje singleton `settings/organization` z wersją rekordu, walidacją Zod/Postgres, konfliktem 409 i audytem; formularz nie ogłasza sukcesu przed potwierdzeniem i nie wykonuje pełnego `PUT` |
| PR-8e4a / Etap 3.9 | **wdrożony online 26.07.2026 — PR #20** | `POST /api/calendar-blocks` i `PATCH /api/calendar-blocks/:id` tworzą oraz anulują blokady wersjonowanymi komendami; wspólna blokada domku serializuje wyścig z rezerwacją, a UI odróżnia lokalny zapis od potwierdzenia Mobile Calendar/OTA |
| PR-8 zbiorczo / Etap 3 | **wdrożony online 26.07.2026 — PR #20** | wszystkie pozostałe rodziny mutacji używają atomowej, wersjonowanej komendy batchowej; klient i API nie udostępniają już pełnego `PUT /api/state`; 289 testów, lint, TypeScript i build 33 tras przechodzą |
| Etap 3 jako całość | **zamknięty online 26.07.2026** | PR-7 i cały PR-8 działają online; migracje, uprawnienia RPC, login, chronione trasy, konsola i runtime zostały potwierdzone po wdrożeniu |
| PR-9a / Etap 4.1 | **wdrożony online 26.07.2026 — PR #22 scalony** | jawna aktywna organizacja bez `limit(1)`, siedem ról, macierz uprawnień, projekcja PII/finansów, RLS i poprawki Advisora; testy, lint, TypeScript, build, migracja i produkcyjny smoke przechodzą |
| PR-9b / Etap 4.2 | **wdrożony online 26.07.2026 — PR #23 scalony** | jawnie tenantowy turnover, przyjęcie/odrzucenie, kolejki zespołu, wersjonowana checklista 10 kroków, dowód gotowości, eskalacje, odświeżenie po 7 dniach i minimalna bramka wydania kluczy; testy, lint, TypeScript, build, migracja i produkcyjny smoke przechodzą |
| PR-9c / Etap 4.3 | **wdrożony online 26.07.2026 — draft PR #24** | wersjonowany rejestr zatwierdzonego SOP, zadanie tylko dla bieżącego/przyszłego pobytu z dziećmi, minimalny dowód wykonania i kontrolowana reakcja bez danych dziecka; 347 testów, lint, TypeScript, build 35 tras, migracja z transakcyjnym rollbackiem i produkcyjny smoke przechodzą. Funkcja jest online, ale aktywacja nadal czeka na zatwierdzony SOP |
| PR-10a / Etap 5.1 | **wdrożony online 27.07.2026 — draft PR #26** | wspólny dostępny dialog, blokada tła i pułapka/powrót fokusu, obsługa Escape, mobilne pola i cele dotykowe, brak natywnych `alert/confirm/prompt` oraz paginacja po 40 rekordów; 353 testy, lint, TypeScript, build 35 tras i powtórzony smoke na wąskim ekranie przechodzą |
| PR-10b / Etap 5.2 | **wdrożony online 27.07.2026 — draft PR #27** | chronologiczna agenda dnia, osobne rodzaje zdarzeń i kanały, stan domków, następna zmiana, blokady oraz ryzyko same-day turnoveru; 359 testów i smoke desktop/390/320 px przechodzą |
| PR-10c / Etap 5.3 | **wdrożony online 27.07.2026 — draft PR #28** | operacyjna lista i osobna historia, jawne filtry i sortowanie, mobilny szczegół z zachowaniem stanu oraz uproszczony formularz z warunkowymi polami; 367 testów i smoke desktop/390/320 px przechodzą |
| PR-10d / Etap 5.4 | **wdrożony online 27.07.2026 — draft PR #29** | kalendarz operatora startuje z 7 dniami kontekstu, pokazuje kanał i stan synchronizacji oraz tworzy wycenę przez drag, dwa dotknięcia lub Enter po kontroli konfliktu; 375 testów i smoke desktop/390/320 px przechodzą |

## Bramka wydania: MVP operatora dla taty

Potrzeby taty nie rozszerzają zakresu PR-6–PR-8. Są zapisane jako osobna bramka wydania przecinająca istniejące, małe paczki:

- POM-008 — mobilny kalendarz dostępności jako ekran startowy operatora, także z powiększonym tekstem;
- POM-006 — cennik zgodny z Mobile Calendar;
- POM-005 — szybka wycena i zapis rezerwacji podczas rozmowy;
- POM-007 — e-mail wybierany, poprawiany i wysyłany z aplikacji;
- POM-004 — stan domków, pełna nazwa bieżącego gościa i następna zmiana, ale niżej od kalendarza;
- PR-9a — właściwa rola operatora zamiast pełnego konta właściciela;
- PR-9b/PR-9c — przygotowanie przyjazdu, sprzątanie oraz wykonanie zatwierdzonej procedury małoletnich;
- PR-12 / Etap 7 — kontrolowane przełączenie źródła prawdy, status dostawcy wiadomości, shadow mode i rollback.

Do czasu spełnienia tej bramki Mobile Calendar/OTA pozostaje nadrzędnym źródłem rezerwacji i dostępności. Jeżeli subskrypcja kończy się wcześniej, należy ją przedłużyć na najkrótszy praktyczny okres zamiast przełączać system bez uzgodnienia danych.

Test taty z 25.07.2026 zmienia priorytet interfejsu operatora: kalendarz, wolne terminy i wycena są przed powitaniem, briefem „Dzisiaj”, zadaniami i statystykami. Pełny zakres, proces obecny/docelowy, kolejność zależności, reguły biznesowe, pominięte decyzje i miary pilota są źródłem prawdy w `PLAN_MVP_OPERATORA_TATY.md` oraz `RAPORT_Z_PRZEJSCIA_TATY_MOBILE_2026-07-25.md`.

## Mapa Etapów i PR-ów

| Kolejność | Etap | Paczka | Zakres | Bramka po paczce |
|---:|---|---|---|---|
| 0 | Etap 0 — zasady pilota | decyzje, bez osobnego PR | ścieżka A, źródła prawdy, KPI, wyłączona wysyłka | ADR-001 i KPI zaakceptowane |
| 1 | Etap 1 — bezpieczeństwo i zaufanie | PR-1 | loading gate, brak demo/zer, bezpieczne formularze | ukończone |
| 2 | Etap 1 — bezpieczeństwo i zaufanie | PR-2 — zaakceptowany | profil z sesji, rola, dynamiczne alerty, uczciwe copy, zaszyfrowany backup | konto testowe nie widzi `Marcin/MS`; zero stałych alertów |
| 3 | Etap 1 — bezpieczeństwo i zaufanie | PR-3 — zaakceptowany | usunięcie przykładowych insightów i uczciwe empty states | przy braku danych nie ma rekomendacji biznesowej |
| 4 | Etap 1 — bezpieczeństwo i zaufanie | **PR-4 — zaakceptowany z wyjątkiem HIBP** | invitation-only, blokada signup→owner i bramka konfiguracji Auth; HIBP po Pro | ukończone na obecnym planie; HIBP pozostaje przyjętym ryzykiem |
| 5 | Etap 2 — prawidłowe metryki | **PR-5 — zaakceptowany** | wspólny silnik okresów, aktywne rezerwacje, obłożenie, waluty | testy granic miesiąca/roku/DST i preview przeszły; właściciel zatwierdził publikację online |
| 6 | Etap 2 — finanse | **PR-6a — draft #5** | saldo gościa i cztery perspektywy: sprzedaż, należności, cashflow, wynik | fixture'y potwierdzają wpłaty, zwroty, saldo i nadpłatę |
| 7 | Etap 2 — finanse | **PR-6b — draft #6** | koszty faktyczne/modelowane, prowizje i wynik zarządczy | koszt nie zmienia salda gościa; strata i nadpłata nie są ukrywane |
| 8 | Etap 2 — finanse | **PR-6c — draft #7** | prezentacja, dowody, kompletność i eksport finansowy | szczegół rezerwacji, Dashboard, Finanse i CSV są zgodne; testy automatyczne i przeglądarkowe przechodzą |
| 9 | Etap 3 — wielosesyjność | **PR-7 — wdrożony online** | telemetryka, koordynacja kart, czytelny konflikt | produkcyjny smoke przechodzi; pełny test destrukcyjny pozostaje wyłącznie dla dedykowanego Supabase |
| 10a | Etap 3 — zapis domenowy | **PR-8a — wdrożony online** | wersjonowana aktualizacja zadania bez pełnego snapshotu | migracja online; testy regresji przechodzą |
| 10b | Etap 3 — zapis domenowy | **PR-8b — wdrożony online** | wersjonowana aktualizacja punktu checklisty bez pełnego snapshotu | migracja online; testy regresji przechodzą |
| 10c | Etap 3 — zapis domenowy | **PR-8c — wdrożony online** | atomowe utworzenie agregatu rezerwacji bez pełnego snapshotu | migracja online; pełny test równoległości pozostaje dla odizolowanego środowiska |
| 10d | Etap 3 — zapis domenowy | **PR-8d — wdrożony online** | wersjonowana aktualizacja/anulowanie rezerwacji wraz z kontaktem, zadaniami i szkicami wiadomości | migracja i bezpieczny smoke RPC online; 204 testy oraz produkcyjny smoke przechodzą |
| 10e | Etap 3 — zapis domenowy | **PR-8e1 — wdrożony online, PR #20 scalony** | kosz/przywracanie rezerwacji bez pełnego snapshotu | migracja online i produkcyjny smoke przechodzą; pełny test destrukcyjny pozostaje dla odizolowanego Supabase |
| 10f | Etap 3 — zapis domenowy | **PR-8e2 — wdrożony online, PR #20 scalony** | księgowanie płatności bez pełnego snapshotu | migracja online i produkcyjny smoke przechodzą; pełny test destrukcyjny pozostaje dla odizolowanego Supabase |
| 10g | Etap 3 — zapis domenowy | **PR-8e3 — wdrożony online, PR #20 scalony** | ustawienia organizacji bez pełnego snapshotu | osobna wersjonowana komenda, konflikt rekordu, migracja i produkcyjny smoke przechodzą |
| 10h | Etap 3 — zapis domenowy | **PR-8e4a — wdrożony online, PR #20 scalony** | tworzenie i anulowanie blokad kalendarza bez pełnego snapshotu | wersjonowane komendy, konflikt dostępności, wyścig rezerwacja↔blokada, migracja i produkcyjny smoke przechodzą |
| 10i | Etap 3 — zapis domenowy | **PR-8 zbiorczo — wdrożony online, PR #20 scalony** | wszystkie pozostałe mutacje: usterki, debrief, komunikacja, faktury, media, profile, zgody, połączenia, domki, stawki, koszty i import | jedna atomowa komenda batchowa, wersje rekordów, konflikt 409, audyt i brak pełnego `PUT /api/state` |
| 11 | Etap 4 — organizacje i role | **PR-9a — wdrożony online, PR #22 scalony** | active organization, role, RLS i izolacja PII/finansów | migracja oraz produkcyjny smoke przechodzą |
| 12 | Etap 4 — operacje zespołu | **PR-9b — wdrożony online, PR #23 scalony** | zlecenia sprzątania, przyjęcie, checklisty per domek i eskalacja | migracja oraz produkcyjny smoke przechodzą |
| 13 | Etap 4 — zgodność operacyjna | **PR-9c — wdrożony online, PR #24 scalony** | procedura małoletnich wynikająca z zatwierdzonego SOP i minimalizacja danych | 347 testów, migracja i produkcyjny smoke przechodzą; aktywacja czeka na zatwierdzony SOP |
| 14 | Etap 5 — fundament UX | **PR-10a — wdrożony online, draft PR #26** | wspólne dialogi, klawiatura, mobile, paginacja i wydajność | 353 testy i przypadek 1000 rekordów przechodzą; smoke klawiatury i wąskiego ekranu przechodzi; pozostaje test 200% na rzeczywistym telefonie taty |
| 15 | Etap 5 — Dzisiaj | **PR-10b — wdrożony online, draft PR #27** | chronologiczna agenda, stan domków i same-day turnover | 359 testów oraz smoke desktop/390/320 px przechodzą; akcja wiadomości otwiera właściwą kartę rezerwacji |
| 16 | Etap 5 — rezerwacje | **PR-10c — wdrożony online, draft PR #28** | prosty formularz, jawne filtry/sortowanie, lista i szczegół | 367 testów przechodzi; powrót zachowuje filtry i scroll, a kanał zawarcia nie miesza się ze źródłem odkrycia |
| 17 | Etap 5 — kalendarz | **PR-10d — wdrożony online, draft PR #29** | kontekst 7 dni wstecz, kanały na paskach, drag/touch/klawiatura | 375 testów przechodzi; szybkie utworzenie pobytu zachowuje domek i daty, a konflikt zatrzymuje formularz |
| 18 | Etap 5 — przegląd roku | PR-10e | roczny widok sprzedaży/obłożenia i deterministyczne wykrywanie luk | luki mają daty, domek, próg i dowody; brak automatycznej kampanii |
| 19 | Etap 6 — CRM | PR-11a | osoba niezależna od pobytu, deduplikacja i atrybucja | powracający gość ma jedną tożsamość i wiele pobytów |
| 20 | Etap 6 — relacja i zgody | PR-11b | debrief, status opinii i consent ledger per cel/kanał | wycofanie właściwej zgody natychmiast blokuje daną wysyłkę/użycie |
| 21 | Etap 6 — komunikacja | PR-11c | szkice PL/DE/EN, dojazd, reguły kanałowe i historia statusów | poprawny język i kanał; wysyłka nadal zablokowana do bramki |
| 22 | Etap 6 — wzrost | PR-11d | import reklam CSV, eksperymenty ofertowe, payback i mierzalne rekomendacje | insight pokazuje próbę, koszt, źródła i nie wykonuje akcji samodzielnie |
| 23 | Etap 7 — integracje i go-live | seria PR-12/spike/go-live | gateway OTA, dostawcy SMS/e-mail, shadow mode i rollback | minimum 7 dni bez niewyjaśnionych różnic i potwierdzone dostarczenie wiadomości |

Każda paczka z sufiksem jest osobnym PR-em i ma własną bramkę. Nie łączymy kilku pozycji tylko dlatego, że należą do tego samego Etapu.

## Ostatnia zamknięta paczka: PR-5 — zaakceptowana do publikacji online

### Zakres

- wprowadzić jedną, odporną na DST definicję okresu `[od, do)` i przecięcia pobytu z okresem,
- ujednolicić predykat aktywnej rezerwacji dla KPI,
- liczyć sprzedane i dostępne noce oraz obłożenie komercyjne bez maskowania wartości powyżej 100%,
- pomniejszać dostępność wyłącznie o nieanulowane bloki `Serwis` i `Remont`, bez podwójnego odjęcia nakładających się bloków,
- liczyć wartość noclegów, ADR i RevPAR osobno dla PLN i EUR,
- pokazywać okres, kompletność i źródło obliczeń na Dashboardzie i w Finansach,
- pokryć testami granice miesiąca, roku, DST, 29 lutego i błędne rekordy.

### Poza zakresem PR-5

- sprzedaż, należności, cashflow i wynik zarządczy — PR-6a,
- docelowy interfejs dowodów finansowych — PR-6c; filtry listy operacyjnej — PR-10c,
- consent ledger — PR-11b; mierzalne rekomendacje wzrostu — PR-11d,
- pełna macierz ról domenowych i multi-tenant — PR-9a,
- płatne podniesienie Supabase do Pro — osobna decyzja właściciela.

### Akceptacja PR-5

1. Dashboard i Finanse używają tej samej funkcji do liczenia okresów, aktywnych rezerwacji i obłożenia.
2. Pobyt przecinający miesiąc lub rok wnosi wyłącznie noce należące do wybranego okresu.
3. Rezerwacje nowe, anulowane, usunięte, z błędnymi datami lub bez znanego domku nie zasilają KPI.
4. PLN i EUR są prezentowane oddzielnie i nigdy nie są sumowane bez kursu.
5. Brak danych nie jest prezentowany jako zero, a niekompletne dane są jawnie oznaczone.
6. Każda karta KPI podaje okres, kompletność i źródło obliczenia.
7. Testy automatyczne, build i test przeglądarkowy desktop/mobile przechodzą bez błędów konsoli.

**Status PR-5 (2026-07-19): zaakceptowany przez właściciela do publikacji online.** Zweryfikowano 100 testów automatycznych, lint, TypeScript, build oraz Dashboard i Finanse na desktopie i telefonie. Kolejne paczki PR-6a–PR-6c zostały wykonane i opublikowane jako drafty #5–#7 w dniu 25.07.2026.

## Zrealizowany stos finansowy: PR-6a–PR-6c

### Cel

Zbudować jedno źródło prawdy dla wartości pobytu, wpłat gościa, zwrotów, salda i nadpłaty oraz wyznaczyć rozłączne wejścia do sprzedaży, należności, cashflow i wyniku zarządczego. PR-6a nie przebudowuje jeszcze całego interfejsu Finansów ani modelu wszystkich kosztów.

### Zakres PR-6a

- zdefiniować `wpłacono od gościa = wpłaty + zaliczki − zwroty`, wyłącznie dla zaksięgowanych transakcji w walucie rezerwacji;
- nie wliczać prowizji, kosztu ani wypłaty OTA do kwoty zapłaconej przez gościa;
- liczyć `saldo = wartość rezerwacji − wpłacono od gościa` bez obcinania wyniku do zera;
- pokazywać saldo ujemne jako nadpłatę;
- rozdzielić wejścia i identyfikatory metryk dla sprzedaży, należności, cashflow i wyniku;
- obsłużyć brak ceny, różne waluty, zwrot częściowy, nadpłatę i wpis otwarcia bez udawania zera;
- użyć tej samej funkcji salda w szczególe rezerwacji, Finansach, alertach i eksporcie;
- przygotować ręcznie policzone fixture'y i testy regresji.

### Poza zakresem PR-6a

- pełny model kosztów i prowizji — PR-6b;
- docelowy układ kart, dowody i eksport — PR-6c;
- agenda Dzisiaj — PR-10b;
- lista/formularz rezerwacji — PR-10c;
- kalendarz i widok roczny — PR-10d/PR-10e;
- CRM, zgody, języki i wiadomości — PR-11a–PR-11c;
- automatyczne kampanie i zmiany ceny — pozostają zabronione.

### Akceptacja PR-6a

1. Pobyt 550 PLN z zaliczką 300 PLN pokazuje: wartość 550, wpłacono 300, pozostało 250.
2. Dopłata do 600 PLN pokazuje nadpłatę 50 PLN, nie saldo zero.
3. Prowizja 80 PLN i koszt sprzątania nie zmieniają kwoty wpłaconej przez gościa.
4. Zwrot zmniejsza wpłaty netto i odpowiednio zwiększa saldo.
5. Direct bez prowizji nie jest oznaczony jako niekompletny tylko dlatego, że nie ma prowizji OTA.
6. Brak ceny i konflikt walut zwracają jawny stan niekompletności.
7. Wszystkie miejsca pokazujące saldo korzystają z jednego silnika i przechodzą te same testy.

**Status PR-6a (2026-07-25): opublikowany jako draft PR #5.** Silnik salda i czterech perspektyw jest pokryty fixture'ami częściowej i pełnej wpłaty, zwrotu, nadpłaty, prowizji, kosztu, direct, OTA oraz PLN/EUR.

### Domknięcie PR-6b i PR-6c

- **PR-6b — draft PR #6:** wynik zarządczy rozdziela fakty od modeli, zachowuje źródła, nie dubluje powiązanych kosztów, pokazuje stratę i gotowość danych.
- **PR-6c — draft PR #7:** Dashboard i Finanse korzystają z jednego raportu; szczegół rezerwacji pokazuje wartość, zaksięgowane wpłaty i saldo; każda karta otwiera dowody, a CSV pozwala odtworzyć wynik.
- Końcowa walidacja stosu: **137/137 testów**, lint, TypeScript i build 28 tras; smoke test desktop 1440 px i mobile 390 px bez poziomego overflow.
- Następna decyzja nie jest implementacyjna: właściciel/księgowość potwierdza nazwy i ręcznie porównuje jeden zamknięty miesiąc. Dopiero potem Etap 2 można oznaczyć jako zaakceptowany.

## Wdrożony online PR-7 — bezpieczna wielosesyjność

### Zakres

- Dashboard nie tworzy ani nie aktualizuje rekordów przez samo otwarcie widoku;
- każdy zapis pełnego stanu ma `requestId`, identyfikator karty, czas klienta, aktora oraz wersję oczekiwaną i aktualną w audycie bazy;
- `BroadcastChannel` informuje pozostałe karty o zatwierdzonej wersji;
- czysta karta automatycznie pobiera nowszy stan, a karta z lokalnymi zmianami zatrzymuje zapis;
- konflikt zachowuje lokalny stan i oferuje: porównanie obszarów, kopię JSON oraz świadome wczytanie chmury;
- spóźnione żądanie porównania nie może ponownie otworzyć konfliktu po wybraniu aktualnej wersji;
- test integracyjny Supabase obejmuje dwie sesje, kontrolowany konflikt i oba zdarzenia telemetryczne.

### Walidacja

- **144/144 testy automatyczne**, lint, TypeScript i build 28 tras przechodzą;
- test przeglądarkowy Dashboardu i Kalendarza na desktopie oraz 390 px przechodzi bez błędów konsoli, error overlay i poziomego overflow;
- symulacja dwóch kart potwierdza brak PUT po zewnętrznym zapisie, zachowanie lokalnej zmiany i odporność na spóźnioną odpowiedź porównania;
- migracja działa online; pełny test destrukcyjny `npm run test:integration` nadal wolno uruchamiać wyłącznie na dedykowanym projekcie Supabase zgodnie z README.

PR-7 nie zamyka Etapu 3: nadal zabezpiecza przejściowy zapis pełnego stanu. PR-8a–PR-8d zastępują go dla zadań, checklisty oraz tworzenia, aktualizacji i anulowania rezerwacji; następne mutacje domenowe są zaplanowane jako PR-8e.

## Wdrożony online PR-8a — pierwsza komenda domenowa

### Zakres

- aktualizacja istniejącego zadania przechodzi przez `PATCH /api/tasks/:id`, a nie `PUT /api/state`;
- payload jest walidowany przez Zod, a baza niezależnie sprawdza identyfikator, typ, priorytet, status i wymagane pola;
- `record_version` blokuje wyłącznie konflikt tego samego zadania; aktualizacje różnych zadań nie porównują globalnej wersji;
- globalna wersja organizacji jest nadal zwiększana bez warunku jako bariera bezpieczeństwa dla przejściowych zapisów pełnego stanu;
- zmiana i audyt `command_committed` powstają w jednej transakcji, a konflikt zwraca aktualną wersję rekordu;
- odczyt `/api/state` przekazuje rzeczywistą wersję zadania, a klient zachowuje optymistyczną zmianę i zatrzymuje zapis po konflikcie;
- test integracyjny tworzy 100 zadań, aktualizuje je równolegle, sprawdza wersje/audyt i osobno odrzuca nieaktualny zapis tego samego zadania.

### Walidacja

- **152/152 testy automatyczne**, lint, TypeScript i build 29 tras przechodzą;
- test przeglądarkowy `/tasks` na desktopie i 390 px przechodzi bez błędów konsoli, error overlay i poziomego overflow;
- test klienta potwierdza `PATCH /api/tasks/:id` i zero `PUT /api/state` po zmianie zadania;
- próba 100 równoległych zapisów jest zaimplementowana, ale nie została uruchomiona: dostępny jest wyłącznie projekt operacyjny, bez odizolowanej gałęzi/testowego Supabase.

Migracja PR-8a działa online. Pełny `npm run test:integration` pozostaje bramką odizolowanego środowiska testowego; PR-8a sam nie zamyka Etapu 3, a kolejne pod-PR-y przejmują następne mutacje domenowe.

## Wdrożony online PR-8b — rekordowa aktualizacja checklisty

### Zakres

- zmiana pojedynczego punktu przechodzi przez `PATCH /api/checklist-items/:id`, bez pełnego `PUT /api/state`;
- Zod oraz niezależne inwarianty Postgresa walidują identyfikatory, etykietę, stan `done` i istnienie powiązanego zadania;
- `record_version` blokuje konflikt tego samego punktu, a zmiana i audyt powstają w jednej transakcji;
- serwer, nie zegar klienta, ustala `completedAt` i `updatedAt`;
- odczyt `/api/state` przekazuje rzeczywistą wersję checklisty;
- szybkie kolejne kliknięcie nie jest nadpisywane przez starszą odpowiedź serwera;
- sygnał z drugiej karty podczas oczekującej komendy jest odkładany, po czym klient pobiera uzgodniony stan;
- test integracyjny przygotowuje 100 punktów, aktualizuje je równolegle, sprawdza wersje/audyt i odrzuca nieaktualny zapis tego samego punktu.

### Walidacja

- **162/162 testy automatyczne**, lint, TypeScript i build 30 tras przechodzą;
- test klienta potwierdza `PATCH /api/checklist-items/:id` i zero `PUT /api/state` po zmianie checklisty;
- regresje obejmują dwa szybkie kliknięcia oraz zewnętrzny commit w trakcie oczekującej komendy;
- `/tasks` przechodzi read-only smoke test na desktopie i 390 px bez błędów konsoli, error overlay i poziomego overflow;
- lokalny lint bazy nie mógł wystartować bez Dockera/Postgresa, a na koncie jest wyłącznie projekt operacyjny bez odizolowanej gałęzi; migracja działa online i widnieje w historii Supabase.

Migracje PR-7–PR-8b działają online. Pełny `npm run test:integration` pozostaje zarezerwowany dla dedykowanego Supabase; PR-8b sam nie zamyka Etapu 3.

## Wdrożony online PR-8c — transakcyjne utworzenie rezerwacji

### Zakres

- nowa rezerwacja przechodzi przez `POST /api/bookings`, bez pełnego `PUT /api/state`;
- jedna funkcja Postgresa zapisuje rezerwację, kontakt/zgody, zadania workflow, checklistę sprzątania oraz szkice zaplanowanych wiadomości;
- zapis do `operational_records`, wykonawczej tabeli `scheduled_messages`, wersji stanu i audytu jest jedną transakcją;
- `pg_advisory_xact_lock` per organizacja+domek serializuje sprawdzenie dostępności i chroni przed równoległym double-bookingiem;
- serwer respektuje konflikty rezerwacji, blokady kalendarza i nachodzące godziny na granicy pobytów;
- powtórzenie tego samego `requestId` zwraca istniejący agregat bez duplikacji;
- Zod i Postgres niezależnie walidują zakres dat, relacje rekordów, limity i podstawowe enumy;
- klient wykonuje optymistyczny zapis, aktualizuje wersje rekordów z odpowiedzi i nie uruchamia pełnego `PUT`.

### Walidacja

- testy API obejmują poprawny commit, replay, brak domku, konflikt ID/terminu/blokady, zerwane relacje, limit rozmiaru, role i wadliwą odpowiedź RPC;
- test store potwierdza utworzenie 5 zadań, 4 punktów checklisty i 8 szkiców komunikacji oraz zero `PUT /api/state`;
- test integracyjny obejmuje commit całego agregatu, replay, konflikt ID, konflikt godzin granicznych, blokadę oraz dwie równoległe rezerwacje tego samego terminu;
- **174/174 testy automatyczne**, lint, TypeScript i build 31 tras przechodzą;
- read-only smoke test `/bookings` oraz formularza „Dodaj rezerwację” przechodzi na desktopie i 390 px bez error overlay, błędów konsoli i poziomego overflow;
- pełny test integracyjny nie został uruchomiony, ponieważ nie skonfigurowano dedykowanego projektu testowego, a projektu operacyjnego nie użyto do prób destrukcyjnych.

Migracje PR-7–PR-8c działają online. Pełny test tworzenia, idempotencji i wyścigu rezerwacji pozostaje przygotowany dla odizolowanego Supabase. Następny wycinek — aktualizacja/anulowanie rezerwacji — został wykonany jako PR-8d.

## Wdrożony online PR-8d — aktualizacja i anulowanie rezerwacji

### Zakres

- edycja oraz anulowanie istniejącej rezerwacji przechodzą przez `PATCH /api/bookings/:id`, bez pełnego `PUT /api/state`;
- blokada optymistyczna dotyczy rekordu rezerwacji, a kontakt, zadania i szkice wiadomości mają własne wersje sprawdzane przed pierwszym zapisem;
- zmiana domku lub terminu blokuje stary i nowy domek w stałej kolejności, ponownie sprawdza rezerwacje, godziny graniczne i blokady kalendarza;
- rezerwacja, kontakt, otwarte zadania pobytowe, rekordy wiadomości i tabela wykonawcza `scheduled_messages` są uzgadniane w jednej transakcji;
- anulowanie oznacza otwarte zadania pobytowe jako `Nie dotyczy`, ale nie zamyka wykonanej pracy ani zadania naprawczego;
- konflikt dowolnego powiązanego rekordu zatrzymuje całą komendę i zostawia audyt `command_conflict`;
- `/api/state` przekazuje rzeczywiste wersje rezerwacji, kontaktów, zadań, checklist i wiadomości, dzięki czemu klient nie zgaduje blokady;
- formularz edycji zapisuje rezerwację i kontakt jedną komendą, a szybkie kolejne mutacje są kolejkowane bez nadpisania nowszego stanu starszą odpowiedzią.

### Walidacja

- **204/204 testy automatyczne**, lint, TypeScript, kontrola konfiguracji Auth i produkcyjny build 32 tras przechodzą;
- test store wykonuje edycję i anulowanie, sprawdza kolejne wersje rezerwacji/kontaktu/zadania, anulowanie szkiców i zero `PUT /api/state`;
- testy API obejmują role, limity, relacje, zakres dat, konflikt rekordu, konflikt skutku ubocznego, konflikt dostępności, brak domku oraz bezpieczne błędy;
- test statyczny migracji pilnuje `security invoker`, pustego `search_path`, odebrania wykonania `public/anon`, blokady doradczej, audytu i tabel uzgadnianych transakcyjnie;
- test przeglądarkowy `/bookings` i formularza edycji przechodzi na desktopie oraz 390×844 bez błędów konsoli, error overlay i poziomego overflow;
- skrypt integracyjny obejmuje create → update → konflikt starej wersji → konflikt blokady → cancel oraz sprawdzenie audytu i `scheduled_messages`;
- migracja `20260726140440_update_operational_booking_commands` została sprawdzona w transakcji z rollbackiem, zastosowana online i potwierdzona bezpiecznym smoke RPC bez zapisu danych;
- podgląd i produkcja Vercel są `READY`; login na domenie docelowej, widok 390 px oraz skan konsoli i runtime przechodzą bez błędów;
- zależności produkcyjne zostały podniesione do bezpiecznych wydań Next.js 16.2.12, PostCSS 8.5.23 i Sharp 0.35.3; `npm audit --omit=dev` nie wykrywa podatności;
- pełny audyt nadal zgłasza 9 ostrzeżeń wysokiego poziomu wyłącznie w narzędziach deweloperskich ESLint/minimatch; brak bezpiecznej poprawki zgodnej z obecną konfiguracją, a lint, TypeScript, testy i build przechodzą;
- pełny destrukcyjny scenariusz integracyjny nie został uruchomiony przeciwko bazie operacyjnej; pozostaje przygotowany wyłącznie dla odizolowanego projektu testowego.

## Wdrożony online PR-8e1 — kosz i przywracanie rezerwacji

### Zakres

- przeniesienie do kosza i przywrócenie przechodzą przez `PATCH /api/bookings/:id` z jawną operacją `trash` lub `restore`, bez pełnego `PUT /api/state`;
- jedna wersjonowana komenda uzgadnia rezerwację, otwarte zadania pobytowe, szkice komunikacji i wykonawczą tabelę `scheduled_messages`;
- kosz zachowuje poprzedni status wyłącznie tych zadań, które sam zmienia na `Nie dotyczy`; przywrócenie nie otwiera ponownie zadań już wykonanych, naprawczych ani wcześniej oznaczonych jako nieobowiązujące;
- szkice komunikacji odzyskują dokładny status i fingerprint sprzed usunięcia, a historia wiadomości wysłanych lub dostarczonych pozostaje bez zmian;
- przywrócenie jest blokowane po upływie 30 dni, przy niezgodnym stanie kosza, konflikcie wersji lub konflikcie dostępności;
- funkcja opakowująca korzysta z istniejącej atomowej komendy PR-8d i dopisuje osobne zdarzenie `lifecycle_committed`, bez rozszerzania uprawnień do modyfikacji audytu;
- polityka RLS audytu jawnie dopuszcza zdarzenia `related_record_conflict` i `lifecycle_committed`, więc ścieżki konfliktu i kosza nie wycofują całej transakcji przez niedozwolony wpis audytowy.

### Walidacja

- **210/210 testów automatycznych**, lint, TypeScript, kontrola konfiguracji Auth i produkcyjny build przechodzą;
- test store wykonuje pełny cykl kosz → przywrócenie, sprawdza dokładne statusy zadań i wiadomości oraz zero `PUT /api/state`;
- testy kontraktu API i domeny obejmują dozwolone operacje, wymagane pola kosza, zakaz modyfikacji pól cyklu życia przez zwykłą edycję oraz błędny stan przywrócenia;
- test statyczny migracji pilnuje `security invoker`, pustego `search_path`, odebrania wykonania `public/anon`, delegowania do atomowej komendy PR-8d, audytu append-only i zakazu `UPDATE public.audit_events`;
- rozszerzony skrypt integracyjny obejmuje create → update → trash → restore → cancel, zachowanie statusów oraz zdarzenia audytowe;
- test przeglądarkowy potwierdza pełny cykl kosz → przywrócenie na desktopie oraz formularz usunięcia na szerokości telefonu bez błędów konsoli, error overlay i poziomego overflow;
- migracja `20260726154158_mutate_operational_booking` została zastosowana online; funkcja działa jako `security invoker`, ma pusty `search_path`, brak `EXECUTE` dla `anon` i dostęp dla `authenticated`;
- produkcja Vercel dla commitu `55cf319` jest `READY`, alias docelowy działa, a login i chronione trasy przechodzą bez błędów runtime;
- destrukcyjny test integracyjny nie został uruchomiony przeciwko bazie operacyjnej i pozostaje zarezerwowany dla odizolowanego projektu Supabase.

## Wdrożony online PR-8e2 — księgowanie płatności

### Zakres

- dodanie wpisu do ledgera przechodzi przez `POST /api/payments`, bez pełnego `PUT /api/state`;
- Zod i Postgres niezależnie walidują identyfikatory, datę, dodatnią kwotę z dokładnością do grosza, walutę PLN/EUR, status zaksięgowania i limity pól;
- koszt i prowizja wymagają źródła, domku oraz właściwej kategorii; opcjonalne powiązanie z modelem kosztowym musi istnieć w tej samej organizacji;
- rezerwacja musi istnieć, a waluta i domek transakcji muszą być zgodne z rezerwacją;
- identyfikator transakcji jest granicą idempotencji: powtórzenie identycznego payloadu zwraca istniejący rekord bez zwiększenia wersji, a inna treść pod tym samym ID daje kontrolowany konflikt;
- pojedyncza transakcja, wersja stanu organizacji i audyt `command_committed` albo `command_conflict` powstają atomowo; funkcja jest `security invoker` z wykonaniem wyłącznie dla `authenticated`;
- `/api/state` przekazuje rzeczywistą wersję rekordu płatności, a klient wykonuje optymistyczny zapis bez uruchamiania ścieżki przejściowej.

### Walidacja

- **230/230 testów automatycznych**, lint, TypeScript, kontrola konfiguracji Auth i produkcyjny build 33 tras przechodzą;
- test store księguje transakcję przez `POST /api/payments`, blokuje ponowne wysłanie tego samego ID i potwierdza zero `PUT /api/state`;
- testy API i domeny obejmują replay, konflikt ID, brak rezerwacji/modelu kosztowego, rolę viewer, limit payloadu, błędną kwotę, walutę, status oraz brak dowodu kosztu;
- test statyczny migracji pilnuje `security invoker`, pustego `search_path`, zawężonego `EXECUTE`, relacji, idempotencji, audytu i zakazu zapisu pełnego snapshotu;
- skrypt integracyjny obejmuje commit płatności, bezpieczny replay, konflikt zmienionej kwoty, konflikt waluty oraz weryfikację rekordu i audytu;
- test przeglądarkowy na rezerwacji 1350 PLN potwierdził zmianę z 300 PLN wpłaconych i 1050 PLN salda na 700 PLN wpłaconych i 650 PLN salda po transakcji 400 PLN;
- widok desktop i telefon 367 px przechodzi bez błędów konsoli, error overlay i poziomego overflow;
- migracja `20260726155815_create_operational_payment_command` została zastosowana online; funkcja działa jako `security invoker`, ma pusty `search_path`, brak `EXECUTE` dla `anon` i dostęp dla `authenticated`;
- produkcja Vercel dla commitu `55cf319` jest `READY`; niezalogowane wywołanie nowego endpointu jest poprawnie blokowane przekierowaniem do logowania, a monitoring nie zgłasza błędów runtime;
- destrukcyjny test integracyjny nie został uruchomiony przeciwko bazie operacyjnej i pozostaje zarezerwowany dla odizolowanego projektu Supabase.

## Wdrożony online PR-8e3 — wersjonowany zapis ustawień organizacji

### Zakres

- zapis formularza przechodzi przez `PATCH /api/settings`, bez pełnego `PUT /api/state`;
- singleton `settings/organization` ma własny `record_version`; wersja `0` pozwala bezpiecznie utworzyć pierwszy rekord, a nieaktualna wersja zwraca konflikt 409;
- Zod i Postgres niezależnie walidują nazwę, strefę `Europe/Warsaw`, kontakt sprzątania, godziny `HH:mm`, flagę zatwierdzania AI, rozmiar payloadu i role owner/admin;
- funkcja bazy działa jako `security invoker`, ma pusty `search_path`, wykonanie wyłącznie dla `authenticated` i zapisuje `command_committed` albo `command_conflict` w tej samej transakcji;
- `/api/state` przekazuje rzeczywistą wersję i czas aktualizacji ustawień, a klient zachowuje optymistyczną zmianę bez uruchamiania pełnego snapshotu;
- formularz pokazuje „zapisano” dopiero po potwierdzeniu serwera, blokuje ponowny klik podczas zapisu i jawnie informuje o braku potwierdzenia.

### Walidacja

- **245/245 testów automatycznych**, lint, TypeScript, kontrola konfiguracji Auth i build 31 tras przechodzą;
- testy API obejmują pierwszy zapis, commit, konflikt, role, limit payloadu, błędną strefę/godzinę/typ oraz bezpieczne mapowanie błędów;
- test store potwierdza `PATCH /api/settings`, wersję rekordu, zachowanie lokalnej zmiany po 409 i zero `PUT /api/state`;
- test statyczny migracji pilnuje `security invoker`, pustego `search_path`, zawężonego `EXECUTE`, pojedynczego rekordu, audytu i zakazu zapisu snapshotu;
- skrypt integracyjny obejmuje commit, konflikt, rekord wersji 2 i oba zdarzenia audytowe, ale pozostaje do uruchomienia wyłącznie na odizolowanym Supabase;
- smoke test `/settings` przechodzi na desktopie i przy rzeczywistej szerokości 390 px bez błędów konsoli, error overlay i poziomego overflow; walidacja pustej nazwy nie wywołuje zapisu;
- migracja `20260726163800_update_operational_settings` została zastosowana online; funkcja działa jako `security invoker`, ma pusty `search_path`, dostęp dla `authenticated` i brak `EXECUTE` dla `anon`;
- niezalogowane wywołanie endpointu jest poprawnie blokowane przekierowaniem do logowania, a baza operacyjna nie była używana do destrukcyjnej próby.

## Wdrożony online PR-8e4a — wersjonowane blokady kalendarza

### Zakres

- utworzenie przechodzi przez `POST /api/calendar-blocks`, a anulowanie przez `PATCH /api/calendar-blocks/:id`; żadna z tych akcji nie wykonuje pełnego `PUT /api/state`;
- blokada ma własny `record_version`: utworzenie oczekuje wersji `0`, zapisuje wersję `1`, a każda aktualizacja wymaga wersji bieżącej i zwiększa ją dokładnie o jeden;
- Zod i Postgres niezależnie walidują identyfikatory, domek, zakres dat, typ, status, powód, dozwolone pola i rozmiar payloadu;
- funkcja bazy działa jako `security invoker`, ma pusty `search_path`, wykonanie wyłącznie dla `authenticated` i atomowo zapisuje `command_committed` albo `command_conflict`;
- blokada doradcza używa tego samego klucza organizacja+domek co komendy rezerwacji, dzięki czemu równoległe utworzenie rezerwacji i aktywnej blokady jest serializowane; aktywna blokada sprawdza kolizje z rezerwacjami i innymi blokadami;
- `/api/state` przekazuje rzeczywistą wersję rekordu, a klient wykonuje optymistyczną zmianę i bezpiecznie przywraca aktywną blokadę po niejednoznacznym wyniku anulowania, aby nie pokazać fałszywie wolnego terminu;
- formularz czeka na potwierdzenie komendy, blokuje ponowne wysłanie, ma focus trap, Escape, przywrócenie fokusu i scroll lock; anulowanie nie używa już `window.confirm`;
- interfejs jawnie opisuje blokadę jako lokalną propozycję w Stawy OS, a nie potwierdzenie synchronizacji z Mobile Calendar/OTA.

### Walidacja

- **277/277 testów automatycznych**, lint, TypeScript i produkcyjny build 32 tras przechodzą;
- testy domeny i API obejmują utworzenie, aktualizację, replay, konflikt wersji/dostępności, brak domku/blokady, role, limit payloadu oraz bezpieczne mapowanie błędów;
- test store potwierdza `POST`/`PATCH`, wersje rekordów, blokadę równoległej komendy, zachowawcze odtwarzanie stanu po błędzie oraz zero `PUT /api/state`;
- test statyczny migracji pilnuje `security invoker`, pustego `search_path`, zawężonego `EXECUTE`, blokad doradczych, konfliktów dostępności, audytu i zakazu zapisu snapshotu;
- skrypt integracyjny obejmuje commit, replay, anulowanie, konflikt starej wersji i wyścig rezerwacja↔blokada, ale pozostaje do uruchomienia wyłącznie na odizolowanym Supabase;
- smoke test `/calendar` przechodzi na desktopie i przy rzeczywistej szerokości 390 px bez błędów konsoli, error overlay i poziomego overflow; walidacja pustego powodu nie wywołuje zapisu;
- migracja `20260726165207_mutate_operational_calendar_blocks` została zastosowana online; funkcja działa jako `security invoker`, ma pusty `search_path`, dostęp dla `authenticated` i brak `EXECUTE` dla `anon`;
- niezalogowane wywołanie endpointu jest poprawnie blokowane przekierowaniem do logowania, a formularz nie zapisał danych podczas niedestrukcyjnej próby przeglądarkowej.

## Domknięcie zbiorczego PR-8 — wszystkie pozostałe mutacje

- `POST /api/records/batch` przyjmuje wyłącznie whitelistowane typy i zwalidowane operacje `upsert/delete`;
- jedno wywołanie `mutate_operational_record_batch` blokuje rekordy w deterministycznej kolejności, sprawdza wszystkie wersje przed pierwszym zapisem i zatwierdza całą paczkę atomowo;
- request ID zapewnia replay bez ponownego zwiększenia wersji, a konflikt jednego rekordu zatrzymuje całą paczkę z wynikiem 409;
- paczka obejmuje usterki, debrief wyjazdu, wiadomości planowane, faktury, notatki, media, profile, zgody, połączenia, domki, stawki, koszty i wynik importu Mobile Calendar;
- wykonawcze tabele `scheduled_messages`, `departure_debriefs` i `marketing_touchpoints` pozostają zsynchronizowane w tej samej transakcji;
- `GET /api/state` zwraca mapę wersji wszystkich rekordów; klient wykonuje optymistyczną zmianę i serializuje komendy;
- pełny `PUT /api/state` został usunięty zarówno ze store, jak i z Route Handlera.

Walidacja zbiorcza: **289/289 testów**, lint, TypeScript, kontrola składni skryptu integracyjnego i produkcyjny build 33 tras przechodzą. Testy obejmują kontrakt batcha, role, limit payloadu, bezpieczne błędy, commit, replay, konflikt wersji, audyt, brak snapshotu i mapę wersji. Rozszerzony test integracyjny jest przygotowany, lecz nie został uruchomiony: lokalny Docker/Supabase nie działa, a baza operacyjna nie jest miejscem do destrukcyjnej próby.

Cały zbiorczy PR-8 działa online. Migracje ustawień, blokad kalendarza i komendy batchowej zostały zastosowane na produkcyjnym Supabase, a uprawnienia potwierdzono bez zapisu danych: nowe RPC są dostępne dla `authenticated`, niedostępne dla `anon`, a stare `replace_operational_state*` nie są wykonywalne przez aplikację. PR #20 został zmergowany do `main` jako commit `1ddfcd6`; produkcyjne wdrożenie Vercel `dpl_GSLrg9Nu4z49xgF5LNzwi8YDARmM` jest `READY` pod `stawyusikory.vercel.app`. Login, przekierowania chronionych tras, konsola przeglądarki i monitoring runtime przechodzą bez błędów. Zakres PR-8 jest zamknięty; nie tworzymy kolejnych podpaczek ani rund ulepszeń.

## PR-9a — aktywna organizacja, role i RLS

Implementacja lokalna usuwa wybór pierwszego członkostwa przez `limit(1)`. Aktywna organizacja pochodzi z jawnego nagłówka albo `HttpOnly` cookie, a każde API ponownie sprawdza członkostwo użytkownika. Przy jednym członkostwie wybór jest automatyczny; przy wielu aplikacja wymaga wyboru i udostępnia przełącznik organizacji, który przed przeładowaniem usuwa lokalny cache danych.

Macierz ról obejmuje `owner`, `admin`, `manager`, `cleaning`, `marketing`, `accounting` i `viewer` oraz uprawnienia `read/write/PII/finance/send/export`. Surowe rekordy JSON są dostępne tylko dla `owner/admin`. Pozostałe role otrzymują serwerową projekcję właściwą dla roli; `cleaning` nadal korzysta wyłącznie z dedykowanego panelu i service-only RPC.

Migracja PR-9a:

- rozszerza constraint ról i dodaje funkcje `private.organization_role` oraz `private.has_org_permission`;
- używa `(select auth.uid())`, nie `user_metadata`;
- rozdziela polityki per operacja, aby usunąć nakładające się polityki `SELECT/FOR ALL`;
- dodaje indeksy wszystkich brakujących kluczy obcych wskazanych przez Advisor;
- przenosi `btree_gist` poza `public`;
- dodaje bezpieczną politykę odczytu własnego `users_profiles`;
- blokuje surowy snapshot i rekordy przed rolami ograniczonymi.

Walidacja: testy, ESLint, TypeScript, produkcyjny build, migracja i smoke online przechodzą. Testy obejmują obcą organizację, nieznaną rolę, każdą komórkę macierzy, redakcję PII/finansów, brak dostępu cleaning do ogólnego stanu oraz `HttpOnly` wybór aktywnej organizacji. PR #22 jest scalony i wdrożony.

## PR-9b — zlecenie sprzątania i gotowość domku

Implementacja lokalna rozwija istniejący panel sprzątania bez rozszerzania dostępu do surowego stanu. RPC przyjmuje jawną aktywną organizację i ponownie sprawdza dokładne członkostwo `cleaning`; nie wybiera już pierwszej organizacji użytkownika.

Przepływ turnoveru obejmuje `do przyjęcia → przyjęte → w toku → gotowe` oraz odrzucenie i problem. Przyjęcie może zawierać planowaną godzinę rozpoczęcia. Odrzucenie wymaga powodu i tworzy wyliczony alert operatora. Zmiana terminu lub domku resetuje wcześniejszą akceptację, aby nowe okno wymagało ponownego potwierdzenia.

Gotowość wynika z ukończenia wszystkich punktów wersjonowanego szablonu checklisty. Domyślny szablon v1 odwzorowuje 10 kroków przyjętej roboczej instrukcji i model obsługuje wariant per domek, sezon oraz dodatki jednorazowe/handoff/usterka. Awaryjne nadpisanie owner/admin wymaga powodu i zapisuje źródło dowodu, liczbę wykonanych punktów oraz audyt.

Silnik operacyjny dodatkowo:

- dzieli zadania na `moje`, `zespołu` i `przeterminowane`, z przypisaniem do konta lub roli;
- wylicza powiadomienie z terminu, priorytetu i preferencji odbiorcy;
- wylicza stan domku bez luźnej etykiety `czysty`;
- proponuje odświeżenie wyłącznie wtedy, gdy od ostatniego potwierdzonego sprzątania/kontroli minęło ponad 7 dni;
- umieszcza w planie tygodnia tylko turnover pobytu z faktycznie zaksięgowaną zaliczką;
- zwraca osobie wydającej klucze tylko identyfikator pobytu/domku i trzy bramki: gotowość, potwierdzenie płatności oraz status procedury PR-9c, bez nazwiska, telefonu, kwoty i CRM.

Walidacja: testy, ESLint, TypeScript, produkcyjny build, migracja i smoke online przechodzą. Testy obejmują redakcję PII/finansów, jawny tenant RPC, pełną maszynę stanów, powód odrzucenia, checklistę, dowód gotowości, reset po zmianie terminu, eskalacje, kolejki, szablon domku/sezonu, plan po zaliczce, odświeżenie i minimalną bramkę wydania kluczy. PR #23 jest scalony i wdrożony.

## PR-9c — procedura ochrony małoletnich

Implementacja lokalna nie tworzy treści prawnej. Owner/admin może aktywować wyłącznie metadane zatwierdzonej wersji SOP: wersję, daty, termin przeglądu nie późniejszy niż za dwa lata, właściciela przeglądu, odwołanie do przygotowania personelu, HTTPS do wersji pełnej i skróconej, potwierdzenie publikacji/wywieszenia oraz kroki dla osoby wydającej klucze.

26.07.2026 przygotowano do konsultacji projekt 0.9 w dwóch wersjach: `SOP_OCHRONA_MALOLETNICH_STAWY_U_SIKORY_V0.9_PROJEKT.docx` i `SOP_OCHRONA_MALOLETNICH_DLA_DZIECI_V0.9_PROJEKT.docx`. Dokumenty przeszły kontrolę źródeł, audyt dostępności i kontrolę wizualną, ale pozostają wyraźnie oznaczone jako nieobowiązujący projekt; nie zamykają bramki zatwierdzenia prawnego/RODO i nie mogą jeszcze zostać aktywowane w Stawy OS.

Pobyt z dziećmi otrzymuje jawnie oznaczone zadanie `minor-protection`. Migracja uzupełnia wyłącznie bieżące i przyszłe pobyty oraz uzgadnia zadanie po zmianie liczby dzieci, terminu, anulowaniu lub koszu. Pobyt historyczny nie wraca do kolejki operacyjnej.

Dowód wykonania zawiera wyłącznie: wymaganie, wykonanie, czas, operatora, identyfikator i wersję SOP oraz wynik `Bez uwag` albo `Wymaga reakcji`. Nie istnieją pola nazwiska, daty urodzenia, PESEL-u, kopii dokumentu, skanu ani swobodnego opisu incydentu. Wynik wymagający reakcji blokuje wydanie kluczy i tworzy osobny stan `Otwarte → Przyjęte → Zamknięte`; zamknięcie wymaga odwołania do właściwego, zewnętrznego rejestru SOP.

Walidacja: **347/347 testów**, ESLint, TypeScript, kontrola diffu, kontrola konfiguracji Auth i produkcyjny build 35 tras przechodzą. Smoke w aktywnej sesji na desktopie i 390 px potwierdza brak overlay, błędów konsoli i poziomego overflow po otwarciu panelu. Test na rzeczywistych danych wykrył i usunął historyczne pobyty z bieżącej kolejki. Migracja produkcyjna została sprawdzona pełnym scenariuszem w transakcji z `ROLLBACK`: aktywacja wersji testowej, wykonanie procedury, otwarcie/przyjęcie/zamknięcie reakcji i odmowa dla użytkownika bez członkostwa. Test wykrył brak trzech typów wpisów w ograniczeniu bazy; dodano migrację naprawczą i cały scenariusz przeszedł ponownie.

Pozostałe bramki przed aktywacją SOP:

- właściciel wraz z osobą kompetentną prawnie i w ochronie danych zatwierdza rzeczywisty SOP, jego wersję pełną i skróconą, kroki, retencję i kanał dokumentowania reakcji;
- po zatwierdzeniu należy wprowadzić rzeczywiste adresy dokumentów, potwierdzenie publikacji/wywieszenia i odwołanie do przygotowania personelu;
- dopiero wtedy aktywować zatwierdzoną wersję SOP;
- nie wpisywać do aplikacji danych dziecka ani opisu zdarzenia.

## PR-10a — fundament UX gotowy lokalnie

Wszystkie pełnoekranowe okna operacyjne korzystają ze wspólnego dialogu z rolą i nazwą dostępną, blokadą przewijania tła, początkowym fokusem, pułapką klawiatury, zamknięciem przez `Escape` i oddaniem fokusu wyzwalaczowi. Natywne `alert`, `confirm` i `prompt` zostały zastąpione kontrolowanymi dialogami, w tym potwierdzeniami destrukcyjnymi oraz szyfrowanym eksportem backupu.

Lista i arkusz rezerwacji renderują po 40 pozycji na stronę. Test z 1000 rekordów potwierdza 25 stron i maksymalnie 40 wyrenderowanych pozycji, a eksport nadal obejmuje pełny przefiltrowany zbiór. Kontrolki paginacji pozostają dostępne nad dolną nawigacją mobilną.

Walidacja po dwóch poprawkach wykrytych dopiero w przeglądarce:

- usunięto wymuszoną minimalną szerokość `body`, która tworzyła poziomy overflow na bardzo wąskim ekranie;
- jawnie zapamiętano mobilny wyzwalacz „Nowa rezerwacja”, aby `Escape` oddawał mu fokus także w rzeczywistym shellu aplikacji;
- podniesiono lepką paginację nad dolne menu, które wcześniej przechwytywało kliknięcie „Dalej”.

Końcowa regresja: **353/353 testy**, 72 pliki testowe, ESLint, TypeScript i produkcyjny build 35 tras przechodzą. Smoke w aktywnej sesji potwierdza przejście na stronę 2 z 5, brak poziomego overflow, poprawne blokowanie/odblokowanie tła, zamknięcie `Escape`, powrót fokusu i brak błędów lub ostrzeżeń aplikacji w konsoli.

Jedyna ręczna bramka przed akceptacją właściciela to test na rzeczywistym telefonie taty z jego docelowym ustawieniem tekstu 200%. Lokalny smoke na efektywnym bardzo wąskim widoku nie zastępuje sprawdzenia sprzętu, systemowej skali fontu i sposobu użycia przez operatora.

## PR-10b — chronologiczna agenda Dzisiaj

Dashboard zaczyna się od jednego planu operacyjnego: wyjazdy, rozpoczęcia turnoveru, przyjazdy, wiadomości i pozostałe zadania są ułożone chronologicznie. Rodzaj zdarzenia, kanał rezerwacji i status są osobnymi informacjami, a kliknięcie prowadzi do właściwej czynności — w tym bezpośrednio do karty wiadomości konkretnej rezerwacji.

Każdy domek ma widoczny stan operacyjny, bieżącego gościa, następną zmianę i blokadę. Same-day turnover pokazuje jawne okno czasowe oraz ryzyko wynikające z niegotowego stanu lub blokady. Agenda odróżnia podobnie nazwane zadania przez domek, gościa i właściciela zadania.

Walidacja po poprawkach wykrytych w przeglądarce:

- bieżący gość nie pokazuje już własnego przyjazdu jako kolejnej zmiany;
- akcje wierszy składają się na ekranie 320 px bez poziomego przewijania;
- kliknięcie wiadomości otwiera `/bookings/:id?tab=messages` i właściwą kartę „Wiadomości”;
- **359/359 testów**, ESLint, TypeScript i produkcyjny build 35 tras przechodzą bez błędów aplikacji w konsoli.

## PR-10c — operacyjne rezerwacje i prosty formularz

Lista domyślnie pokazuje wyłącznie pobyty trwające i nadchodzące, posortowane od najbliższego przyjazdu. Historia jest osobnym zakresem. Operator ma jawnie podpisane filtry: okres przyjazdu, domek, etap obsługi, kanał rezerwacji, saldo gościa, jakość danych i pochodzenie importu oraz trzy sortowania opisujące faktyczne pole.

Desktop zachowuje układ master–detail. Na telefonie lista i szczegół są osobnymi ekranami, a przycisk powrotu zachowuje filtry, sortowanie oraz pozycję przewinięcia w sesji. Karty podsumowania liczą wyłącznie operacyjne pobyty, więc wartość całej historii nie konkuruje z bieżącą pracą.

Formularz:

- oddziela kanał zawarcia rezerwacji, kontakt i sposób odkrycia obiektu;
- pokazuje numer i prowizję tylko dla OTA, a dzieci dopiero po jawnym dodaniu;
- ukrywa standardowe godziny 16:00/11:00 i pokazuje je tylko jako jawny wyjątek;
- pokazuje rozbicie cennika, różnicę/rabat oraz domyślny zadatek 33% z możliwością nadpisania;
- trzyma opcjonalne dane faktury/adresu w zwiniętej sekcji;
- nie wdraża niezatwierdzonej reguły zwierząt ani ceny 3,5 doby;
- nie tworzy automatycznego zadania Content — pozostaje ono ręczną okazją.

Walidacja: **367/367 testów**, 76 plików testowych, ESLint, TypeScript i produkcyjny build 35 tras przechodzą. Smoke desktop/390/320 px potwierdza historię osobno, filtr Booking, mobilny szczegół, zachowanie filtra po powrocie, brak poziomego overflow i brak błędów lub ostrzeżeń aplikacji w konsoli.

## PR-10d — kalendarz dostępności i szybka wycena

Kalendarz jest ekranem startowym operatora i otwiera 42 dni: 7 dni kontekstu wstecz, dzisiaj oraz 34 dni do przodu. „Dzisiaj” znajduje się około 28% szerokości widoku, miesiące mają osobne nagłówki, a jedna przewijana oś steruje datami i oboma domkami.

Każdy pasek pobytu pokazuje kanał tekstowo i w dostępnej nazwie, a stan synchronizacji Booking/Airbnb jest jawny. Ten sam sprawdzany draft rezerwacji powstaje po:

- przeciągnięciu zakresu na desktopie;
- dwóch kliknięciach lub dotknięciach;
- wskazaniu obu dat klawiszem Enter.

Konflikt z rezerwacją lub blokadą jest wykrywany przed otwarciem formularza. Mobilna agenda zaczyna się od dzisiaj, obejmuje 7 dni i pozwala wybrać zakres bez utraty domku ani dat.

Walidacja po pętli poprawek: **375/375 testów**, 77 plików testowych, ESLint, TypeScript i produkcyjny build 35 tras przechodzą. Smoke desktop/390/320 px potwierdza wybór dotykiem, Enterem i drag, poprawne wartości wyceny, zatrzymanie konfliktu przed formularzem, brak poziomego overflow i brak błędów aplikacji w konsoli.

## Pełne przypisanie ustaleń z walkthrough

Ta tabela jest kontrolą kompletności. Szczegółowe uzasadnienie i scenariusze znajdują się w `RAPORT_Z_PRZEJSCIA_PRZEZ_APLIKACJE_2026-07-19.md`.

| Ustalenie | Paczka docelowa | Warunek zachowania zakresu |
|---|---|---|
| wartość / wpłacono / pozostało lub nadpłata | PR-6a i PR-6c | obliczenia w 6a, hierarchia wizualna w 6c |
| prowizja, koszt i wypłata OTA poza saldem gościa | PR-6a/PR-6b | zero wspólnego sumowania z wpłatą gościa |
| koszty faktyczne i modelowane | PR-6b | jawne źródło i zakaz dublowania |
| prowizja per platforma, domek i okres | PR-6b | fakt z importu ma pierwszeństwo przed modelem |
| strata i nadpłata nieobcinane do zera | PR-6a/PR-6b | przypadki ujemne w fixture'ach |
| rentowność i spłata domku | PR-11d po PR-6b | kapitał, nakłady, wypłaty właściciela i koszty wspólne są jawne |
| automatyczne zadanie Content nie dla każdego pobytu | PR-10c | content staje się ręczną okazją, opinia pozostaje osobnym procesem |
| chronologiczne przyjazdy, wyjazdy, sprzątanie i wiadomości | PR-10b | rodzaj zdarzenia i kanał są osobnymi znacznikami |
| stan domku wyliczany z pobytu i turnoveru | PR-9b/PR-10b | `gotowy` wynika z checklisty lub audytowanego nadpisania |
| sprzątająca przyjmuje/odrzuca okno | PR-9b | brak odpowiedzi ma eskalację do operatora |
| checklisty per domek, sezon i wyjątek | PR-9b | stałe punkty oddzielone od jednorazowych uwag |
| zadania ojca/Patryka: zakupy, płatności, naprawy | PR-9b | zadanie ma konto/rolę, termin, priorytet i regułę powiadomienia |
| informacja dla sprzątania po zaliczce | PR-9b | trafia do planu tygodnia; odbiorca nie widzi ceny ani pełnego PII |
| odświeżenie domku po długiej przerwie | PR-9b | próg >7 dni liczy się od ostatniej potwierdzonej kontroli/sprzątania, nie tylko od rezerwacji |
| kalendarz jako ekran startowy operatora | PR-9a/PR-10a/PR-10d | na telefonie dostępność jest przed powitaniem, KPI i briefem |
| powiększony tekst taty | PR-10a | test na rzeczywistym telefonie i przy 200%; krytyczna treść oraz akcje nie znikają |
| kalendarz z 7 dniami kontekstu wstecz | PR-10d | `Dzisiaj` ustawia dzień około 1/4–1/3 widoku |
| jedna spójna nawigacja osi | PR-10d | scroll i zakres nie rozjeżdżają się |
| kanał widoczny na pasku bez polegania na kolorze | PR-10d | tekst lub ikona plus dostępna nazwa |
| zaznaczenie zakresu drag/touch/klawiatura | PR-10d | konflikt jest widoczny przed zapisem |
| roczny przegląd popytu | PR-10e | miesiące, domki i stan sprzedaży na dziś są rozróżnione |
| wykrywanie luk 1–3/4–6/7+ nocy | PR-10e | deterministyczna reguła, zero automatycznej kampanii |
| sezonowe cele obłożenia | PR-10e | cele są konfigurowalną hipotezą per domek, nie hardcoded 95%/50% |
| domyślnie nadchodzące i trwające rezerwacje | PR-10c | historia pozostaje dostępna osobno |
| jednoznaczne filtry i sortowanie | PR-10c | nazwa opisuje faktyczne pole, np. najbliższy przyjazd |
| globalna wartość historyczna poza listą operacyjną | PR-10c/PR-6c | lista pokazuje działania, Finanse pokazują wartości z okresem |
| prosty wpis i pola warunkowe | PR-10c | minimum operacyjne nie zawiera pełnego CRM |
| standardowe godziny 16:00/11:00 | PR-10c/Ustawienia | szybki formularz ich nie pyta; wyjątek jest jawną korektą |
| zwierzęta per domek | PR-10c | Czapla bez zwierząt; Rybak 100 PLN/szt./pobyt po zatwierdzeniu polityki |
| minimum 4 doby i wyjątkowa podstawa 3,5 doby | PR-10c | nie zmieniać faktycznych dat; najpierw zatwierdzić dokładną regułę ceny |
| zaliczka 33% z wyjątkiem per rezerwacja | PR-6a/PR-10c | liczyć od ceny końcowej; np. 50% jest jawną decyzją operatora |
| kanał zawarcia oddzielony od źródła odkrycia | PR-10c/PR-11a | direct i odkrycie przez Google mogą współistnieć |
| jedna osoba, wiele pobytów | PR-11a | deduplikacja kontrolowana przez człowieka |
| fraza/prompt, źródło, metoda, kontakt i kampania osobno | PR-11a | brak wiedzy jest prawidłowym stanem |
| debrief, NPS, cytat i status opinii | PR-11b | dokładny cytat nie jest zastępowany streszczeniem AI |
| zgody e-mail/SMS/cytat/media/reklama osobno | PR-11b | wersja, źródło, timestamp i wycofanie |
| procedura ochrony małoletnich | PR-9c | najpierw zatwierdzony SOP, później minimalny zapis wykonania |
| formularz online/podpis dla małoletnich | PR-9c po konsultacji | nie zakładać, że formularz lub dowolny DocuSign spełnia wymagania; ustalić formę, dane i retencję |
| język gościa PL/DE/EN | PR-11c | język steruje szablonem, nie jest zgadywany z kraju |
| zatwierdzona trasa dojazdu per język | PR-11c | wersjonowana treść i właściciel akceptacji |
| status opinii od prośby do otrzymania | PR-11b/PR-11c | status dostawcy nie jest udawany przez UI |
| osobisty SMS i e-mail/OTA zależnie od celu | PR-11c | kanał wynika z celu, danych i polityki rezerwacji |
| sekwencja e-mail taty | PR-11c/Etap 7 | rezerwacja+zaliczka → potwierdzenie wpłaty → saldo D-2 → przyjazd; automatyzacja etapami |
| przypomnienie o powrocie przed podobnym terminem | PR-11d | trigger wynika z lead time i działa tylko przy właściwej zgodzie |
| produkcyjny delivery, retry i alert | Etap 7 | wysyłka dopiero po testach dostawcy i zgodności |
| wydatki reklamowe i okresy kampanii | PR-11d | najpierw CSV, API dopiero po stabilnym modelu |
| pakiet wędkarski poza sezonem | PR-11d | eksperyment z kosztem, kodem i kryterium decyzji |
| AI do wniosków i kampanii | PR-11d+ | tylko propozycja z dowodami; bez wysyłki, publikacji i zmiany ceny |
| odczyty prądu | PR-11d / integracja późniejsza | najpierw ręczny zapis i ocena wartości API |
| realny test ojca i sprzątającej | bramka po Etapie 5 | minimum 2 tygodnie równolegle; osobny feedback i mierzone tarcia |

## Stałe zasady do czasu Etapu 7

- Mobile-Calendar/OTA pozostaje nadrzędnym źródłem rezerwacji i dostępności.
- Stawy OS nie jest jeszcze podstawą księgową ani podatkową.
- SMS i inne dostawy wychodzące pozostają domyślnie wyłączone.
- AI nie wysyła, nie publikuje i nie zmienia cen.
- Content od gościa jest ręcznie rozpoznaną okazją, nie automatycznym obowiązkiem każdego pobytu.
- Kanał zawarcia rezerwacji i źródło odkrycia są osobnymi danymi.
- Stan `gotowy` domku wynika z wykonanego procesu albo audytowanego nadpisania, nie z luźnej etykiety.
- Brak danych nie jest zerem, a próbka poniżej progu nie tworzy insightu.
- Żaden następny PR nie może rozszerzać pełnego snapshotu jako docelowej architektury.

## Dokumenty szczegółowe

- `AUDYT_APLIKACJI_2026-07-15.md` — ustalenia i dowody,
- `PLAN_WDROZENIA_POPRAWEK_2026-07-15.md` — pełne kryteria Etapów,
- `PLAN_RESTRUKTURYZACJI_STAWY_OS.md` — architektura docelowa,
- `PLAN_MVP_OPERATORA_TATY.md` — priorytety, zależności i bramka bezpiecznego zastąpienia Mobile Calendar,
- `RAPORT_Z_PRZEJSCIA_TATY_MOBILE_2026-07-25.md` — mobilny walkthrough taty, proces obecny/docelowy, reguły biznesowe, luki i granice prawne,
- `ADR_001_PILOT_I_ZRODLA_PRAWDY.md` — decyzja i źródła prawdy,
- `SLOWNIK_KPI_V1.md` — definicje metryk,
- `RAPORT_Z_PRZEJSCIA_PRZEZ_APLIKACJE_2026-07-19.md` — wymagania produktowe, niejasności, scenariusze i pełne uzasadnienie podziału PR-6a–PR-6c, PR-9a–PR-9c, PR-10a–PR-10e i PR-11a–PR-11d.
