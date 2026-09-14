# Stawy OS — status realizacji, 14 września 2026

Aktualna roadmapa: `../outputs/audyt_2026-09-07/PLAN_DALSZYCH_PRAC.md`, audyt z 7 września i raporty wdrożenia z 9 września. Sierpniowy master plan jest historią decyzji.

Checkout: `stawy-app-father-booking-fix`, gałąź `agent/audit-stage2-operator-finance-contract`, commit bazowy `e0a78ff6d823b183eacf6e199e0224adee0d6c29`. Wszystkie opisane niżej nowe zmiany pozostają lokalne; bez pushu, wdrożenia, migracji produkcji i dostaw do gości.

## Pakiety

| Pakiet | Stan | Wykonane / pozostały warunek |
|---|---|---|
| 0 — środowisko | Otwarty | Ustalony checkout, Node 24, CLI Supabase, zabezpieczony skrypt integracyjny. Potrzebna izolowana baza. |
| 1 — kreator rezerwacji | Wdrożony 9 września | Raport w `../outputs/etap1_2026-09-09/RAPORT_WDROZENIA.md`. |
| 2 — kontrakt finansowy operatora | Wdrożony 9 września | Raport w `../outputs/etap2_2026-09-09/RAPORT_WDROZENIA.md`. |
| 3 — kompletny i aktualny stan | Kod lokalny gotowy do odbioru | Stronicowanie, stabilna rewizja/liczebność, odświeżanie aktywnej aplikacji, ochrona przed spóźnionym odczytem, ostrzeżenie przeterminowanego feedu. Pozostał odbiór na izolowanej bazie i dwóch urządzeniach. |
| 4 — zapisy i sprzątanie | Częściowo wykonany | Potwierdzenia zapisów, zachowanie formularzy, rollback odrzuconych zadań/checklisty, transakcyjna usterka+blokada, przypisanie zadania do konta. Pozostał przegląd reszty formularzy i pełna ścieżka ról. |
| 5 — uzgodnienie danych | Pierwsza kontrola wykonana | Importy i powiązane kwoty zgodne w bazie. Trzy historyczne braki ceny, jedna niepowiązana korekta, 32 pozycje do przeglądu. Potrzebne niezależne źródła OTA/bankowe. |
| 6 — komunikacja | Częściowo wykonany | Świeży preflight i fingerprint, limity retry, ochrona późnych webhooków, izolacja/przejęcie SMS, potwierdzenie dostawcy, zachowanie historii. Pozostała atomowość bazy, terminalne kolejki i rzeczywisty odbiór dostaw. |
| 7 — backup i retencja | Częściowo wykonany | Uczciwe archiwum po 30 dniach, odszyfrowanie i kontrola integralności kopii lokalnie. Potrzebne odtworzenie całej bazy, kont i uprawnień na osobnym środowisku. |
| 8 — uproszczenie UI | Poprawki lokalne przygotowane | Usunięte mylące procenty i dema, schowany rejestr zgód, archiwum szablonów, spójne metryki, czytelniejsze zadania i usterki, lista kont i własny profil. Pozostał pełny odbiór mobilny i dostępów. |
| 9 — higiena i refaktoryzacja | Kontrole lokalne i CI przygotowane | ESLint działa na Node 24, audyt zależności czysty, workflow jakości gotowy. Refaktoryzacja dużych modułów i wykonanie CI na GitHubie pozostają otwarte. |
| 10 — rozszerzenia | Odłożony zgodnie z zakresem | OTA/CRM/AI/marketing nie są warunkiem ukończenia obecnego rdzenia. |

## Ostatnia pełna kontrola

**599/599 testów w 122 plikach, TypeScript i produkcyjny build zakończone poprawnie. ESLint: 0 błędów i 2 ostrzeżenia. Audyt npm: 0 podatności. `git diff --check`: poprawny.** Kontrole wykonane na Node 24.19.0. Pełne testy integracyjne Supabase, dostawy oraz odbiór przeglądarkowy nie są zaliczone.

