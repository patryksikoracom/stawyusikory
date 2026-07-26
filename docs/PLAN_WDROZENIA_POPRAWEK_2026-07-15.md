# Plan wdrożenia poprawek Stawy OS

> Bieżąca kolejność, status i mapowanie Etapów na paczki PR są utrzymywane w `MASTER_PLAN_REALIZACJI_STAWY_OS.md`. Ten dokument pozostaje szczegółową listą wymagań i kryteriów akceptacji.

> Aktualizacja 20.07.2026: włączono ustalenia z `RAPORT_Z_PRZEJSCIA_PRZEZ_APLIKACJE_2026-07-19.md`. Finansowe elementy weszły do PR-6a–PR-6c. Pozostałe wymagania zostały przypisane do PR-9a–PR-9c, PR-10a–PR-10e, PR-11a–PR-11d i Etapu 7 bez omijania wcześniejszych bramek architektonicznych.

> Aktualizacja 25.07.2026: włączono test taty na telefonie z `RAPORT_Z_PRZEJSCIA_TATY_MOBILE_2026-07-25.md`. Dla roli operatora kalendarz dostępności jest ważniejszy od Dashboardu i briefu „Dzisiaj”. Dodano powiększony tekst, wizualny wybór zakresu, reguły godzin/zwierząt/minimum pobytu, zaliczkę, sekwencję e-mail, sprzątanie po zaliczce oraz granicę prawną procedury małoletnich.

## Cel

Doprowadzić aplikację od kontrolowanego pilota do wiarygodnego systemu operacyjnego, bez rozwijania warstwy wzrostu na niepewnych danych i bez przełączania źródła prawdy przed sprawdzonym gatewayem OTA.

Szacunki zakładają jedną osobę rozwijającą produkt z pomocą narzędzi AI. Nie obejmują czasu oczekiwania na dostawców OTA, księgowość ani decyzje biznesowe.

## Zasady realizacji

1. Najpierw bezpieczeństwo zapisu i prawda w danych, potem optymalizacja wyglądu i AI.
2. Żadna liczba biznesowa bez definicji, okresu, źródła i testu.
3. Żadna rekomendacja marketingowa bez minimalnej próby i widocznej kompletności danych.
4. Zmiany domenowe wdrażać jako małe komendy/rekordy, nie kolejne rozszerzenia pełnego snapshotu.
5. Do czasu bramki go-live Mobile-Calendar/obecny system pozostaje nadrzędnym źródłem rezerwacji.
6. Kanał zawarcia rezerwacji, sposób kontaktu i źródło odkrycia są osobnymi pojęciami.
7. Automatyzacja rutyny może przygotować zadanie lub szkic, lecz nie może tworzyć zbędnego obowiązku, wysyłać kampanii ani zmieniać ceny bez właściwej bramki.
8. Każdy PR obejmuje wyłącznie przypisaną paczkę; nowych ekranów nie dokładamy do PR-6a–PR-6c tylko dlatego, że pokazują kwoty.

## Kolejność wdrożenia

### Etap 0 — decyzje i zabezpieczenie pilota (0,5–1 dnia)

**Cel:** zatrzymać dalsze rozchodzenie się architektury i ustalić zasady danych.

- [x] Potwierdzić właściciela decyzji produktowej i technicznej rolami w ADR-001.
- [x] Wybrać jedną ścieżkę:
  - **A — wybrana:** obecny system pozostaje pilotem, a zapis domenowy jest przebudowywany inkrementalnie;
  - **B:** obecny snapshot zostaje świadomie zaakceptowany jako rozwiązanie tymczasowe z datą końca życia.
- [x] Ustalić, który system jest źródłem prawdy dla: rezerwacji, blokad, cen, płatności, kontaktów i zgód.
- [x] Zablokować komunikację produkcyjną i automatyczne działania inne niż szkice do czasu bramki.
- [x] Spisać definicje `rezerwacja aktywna`, `sprzedana noc`, `przychód`, `wpłata`, `saldo`, `koszt faktyczny`, `koszt modelowany`, `direct`.

**Akceptacja:** podpisana tabela źródeł prawdy i słownik KPI w repozytorium; zero otwartych sprzeczności między planem strategicznym a bieżącą implementacją.

**Status Etapu 0 (2026-07-17): zaakceptowany do kontynuacji; artefakty i blokady techniczne gotowe.** Zobacz `ADR_001_PILOT_I_ZRODLA_PRAWDY.md` i `SLOWNIK_KPI_V1.md`.

### Etap 1 — szybkie poprawki bezpieczeństwa i zaufania (1–2 dni)

#### 1.1 Hydratacja i formularze

- [x] Dodać `dataStatus: loading | ready | error` w store.
- [x] Nie renderować metryk i formularzy przed `ready`; użyć skeletonów bez fikcyjnych wartości.
- [x] Usunąć pierwszy render na danych demo w środowisku chmurowym.
- [x] Zsynchronizować formularz Ustawień dopiero po załadowaniu właściwych danych.
- [x] Zablokować zapis chmurowy do zakończenia hydratacji.
- [x] Dodać test: twarde odświeżenie `/settings` → brak możliwości zapisania danych demo/pustych.

**Status PR-1 (2026-07-17): ukończony i zaakceptowany do kontynuacji; zweryfikowany testami automatycznymi oraz w przeglądarce.**

#### 1.2 Hardcoded dane i insighty

- [x] Profil, nazwa i inicjały z sesji/użytkownika, nie `Marcin/MS`.
- [x] Alerty wyłącznie z realnych reguł i danych.
- [x] Usunąć stałe segmenty oraz stałą sugestię marketingową.
- [x] „Profile gości” liczyć z rzeczywistych rekordów i pokazać mianownik widocznych rezerwacji.
- [x] Poprawić odmianę liczebników objętych PR-2.
- [x] Zmienić etykietę backupu na „Pobierz zaszyfrowany backup”.

**Status PR-2 (2026-07-17): zaakceptowany przez właściciela po weryfikacji preview online.**

**Status PR-3 (2026-07-17): zaakceptowany przez właściciela.** Segmenty i kolejne kroki wynikają wyłącznie z rekordów źródłowych, brak danych nie jest prezentowany jako zero, a stałe rekomendacje biznesowe zostały zastąpione jawną bramką jakości danych.

