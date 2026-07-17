# Audyt Stawy OS — stan na 15 lipca 2026

## Podsumowanie zarządcze

Stawy OS ma solidny fundament operacyjny i nadaje się do dalszego pilotażu równolegle z obecnym źródłem rezerwacji. Nie rekomenduję jeszcze uznania go za jedyne źródło prawdy ani podstawę decyzji finansowych i marketingowych.

Największym ryzykiem nie jest obecnie klasyczny wyciek danych, lecz **zaufanie do danych i zapisów**:

1. pulpit i CRM pokazują metryki lub wnioski, których znaczenie nie odpowiada obliczeniom;
2. podczas ładowania chmury interfejs chwilowo pokazuje dane demo albo zera, a formularz ustawień może zachować stary stan i nadpisać właściwe ustawienia;
3. każda drobna zmiana przepisuje cały stan organizacji, co już generuje konflikty wersji;
4. założenie strategiczne o wyborze gatewaya OTA i modelu v2 nie zostało domknięte, choć aplikacja działa produkcyjnie na rozwiniętej wersji prototypowego magazynu stanu.

**Rekomendacja:** tryb równoległy i kontrolowany zapis — tak. Pełne przełączenie operacji — nie, dopóki nie zostaną zamknięte pozycje P1 z planu wdrożenia.

### Ocena orientacyjna

| Obszar | Ocena | Wniosek |
|---|---:|---|
| Funkcje operacyjne | 7/10 | Główne ścieżki działają i są spójne domenowo. |
| Czytelność i UX | 6/10 | Dobra baza wizualna, lecz są błędne stany ładowania, przeciążone listy i mylące etykiety. |
| Wiarygodność danych | 4/10 | Definicje KPI, okresy i dane modelowane nie są dostatecznie rozdzielone. |
| Niezawodność zapisu | 5/10 | Wersjonowanie chroni przed cichą utratą danych, ale pełny zapis stanu wywołuje konflikty. |
| Bezpieczeństwo | 7/10 | RLS, uwierzytelnianie i nagłówki są mocną bazą; pozostały ważne ustawienia i utwardzenie. |
| Gotowość do wzrostu | 3/10 | Brakuje wiarygodnej warstwy CRM, atrybucji i mierzenia powrotów/direct. |

## Zakres i sposób testu

