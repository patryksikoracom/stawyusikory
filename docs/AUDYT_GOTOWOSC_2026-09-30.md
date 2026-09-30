# Stawy OS — audyt gotowości, 30 września 2026

Pakiet kodu przeszedł testy, ale automatyczne wiadomości nie są jeszcze uruchomione na produkcji. PR #43 został wdrożony na produkcji (448fe1e). Nie uznajemy całej aplikacji za gotową przed testem rzeczywistej kolejki i uruchomieniem harmonogramu.

## Uzgodniony zakres

Patryk zwykle potwierdza sprzątanie na miejscu; tata również może je potwierdzić. Tata oznacza zapłatę Jadzi, także zbiorczo za kilka wcześniejszych sprzątań. Kwota dla Jadzi jest odrębna od opłaty pobieranej od gościa. Operator otrzymuje prosty ekran, właściciel zachowuje szczegółowy widok zadań.

## Wykonany pakiet

| Obszar | Zmiana | Walidacja |
|---|---|---|
| Sprzątanie | Potwierdzenie wykonania, kwota, suma zaległości, wybór kilku pozycji, zapłata, cofnięcie zapłaty | Przeglądarka: 150 + 180 = 330 zł, zbiorcza zapłata i odświeżenie |
| Uprawnienia | Operator może zmieniać tylko wykonanie i rozliczenie sprzątania; ograniczone RPC, kontrola organizacji i wersji | Testy API i transakcja na osobnej bazie |
| Pełne dane | Stronicowanie stanu organizacji z kontrolą kompletności i wersji | Testy limitów odpowiedzi i zmiany stanu w trakcie odczytu |
| Harmonogram maili | Czas Europe/Warsaw; obsługa późnej rezerwacji; wygaszanie nieaktualnych wiadomości | Testy reguł i terminów |
| Kolejka wysyłki | Ponowna kontrola rezerwacji, kontaktu, ceny, zgody i treści przed próbą; odczyt wszystkich stron kolejki; blokada równoległego przejęcia | Testy procesora i weryfikacji treści |
| Ponowienia | Limit prób, blokada terminalnych błędów, zakończenie niepewnych prób przed wygaśnięciem deduplikacji dostawcy | Testy procesora |
| Dostarczenie | Atomowy webhook i zakończenie wysyłki; brak cofania „dostarczono” lub odbicia przez spóźniony zapis; ponowienie zbyt wczesnego webhooka | Testy API i rzeczywiste SQL |
| Harmonogram zewnętrzny | Krok maili wykonywany także po błędzie iCal; ograniczenia czasu żądań | Przegląd workflow |
| Zależności | Poprawki brace-expansion i undici z zachowaniem głównych wersji | npm audit: 0 podatności |

## Reguły dla późnych rezerwacji

- Potwierdzenie rezerwacji jest gotowe do wysyłki po zapisaniu kompletnej rezerwacji, również po południu.
- Informacje przed przyjazdem: standardowo pięć dni wcześniej, a przy późniejszej rezerwacji od dnia jej utworzenia.
- Wiadomość „jutro przyjazd” nie wychodzi w dniu przyjazdu ani później.
- Instrukcja „jutro wyjazd” nie wychodzi w dniu wyjazdu ani później.
- Potwierdzenie nowej rezerwacji i informacje przed przyjazdem nie wychodzą po dniu przyjazdu.
- Podziękowanie ma ograniczone okno opóźnienia; nie tworzymy zaległej wysyłki dla dawnych pobytów.
- Anulowanie, usunięcie lub istotna zmiana rezerwacji blokuje wysłanie starej treści.
- Brak języka, kontaktu, szablonu lub wymaganej zmiennej blokuje wysyłkę. Marketing nadal wymaga odpowiedniej zgody.

## Wyniki testów

- 114 plików testowych, 571 testów: PASS.
- Produkcyjny build Next.js wraz z TypeScript i sprawdzeniem manifestu: PASS.
- ESLint: 0 błędów; 2 istniejące ostrzeżenia nawigacji przez window.location.
- npm audit po instalacji poprawionego package-lock.json: 0 podatności.
- `tests/integration/operator-cleaning.sql`: wykonanie, późniejsza płatność, cofnięcie, konflikt wersji, blokada zmiany zapłaconej kwoty, role, izolacja organizacji i audyt: PASS na dedykowanej bazie testowej. Dane testowe wycofane przez ROLLBACK.
- `tests/integration/email-completion.sql`: zapis wysłania, dostarczenie, odbicie, spóźniony zapis i kontrola roli usługi: PASS na dedykowanej bazie testowej. ROLLBACK.
- Test Resend z zatwierdzonych adresów: wiadomość `01a0f292-85d6-7664-9e26-3b199f7b890c` ma status **delivered**. Webhooki sent/delivered mają status success. To potwierdza dostawcę i odbiór HTTP przez obecny endpoint, nie pełną ścieżkę nowej kolejki aplikacji.

## Fakty z produkcji i blokady uruchomienia