#### 1.3 Auth i konfiguracja

- [ ] Włączyć leaked-password protection w Supabase. **Blocker zewnętrzny:** funkcja wymaga planu Pro; plan organizacji jest obecnie Free i nie wykonano płatnej zmiany bez zgody właściciela.
- [x] Usunąć automatyczne nadawanie `owner` każdemu nowemu użytkownikowi, w tym domyślną wartość kolumny członkostwa.
- [x] Dodać admin-only invitation/provisioning z kompensacyjnym usunięciem konta po błędzie członkostwa.
- [x] Dodać test i kontrolę produkcyjnego `disable_signup = true` oraz minimalnej długości hasła.
- [x] Zweryfikować przechowywanie sekretów: `.env.local` i `.vercel` są ignorowane, klucze aplikacyjne są zapisane jako zaszyfrowane zmienne Vercel osobno dla Production/Preview, service role jest importowane wyłącznie w module serwerowym, a osobisty token Supabase pozostaje lokalny. Rotacji nie wykonano bez przygotowanego rollbacku.

**Status PR-4 (2026-07-17): zaakceptowany przez właściciela z jawnym wyjątkiem HIBP.** Implementacja, testy, migracja produkcyjna i preview desktop/mobile zostały zweryfikowane. Etap 1 jest warunkowo zamknięty na obecnym planie Supabase Free; płatna funkcja HIBP pozostaje przyjętym ryzykiem i wróci do realizacji po osobnej decyzji o planie Pro.

**Akceptacja etapu 1:** na wolnym połączeniu żaden ekran nie pokazuje fikcyjnych zer/demo; konto testowe pokazuje własną tożsamość i rolę; signup nie może utworzyć członkostwa; Supabase Advisor nie zgłasza ochrony haseł.

### Etap 2 — prawidłowe metryki i finanse (4–7 dni)

#### 2.1 Wspólny silnik okresów

- [x] Jedna funkcja wyznaczająca przecięcie pobytu z okresem.
- [x] Wykluczenie nowych, anulowanych i kosza we wszystkich KPI PR-5.
- [x] Jawna polityka walut: PLN i EUR są liczone i prezentowane oddzielnie, bez niejawnego kursu.
- [x] Testy pobytów przecinających miesiąc, rok, DST i 29 lutego.
- [x] Dostępność pomniejszana wyłącznie o nieanulowane bloki `Serwis` i `Remont`, z deduplikacją nakładających się blokad.
- [x] Dashboard i Finanse pokazują okres, kompletność, źródło oraz przyczynę niepełnych danych.

**Status PR-5 (2026-07-19): zaakceptowany przez właściciela do publikacji online.** 100 testów, lint, TypeScript, build oraz test preview Dashboardu i Finansów na desktopie i telefonie przeszły bez błędów konsoli. PR-6a–PR-6c wykonano i opublikowano jako drafty #5–#7 w dniu 25.07.2026.

#### 2.2 PR-6a — saldo gościa i cztery perspektywy

- [x] **Sprzedaż:** wartość aktywnych rezerwacji według okresu pobytu.
- [x] **Należności:** wartość pobytu, zaksięgowane wpłaty gościa, zwroty, saldo i nadpłata.
- [x] **Cashflow:** wyłącznie zaksięgowane transakcje według daty zdarzenia.
- [x] **Wynik zarządczy:** osobna perspektywa, której wejścia nie zmieniają salda gościa.
- [x] Wpłaty gościa liczyć jako `Wpłata + Zaliczka − Zwrot`; nie dodawać `Prowizji`, `Kosztu` ani `Wypłaty OTA`.
- [x] Nie obcinać nadpłaty do zera; saldo ujemne nazwać nadpłatą.
- [x] Opening balance uwzględniać jako jawne saldo otwarcia z pochodzeniem, nie anonimową wpłatę.
- [x] Brak ceny, konflikt waluty albo nieuzgodniona wypłata dają stan `częściowe/brak danych`, nie zero.
- [x] Jedna funkcja salda zasila szczegół rezerwacji, Finanse, alerty i eksport.
- [x] Fixture'y: częściowa wpłata, pełna wpłata, zwrot, nadpłata, prowizja, koszt, direct, OTA, PLN/EUR.

**Akceptacja PR-6a:** pobyt 550 PLN z zaliczką 300 PLN pokazuje saldo 250 PLN; prowizja i sprzątanie nie zmieniają salda; wpłata 600 PLN pokazuje nadpłatę 50 PLN; wszystkie miejsca używają identycznego wyniku.

**Status PR-6a (2026-07-25): wykonany, zweryfikowany i opublikowany jako draft PR #5.**

#### 2.3 PR-6b — koszty, prowizje i wynik zarządczy

- [x] Rozdzielić koszt faktyczny od modelowanego i pokazać źródło każdej pozycji.
- [x] Nie dublować kosztu z ledgerem i masterem kosztów.
- [x] Modelować koszt stały per miesiąc/rok, zmienny per pobyt/noc/osobonoc oraz procent od właściwej podstawy.
- [x] Sprzątanie traktować jako koszt per pobyt, chyba że fakt stanowi inaczej.
- [x] Prowizję opisać przez platformę, domek/listing, okres obowiązywania, typ stawki i źródło.
- [x] Prowizja faktyczna z rozliczenia/importu ma pierwszeństwo; reguła procentowa jest jawną estymacją.
- [x] Energia, woda i szambo mogą używać modelu dopiero po zapisaniu założenia i sposobu pomiaru.
- [x] Nie obcinać stratnego miesiąca ani ujemnego wyniku do zera.
- [x] Dla YTD użyć okresu do bieżącej daty; pełny rok przyszły nazwać planem/prognozą.
- [x] Koszty wspólne mają jawną regułę alokacji między domki.

**Akceptacja PR-6b:** ręcznie policzony rok i miesiąc zgadzają się z systemem; koszt ma oznaczenie fakt/model; strata jest widoczna; brak prowizji w direct nie jest błędem kompletności.

**Status PR-6b (2026-07-25): wykonany, zweryfikowany i opublikowany jako draft PR #6.**

