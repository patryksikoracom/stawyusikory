# Plan wdrożenia poprawek Stawy OS

> Bieżąca kolejność, status i mapowanie Etapów na paczki PR są utrzymywane w `MASTER_PLAN_REALIZACJI_STAWY_OS.md`. Ten dokument pozostaje szczegółową listą wymagań i kryteriów akceptacji.

## Cel

Doprowadzić aplikację od kontrolowanego pilota do wiarygodnego systemu operacyjnego, bez rozwijania warstwy wzrostu na niepewnych danych i bez przełączania źródła prawdy przed sprawdzonym gatewayem OTA.

Szacunki zakładają jedną osobę rozwijającą produkt z pomocą narzędzi AI. Nie obejmują czasu oczekiwania na dostawców OTA, księgowość ani decyzje biznesowe.

## Zasady realizacji

1. Najpierw bezpieczeństwo zapisu i prawda w danych, potem optymalizacja wyglądu i AI.
2. Żadna liczba biznesowa bez definicji, okresu, źródła i testu.
3. Żadna rekomendacja marketingowa bez minimalnej próby i widocznej kompletności danych.
4. Zmiany domenowe wdrażać jako małe komendy/rekordy, nie kolejne rozszerzenia pełnego snapshotu.
5. Do czasu bramki go-live Mobile-Calendar/obecny system pozostaje nadrzędnym źródłem rezerwacji.

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

**Status PR-4 (2026-07-17): implementacja, testy i migracja produkcyjna gotowe; oczekuje na preview i ręczną akceptację.** Pełne zamknięcie Etapu 1 pozostaje zależne od płatnej funkcji HIBP na Supabase Pro.

**Akceptacja etapu 1:** na wolnym połączeniu żaden ekran nie pokazuje fikcyjnych zer/demo; konto testowe pokazuje własną tożsamość i rolę; signup nie może utworzyć członkostwa; Supabase Advisor nie zgłasza ochrony haseł.

### Etap 2 — prawidłowe metryki i finanse (3–5 dni)

#### 2.1 Wspólny silnik okresów

- [ ] Jedna funkcja wyznaczająca przecięcie pobytu z okresem.
- [ ] Wykluczenie anulowanych i kosza we wszystkich KPI.
- [ ] Jawna polityka walut: osobne sumy per waluta albo zatwierdzony kurs ze źródłem i datą.
- [ ] Testy pobytów przecinających miesiąc, rok, DST i 29 lutego.

#### 2.2 Cztery perspektywy finansowe

- [ ] **Sprzedaż:** wartość aktywnych rezerwacji według okresu pobytu.
- [ ] **Należności:** cena, zaksięgowane wpłaty, saldo.
- [ ] **Cashflow:** wyłącznie ledger według daty transakcji.
- [ ] **Wynik zarządczy:** przychód zrealizowany minus koszty faktyczne i jawnie modelowane.
- [ ] Nie obcinać stratnych miesięcy do zera.
- [ ] Rozdzielić prowizję zaksięgowaną, zaimportowaną i estymowaną; zapobiec dublowaniu.
- [ ] Dla YTD użyć denominatora do daty bieżącej; dla całego roku nazwać metrykę prognozą.

#### 2.3 Nowy pulpit

- [ ] Filtr okresu: dziś / 14 dni / miesiąc / YTD / własny.
- [ ] Każda karta: definicja, okres, ostatnia aktualizacja, źródło, kompletność.
- [ ] Rozdzielić alert operacyjny od KPI strategicznego.
- [ ] Kliknięcie liczby otwiera rekordy będące podstawą obliczenia.

**Akceptacja etapu 2:** zestaw fixture’ów finansowych ma ręcznie policzone oczekiwane wyniki; księgowość/właściciel zatwierdza słownik; pulpit i Finanse pokazują te same liczby dla tego samego okresu i definicji.

### Etap 3 — niezawodny zapis i wielosesyjność (5–8 dni)

#### 3.1 Doraźnie, przed większą migracją