1. Resend: domena zweryfikowana, wysyłka dostępna, webhook skonfigurowany.
2. Najnowszy sprawdzony GitHub Actions run `36687178832` zakończył się sukcesem, lecz krok „Process queued e-mails” był **skipped**. Zielony workflow nie oznacza działających maili.
3. Produkcja ma stare reguły w trybie roboczym oraz brak rekordu communicationConfigs. Potrzebne są numer konta do zaliczek i aktualne materiały dojazdu. Pytania przekazano właścicielowi; nie uzupełniamy ich fikcyjnymi danymi.
4. Dostęp do Vercel odzyskano przez zalogowaną przeglądarkę. Podgląd PR #43 ma status Ready. W produkcji potwierdzono obecność klucza Resend, webhooka, danych Supabase i konfiguracji nadawcy.
5. Po testach zastosowano obie nowe migracje do produkcji. Numery plików odpowiadają wersjom nadanym przez historię migracji Supabase. Nie zmieniono danych rezerwacji ani rozliczeń.

## Kolejność zakończenia wdrożenia

1. Przywrócić dostęp Vercel do istniejącego projektu; sprawdzić aktualny commit, środowisko oraz podłączoną bazę. Nie tworzyć drugiego projektu produkcyjnego.
2. Przy wyłączonej wysyłce zastosować nowe migracje: `20260930142414_operator_cleaning_settlement.sql`, następnie `20260930142421_atomic_email_send_completion.sql`. Pliki migracji z 14 września odzwierciedlają już wdrożone zmiany — nie uruchamiać ich ponownie bez porównania historii.
3. Wdrożyć kod i wykonać smoke test kont właściciela i operatora: dwie pozycje sprzątania, zapis z obu kont, zbiorcza zapłata, odświeżenie, konflikt na dwóch urządzeniach.
4. Uzupełnić konto i przewodniki PL/EN/DE, sprawdzić aktualne szablony i migrację definicji reguł. Przejrzeć kolejkę: stare szkice nie mogą stać się masową zaległą wysyłką.
5. Sprawdzić serwerowe RESEND_API_KEY, RESEND_FROM_EMAIL, RESEND_WEBHOOK_SECRET, CRON_SECRET i STAWY_OS_EMAIL_ENABLED oraz odpowiadające ustawienia harmonogramu GitHub. Sekretów nie umieszczać w repozytorium ani raporcie.
6. Przeprowadzić próbę przez rzeczywistą kolejkę na kontrolnej rezerwacji i zatwierdzonym adresie testowym: normalny termin, rezerwacja na dziś, anulowanie, zmiana kontaktu, ponowne wywołanie cron, webhook delivered. Potwierdzić pojedynczą wiadomość i status w aplikacji.
7. Włączyć wysyłkę i wykonać rzeczywisty przebieg harmonogramu. Potwierdzić brak błędów oraz działanie kolejnego zaplanowanego przebiegu. Dopiero wtedy zamknąć cel jako gotowy.

## Obsługa wyjątków

Niepewna wysyłka po upływie 23 godzin przechodzi do błędu wymagającego sprawdzenia historii Resend. Nie zerować prób ani klucza deduplikacji bez sprawdzenia, czy wiadomość już doszła. Nieoznaczona kwota za sprzątanie jest pokazywana osobno i nie jest traktowana jako 0 zł.

## Weryfikacja po wdrożeniu, 16:59 CEST

- Na koncie właściciela w produkcji potwierdzono zapis kwoty 1,23 zł, oznaczenie zapłaty, cofnięcie i trwałość po odświeżeniu. Osobną pozycję testową usunięto; rzeczywistych należności nie zmieniono.
- Próba zapisu komunikacji ujawniła błąd 23514: historyczne ograniczenie tabeli nie dopuszczało nowych kolekcji, mimo ich obsługi w komendzie batchowej. Migracja `20260930145818_extend_supported_operational_collections.sql` rozszerza ograniczenie, zachowując wcześniejsze typy. Test autoryzowanego zapisu konfiguracji na bazie testowej: PASS, ROLLBACK. Migracja zastosowana na produkcji; zapis przez UI potwierdzony w bazie.
- Właściciel potwierdził obecny przewodnik i polecił na razie użyć wypełniacza konta. Zapisano jasną informację „Numer konta do wpłaty Marcin przekaże bezpośrednio.”, bez fikcyjnego numeru rachunku.
- Naprawiono niespójność wersji reguł: klient aktualizował historyczne definicje w pamięci, a serwer wysyłki czytał stare wersje. Oba korzystają teraz z tej samej funkcji normalizacji, zachowującej wyłączenia reguł. Test odtwarzający stare dane produkcyjne: PASS; łącznie 32 testy obszaru zmiany, TypeScript i ESLint: PASS.
- Nadal do potwierdzenia: rzeczywista kolejka, zgoda na kopię testów do Marcina oraz aktywny harmonogram GitHub. Nie włączono masowej wysyłki.

## Stan po PR #44 i kontroli harmonogramu