#### 2.4 PR-6c — prezentacja, dowody i eksport

- [x] W szczególe rezerwacji pokazać z równą wagą: `wartość pobytu`, `zaksięgowano od gościa`, `pozostało/nadpłata`.
- [x] Prowizję i wypłatę OTA pokazać w osobnej sekcji tylko dla kanału, którego dotyczą.
- [x] Filtr okresu: dziś / 14 dni / miesiąc / YTD / własny.
- [x] Każda karta: definicja, okres, ostatnia aktualizacja, źródło, waluta i kompletność.
- [x] Rozdzielić alert operacyjny od KPI strategicznego.
- [x] Kliknięcie liczby otwiera rekordy będące podstawą obliczenia.
- [x] Dashboard, Finanse, szczegół rezerwacji i CSV używają wspólnych nazw oraz wartości.
- [x] Globalna historyczna wartość rezerwacji nie jest prezentowana jako bieżący wynik finansowy.

**Akceptacja PR-6c:** użytkownik potrafi wskazać, która liczba jest sprzedażą, należnością, gotówką i wynikiem; eksport pozwala odtworzyć karty; wartości PLN/EUR nie są łączone bez kursu.

**Status PR-6c (2026-07-25): wykonany, zweryfikowany i opublikowany jako draft PR #7.** Końcowa walidacja stosu: 137/137 testów, lint, TypeScript, build 28 tras oraz smoke test desktop 1440 px i mobile 390 px bez poziomego overflow.

**Akceptacja etapu 2:** zestaw fixture’ów finansowych ma ręcznie policzone oczekiwane wyniki; księgowość/właściciel zatwierdza słownik; pulpit i Finanse pokazują te same liczby dla tego samego okresu i definicji.

**Stan bramki Etapu 2:** implementacja i walidacja techniczna są zakończone. Pozostaje ręczne porównanie jednego zamkniętego miesiąca oraz akceptacja nazw i definicji przez właściciela/księgowość.

### Etap 3 — niezawodny zapis i wielosesyjność (5–8 dni)

#### 3.1 Doraźnie, przed większą migracją

- [x] Usunąć automatyczne mutacje przy samym otwarciu pulpitu albo zapisywać je idempotentną komendą serwerową.
- [x] Dodać identyfikator żądania, użytkownika, wersję oczekiwaną/aktualną i czas zapisu do telemetryki.
- [x] Koordynować karty przez `BroadcastChannel`; po konflikcie nie nadpisywać lokalnego stanu.
- [x] Pokazać użytkownikowi konflikt z wyborem: odśwież, skopiuj zmiany, porównaj.
- [x] Dodać test równoległych zapisów w dwóch sesjach.

**Status PR-7 (2026-07-25): wdrożony online.** Przechodzi 144/144 testów, lint, TypeScript, build 28 tras oraz smoke test desktop/mobile. Test dwóch sesji obejmuje zatrzymanie PUT, zachowanie lokalnej zmiany i spóźnione porównanie. Migracja telemetryczna działa online; destrukcyjny `test:integration` pozostaje zarezerwowany dla dedykowanego projektu Supabase.

#### 3.2 Docelowo

- [ ] Dokończyć zastępowanie `PUT /api/state` komendami per domena:
  - `POST /bookings`, `PATCH /bookings/:id`, `POST /bookings/:id/cancel`;
  - `POST /payments`;
  - `PATCH /tasks/:id`;
  - `PATCH /settings`.
- [x] Walidacja Zod per wdrożona komenda i invarianty serwerowe.
- [x] `record_version`/optimistic locking per rekord dla wdrożonych komend.
- [x] Audit event w tej samej transakcji co wdrożona zmiana domenowa.
- [ ] Snapshot pozostawić tylko jako backup/eksport, nie główną ścieżkę CRUD.
- [ ] Plan migracji i rollbacku z porównaniem liczby/haszy rekordów.

**PR-8a — pierwszy wycinek wdrożony online 25.07.2026:**

- [x] `PATCH /api/tasks/:id` aktualizuje istniejące zadanie bez pełnego `PUT /api/state`.
- [x] Zod oraz niezależne inwarianty Postgresa walidują komendę.
- [x] `record_version` i optimistic locking dotyczą jednego zadania.
- [x] Audit event powstaje w tej samej transakcji co zmiana.
- [x] Globalna wersja jest zwiększana bez warunku, aby stary pełny snapshot nie nadpisał komendy domenowej.
- [x] Test klienta potwierdza brak pełnego `PUT` po zmianie zadania.
- [x] Test integracyjny zawiera 100 równoległych aktualizacji różnych zadań i konflikt tego samego zadania.
- [ ] Uruchomić próbę 100 aktualizacji na dedykowanym Supabase; jedyny dostępny projekt jest operacyjny i nie został użyty do testu destrukcyjnego.

**Status PR-8a:** wdrożony online; 152/152 testy, lint, TypeScript, build i smoke desktop/mobile przechodzą. Pełna próba równoległości pozostaje dla odizolowanej bazy.

**PR-8b — checklista rekordowa wdrożona online 25.07.2026:**

- [x] `PATCH /api/checklist-items/:id` aktualizuje jeden punkt bez pełnego `PUT /api/state`.
- [x] Zod i Postgres niezależnie walidują komendę oraz powiązane zadanie.
- [x] `record_version` i optimistic locking dotyczą jednego punktu checklisty.
- [x] Audit event powstaje w tej samej transakcji, a czas ukończenia pochodzi z serwera.
- [x] Dwa szybkie kliknięcia nie cofają nowszego stanu po starszej odpowiedzi.
- [x] Zewnętrzny commit podczas oczekującej komendy powoduje odłożone, bezpieczne odświeżenie.
- [x] Test klienta potwierdza brak pełnego `PUT` po zmianie checklisty.
- [x] Test integracyjny zawiera 100 równoległych aktualizacji różnych punktów i konflikt tego samego punktu.
- [ ] Uruchomić próbę na dedykowanym Supabase; dostępny jest tylko projekt operacyjny bez gałęzi testowej.

**Status PR-8b:** wdrożony online; 162/162 testy, lint, TypeScript, build 30 tras oraz read-only smoke test `/tasks` na desktopie i 390 px przechodzą. Pełna próba równoległości pozostaje dla odizolowanej bazy.

