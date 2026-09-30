# Stawy OS — audyt gotowości, 30 września 2026

Pakiet wdrożony na produkcji przez PR #43–#46. Wysyłka jest włączona w Vercel i GitHub. Rzeczywisty test rezerwacji na dzień przyjazdu zakończył się dostarczeniem obu właściwych wiadomości i zapisaniem potwierdzeń w aplikacji. Pozostaje ograniczenie operacyjne: nie zaobserwowano jeszcze kolejnego samoczynnego przebiegu GitHub po włączeniu maili; deklarowany interwał 15 minut nie jest gwarancją czasu wysyłki.

## Wdrożony zakres

| Obszar | Wynik |
|---|---|
| Sprzątanie | Patryk i tata mogą potwierdzić wykonanie. Kwota należna Jadzi jest oddzielona od opłaty gościa. Tata może zaznaczyć kilka sprzątań i rozliczyć je razem; dostępne cofnięcie zapłaty. Brak kwoty jest widoczny osobno. |
| Prosty widok taty | Ograniczona nawigacja i uprawnienia operatora; szczegółowy panel pozostaje dla właściciela. |
| Automatyczne maile | Potwierdzenie, potwierdzenie zaliczki, informacje i przypomnienia przed przyjazdem, podziękowanie. Reguły uwzględniają termin pobytu, język, kompletność danych i zgody. |
| Późna rezerwacja | Potwierdzenie i informacje przed przyjazdem stają się gotowe także przy rezerwacji na dziś. Nie wychodzi nieaktualne „jutro przyjazd”. |
| Czysty start | 208 zakończonych pobytów oznaczono jako historię. Anulowano 85 niewysłanych wiadomości i wyłączono 45 otwartych obowiązków pobytowych. Zachowano dane, rzeczywiste płatności i naprawy. |
| Blokada historii | Historyczne pobyty nie generują obowiązków, braków danych ani alertów. Serwer odrzuca historyczne maile bezpośrednio przed wysyłką. |
| Wiadomości | Nowy ekran /messages: rozmowy, wyszukiwanie, kanały, historia dostarczenia, planowane wiadomości, zatwierdzanie i anulowanie. |
| Szablony | Widok wzorowany na Mobile Calendar: tabela, język, status, zmienne, edycja i podgląd. Zapis wersjonowany, z kontrolą konfliktu i nieznanych zmiennych. Importy MC pozostają nieaktywnym materiałem źródłowym. |
| Dane do zaliczki | Rachunek potwierdzony w ustawieniach Mobile Calendar i faktycznie wysłanej wiadomości; poprawna suma kontrolna. Zapisany w prywatnej konfiguracji. Przewodnik pod dotychczasowym adresem. |

## Dowody z produkcji