## Dowody i bezpieczeństwo testów

- Odczyt Supabase: 1603 rekordy przy limitach strony 500 i 200, awaria kolejnej strony, zmiana rewizji i ograniczenie powtórzeń; testy używają rzeczywistego klienta SDK z kontrolowanym HTTP.
- Provider stanu: odświeżenie, powrót sieci, brak nadpisania nowszego zapisu, zachowanie danych przy awarii i rollback jednoznacznie odrzuconej mutacji.
- Kontrola rzeczywistej bazy wyłącznie do odczytu: 998 rekordów operacyjnych, w tym 207 rezerwacji. Nie zmieniono limitów, planu ani danych. Limit pojedynczej odpowiedzi Data API jest obsłużony stronicowaniem.
- HTTP lokalnego serwera: `/login` 200, `/api/state` bez sesji 307. To nie zastępuje odbioru zalogowanego operatora. Przeglądarka wcześniej zwróciła `net::ERR_BLOCKED_BY_CLIENT`; odbiór wizualny pozostaje niezaliczony.
- `.env.local` odtworzono z istniejącego checkoutu, wyłącznie wymagane klucze Supabase, plik ignorowany przez Git i dostęp 0600. Wskazuje produkcję; nie używa go skrypt integracyjny.
- Skrypt integracyjny korzysta z `.env.integration.local`, blokuje znany projekt produkcyjny przed połączeniem, wymaga jawnego identyfikatora zdalnego projektu testowego. Przygotowano ponad 1500 syntetycznych rekordów i odczyt tym samym helperem co API. Pełny test nie został jeszcze uruchomiony.
- Ostatni audyt npm: 0 podatności. ESLint: 0 błędów, 2 istniejące ostrzeżenia nawigacji przy wylogowaniu. Node 24 zapisany w `.nvmrc` i używany przez CI.

## Środowisko do odbioru

Użytkownik potwierdził, że nie ma projektu testowego. Lokalnie brak silnika kontenerów, a dysk ma około 6 GiB wolnego miejsca. Zlecił sprawdzenie możliwości i kosztu projektu testowego w Supabase. Połączenie pokazuje jedną organizację `Stawy u Sikory` (`atcsjodbmciafhxodqmw`) i jeden aktywny projekt. Narzędzie wyceny wymaga potwierdzenia organizacji; pytanie zostało przekazane użytkownikowi. Nie utworzono zasobu ani nie zaakceptowano kosztu.

## Raporty szczegółowe

- [Pakiet 4](PAKIET4_ZAPISY_I_SPRZATANIE_2026-09-14.md)
- [Pakiet 5](PAKIET5_UZGODNIENIE_DANYCH_2026-09-14.md)
- [Pakiet 6](PAKIET6_KOMUNIKACJA_2026-09-14.md)
- [Pakiet 7](PAKIET7_BACKUP_I_ARCHIWUM_2026-09-14.md)
- [Pakiety 8–9](PAKIET8_9_INTERFEJS_I_KONTROLE_2026-09-14.md)

Nie oznaczono wszystkich pakietów jako ukończonych. Test jednostkowy, kontrola pliku backupu i udany build nie zastępują odtworzenia bazy, odbioru ról ani niezależnego uzgodnienia finansów.

## Kontynuacja bez lokalnej bazy

Brak izolowanego Supabase nie blokuje kolejnych poprawek kodu. Po sprawdzeniu 9,5 GiB wolnego miejsca kontynuowano bez instalowania kontenerów i tworzenia płatnego projektu. Naprawiono zachowanie treści notatki po błędzie oraz ponowienie tego samego identyfikatora rekordu. Zmiana statusu opinii pokazuje wynik zapisu. Kontrola: 601/601 testów w 123 plikach oraz TypeScript i ESLint (0 błędów, 2 dotychczasowe ostrzeżenia). Ostatni build pochodzi z poprzedniej pełnej pętli. Odtworzenie bazy i rzeczywisty test uprawnień pozostają otwarte.