**PR-8c — transakcyjne utworzenie agregatu rezerwacji wdrożone online 25.07.2026:**

- [x] `POST /api/bookings` tworzy rezerwację bez pełnego `PUT /api/state`.
- [x] Rezerwacja, kontakt/zgody, 5 zadań workflow, checklista sprzątania i szkice komunikacji zapisują się w jednej transakcji.
- [x] Zod i Postgres niezależnie walidują dane oraz relacje agregatu.
- [x] Blokada transakcyjna per domek serializuje równoległe próby i zapobiega double-bookingowi.
- [x] Kontrola dostępności uwzględnia aktywne rezerwacje, blokady oraz konflikt godzin na granicy pobytów.
- [x] Powtórzenie tego samego `requestId` jest idempotentne i nie duplikuje rekordów.
- [x] Audit event, globalna wersja-fence i rekordy wykonawcze `scheduled_messages` powstają w tej samej transakcji.
- [x] Test klienta potwierdza 5 zadań, 4 punkty checklisty, 8 szkiców wiadomości i brak pełnego `PUT`.
- [x] Test integracyjny zawiera commit, replay, konflikt ID, konflikt blokady/godzin i dwie równoległe próby tego samego terminu.
- [ ] Uruchomić pełną próbę na dedykowanym Supabase; projekt operacyjny nie został użyty do destrukcyjnego testu.

**Status PR-8c:** wdrożony online; 174/174 testy automatyczne, lint, TypeScript, build 31 tras oraz read-only smoke test `/bookings` i formularza na desktopie/390 px przechodzą. Pełny test wyścigu pozostaje dla odizolowanej bazy.

**Status zbiorczego PR-8 (2026-07-26): wdrożony online.** Ustawienia, blokady kalendarza i atomowa komenda batchowa dla wszystkich pozostałych mutacji działają na produkcyjnym Supabase; migracje `20260726163800`, `20260726165207` i `20260726171329` zostały zastosowane. Store nie wysyła już pełnego `PUT /api/state`, a Route Handler tej metody został usunięty. Całość przechodzi 289/289 testów, lint, TypeScript, kontrolę składni integracji i build 33 tras. Uprawnienia RPC, przekierowania niezalogowanych wywołań, login, konsola oraz runtime Vercel zostały potwierdzone po wdrożeniu commitu `1ddfcd6` z PR #20. Nie planujemy kolejnych podziałów ani ulepszeń w ramach PR-8.

**Akceptacja etapu 3:** 100 równoległych, kontrolowanych aktualizacji różnych rekordów bez konfliktu globalnego; konflikt tego samego rekordu nie traci danych i daje czytelny wynik 409; brak pełnego delete/reinsert przy pojedynczej zmianie.

### Etap 4 — multi-tenant, role i operacje zespołu (4–7 dni)

#### 4.1 PR-9a — organizacje, role i RLS

- [ ] Dodać `activeOrganizationId` do sesji/kontekstu żądania.
- [ ] Każde API waliduje członkostwo w jawnie wskazanej organizacji.
- [ ] Usunąć `limit(1)` jako mechanizm wyboru tenanta.
- [ ] Zdefiniować role: owner/admin, manager, cleaning, marketing, accounting, viewer.
- [ ] Zbudować macierz `read/write/PII/finance/send/export`.
- [ ] Panel sprzątania: tylko obiekt, terminy, checklisty, usterki i niezbędne informacje operacyjne; bez cen, nazwisk/telefonów gości, historii marketingowej i eksportów.
- [ ] Testy RLS pozytywne i negatywne dla każdej roli i dwóch organizacji.
- [ ] Naprawić wskazania Advisor: indeksy FK, initplan `(select auth.uid())`, nakładające się policies, `btree_gist` poza `public`.

#### 4.2 PR-9b — zlecenie sprzątania i gotowość domku

- [x] Zadania właściciela/managera przypisywać do konta lub roli, nie tylko do dowolnego tekstu `owner`.
- [x] Dodać osobne kolejki `moje`, `zespołu`, `przeterminowane` dla zakupów, płatności, napraw i operacji.
- [x] Powiadomienie o zadaniu wynika z terminu, priorytetu i preferencji odbiorcy; brak stałego alertu bez rekordu źródłowego.
- [x] Zadanie turnoveru wynika z wyjazdu i aktualizuje się po zmianie terminu.
- [x] Pokazać okno `można wejść od` → `gotowe do` na podstawie wyjazdu i kolejnego przyjazdu.
- [x] Dodać stany: `do przyjęcia`, `przyjęte`, `w toku`, `gotowe`, `problem/odrzucone`.
- [x] Osoba sprzątająca może przyjąć lub odrzucić okno; godzina rozpoczęcia jest opcjonalna.
- [x] Brak odpowiedzi i odrzucenie tworzą alert dla operatora.
- [x] Dodać wersjonowane szablony checklist per domek z punktami stałymi, sezonowymi, jednorazowymi i wynikającymi z handoffu/usterki.
- [x] Stan domku wyliczać jako `goście`, `wyjazd dzisiaj`, `do sprzątania`, `w toku`, `gotowy`, `zablokowany usterką`.
- [x] `Gotowy` wynika z pełnej checklisty; awaryjne nadpisanie właściciela wymaga powodu i audytu.
- [x] Zachować zgłaszanie usterki z oceną ryzyka przed kolejnym pobytem.
- [x] Po zaksięgowaniu zaliczki umieścić pobyt w planie sprzątania na najbliższy tydzień, zgodnie z regułą i preferencją operatora.
- [x] Jeżeli od ostatniego potwierdzonego sprzątania lub kontroli gotowości minęło ponad siedem dni, zaproponować odświeżenie przed przyjazdem; sama luka między rezerwacjami nie jest dowodem potrzeby.
- [x] Osoba wydająca klucze widzi tylko niezbędne potwierdzenia: właściwy pobyt, gotowość, bramkę płatności i wykonanie wymaganej procedury, bez pełnych finansów i CRM.

#### 4.3 PR-9c — procedura ochrony małoletnich