- [ ] Usunąć automatyczne mutacje przy samym otwarciu pulpitu albo zapisywać je idempotentną komendą serwerową.
- [ ] Dodać identyfikator żądania, użytkownika, wersję oczekiwaną/aktualną i czas zapisu do telemetryki.
- [ ] Koordynować karty przez `BroadcastChannel`; po konflikcie nie nadpisywać lokalnego stanu.
- [ ] Pokazać użytkownikowi konflikt z wyborem: odśwież, skopiuj zmiany, porównaj.
- [ ] Dodać test równoległych zapisów w dwóch sesjach.

#### 3.2 Docelowo

- [ ] Zastąpić `PUT /api/state` komendami per domena, np.:
  - `POST /bookings`, `PATCH /bookings/:id`, `POST /bookings/:id/cancel`;
  - `POST /payments`;
  - `PATCH /tasks/:id`;
  - `PATCH /settings`.
- [ ] Walidacja Zod per komenda i invarianty serwerowe.
- [ ] `record_version`/optimistic locking per rekord, a nie globalnie dla 707+ rekordów.
- [ ] Audit event w tej samej transakcji co zmiana.
- [ ] Snapshot pozostawić tylko jako backup/eksport, nie główną ścieżkę CRUD.
- [ ] Plan migracji i rollbacku z porównaniem liczby/haszy rekordów.

**Akceptacja etapu 3:** 100 równoległych, kontrolowanych aktualizacji różnych rekordów bez konfliktu globalnego; konflikt tego samego rekordu nie traci danych i daje czytelny wynik 409; brak pełnego delete/reinsert przy pojedynczej zmianie.

### Etap 4 — multi-tenant, role i RLS (3–5 dni)

- [ ] Dodać `activeOrganizationId` do sesji/kontekstu żądania.
- [ ] Każde API waliduje członkostwo w jawnie wskazanej organizacji.
- [ ] Usunąć `limit(1)` jako mechanizm wyboru tenanta.
- [ ] Zdefiniować role: owner/admin, manager, cleaning, marketing, accounting, viewer.
- [ ] Zbudować macierz `read/write/PII/finance/send/export`.
- [ ] Panel sprzątania: tylko obiekt, terminy, checklisty, usterki i wymagany kontakt; bez cen, historii marketingowej i eksportów.
- [ ] Testy RLS pozytywne i negatywne dla każdej roli i dwóch organizacji.
- [ ] Naprawić wskazania Advisor: indeksy FK, initplan `(select auth.uid())`, nakładające się policies, `btree_gist` poza `public`.

**Akceptacja etapu 4:** użytkownik organizacji A nie może odczytać ani zmienić organizacji B; cleaning nie widzi finansów/marketingu/pełnego PII; viewer nie może wykonać żadnego zapisu ani wysyłki.

### Etap 5 — UX, dostępność i wydajność (4–6 dni)

- [ ] Jeden komponent `Dialog` i `ConfirmDialog`: focus trap, Escape, restore focus, scroll lock, `aria-describedby`.
- [ ] Zastąpić `window.confirm` w anulowaniu, blokadach i resecie.
- [ ] Testy klawiatury dla nowej rezerwacji, edycji, anulowania, płatności i profilu gościa.
- [ ] Paginacja/wirtualizacja listy rezerwacji i CRM.
- [ ] Domyślnie: nadchodzące + wymagające działania; archiwum osobno.
- [ ] Filtry kanału i płatności z prawdziwymi etykietami `aria-label`.
- [ ] Minimalny tekst krytyczny 12–14 px; informacja nie może zależeć wyłącznie od koloru.
- [ ] Ujednolicić nazwy statusów oraz odmianę liczebników.
- [ ] Mobilny kalendarz: jasno opisać, że agenda pokazuje 7 dni, i zapewnić prostą zmianę tygodnia.
- [ ] Budżet wydajności: LCP, INP, liczba elementów DOM, czas otwarcia rezerwacji.

**Akceptacja etapu 5:** WCAG smoke test klawiaturą i czytnikiem ekranu; 1 000 rezerwacji nie renderuje 1 000 wierszy jednocześnie; brak poziomego overflow na 320/390/768 px.

