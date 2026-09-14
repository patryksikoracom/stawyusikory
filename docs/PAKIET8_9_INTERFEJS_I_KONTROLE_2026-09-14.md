# Pakiety 8–9 — interfejs i kontrole

## Interfejs

- iCal pokazuje czas ostatniego odczytu zamiast procentu kompletności. Po przekroczeniu progu `staleAfterMinutes` (domyślnie 240 minut) aktywny feed otrzymuje ostrzeżenie, także przy pozostawionej otwartej stronie.
- Operator nie widzi odnośnika do niedostępnego przeglądu roku.
- Statystyki roczne korzystają z tej samej definicji sprzedanego pobytu co metryki komercyjne. Status „Nowa” nie powiększa sprzedaży.
- Licznik pilnych zadań pulpitu obejmuje wszystkie zadania wysokiego priorytetu na dziś, niezależnie od skróconej listy. Zadania pokazują termin i identyfikator rezerwacji.
- Właściciel/admin może jawnie przypisać zadanie do swojego identyfikatora konta. Konkretne przypisanie konta ma pierwszeństwo przed rolą i historycznym polem imienia.
- Własny profil pozwala odczytać nazwę, e-mail i rolę oraz zapisać nazwę wyświetlaną. Endpoint działa na sesji bieżącego użytkownika i odrzuca dodatkowe pola identyfikatora/roli.
- Ustawienia umożliwiają odczyt kont i ról bieżącej organizacji. Endpoint odrzuca role bez dostępu przed użyciem klienta administracyjnego, nie zwraca arbitralnych metadanych Auth i nie buforuje listy.
- Drobna usterka nie jest automatycznie przedstawiana jako blokada pobytu. Ryzyko przyjazdu, krytyczna waga lub naprawa wymagana przed przyjazdem pozostają wskazaniem do interwencji. Odnośnik wybiera widok usterek i konkretną pozycję.
- Licznik pobytów profilu uwzględnia otwartą rezerwację także przed utworzeniem osobnego rekordu CRM. Łączenie profili czeka na potwierdzenie zapisu.
- Formularz rejestru zgód oraz wskaźniki zgód w profilu i kompletności pobytu zostały ukryte zgodnie z decyzją użytkownika. Historyczne rekordy i kontakt/język są zachowane.
- Importowane szablony Mobile-Calendar są w zwijanym archiwum i nie kwalifikują się do automatycznej wysyłki.
- Usunięto z produkcyjnych widoków demonstracyjne laboratorium finansowe, statyczny panel gotowości integracji, gotowość AI 4/4 i pozorny przełącznik AI.
- Ustawienia umożliwiają sprawdzenie pliku kopii bez zmiany bieżących danych.

## Kontrole i środowisko

- `.nvmrc` wskazuje Node 24, na którym zakończył się ESLint. Próby z systemowym Node 26 nie kończyły importu konfiguracji w wyznaczonym czasie; reguł lint nie wyłączano.
- GitHub Actions zawiera kontrolę instalacji z lockfile, ESLint, TypeScript, testów i buildu. Workflow nie używa sekretów produkcji. Nie uruchomiono go na GitHubie, ponieważ zmian nie wypchnięto.
- Audyt npm z 14 września: zero znanych podatności we wszystkich kategoriach, włącznie z zależnościami developerskimi.
- Skrypt integracyjny czyta `.env.integration.local` lub jawnie wskazany plik testowy, z pierwszeństwem zmiennych procesu. Nie czyta domyślnie `.env.local`. Produkcyjny projekt Stawów jest dodatkowo odrzucany przed utworzeniem klienta. Odrzucenie zostało sprawdzone na sztucznych kluczach bez wywołania bazy.

## Pozostały zakres

Pełny odbiór ról na izolowanej bazie i przeglądarce, zarządzanie zmianą/odebraniem uprawnień kont, kontrola wszystkich pozostałych formularzy i przegląd aplikacji na telefonie. Refaktoryzacja dużych widoków i store nie jest zakończona; wydzielono potwierdzane akcje, pełny odczyt stanu i kontrolę aktualności e-maila. Rozszerzenia OTA/CRM/AI/marketing pozostają poza rdzeniem.