- [ ] Najpierw przyjąć i wersjonować zatwierdzony SOP dla obiektu; aplikacja nie wymyśla treści procedury.
- [ ] Dla pobytu z dziećmi tworzyć zadanie wewnętrzne wykonania procedury, nie marketingową ankietę.
- [ ] Zapisać minimalnie: czy wymagana, czy wykonana, data, osoba, wersja SOP i wynik `bez uwag/wymaga reakcji`.
- [ ] Nie przechowywać kopii dokumentów ani dodatkowych danych dziecka bez odrębnej, udokumentowanej potrzeby i retencji.
- [ ] Nie łączyć procedury z marketingiem, ankietą satysfakcji ani zgodą na media.
- [ ] Dodać kontrolowaną ścieżkę reakcji i audyt dla wyniku wymagającego działania.
- [ ] SOP określa pełną i skróconą wersję standardów, sposób udostępnienia, przygotowanie personelu, właściciela przeglądu oraz pisemny zapis wniosków z okresowej oceny.
- [ ] Formularz online powstaje dopiero po zatwierdzeniu SOP, minimalnego zakresu danych, retencji i dostępu.
- [ ] Nie zakładać, że dowolny podpis DocuSign jest równoważny podpisowi własnoręcznemu; wymagana forma i poziom podpisu podlegają osobnej walidacji prawnej.

**Akceptacja etapu 4:** użytkownik organizacji A nie może odczytać ani zmienić organizacji B; cleaning wykonuje pełny turnover bez finansów/marketingu/pełnego PII; viewer nie zapisuje ani nie wysyła; stan gotowości ma dowód; procedura małoletnich zapisuje tylko zatwierdzone minimum.

### Etap 5 — UX, codzienna praca i kalendarz (8–14 dni)

#### 5.1 PR-10a — wspólny fundament UX i wydajność

- [ ] Jeden komponent `Dialog` i `ConfirmDialog`: focus trap, Escape, restore focus, scroll lock, `aria-describedby`.
- [x] Zastąpić `window.confirm` w blokadach kalendarza dostępnym dialogiem z focus trap, Escape i przywróceniem fokusu.
- [ ] Zastąpić `window.confirm` w pozostałych anulowaniach i resecie.
- [ ] Testy klawiatury dla nowej rezerwacji, edycji, anulowania, płatności i profilu gościa.
- [ ] Paginacja/wirtualizacja listy rezerwacji i CRM.
- [ ] Minimalny tekst krytyczny 12–14 px; informacja nie zależy wyłącznie od koloru.
- [ ] Dla toru operatora treść podstawowa ma docelowo co najmniej 16 px i musi działać przy powiększeniu tekstu/zoomie do 200%.
- [ ] Wykonać test na rzeczywistym telefonie taty z jego ustawieniem tekstu; test samej szerokości 390 px nie wystarcza.
- [ ] Główne kontrolki dotykowe mają duże cele, a powiększenie nie ukrywa dat, ceny, nazwy domku ani akcji kontynuacji.
- [ ] Ujednolicić nazwy statusów oraz odmianę liczebników.
- [ ] Budżet wydajności: LCP, INP, liczba elementów DOM, czas otwarcia rezerwacji.

#### 5.2 PR-10b — ekran Dzisiaj jako agenda pracy

- [ ] Jedna chronologiczna agenda: wyjazd → początek turnoveru → przyjazd → wiadomość/zadanie.
- [ ] Każdy wpis ma osobno rodzaj zdarzenia/status i kanał rezerwacji.
- [ ] Dodać pasek stanu domków z następną zmianą i ewentualną blokadą.
- [ ] Same-day turnover wyraźnie pokazuje dostępne okno i ryzyko.
- [ ] Kliknięcie zdarzenia otwiera właściwą akcję, nie tylko ogólny rekord.
- [ ] Dane niezbędne do decyzji są czytelne w 5 sekund na desktopie i telefonie.
- [ ] Dla roli operatora agenda „Dzisiaj” znajduje się pod kalendarzem albo w osobnej zakładce; nie zajmuje miejsca nad dostępnością.

#### 5.3 PR-10c — formularz, lista i szczegół rezerwacji

- [ ] Domyślny widok: nadchodzące i trwające; historia/archiwum osobno.
- [ ] Jawne etykiety filtrów: okres, domek, status pobytu, kanał zawarcia, saldo/płatność, jakość danych, źródło/import.
- [ ] Sortowanie nazywa faktyczne pole: `najbliższy przyjazd`, `ostatnio dodane`, `największe saldo`, `ostatnio zmienione`.
- [ ] Powrót ze szczegółu zachowuje filtry, sortowanie i pozycję listy.
- [ ] Desktop może użyć master–detail z jednoznacznym zaznaczeniem; telefon ma osobny szczegół i przycisk powrotu.
- [ ] Globalną historyczną wartość przenieść z listy operacyjnej do Finansów; lista pokazuje działania, konflikty i braki.
- [ ] Rozdzielić w formularzu: kanał zawarcia, sposób kontaktu i opcjonalne źródło odkrycia.
- [ ] Pola OTA, prowizji, zadatku i dzieci pokazywać warunkowo.
- [ ] Minimalny szybki wpis obejmuje termin, domek, osoby, nazwę, kontakt, kanał, cenę/status; pełny CRM jest później.
- [ ] Standardowe godziny check-in 16:00 i check-out 11:00 pobierać z ustawień obiektu i ukryć w szybkim formularzu; wyjątek jest jawną korektą zależną od gotowości.
- [ ] Dodać liczbę zwierząt i regułę per domek: Czapla bez zwierząt, Rybak 100 PLN za sztukę za pobyt, po zatwierdzeniu aktualnej polityki.
- [ ] Pokazać osobno noclegi, zwierzęta, usługi, cenę z cennika, rabat kwotowy/procentowy i cenę końcową.
- [ ] Domyślna zaliczka wynosi 33% ceny końcowej; operator może ją zmienić per rezerwacja, np. do 50%, z widoczną kwotą i pozostałym saldem.
- [ ] Standardowe minimum czterech dób i wyjątek rozliczany według minimalnej podstawy nie mogą zmieniać faktycznych dat pobytu; reguła 3,5 doby wymaga zatwierdzenia przed implementacją.
- [ ] Opcjonalny adres i dane do dokumentu sprzedaży umieścić w rozwijanej sekcji, nie w podstawowej ścieżce telefonu.
- [ ] Usunąć automatyczne zadanie `Content` dla każdego pobytu; zastąpić ręczną akcją `okazja na content`.