- Wdrożony kod: `5eaae71ba1438e36eab9bda5a9b1ffc6d2c649f2` (PR #46), Vercel success.
- Ręcznie uruchomiony rzeczywisty workflow [36740913352](https://github.com/patryksikoracom/stawyusikory/actions/runs/36740913352): sukces synchronizacji iCal i kroku mailowego; processed=2, sent=2, failed=0, skipped=0.
- Testowa rezerwacja na 30.09–01.10 została utworzona przez interfejs produkcyjny. Oba maile skierowano wyłącznie na zatwierdzony adres właściciela, z zatwierdzoną kopią do taty.
- Potwierdzenie: Resend `01a0f30b-1d6d-79da-ab8f-a297bc3093fb`, delivered.
- Informacje przed przyjazdem: Resend `01a0f30b-20aa-74ce-b412-7069d78336cb`, delivered.
- Baza po webhookach: dokładnie 2 rekordy outbound, oba delivered, każdy attempts=1. Obejmuje to ścieżkę UI → zapis rezerwacji → kolejka → procesor → Resend → webhook → zapis statusu.
- Testowe przypomnienie „jutro przyjazd” zostało zablokowane jako spóźnione.
- Po teście rezerwację anulowano i przeniesiono do kosza. Cztery zadania mają status „Nie dotyczy”; wszystkie siedem niewysłanych wiadomości anulowano. Dwa potwierdzenia dostarczenia zachowano. Test nie blokuje terminu i nie tworzy przyszłej wysyłki.
- Końcowa kontrola historii i testu: wyłącznie wiadomości anulowane albo dostarczone; brak oczekujących.
- Edytor szablonów: zmiana nazwy TPL-REPAIR zapisana w UI i potwierdzona po odświeżeniu oraz w bazie. Następnie przywrócono nazwę „Informacja po naprawie”; wersja 4. Treść i temat niezmienione.
- Sprzątanie na produkcji: zapis kwoty, zapłata, cofnięcie i odświeżenie potwierdzone. Osobną pozycję testową usunięto. Zbiorcze rozliczenie 150 + 180 = 330 zł zweryfikowano w środowisku demonstracyjnym.

## Testy i zabezpieczenia

- 116 plików / 581 testów: PASS.
- Produkcyjny build Next.js i TypeScript: PASS.
- ESLint: brak nowych błędów; istniejące ostrzeżenia dotyczące window.location.
- npm audit po aktualizacji zależności: 0 podatności.
- SQL na dedykowanej bazie: uprawnienia operatora, rozliczenie, cofnięcie, konflikt wersji, izolacja organizacji, audyt, atomowe zakończenie wysyłki i wyścigi webhooków: PASS, dane wycofane przez ROLLBACK.
- Procesor ponownie sprawdza aktualną rezerwację, kontakt, cenę, zgodę i treść przed wysyłką. Anulowanie, kosz lub zmiana danych blokują starą wiadomość.
- Deduplikacja oparta na unikalnym kluczu w bazie i kluczu dostawcy; testy obejmują ponowienia i równoległe przejęcie. Niepewna próba po 23 godzinach wymaga kontroli historii dostawcy.
- Drugie ręczne uruchomienie produkcyjnego workflow do testu deduplikacji zostało odrzucone przez automatyczną kontrolę uprawnień z powodu ryzyka powtórnej wysyłki. Nie ponawiano go inną drogą. Zamiast tego sprawdzono odczytem statusy, liczbę prób i unikalny indeks. Nie twierdzimy, że wykonano drugi test live.

## Harmonogram i granice weryfikacji

GitHub ma aktywny workflow co 15 minut i włączony krok e-mail. Wcześniejsze automatyczne przebiegi są widoczne, ale ich odstępy 30.09 były znacznie dłuższe od ustawionego interwału. Po włączeniu maili potwierdzono przebieg ręczny, a nie kolejny event schedule. Wysyłka jest zależna od uruchomienia harmonogramu, więc nie należy obiecywać gościom dostarczenia dokładnie w ciągu 15 minut.

GitHub dokumentuje możliwość opóźnienia, a przy przeciążeniu również pominięcia zaplanowanych uruchomień: [dokumentacja harmonogramu](https://docs.github.com/en/actions/how-tos/troubleshoot-workflows). Jeśli wymagany jest ścisły czas wysłania przy rezerwacjach na dziś, harmonogram wymaga przeniesienia do usługi przeznaczonej do regularnych zadań produkcyjnych. Takiej migracji w tym pakiecie nie wykonano.

Odpowiedzi gości nadal trafiają do skrzynki Marcina; ekran aplikacji nie udaje zsynchronizowanej skrzynki przychodzącej. SMS i wiadomości platform OTA nie zostały objęte rzeczywistym testem wysyłki tego pakietu. Importowane szablony MC nie są automatycznie aktywowane. Nie jest to opinia prawna ani certyfikat zgodności.

## Obsługa na co dzień

1. Wprowadzić nową rezerwację z poprawnym e-mailem, językiem, datami i ceną. Sprawdzić wiadomości oraz ewentualny powód blokady.
2. Po faktycznej wpłacie zaznaczyć zaliczkę; nie księgować wpłat na podstawie samego wysłania maila.
3. Po sprzątaniu zaznaczyć wykonanie i należność dla Jadzi. Tata rozlicza wybrane pozycje, gdy faktycznie płaci.
4. Dawne pobyty pozostają historią bez zaległych obowiązków. Nie przywracać historycznych wiadomości do wysyłki.
5. W razie błędu sprawdzić status w Wiadomościach i przebieg GitHub. Nie zerować prób ani klucza deduplikacji bez sprawdzenia Resend.

## Uzupełnienie: harmonogram bazy

Ze względu na nieregularne uruchomienia GitHub przygotowano Supabase Cron co 5 minut. Migracja tworzy prywatną funkcję SECURITY INVOKER i nieaktywny job; klucz jest odrębny od ogólnego CRON_SECRET i przechowywany w Vault oraz Vercel. Funkcja wysyła wyłącznie do stałego endpointu tej aplikacji. Brak klucza blokuje wywołanie. Role anon/authenticated nie mają dostępu do schematu ani funkcji. Test SQL obejmuje uprawnienia, brak klucza i zawartość kolejki HTTP, po czym robi ROLLBACK — bez żądania sieciowego. Aktywacja i dowód samoczynnego przebiegu są ostatnim krokiem wdrożenia.