- wersja: commit `80c497f`;
- środowiska: produkcja Vercel, Supabase oraz izolowany tryb lokalny bez zapisu do chmury;
- widoki: logowanie, Dzisiaj, Kalendarz, Rezerwacje, Zadania, Goście i marketing, Finanse, Integracje, Ustawienia;
- rozdzielczości: desktop oraz telefon 390 × 844 px;
- przepływy zapisu testowane lokalnie: nowa rezerwacja, konflikt terminu, automatyczne zadania, zmiana statusu, księgowanie wpłaty, anulowanie;
- kod i konfiguracja: Next.js, Supabase/RLS/RPC, integracje iCal, SMS, import, backup, nagłówki HTTP, sekrety i zależności;
- bramki jakości: lint, TypeScript, testy, build produkcyjny i `npm audit`;
- punkt odniesienia bezpieczeństwa: [OWASP ASVS 5.0](https://owasp.org/www-project-application-security-verification-standard/) oraz [Supabase Security](https://supabase.com/docs/guides/security).

Nie wykonywano testu obciążeniowego, destrukcyjnego pentestu, wysyłki SMS, synchronizacji zewnętrznych OTA ani zmian danych produkcyjnych. To audyt aplikacyjny i konfiguracyjny, nie certyfikowany pentest infrastruktury.

## Co działa dobrze

- Konto testowe loguje się poprawnie w produkcji, a dostęp do `/api/state` bez sesji kończy się przekierowaniem do logowania.
- Wszystkie sprawdzone tabele publiczne mają RLS. Uprawnienia zapisu są ograniczone do `owner/admin`, a `viewer` jest tylko do odczytu.
- Samodzielna rejestracja Supabase Auth jest obecnie wyłączona; e-mail wymaga potwierdzenia.
- Produkcja zwraca HSTS, CSP, `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, restrykcyjne `Permissions-Policy` i `Referrer-Policy: no-referrer`.
- Konflikt dat jest wykrywany przed zapisem i ponownie sprawdzany przy zatwierdzeniu rezerwacji ([new-booking-dialog.tsx](../src/components/bookings/new-booking-dialog.tsx)).
- Lokalny test utworzenia rezerwacji zakończył się poprawnie i wygenerował pięć powiązanych zadań; zmiana statusu oraz zaksięgowanie wpłaty zaktualizowały saldo.
- iCal ma kontrolę protokołu, DNS, adresów prywatnych, rozmiaru i timeoutu; publiczny feed nie zawiera danych gościa.
- SMS ma uwierzytelnienie, limit dzienny i klucz idempotencji. Automaty komunikacyjne pracują w bezpiecznym trybie draft-first.
- Backup jest szyfrowany w przeglądarce, a eksport do analizy cen usuwa PII.
- Repozytorium ignoruje `.env*` i `.vercel`; w historii nie znaleziono śladów śledzenia `.env.local` ani projektu Vercel. Publiczne repo nie zawiera sprawdzonych sekretów.
- `npm audit` dla zależności produkcyjnych: 0 znanych podatności.
- Vercel: ostatni deployment produkcyjny jest `READY`; w analizowanym okresie nie było klastra błędów runtime.

## Ustalenia priorytetowe

### P1 — przed uznaniem aplikacji za główne źródło prawdy

#### A01. KPI na pulpicie nie odpowiadają etykietom

`Przychód potwierdzony`, średnia cena nocy i udział direct są liczone z całej tablicy rezerwacji, bez okresu, bez wykluczenia anulowanych, bez rozliczenia walut i bez sprawdzenia zaksięgowanej płatności ([rules.ts:333](../src/lib/workflow/rules.ts#L333)). W produkcji pulpit pokazał 438 667 zł jako „potwierdzone”, mimo że 43 rezerwacje wymagały sprawdzenia rozliczenia.

Obłożenie miesiąca bierze pełną długość pobytu, gdy check-in albo check-out przypada w miesiącu. Pobyt przecinający granicę miesiąca może zostać nad- lub niedoliczony ([dashboard-view.tsx:29](../src/components/views/dashboard-view.tsx#L29)).

**Wpływ:** błędne decyzje cenowe, marketingowe i gotówkowe.

**Naprawa:** jeden katalog definicji metryk; obowiązkowy okres, status, waluta, źródło i poziom zaufania widoczne przy każdej liczbie. Oddzielić wartość rezerwacji, przychód należny, wpłaty i gotówkę.

#### A02. Moduł wzrostu pokazuje dane przykładowe jako wnioski

Karta „Profile gości” liczy wszystkie rezerwacje, a nie istniejące profile. Dwa segmenty mają liczbę `1` wpisaną na stałe, niezależnie od danych. Sugestia „Rodziny rezerwują wcześniej…” jest stała nawet przy próbie 0 ([guests-view.tsx:16](../src/components/views/guests-view.tsx#L16), [guests-view.tsx:29](../src/components/views/guests-view.tsx#L29), [guests-view.tsx:33](../src/components/views/guests-view.tsx#L33), [guests-view.tsx:49](../src/components/views/guests-view.tsx#L49)).

**Wpływ:** pozorna wiedza o rynku i ryzyko uruchomienia kampanii na nieistniejącym sygnale.

**Naprawa:** usunąć hardcoded insighty, odróżnić „rezerwacje” od „kompletnych profili”, wprowadzić próg minimalnej próby i komunikat „brak wystarczających danych”.

#### A03. Błędne dane podczas hydratacji mogą zostać zapisane

Pierwszy render startuje na danych demo, następnie przechodzi przez pusty stan chmurowy i dopiero potem pobiera dane produkcyjne ([app-store.tsx:255](../src/components/layout/app-store.tsx#L255)). W testach widoki Finansów i Ustawień chwilowo pokazywały zera/tryb lokalny przed właściwymi danymi.

`SettingsView` inicjalizuje formularz tylko raz z `data.settings` i nie synchronizuje go po załadowaniu chmury ([settings-view.tsx:9](../src/components/views/settings-view.tsx#L9)). Kliknięcie „Zapisz” po twardym odświeżeniu może więc wysłać stare wartości z fazy demo/pustej.

**Wpływ:** utrata zaufania, błędne decyzje, możliwość niezamierzonego nadpisania konfiguracji.

**Naprawa:** globalna bramka `dataStatus: loading|ready|error`; nie renderować metryk i formularzy przed `ready`; formularze inicjalizować z wersji gotowych danych lub jawnie resetować po zmianie rekordu.

#### A04. Każda zmiana przepisuje cały stan i wywołuje konflikty

Po każdej zmianie klient po 700 ms wysyła cały `AppData` do `/api/state` ([app-store.tsx:307](../src/components/layout/app-store.tsx#L307)). RPC usuwa i ponownie wstawia każdy typ encji, a potem cały snapshot ([20260715152000_free_tier_security_hardening.sql:145](../supabase/migrations/20260715152000_free_tier_security_hardening.sql#L145)).

W logach Postgresa zaobserwowano serię konfliktów „Wersja danych uległa zmianie”; Vercel zanotował również pojedynczy PUT `/api/state` 500 w ostatnich 7 dniach. Otworzenie pulpitu może samo przygotować debrief i oznaczyć prompt, czyli wygenerować zapis bez jawnej akcji użytkownika ([dashboard-view.tsx:35](../src/components/views/dashboard-view.tsx#L35)).

**Wpływ:** problemy wielokartowe/wielourządzeniowe, kosztowne zapisy, rosnące ryzyko utraty zmian przy rozwoju danych.

**Naprawa:** endpointy/komendy per encja z wersją rekordu, atomowe aktualizacje i idempotencja; tymczasowo koordynacja kart przez `BroadcastChannel`, jawny stan konfliktu, telemetryka request/version i zakaz zapisu podczas hydratacji.

#### A05. Organizacja jest wybierana przez `limit(1)`

API oraz RPC biorą pierwsze członkostwo użytkownika bez identyfikatora organizacji przekazanego w sesji/żądaniu ([auth-context.ts:4](../src/lib/supabase/auth-context.ts#L4), [route.ts:19](../src/app/api/state/route.ts#L19)). RPC dodatkowo sortuje po dacie utworzenia.

**Wpływ:** po dodaniu drugiej organizacji użytkownik może odczytać lub zapisać nie ten tenant, którego oczekuje.

**Naprawa:** jawny `activeOrganizationId`, walidacja członkostwa przy każdym żądaniu i przełącznik organizacji albo twarda gwarancja modelu single-tenant.

#### A06. Bezpieczeństwo kont wymaga jeszcze domknięcia

Supabase Advisor wskazuje wyłączoną ochronę przed hasłami z wycieków. Funkcja provisioningowa nadaje każdemu nowemu użytkownikowi rolę owner w głównej organizacji; dziś ryzyko łagodzi `disable_signup: true`, ale przypadkowe włączenie signup otworzyłoby krytyczną ścieżkę eskalacji ([20260713140000_production_foundation.sql](../supabase/migrations/20260713140000_production_foundation.sql)).

**Naprawa:** włączyć leaked-password protection, usunąć automatyczne nadawanie owner, tworzyć członkostwo wyłącznie przez zaproszenie/admina, dodać test blokujący signup → owner.

#### A07. Implementacja rozeszła się z decyzjami strategicznymi

Plan zakładał najpierw spike Mobile-Calendar/Beds24, zamrożenie prototypu i model v2. Jednocześnie obecna aplikacja rozwinęła magazyn pełnego stanu i działa produkcyjnie, a 0/2 połączeń OTA jest aktywnych ([PLAN_RESTRUKTURYZACJI_STAWY_OS.md](./PLAN_RESTRUKTURYZACJI_STAWY_OS.md)).

**Wpływ:** koszt dalszego rozwijania architektury, którą plan przewiduje zastąpić; ryzyko podwójnego źródła prawdy i overbookingu przez iCal.

**Naprawa:** formalna decyzja: (a) obecny system zostaje pilotem/read-only do czasu wyboru gatewaya, albo (b) obecny model zostaje świadomie przyjęty i przebudowany inkrementalnie. Nie rozwijać dwóch sprzecznych ścieżek.

#### A08. Model ról nie realizuje założeń produktu

Plan wymaga osobnych ról: owner/admin, manager, sprzątanie, marketing, księgowość. Baza obsługuje tylko `owner/admin/viewer`, a UI jest ten sam dla każdego członka; panel sprzątania nie ma odseparowanego zakresu finansów i PII.

**Wpływ:** nie można bezpiecznie wdrożyć aplikacji całemu zespołowi zgodnie z zasadą najmniejszych uprawnień.

**Naprawa:** macierz uprawnień domenowych i testy RLS/UI dla każdej roli przed zaproszeniem personelu.

### P2 — następny etap jakości

#### A09. Finanse mieszają rezerwacje, księgę i koszty modelowane

- „Przychód brutto” sumuje aktywne rezerwacje według roku check-in, niezależnie od wpłaty i realizacji pobytu.
- Prowizja bierze ledger **albo** import (`commissionFromLedger || commissionFromImports`), nie pełne uzgodnienie.
- Karta prowizji może pokazywać 0, gdy koszt modelowany 20% jest równocześnie ujęty w kosztach operacyjnych.
- Obłożenie i RevPAR bieżącego roku dzielą przez pełne 365/366 dni, choć koszty stałe są liczone tylko do bieżącego miesiąca.
- Cały pobyt i przychód trafiają do miesiąca/roku check-in; pobyty przecinające okres nie są proporcjonowane.
- Miesięczny „wynik” jest obcinany do zera, co ukrywa stratne miesiące ([finances-view.tsx:20](../src/components/views/finances-view.tsx#L20)).

**Naprawa:** trzy oddzielne perspektywy: sprzedaż/rezerwacje, cashflow/ledger, rachunek zarządczy. Przy każdej metryce pokazywać okres oraz „faktyczne/modelowane”.

#### A10. Tożsamość i alerty są wpisane na stałe

Zalogowane konto testowe widzi „Dzień dobry, Marcin”, inicjały `MS`, „Panel właściciela” oraz alert „1 płatność”, mimo innego użytkownika i 43 spraw wymagających rozliczenia ([app-shell.tsx:29](../src/components/layout/app-shell.tsx#L29), [app-shell.tsx:131](../src/components/layout/app-shell.tsx#L131)).

**Naprawa:** pobierać profil i rolę z sesji, alerty budować wyłącznie z reguł/danych; zero hardcoded stanu operacyjnego.

#### A11. Lista rezerwacji nie skaluje się

W produkcji 194 rekordy są renderowane jednocześnie wraz z rozbudowanymi nazwami dostępnościowymi. Kod mapuje pełne `rows` bez paginacji/wirtualizacji ([bookings-view.tsx:75](../src/components/views/bookings-view.tsx#L75)).

**Naprawa:** paginacja lub wirtualizacja, filtrowanie serwerowe, domyślny zakres „aktywne/nadchodzące”, skrócone etykiety dla czytników ekranu.

#### A12. Modale i działania destrukcyjne są niespójne

Główny formularz rezerwacji ma `role=dialog`, `aria-modal`, Escape i pułapkę fokusu, ale nie blokuje przewijania tła. Inne formularze nie mają równoważnego zarządzania fokusem. Anulowanie rezerwacji i blokady korzysta z `window.confirm`, co utrudnia dostępność, opis skutków i testowanie ([bookings-view.tsx:138](../src/components/views/bookings-view.tsx#L138)).

**Naprawa:** jeden wspólny komponent Dialog/Confirm z blokadą scrolla, odzyskaniem fokusu, opisem skutków i testami klawiatury.

#### A13. API waliduje kształt techniczny, nie model biznesowy

`/api/state` przyjmuje `z.record<string, unknown>` do 5 MB ([route.ts:5](../src/app/api/state/route.ts#L5)). Identyfikatory i limity są sprawdzane w RPC, ale typy, daty, statusy, kwoty, telefon/e-mail i relacje encji nie mają pełnej walidacji serwerowej.

**Naprawa:** współdzielone schematy Zod per komenda/encja, walidacja invariantów i testy negatywne API.

#### A14. Pozostałe utwardzenie bazy

Supabase Advisor zgłasza:

- `users_profiles` z RLS, ale bez polityki — należy jawnie potwierdzić, czy tabela ma być całkowicie zamknięta;
- rozszerzenie `btree_gist` w schemacie `public`;
- wykonywalną przez authenticated funkcję `SECURITY DEFINER` — obecnie ma kontrolę roli wewnątrz, ale wymaga stałych testów regresji;
- brak indeksów na wybranych kluczach obcych;
- polityki RLS z `auth.uid()` bez initplan i nakładające się permissive policies.

Źródła remediacji: [RLS enabled, no policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [extension in public](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public), [authenticated SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

#### A15. Dalsze utwardzenie aplikacji

- CSP dopuszcza `unsafe-inline` dla skryptów i stylów; docelowo użyć nonce/hash, o ile pozwala na to konfiguracja Next.js.
- Walidacja iCal ogranicza SSRF, ale sprawdza DNS przed osobnym `fetch`; pozostaje teoretyczne okno DNS rebinding/TOCTOU. Ryzyko jest ograniczone do konfiguracji przez admina.
- Telefon SMS nie jest normalizowany do E.164, a szczegóły błędu dostawcy mogą trafić do UI/stanu.
- Etykieta „Pobierz backup JSON” jest myląca: pobierany jest zaszyfrowany plik `.stawyos`, nie zwykły JSON ([settings-view.tsx:25](../src/components/views/settings-view.tsx#L25)).

### P3 — polish i czytelność

- Odmiana liczb: „1 osób”, „1 rezerwacji”, „43 rezerwacji”.
- Część tekstów ma 9–11 px; na telefonie są czytelne wizualnie, ale nie powinny przenosić krytycznej informacji.
- Domyślna zakładka sprzątania może pokazać 0, gdy pulpit mówi o 59 otwartych zadaniach; potrzebny jest wyraźny podział kategorii.
- Mobilna agenda pokazuje tylko 7 dni, mimo nagłówka widoku 42 dni; warto ujawnić ten zakres w etykiecie.

## Jak poprawić rozumienie danych i wesprzeć wzrost

### 1. Zmienić pulpit z „dużych liczb” w pulpit decyzji

Każda karta powinna odpowiadać na cztery pytania: **co mierzymy, za jaki okres, z jakiego źródła i czy dane są kompletne**.

Proponowany układ:

- **Dzisiaj:** przyjazdy, wyjazdy, turnover, płatności wymagające działania, awarie synchronizacji;
- **Najbliższe 14 dni:** wolne noce, luki 1–2 noce, niepotwierdzone płatności, brakujące dane kontaktowe;
- **Wynik miesiąca:** wartość pobytów, zaksięgowane wpłaty, koszty faktyczne, koszty modelowane, różnica do planu;
- **Wzrost:** udział direct w pobytach z bieżącego okresu, lead time, ADR i konwersja według kanału, powroty gości, koszt prowizji możliwy do odzyskania;
- **Jakość danych:** licznik rekordów bez ceny, kontaktu, zgody, źródła odkrycia i uzgodnionej płatności.

### 2. Rozdzielić cztery znaczenia pieniędzy

1. wartość rezerwacji;
2. przychód zrealizowany według pobytów;
3. należności i saldo gościa;
4. cashflow z zaksięgowanych transakcji.

Nie używać słowa „potwierdzony”, jeśli potwierdzenie nie jest zapisane jako zdarzenie/ledger.

### 3. Zbudować minimalny lejek danych gościa

Dla każdej nowej rezerwacji zbierać lub jawnie oznaczać brak:

- kanał rezerwacji i źródło odkrycia;
- kampania/UTM lub polecenie;
- pierwszy kontakt/pytanie, segment i motywacja;
- zgoda z treścią, źródłem, datą i możliwością wycofania;
- NPS/feedback i możliwość publikacji cytatu;
- identyfikator powracającego gościa, bez duplikowania osób między rezerwacjami.

Insight wolno pokazać dopiero po spełnieniu progu próby, np. `n ≥ 20` oraz minimum 70% kompletności wymaganych pól.

### 4. Pokazać użytkownikowi „dlaczego”

Do każdego alertu i rekomendacji dodać:

- regułę lub obliczenie;
- rekordy będące podstawą;
- próbę i kompletność;
- proponowaną akcję i spodziewany efekt;
- możliwość odrzucenia/oznaczenia jako błędne.

## Wyniki bramek technicznych

| Test | Wynik |
|---|---|
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS — 10 plików, 43 testy |
| `npm run build` | PASS — 26 stron/tras wygenerowanych |
| `npm audit --omit=dev` | PASS — 0 podatności |
| Logowanie produkcyjne | PASS |
| API bez sesji | PASS — brak dostępu do stanu |
| Mobilny dashboard/kalendarz 390 px | PASS — brak poziomego overflow |
| Nowa rezerwacja lokalna | PASS |
| Konflikt rezerwacji | PASS |
| Automatyczne zadania | PASS — 5 zadań |
| Zmiana statusu | PASS |
| Księgowanie wpłaty | PASS |
| Anulowanie | Funkcja dostępna; UX `window.confirm` wymaga wymiany |

## Kryterium go-live

Pełne przełączenie jest bezpieczne dopiero, gdy:

1. wszystkie P1 mają testy akceptacyjne i są zamknięte;
2. metryki finansowe są formalnie zatwierdzone przez właściciela/księgowość;
3. jeden gateway OTA przejdzie próbę: nowa rezerwacja, zmiana, anulowanie, blokada, cena, płatność i opóźnienie synchronizacji;
4. nastąpi uzgodnienie 100% aktywnych rezerwacji i blokad z obecnym systemem;
5. dwie równoczesne sesje przejdą test zapisu bez utraty zmian;
6. role zespołu mają potwierdzone ograniczenia danych i funkcji;
7. istnieje sprawdzony backup, procedura odtworzenia i plan rollbacku.

Szczegółową kolejność realizacji zawiera [Plan wdrożenia poprawek](./PLAN_WDROZENIA_POPRAWEK_2026-07-15.md).