#### 5.4 PR-10d — kalendarz operacyjny

- [ ] Rola `manager/operator` po zalogowaniu trafia do kalendarza, nie do ogólnego Dashboardu.
- [ ] Na telefonie kalendarz jest widoczny przed powitaniem, KPI, zadaniami i briefem operacyjnym.
- [ ] Domyślny zakres 42 dni: 7 dni wstecz, dzisiaj, 34 dni naprzód.
- [ ] `Dzisiaj` ustawia bieżący dzień około 1/4–1/3 szerokości, zachowując kontekst poprzedniego pobytu.
- [ ] Nawigacja zakresu i przewijanie osi są sprzężone; użytkownik nie zarządza dwoma niezależnymi stanami.
- [ ] Miesiące są czytelnymi nagłówkami osi.
- [ ] Pasek rezerwacji pokazuje kanał tekstem/ikoną oraz dostępny opis; kolor jest dodatkiem.
- [ ] Drag na desktopie, dwa tapnięcia na dotyku i pola od/do dla klawiatury tworzą ten sam szkic terminu.
- [ ] Konflikt/blokada są sprawdzane przed otwarciem lub zatwierdzeniem formularza.
- [ ] Mobilna agenda jasno pokazuje zakres i pozwala łatwo zmienić tydzień.
- [ ] Dwa tapnięcia na wizualnej dostępności zachowują początek, koniec i domek oraz otwierają wycenę bez ponownego wpisywania dat.
- [ ] Widoczny stan synchronizacji odróżnia lokalny zapis od potwierdzonej blokady Mobile Calendar/OTA.

#### 5.5 PR-10e — przegląd roku i luki

- [ ] Widok 12 miesięcy per domek ze stanem sprzedaży na dziś.
- [ ] Przełączniki co najmniej: obłożenie, wartość rezerwacji, ADR i lead time; waluty osobno.
- [ ] Porównanie z poprzednim rokiem używa tego samego dnia sprzedaży, a nie pełnego wyniku przyszłych miesięcy.
- [ ] Deterministycznie klasyfikować wolne ciągi: 1 noc, 2–3, 4–6, 7+.
- [ ] Karta luki pokazuje daty, domek, sezon, min-stay, czas do terminu i podstawę rekomendacji.
- [ ] Sezony i cele obłożenia konfigurować per domek; wartości 95%/40–50% traktować jako hipotezy do zatwierdzenia, nie stałe systemowe.
- [ ] System nie uruchamia reklamy, nie publikuje treści i nie zmienia ceny.

**Akceptacja etapu 5:** WCAG smoke test klawiaturą i czytnikiem ekranu; 1 000 rezerwacji nie renderuje 1 000 wierszy jednocześnie; brak poziomego overflow na 320/390/768 px; operator w 5 sekund rozpoznaje dzisiejsze przyjazdy, wyjazdy i niegotowy domek; kalendarz i widok roczny przechodzą testy desktop/mobile/klawiatura.

**Bramka pilotażowa przed rekomendacjami Etapu 6:** prowadzić system równolegle przez minimum 2 tygodnie. Osobno zebrać feedback ojca/operatora i osoby sprzątającej; mierzyć powroty do innych narzędzi, pomijane pola, zbędne zadania, korekty wiadomości, niezgodne statusy domków, czas turnoveru oraz różnice Stawy OS ↔ źródło OTA. Modelowanie Etapu 6 może być przygotowywane równolegle, ale rekomendacje wzrostu nie są akceptowane przed wynikami pilota.

### Etap 6 — dane wzrostu, relacja i komunikacja (10–16 dni)

#### 6.1 PR-11a — osoba, pobyty i atrybucja

- [ ] Oddzielić `person/guest` od `booking`, aby rozpoznać powracających gości.
- [ ] Deduplikować telefon/e-mail z kontrolą człowieka; nie scalać wyłącznie po imieniu.
- [ ] Znormalizować osobno: kanał zawarcia, sposób pierwszego kontaktu, źródło odkrycia, metoda szukania, fraza/prompt, kampania/UTM, polecenie, motywacja, segment i powód rezygnacji.
- [ ] Brak pamięci frazy lub źródła jest prawidłowym stanem, nie wartością wymuszaną.
- [ ] Powracający gość ma jedną osobę i wiele pobytów bez kopiowania zgód między różnymi celami.
- [ ] Zapis źródła pokazuje moment, autora i podstawę: deklaracja gościa, UTM, import albo ręczna notatka.

#### 6.2 PR-11b — feedback, opinie i consent ledger

- [ ] Zachować debrief po wyjeździe: źródło, dlaczego wybrali, najlepsza część, problem, NPS, zamiar powrotu i dokładny cytat.
- [ ] Dokładny cytat przechowywać osobno od streszczenia lub tagów tworzonych przez AI.
- [ ] Status opinii: nie proszono, zaplanowana, wysłana, kliknięta (jeśli mierzalne), otrzymana, brak opinii, nie dotyczy.
- [ ] Rozdzielić zgody: marketing e-mail, marketing SMS, cytat, media na stronie, social media, reklama płatna.
- [ ] Każda zgoda ma treść/wersję, cel, źródło, timestamp, użytkownika i wycofanie.
- [ ] Zgody nie łączyć z kontaktem operacyjnym, procedurą małoletnich ani wystawieniem opinii.
- [ ] Content jest ręczną okazją; zgoda na media i prośba o opinię są dwoma procesami.

#### 6.3 PR-11c — biblioteka komunikacji PL/DE/EN