### Etap 6 — dane wzrostu i CRM (5–8 dni)

#### 6.1 Model danych

- [ ] Oddzielić `person/guest` od `booking`, aby rozpoznać powracających gości.
- [ ] Znormalizować kanał rezerwacji, źródło odkrycia, kampanię/UTM, polecenie, motywację, segment i powód rezygnacji.
- [ ] Zgoda: treść/wersja, cel, źródło, timestamp, użytkownik, wycofanie.
- [ ] Połączyć feedback, NPS, opinię publiczną i zgodę na cytat/media.
- [ ] Deduplikacja kontaktów z kontrolą człowieka.

#### 6.2 Czytelne insighty

- [ ] Każdy insight ma `n`, okres, kompletność i porównanie bazowe.
- [ ] Próg publikacji wniosku, np. `n ≥ 20`, kompletność ≥ 70%; poniżej progu pokazać plan zbierania danych.
- [ ] Dashboard wzrostu: direct share, lead time, ADR, długość pobytu, powroty, prowizja, konwersja według źródła.
- [ ] Segmenty wyłącznie wyliczane z danych, zero stałych liczb i narracji.
- [ ] Kampanie nadal wyłączone, dopóki zgody i dostawca wysyłki nie przejdą testów.

**Akceptacja etapu 6:** każda liczba na ekranie „Goście i marketing” ma możliwy do otwarcia zbiór rekordów źródłowych; przy próbie 0 nie pojawia się wniosek biznesowy; wycofana zgoda natychmiast blokuje wysyłkę.

### Etap 7 — gateway OTA i kontrolowany go-live (3–5 dni pracy + czas dostawcy)

- [ ] Zrealizować spike Mobile-Calendar Premium vs Beds24 na kopii danych.
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

**Akceptacja etapu 7:** zero niewyjaśnionych różnic przez minimum 7 dni; udokumentowane RTO/RPO; sprawdzony rollback; właściciel zatwierdza przełączenie.

## Proponowane paczki wdrożeniowe

| Paczka | Zawartość | Ryzyko | Szacunkowo |
|---|---|---:|---:|
| PR-1 | loading gate, brak demo flash, bezpieczne Ustawienia | niskie | 0,5–1 d. |
| PR-2 | profil użytkownika, dynamiczne alerty, copy/backup | niskie | 0,5–1 d. |
| PR-3 | usunięcie fake insightów + honest empty states | niskie | 0,5 d. |
| PR-4 | leaked passwords, invitation-only provisioning, test signup | średnie | 0,5–1 d. |
| PR-5 | biblioteka okresów i poprawne obłożenie | średnie | 1–2 d. |
| PR-6 | rozdzielenie sprzedaż/ledger/wynik | średnie | 2–3 d. |
| PR-7 | telemetryka, koordynacja kart, czytelny konflikt | średnie | 2 d. |
| PR-8+ | komendy per domena i migracja snapshotu | wysokie | 5–8 d. |
| PR-9 | role/RLS/multi-tenant | wysokie | 3–5 d. |
| PR-10 | Dialog, paginacja, a11y i mobile polish | średnie | 4–6 d. |
| PR-11 | CRM/atrybucja/consent ledger | średnie | 5–8 d. |

## Macierz testów regresji

| Obszar | Minimum przed merge | Minimum przed produkcją |
|---|---|---|
| Rezerwacje | unit: daty, konflikt, zadania | E2E: dodaj, zmień, anuluj, przywróć |
| Płatności | unit: saldo, zwrot, prowizja | E2E: ledger + uzgodnienie |
| Kalendarz | unit: przecięcie okresów | E2E: desktop/mobile, same-day turnover |
| Chmura | API: wersja, 409, schema | dwie karty i dwa konta równocześnie |
| Role | RLS policy tests | każda rola w UI i bezpośrednim API |
| Finanse | fixtures z wynikiem ręcznym | akceptacja właściciela/księgowości |
| CRM/zgody | unit: blokada po wycofaniu | E2E: profil → zgoda → wysyłka/zakaz |
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