## Zdalne środowisko testowe — uruchomione

Utworzono projekt Supabase `stawy-os-test` (`pzsvfhchjvxavhlgwphw`, eu-west-1) w organizacji Stawy u Sikory po wycenie 0 miesięcznie i potwierdzeniu przez narzędzie kosztów. Status ACTIVE_HEALTHY. Zastosowano kolejno wszystkie 44 istniejące migracje z repozytorium. Kontrola SQL potwierdziła 37 tabel publicznych, wszystkie z RLS, 0 użytkowników i 0 rekordów operacyjnych przed testem. Transakcyjny test z syntetycznym użytkownikiem i dwiema organizacjami potwierdził widoczność tylko własnej organizacji, uprawnienie właściciela do zapisu i brak uprawnień do obcej organizacji. Fixtures wycofano przez ROLLBACK. Nie jest to pełny test HTTP/Auth ani odtworzenie backupu danych.

Advisors: informacja o braku polityki dla zamkniętego app_release_manifest oraz dwa ostrzeżenia dla celowo uprzywilejowanych RPC create_operational_booking i mutate_operational_booking; wymagają dalszego odbioru autoryzacji, bez automatycznej zmiany modelu uprawnień. Dokumentacja: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

Najnowszy build aplikacji, obejmujący 601-testowy stan, przeszedł (`/tmp/stawy-online-build.log`). Wdrożenia jeszcze nie wykonano: połączenie Vercel pokazuje zespół, ale brak projektów; odczyt istniejącego projektu zwraca 404, lista wdrożeń 403, a alternatywny odczyt API przez zapisaną sesję CLI również 403. Poproszono o ponowne połączenie konta z dostępem do stawyusikory. Następnie: klucze wyłącznie nowej bazy dla podglądu, pełny skrypt integracyjny, konta testowe i odbiór online. Produkcja pozostaje bez zmian.

## Podgląd online — wdrożony 14 września

Po ponownej autoryzacji CLI Vercel i jawnej zgodzie użytkownika na użycie istniejącej bazy wdrożono bieżący checkout jako Preview: https://stawyusikory-ejj7tdbx5-stawy-u-sikory.vercel.app (dpl_FAsFQJSNVXEsJUevPGMXP8B76aPE). Status READY, build zdalny i TypeScript zakończone poprawnie, npm audit w buildzie: 0 podatności. Domena produkcyjna nie została przełączona. Podgląd używa istniejących zmiennych Preview; nie jest odizolowany od danych operacyjnych.

Kontrola przeglądarkowa potwierdziła poprawny ekran logowania Stawy OS. GET /api/state bez sesji zwraca 307. Nie wykonywano zapisów ani testów destrukcyjnych. Odbiór po zalogowaniu pozostaje otwarty. Użytkownik zalogował również panel Supabase; baza testowa nie jest jeszcze podłączona do tego wdrożenia. Z paczki wdrożenia wykluczono pliki .env, lokalne zrzuty ekranu i dokumentację roboczą przez .vercelignore.

## Odbiór online konta właściciela — odczyt

Na wdrożeniu ejj7tdbx5 po zalogowaniu użytkownika sprawdzono dashboard, listę rezerwacji z panelem szczegółów, kalendarz, ustawienia, finanse i zadania. Ekrany renderują dane; lista kont i odczyt własnego profilu działają, profil potwierdza rolę Właściciel. Nie zapisywano zmian i nie wysyłano komunikacji. Nie jest to odbiór mobilny, test zapisów ani test ograniczeń pozostałych ról.

Wykryte niespójności: dashboard pokazuje jakość 100% obok 7 brakujących pól (kod zaokrągla średnią wyników), a ręczny wpis o nazwie remont i statusie Nowa jest prezentowany jako pobyt na miejscu na podstawie dat; finanse wykluczają go z aktywnej sprzedaży. Nie zmieniano klasyfikacji tego wpisu na podstawie samej nazwy. Wymagany przegląd spójności definicji aktywnego pobytu.