- [ ] Dodać preferowany język gościa `pl/de/en`; nie zgadywać go wyłącznie z kraju.
- [ ] Wersjonować szablony potwierdzenia, płatności, przed przyjazdem, kontroli po przyjeździe, wyjazdu i opinii.
- [ ] Dla MVP taty odwzorować kolejno: potwierdzenie i prośbę o zaliczkę, potwierdzenie zaliczki z materiałami pobytowymi, przypomnienie o saldzie D-2 oraz trasę i informacje przed przyjazdem.
- [ ] Szablon potwierdzenia zawiera obiekt, termin, cenę, zaliczkę, termin, konto i warunki; numer konta jest wersjonowaną konfiguracją, nie tekstem kopiowanym do wielu szablonów.
- [ ] Pozwolić wybrać operatorów otrzymujących kopię wiadomości bez ujawniania listy gości.
- [ ] Dodać zatwierdzoną instrukcję dojazdu per język, z ostrzeżeniem przed niewłaściwą trasą.
- [ ] Dobierać kanał do celu i źródła rezerwacji: SMS, e-mail albo OTA; nie dublować bez jawnej reguły.
- [ ] Opcjonalny krótki SMS kierujący do ważnego e-maila jest osobną, jawną regułą z limitem, nie automatycznym duplikatem każdej wiadomości.
- [ ] Szablony mają naturalny, krótki ton, podpis nadawcy i możliwość odpowiedzi; nie udają ręcznie napisanej wiadomości.
- [ ] Reguły opinii są zależne od polityki kanału Booking/Airbnb/direct.
- [ ] Zapisać statusy szkicu i zatwierdzenia; nie oznaczać `wysłana/dostarczona` bez odpowiedzi dostawcy.
- [ ] Szkice mogą powstawać automatycznie, ale produkcyjna dostawa pozostaje zablokowana do Etapu 7.
- [ ] Automatyzację wdrażać per szablon: szkic → ręczne zatwierdzenie → ręczna wysyłka ze statusem → dopiero potem jawnie zatwierdzony auto-send.
- [ ] Zmiana terminu, ceny, obiektu, odbiorcy lub języka po zatwierdzeniu cofa wiadomość do sprawdzenia.

#### 6.4 PR-11d — insighty, reklamy i eksperymenty

- [ ] Każdy insight ma `n`, okres, kompletność i porównanie bazowe.
- [ ] Próg publikacji wniosku, np. `n ≥ 20`, kompletność ≥ 70%; poniżej progu pokazać plan zbierania danych.
- [ ] Dashboard wzrostu: direct share, lead time, ADR, długość pobytu, powroty, prowizja i konwersja według źródła.
- [ ] Segmenty wyłącznie wyliczane z danych, zero stałych liczb i narracji.
- [ ] Importować wydatki reklamowe najpierw z CSV: data, kanał, kampania, koszt, wynik i kod/UTM.
- [ ] Okres kampanii można nanieść na widok roku, ale korelacji nie nazywać przyczynowością.
- [ ] Model payback per domek wymaga kapitału początkowego, dodatkowych nakładów, kosztów, wypłat właściciela i alokacji kosztów wspólnych.
- [ ] Pakiet wędkarski poza sezonem prowadzić jako eksperyment z okresem, kosztem, kodem, kryterium sukcesu i decyzją po pilocie.
- [ ] Przypomnienie o powrocie opierać na historycznym lead time i wysyłać wcześniej niż poprzedni moment decyzji, wyłącznie dla właściwej zgody i kanału.
- [ ] Odczyty prądu najpierw zapisywać ręcznie z datą, licznikiem i źródłem/zdjęciem; API dopiero po ocenie wartości.
- [ ] AI może podsumować dane albo przygotować propozycję; nie wysyła, nie publikuje, nie zmienia ceny i nie uruchamia reklamy.

**Akceptacja etapu 6:** każda liczba na ekranie „Goście i marketing” ma możliwy do otwarcia zbiór rekordów źródłowych; przy próbie 0 nie pojawia się wniosek biznesowy; powracający gość ma jedną tożsamość; wycofana zgoda blokuje właściwy cel; szkic ma poprawny język i kanał; eksperyment pokazuje koszt oraz wynik bez automatycznego działania.

### Etap 7 — integracje i kontrolowany go-live (5–10 dni pracy + czas dostawców)

#### 7.1 Gateway OTA

- [ ] Zrealizować spike Mobile-Calendar Premium vs Beds24 na kopii danych.
- [ ] Potwierdzić synchronizację co najmniej z Booking, Airbnb i Aloha Camp oraz właściciela każdego konta; nie zakładać jej na podstawie samego widoku Mobile Calendar.
- [ ] Macierz pól: rezerwacja, gość, cena, prowizja, płatność, blokada, status, wiadomość, webhook.
- [ ] Test dla obu domków i obu głównych kanałów:
  1. nowa rezerwacja;
  2. zmiana terminu;
  3. anulowanie;
  4. blokada;
  5. aktualizacja ceny/dostępności;
  6. opóźnienie/awaria synchronizacji;
  7. idempotentne powtórzenie webhooka.
- [ ] Wybrać gateway i podpisać kontrakt danych/versioning.
- [ ] Uzgodnić wszystkie aktywne rezerwacje, blokady i salda.
- [ ] 7–14 dni shadow mode/read-only z codziennym raportem różnic.
- [ ] Dopiero potem kontrolowany write-through i możliwość szybkiego rollbacku.

#### 7.2 Produkcyjna dostawa SMS/e-mail/OTA

- [ ] Wybrać właściciela kont dostawców i środowiska testowe/produkcyjne.
- [ ] Normalizować telefon do E.164 i walidować adres e-mail.
- [ ] Przed kolejką sprawdzić cel, podstawę/zgodę, kanał rezerwacji, język i aktualną wersję rezerwacji.
- [ ] Idempotency key gwarantuje, że retry nie wyśle duplikatu.
- [ ] Zapisywać status dostawcy: kolejka, wysłana, dostarczona, błąd, odrzucona; nie wnioskować dostarczenia z samego żądania.
- [ ] Retry ma limit, backoff i alert do właściciela dla wiadomości ważnej operacyjnie.
- [ ] Zmiana terminu, kontaktu lub języka po zatwierdzeniu cofa wiadomość do sprawdzenia.
- [ ] Osobno przetestować potwierdzenie, płatność, dojazd, sprzątanie i opinię w każdym używanym kanale.
- [ ] Nie wysyłać potwierdzenia rezerwacji przed potwierdzeniem zapisu w źródle nadrzędnym.
- [ ] Przypomnienie D-2 powstaje tylko dla rzeczywistego salda > 0; pełna wpłata nie tworzy wiadomości.