- PR #44 scalony; produkcyjny commit `0ad094f001cb9c7e08e99dfa726817330c2c4088` ma potwierdzony sukces Vercel. Pełny zestaw: 114 plików, 572 testy PASS; build PASS.
- Konfiguracja produkcyjna zawiera sześć zatwierdzonych instrukcji dojazdu (dwa domki, PL/EN/DE). Zapis oraz odczyt po odświeżeniu potwierdzone.
- Oryginalny wzorzec Mobile Calendar wskazuje odbiorcę „Treedent Marcin Sikora” i zmienną `{bank_acc_nr}`. Cyfr rachunku nie ma w lokalnej kopii; odczyt ustawień wymaga zalogowania do Mobile Calendar. Tymczasowy tekst pozostaje zgodnie z dyspozycją właściciela.
- Dostęp do GitHub został potwierdzony. Cztery zatwierdzone zaległe maile sprawdzono bieżącą funkcją preflight na odczycie danych produkcyjnych: wszystkie odrzucone przed wysyłką.
- Przełącznik kroku mailowego GitHub został chwilowo włączony podczas przygotowania próby. Automatyczna kontrola uprawnień odrzuciła ręczne uruchomienie produkcyjnego workflow; wskazała potrzebę zgody obejmującej rzeczywistych gości. Przełącznik przywrócono do `false`, zapis potwierdzono w UI. Odczyt kolejki nadawczej po cofnięciu: 0 maili.
- Oczekujemy na odpowiedź właściciela dotyczącą produkcyjnego harmonogramu i testów z kopią do Marcina. Nie ponawiać odrzuconego uruchomienia bez nowej zgody. Nie uznawać celu za ukończony przed rzeczywistym testem kolejki i dostarczenia.

## Czysty start i autoryzowany test, 17:34 CEST

- Właściciel potwierdził adres testowy i kopię do Marcina oraz polecił zamknąć obowiązki historycznych pobytów.
- Na produkcji oznaczono 208 pobytów zakończonych przed 30.09.2026 jako historię; anulowano 85 niewysłanych wiadomości w obu reprezentacjach kolejki i wyłączono 45 otwartych obowiązków pobytowych. Naprawy oraz rzeczywiste płatności zachowano. Operacja atomowa, zwiększone wersje rekordów i stanu, wpis audytowy; prywatna kopia przed zmianą poza repozytorium.
- Kontrola SQL po zmianie: 0 historycznych wiadomości oczekujących, 0 otwartych historycznych obowiązków pobytowych, 0 zatwierdzonych maili i 0 maili w kolejce nadawczej.
- Numer konta potwierdzono w danych konta Mobile Calendar i faktycznie wysłanym potwierdzeniu; suma kontrolna NRB poprawna. Zapis konfiguracji produkcyjnej: wersja 8. Numeru rachunku nie publikujemy w raporcie.
- Test przez endpoint aplikacji zwrócił ID `01a0f2f0-5127-76f7-af17-c4df2af78f51`; Resend potwierdza delivered, właściwego nadawcę, odbiorcę oraz CC i Reply-To do Marcina. Endpoint deduplikuje test w obrębie dnia; jest to potwierdzenie integracji, nadal nie pełnego przebiegu kolejki rezerwacji.
- Dodatkowe zabezpieczenia kodu: historia nie tworzy zadań, nie zgłasza braków danych, nie podnosi alertów, nie trafia do listy finansów do działania i jest odrzucana bezpośrednio przed wysyłką.

## Widok wiadomości i uruchomienie harmonogramu

- PR #45 wdrożony: dodatkowe zabezpieczenie historii w serwerze i interfejsie.
- Nowy ekran `/messages`: lista rozmów z wyszukiwaniem, filtr kanału, historia i kolejka, zatwierdzanie i anulowanie niewysłanych wiadomości. Historia jest domyślnie ukryta, a odpowiedzi kierowane na dotychczasową skrzynkę Marcina.
- Osobny widok szablonów, wzorowany na Mobile Calendar: tabela, język i status, panel zmiennych, temat, treść, podgląd dla rezerwacji. Edycje korzystają z wersjonowanej konfiguracji i są jednakowo odczytywane przez klienta i serwer. Oryginały MC pozostają wyłączonym materiałem źródłowym.
- Testy chronią błąd zapisu, nieznane zmienne, odczyt bez prawa edycji, wersję konfiguracji i blokadę nieaktualnej treści kolejki. 116 plików / 581 testów PASS. Podgląd przeglądarkowy listy, wyszukiwania i szablonu: PASS.
- Test rezerwacji na 30.09.2026 utworzony przez UI; kolejka zawiera potwierdzenie i instrukcję przyjazdu na zatwierdzony adres. Spóźnione przypomnienie o jutrzejszym przyjeździe jest zablokowane.
- GitHub krok e-mail włączony; ręczny run 36738740560 przeszedł synchronizację iCal, lecz wysyłka zwróciła 423. Po otwarciu edytora przez właściciela zapisano `STAWY_OS_EMAIL_ENABLED=true` w Production Vercel. Nowe wdrożenie musi pobrać tę wartość; nadal wymagane potwierdzenie rzeczywistego wysłania i dostarczenia kolejki.