## Poprawka po odbiorze właściciela

Użytkownik wyjaśnił, że wpis remont jest zastępczym oznaczeniem niedostępności, a nie pobytem gościa. W modelu blokad istnieje już typ Remont (calendar-block-command.ts). Konwersja ma dotyczyć wyłącznie wskazanego rekordu SUS-cb269ff8-961d-4c6e-a5fa-cebb478c633f, zachować domek i terminy oraz historię, usunąć fałszywe należności i zadania pobytu; nie wykonywano jeszcze zmiany danych. Istniejący RPC tworzenia blokady sprawdza konflikt z rezerwacją, więc sekwencja anuluj/dodaj nie zapewnia atomowości. Przed zmianą potrzebna jest transakcja z blokadą dostępności i kontrolą wersji albo dedykowana komenda konwersji.

Lokalnie poprawiono zaokrąglanie dashboardMetrics.dataQuality w dół, aby 100% nie pojawiało się przy wykrytych brakach. Test regresji z 200 rezerwacjami i jednym brakiem oraz z kompletnymi danymi przeszedł (14 testów rules.test.ts). Poprawka nie jest jeszcze wdrożona na podgląd ejj7tdbx5. Poproszono użytkownika o konto managera do kolejnego odbioru uprawnień.

## Odbiór managera — 14 września

Zalogowane konto marcin na Preview ejj7tdbx5: menu ograniczone do kalendarza i rezerwacji. Brak eksportu, kosza, dodawania blokad, przeglądu roku i zakładek płatności/wiadomości w szczegółach. Kreator rezerwacji otwiera się; wskazuje konflikt terminu z istniejącym wpisem remont. Formularz zamknięto bez zapisu. Bezpośrednie wejścia /settings i /finances przekierowują do /calendar. Bezpośrednie otwarcie /api/admin/members zostało zablokowane przez narzędzie przeglądarkowe (ERR_BLOCKED_BY_CLIENT), więc nie zaliczono tego jako potwierdzenia odpowiedzi 403 API. Nie testowano zapisu, edycji ani anulowania prawdziwej rezerwacji. Następny odbiór: konto sprzątania oraz testy mutacji w izolowanym środowisku.

## Odbiór konta sprzątania — odczyt

Po autoryzowanej zmianie hasła istniejącego konta demonstracyjnego (rola cleaning bez zmian) użytkownik zalogował się jako Jadzia na podgląd ejj7tdbx5. Ekran pokazuje wyłącznie plan przygotowania domków; brak nazwisk gości, cen i menu pozostałych modułów. Bezpośrednie /settings, /bookings i /finances nadal renderują panel sprzątania pod wpisanym adresem (nie przekierowują URL). To kontrola widocznego interfejsu, nie dowód filtracji wszystkich odpowiedzi API. Checklista przed przyjęciem i rozpoczęciem pracy jest wyłączona. Zakładka Gotowe pokazuje prawidłowy komunikat Brak ukończonych zadań. 11 otwartych zadań, w tym zaległe z sierpnia; nie zamykano ich automatycznie. Nie wykonano zapisów, przyjęcia zadania ani zgłoszenia usterki.

## Kolejna pętla — pełny plan sprzątania

GET /api/cleaning korzysta teraz z readOperationalState: pełne stronicowanie, kontrola liczebności i rewizji przed/po odczycie. W razie niekompletnego odczytu zwraca 503 zamiast pozornie poprawnego, uciętego planu. Odpowiedź nadal powstaje przez buildCleaningDashboard; surowe rekordy nie są zwracane klientowi. Dodano testy ograniczenia roli, bezpiecznego błędu i niewypuszczania danych kontaktowych. Pełna kontrola: 605/605 testów w 123 plikach, TypeScript poprawny.