#### 7.3 Dalsze integracje

- [ ] API reklam dopiero po przejściu stabilnego importu CSV i przyjęciu modelu kampanii.
- [ ] Integracja liczników dopiero po pilocie ręcznych odczytów i potwierdzeniu zwrotu z pracy.
- [ ] Każda integracja ma kontrakt pól, źródło prawdy, idempotencję, monitoring, retencję i rollback.

**Akceptacja etapu 7:** zero niewyjaśnionych różnic OTA przez minimum 7 dni; udokumentowane RTO/RPO; sprawdzony rollback; wiadomości mają potwierdzony pełny cykl i nie tworzą duplikatów; właściciel zatwierdza każde przełączenie produkcyjne osobno.

## Proponowane paczki wdrożeniowe

| Paczka | Zawartość | Ryzyko | Szacunkowo |
|---|---|---:|---:|
| PR-1 | loading gate, brak demo flash, bezpieczne Ustawienia | niskie | 0,5–1 d. |
| PR-2 | profil użytkownika, dynamiczne alerty, copy/backup | niskie | 0,5–1 d. |
| PR-3 | usunięcie fake insightów + honest empty states | niskie | 0,5 d. |
| PR-4 | leaked passwords, invitation-only provisioning, test signup | średnie | 0,5–1 d. |
| PR-5 | biblioteka okresów i poprawne obłożenie | średnie | 1–2 d. |
| PR-6a | saldo gościa i cztery perspektywy finansowe | średnie | 1–2 d. |
| PR-6b | koszty, prowizje i wynik zarządczy | średnie | 1,5–3 d. |
| PR-6c | prezentacja finansów, dowody i eksport | średnie | 1–2 d. |
| PR-7 | telemetryka, koordynacja kart, czytelny konflikt | średnie | 2 d. |
| PR-8+ | komendy per domena i migracja snapshotu | wysokie | 5–8 d. |
| PR-9a | role/RLS/multi-tenant | wysokie | 3–5 d. |
| PR-9b | sprzątanie: przyjęcie, checklisty, gotowość i eskalacja | średnie | 2–3 d. |
| PR-9c | zatwierdzona procedura małoletnich i minimalny zapis | średnie | 1–2 d. + konsultacja |
| PR-10a | Dialog, paginacja, a11y i wydajność | średnie | 3–4 d. |
| PR-10b | agenda Dzisiaj i stan domków | średnie | 2–3 d. |
| PR-10c | formularz, lista, filtry i szczegół rezerwacji | średnie | 3–4 d. |
| PR-10d | kalendarz: kontekst, kanały i zaznaczenie zakresu | średnie | 3–4 d. |
| PR-10e | widok roczny i deterministyczne luki | średnie | 2–4 d. |
| PR-11a | osoby, powroty i atrybucja | wysokie | 3–5 d. |
| PR-11b | feedback, opinie i consent ledger | średnie | 3–5 d. |
| PR-11c | szkice komunikacji PL/DE/EN i dojazd | średnie | 2–4 d. |
| PR-11d | insighty, reklamy CSV, payback i eksperymenty | średnie | 4–7 d. |
| PR-12+ | gateway OTA, dostawcy wiadomości, shadow mode i go-live | wysokie | 5–10 d. + czas dostawców |

## Macierz testów regresji

| Obszar | Minimum przed merge | Minimum przed produkcją |
|---|---|---|
| Rezerwacje | unit: daty, konflikt, zadania bez domyślnego Content, kanał ≠ źródło | E2E: szybki wpis, edycja, anuluj, przywróć, zachowane filtry |
| Płatności | unit: saldo, zwrot, nadpłata, prowizja/koszt poza wpłatą | E2E: szczegół = Finanse = CSV + uzgodnienie |
| Kalendarz | unit: przecięcie okresów i klasyfikacja luk | E2E: desktop/mobile/klawiatura, drag/tap, same-day turnover, widok roku |
| Chmura | API: wersja, 409, schema | dwie karty i dwa konta równocześnie |
| Role | RLS policy tests | każda rola w UI/API; cleaning bez PII/finansów |
| Sprzątanie | unit: okno, checklist template, stan gotowości | E2E: przyjmij, odrzuć, wykonaj, zgłoś problem, eskalacja |
| Finanse | fixtures z wynikiem ręcznym | akceptacja właściciela/księgowości |
| CRM/zgody | unit: deduplikacja i blokada per cel po wycofaniu | E2E: osoba → pobyt → debrief → zgoda → dozwolone użycie/zakaz |
| Wiadomości | unit: język, szablon, fingerprint, idempotencja | E2E: szkic → zatwierdzenie → dostawca → delivery/błąd/retry |
| Małoletni | unit: wersja SOP i minimalny zapis | E2E: zadanie → wykonanie → reakcja; brak zbędnych danych |
| OTA | contract tests + idempotencja | pełny cykl obu kanałów |
| Dostępność | lint + dialog tests | klawiatura, screen reader smoke, 320 px |
| Bezpieczeństwo | lint/advisors/audit | OWASP checklist, sekrety, backup/restore |

## Monitoring po wdrożeniu

Śledzić co najmniej:

- liczbę i odsetek 409/500 dla zapisów;
- czas GET/PUT/komend oraz rozmiar payloadu;
- różnice Stawy OS ↔ gateway OTA;
- rezerwacje bez ceny, kontaktu, zgody i źródła;
- zadania przeterminowane oraz niedostarczone wiadomości;
- nieudane logowania, zmiany ról i eksporty danych;
- czas od zmiany OTA do widoczności w Stawy OS;
- backup age i wynik cyklicznego testu odtworzenia.

Alert nie może być stałym tekstem w UI. Musi wynikać z mierzalnego zdarzenia, mieć właściciela i instrukcję reakcji.

## Bramka końcowa

Status **GO** można nadać dopiero po spełnieniu wszystkich kryteriów P1 z [raportu audytu](./AUDYT_APLIKACJI_2026-07-15.md), przejściu shadow mode oraz zatwierdzeniu definicji finansowych i procesu OTA. Wcześniej status pozostaje **PILOT / PARALLEL RUN**.
