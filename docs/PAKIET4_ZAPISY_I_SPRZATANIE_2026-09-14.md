# Pakiet 4 — zapisy i panel sprzątania

14 września 2026. Zmiany lokalne, bez publikacji i bez zmian danych produkcyjnych.

## Wykonane poprawki

- A12: nieudane pobranie planu sprzątania nie pokazuje zerowych liczników ani zapewnienia o gotowości. Pusty, poprawnie pobrany plan oznacza „Brak otwartych zadań”, a nie dowód przygotowania domków.
- A12: odrzucone zgłoszenie problemu pozostaje otwarte z wpisanym tytułem/opisem i błędem w dialogu. Zamknięcie następuje po potwierdzonym zapisie. Równoległe kliknięcia nie uruchamiają kolejnych mutacji.
- A11, import: kontrakt `replaceWithImportedBookings` zwraca wynik zapisu. Ekran czeka na walidację i trwały zapis, przez cały czas blokuje powtórną akcję. Odrzucenie lub wyjątek pozostawia podgląd i dane plików. Sukces nie jest już ogłaszany po samej walidacji.
- A11, podgląd importu: błąd sieci zwalnia stan oczekiwania i zachowuje dane wejściowe.
- A11, dokumenty finansowe: zapis dokumentu ma stan oczekiwania i błąd w formularzu. Nieudany zapis nie zamyka formularza; ponowienie zachowuje identyfikator dokumentu. Identyfikator UUID zastępuje identyfikator oparty wyłącznie na milisekundzie.

## Testy zachowania

- Panel sprzątania: brak fałszywej gotowości po błędzie; odrzucenie zgłoszenia, zachowanie tekstu i skuteczne ponowienie.
- Import: opóźnione potwierdzenie, odrzucony zapis i sukces; sprawdzany stan pól oraz przycisków.
- Dokument: odrzucenie, zachowanie kwoty, ponowienie z tym samym ID i zamknięcie po potwierdzeniu.
- Testy nie wysyłają wiadomości i nie zapisują danych produkcyjnych.

## Pozostałe granice pakietu

A11 nie jest zamknięte dla wszystkich ekranów: do przejścia pozostają pomocnicze zapisy mediów, reklam, konfiguracji komunikacji i działania zadań. Odbiór pełnego procesu sprzątania z bazą i rolami również pozostaje otwarty. Wyniki jsdom nie zastępują odbioru na telefonie i testu produkcyjnego.

## Wynik kontroli

Pełna regresja: **556/556 testów w 114 plikach**. TypeScript i produkcyjny build zakończone poprawnie. `git diff --check` bez uwag. Wcześniejszy problem uruchomienia ESLint i blokada przeglądarki pozostają opisane w statusie; nie oznaczono tych kontroli jako zaliczonych.

## Kolejna część pakietu — konfiguracja i zadania

- Instrukcja dojazdu i konfiguracja nadawcy: wynik zapisu jest sprawdzany, pola nie są czyszczone przy błędzie, przyciski i edycja są blokowane na czas zapisu. Odrzucona próba nie dopisuje lokalnej wersji instrukcji.
- Usterka z panelu zadań i blokada powiązanego zadania są teraz jedną istniejącą komendą batchową, wykonywaną transakcyjnie. Nie są wysyłane dwa niezależne zapisy. Brak lokalnego zadania odrzuca operację przed wysłaniem.
- Nadpisanie gotowości czeka na wynik komendy zadania. Błąd zachowuje powód w otwartym dialogu i nie wyświetla sukcesu.
- Pusta kolejka sprzątania właściciela nie nazywa już wszystkich domków gotowymi.
- Uprawnienia bazy nie zostały rozszerzone. Komenda batchowa pozostaje dostępna zgodnie z istniejącymi rolami; nie stanowi obejścia uprawnień managera.

Dodatkowe testy: usterka i blokada w jednym żądaniu, zachowanie formularza po błędzie usterki/nadpisania oraz ponowienie zapisu instrukcji dojazdu.

Kontrola tej części: **560/560 testów w 115 plikach**, produkcyjny build oraz TypeScript zaliczone. Po dodaniu ochrony przed zgłoszeniem do nieistniejącego zadania ponownie zaliczono 22 testy store i TypeScript. Brak zmian schematu bazy i brak wdrożenia produkcyjnego.

## Pętla zadań i checklisty

Zwykłe akcje sprzątania i zadań, zaznaczanie checklisty oraz zmiany statusu/horyzontu usterek pokazują błąd wyniku i blokują ponowne kliknięcia podczas zapisu. Komenda checklisty zwraca potwierdzenie. Jednoznaczne odrzucenie 400/401/403/404/422 cofa optymistyczną zmianę zadania/checklisty, o ile nie została już zastąpiona nowszą lokalną wersją. Niejednoznaczna awaria sieci nadal wymaga odświeżenia; nie udaje sukcesu.

Testy 403 i 422 sprawdzają rzeczywisty provider stanu i wynik komendy. Pełna regresja tej pętli: **563/563 testy**, TypeScript i build zaliczone.

## Dalsze potwierdzenia

Formularz zaplanowanej wiadomości zachowuje edytowaną treść po błędzie szkicu/zatwierdzenia. Przywracanie z kosza oraz łączenie profili czekają na wynik. Właściciel/admin może przypisać zadanie do własnego identyfikatora konta; konkretne przypisanie ma pierwszeństwo przed rolą lub nazwą. Aktualna pełna kontrola: 599/599 testów, TypeScript, build i ESLint bez błędów (2 ostrzeżenia).