Odczyt Data API z zalogowanym kontem cleaning potwierdził brak widocznych rekordów w operational_records, bookings, contacts_consents i invoice_records. Weryfikacja używała wyłącznie zapytań HEAD/count, bez pobierania treści rekordów i bez mutacji. Nie zastępuje to testów PATCH ani wszystkich kombinacji polityk.

Poprawki opublikowano jako Preview https://stawyusikory-2fk2zvckp-stawy-u-sikory.vercel.app — dpl_Hrpo9mEQe5U8er3hxWZhs5ndqcBM, READY. Build Vercel poprawny, lint zmienionych plików bez błędów. Wdrożenie korzysta z wcześniej zatwierdzonej konfiguracji Preview z istniejącą bazą. Domena produkcyjna bez zmian.

## Test transakcji sprzątania — zaliczony na osobnej bazie

Na projekcie testowym pzsvfhchjvxavhlgwphw wykonano tests/integration/cleaning-workflow.sql. Scenariusz przeszedł: odmowa rozpoczęcia przed przyjęciem, przyjęcie z planowaną godziną, start, odmowa zakończenia niepełnej checklisty, zaznaczenie punktu, zakończenie z readinessEvidence i readyAt, zgłoszenie usterki Woda z blokadą zadania, odmowa działania w obcej organizacji, dokładnie pięć wpisów audytu udanych operacji. Całość w transakcji zakończonej ROLLBACK, bez zmian produkcyjnych.

Jest to integracyjny test funkcji bazowej, wywołanej przez administracyjne połączenie SQL z jawnym aktorem. Nie zalicza pełnej ścieżki przeglądarka → HTTP PATCH → baza ani równoległych zapisów. Testy jednostkowe API i interfejsu pozostają osobnymi dowodami.

## Partia: korekta remontu i kolejka komunikacji

W produkcji wykonano jedną potwierdzoną przez użytkownika konwersję: SUS-cb269ff8-961d-4c6e-a5fa-cebb478c633f → BLOCK-REMONT-SUS-cb269ff8-961d-4c6e-a5fa-cebb478c633f, domek-4, 9–16 września 2026, typ Remont, status Aktywna. Operacja transakcyjna, z blokadą dostępności, kontrolą wersji 1 oraz braku wpłat/wysyłek. Pierwotny wpis anulowany i przeniesiony do kosza, oryginalne rekordy oraz robocze wiadomości zapisane w audycie. Zadania płatności, przygotowania pobytu i opinii oznaczono Nie dotyczy; sprzątanie zachowano jako osobne Sprzątanie po remoncie z dotychczasową checklistą i terminem. Wszystkie robocze wiadomości anulowane. Weryfikacja po COMMIT: jedna aktywna blokada, oryginał Anulowana, zero otwartych zadań powiązanych z fikcyjnym pobytem, zero nieanulowanych wiadomości, jeden audyt konwersji.

Skrypt scripts/maintenance/convert-confirmed-remont.sql jest jednorazową korektą konkretnego wpisu; ponowne uruchomienie jest blokowane. Test tests/integration/remont-conversion.sql odtwarza konwersję na izolowanym projekcie i kończy ROLLBACK. Przed właściwą zmianą wykonano również próbę na rzeczywistym wpisie z ROLLBACK. Nie jest to ogólny interfejs konwersji rezerwacji.

Kolejka SMS: nowy readSmsQueue przechodzi przez kolejne strony do zebrania partii kwalifikujących się wiadomości, więc terminalne błędy na początku nie blokują nowszych. Test SDK z limitem serwera niższym od żądanej strony obejmuje 40 terminalnych błędów przed 5 wysyłalnymi rekordami i awarię kolejnej strony. Przejęcie wiadomości dodatkowo porównuje poprzedni next_attempt_at. Nie wysłano SMS-ów. Atomowość webhooków i analogiczny problem selekcji e-mail pozostają do rozwiązania.

Aktualne lokalne kontrole: 607/607 testów w 124 plikach, TypeScript poprawny, lint zmienionych plików poprawny.
