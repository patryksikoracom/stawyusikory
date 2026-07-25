# Stawy OS — plan MVP operatora dla taty

**Status:** plan zatwierdzony do wpisania w kolejkę; bez zgody na wdrażanie poza kolejnymi, osobnymi PR-ami<br>
**Data:** 25 lipca 2026<br>
**Właściciel potrzeby:** tata — operator obiektu<br>
**Właściciel produktu:** Patryk<br>
**Powiązane pomysły:** POM-004, POM-005, POM-006, POM-007

## Cel

Przygotować Stawy OS do codziennej pracy taty bez rozszerzania trwających PR-ów 6–8 i bez przedwczesnego wyłączenia Mobile Calendar.

MVP ma umożliwić operatorowi:

1. zobaczyć kalendarz wszystkich rezerwacji;
2. podczas rozmowy wybrać domek i zakres oraz szybko podać cenę;
3. zastosować kontrolowany rabat;
4. zapisać imię i nazwisko lub nazwę rezerwacji, kontakt, źródło, cenę i płatność;
5. zobaczyć na ekranie „Dzisiaj”, kto jest w każdym domku i do kiedy;
6. wybrać, poprawić i wysłać e-mail z poziomu aplikacji;
7. pracować na własnym koncie z uprawnieniami operatora, bez pełnych uprawnień właściciela.

## Najważniejsza decyzja operacyjna

Wygaśnięcie subskrypcji Mobile Calendar nie jest samo w sobie zgodą na przełączenie źródła prawdy.

Do czasu spełnienia bramki go-live:

- Mobile Calendar/OTA pozostaje źródłem prawdy dla rezerwacji i dostępności;
- Stawy OS działa równolegle jako pilot i read model;
- lokalnie utworzona rezerwacja nie jest przedstawiana jako potwierdzona w OTA;
- jeżeli termin odnowienia nadejdzie wcześniej, należy przedłużyć Mobile Calendar na najkrótszy praktyczny okres;
- nie wyłączamy narzędzia, dopóki nie wiemy, czy odpowiada za synchronizację Booking, Airbnb lub innych kanałów.

## Co już istnieje

| Potrzeba | Stan obecny | Najważniejsza luka |
|---|---|---|
| kalendarz rezerwacji | istnieje oś czasu i agenda mobilna | docelowy punkt startu, wybór zakresu i pełny test operatora są w PR-10d |
| dane klienta | formularz zapisuje nazwę, telefon i e-mail | pełna osoba/CRM jest później; MVP może użyć istniejącej etykiety gościa |
| źródło rezerwacji | istnieje wybór kanału i numer zewnętrzny | trzeba zachować rozdział kanału zawarcia od źródła odkrycia |
| szybka wycena | `quoteStay` liczy każdą noc według reguł | prawdziwe stawki Mobile Calendar nie są jeszcze uzgodnione |
| rabat | można ręcznie zmienić cenę | brakuje jawnej wartości/procentu rabatu oraz powodu |
| ekran „Dzisiaj” | dane bieżących pobytów istnieją | karta stanu nie pokazuje jeszcze pełnej informacji wymaganej przez POM-004 |
| szablony wiadomości | istnieją szkice, wersje i zatwierdzenie | brak produkcyjnej wysyłki e-mail oraz statusu dostawcy |
| import Mobile Calendar | istnieje import CSV z podglądem | import nie oznacza bezpiecznego przejęcia zapisu ani synchronizacji OTA |
| konto taty | można zaprosić administratora lub viewer | brakuje docelowej roli manager/operator z właściwym zakresem |

## Priorytety

### P0 — ciągłość działalności, nie funkcja

Przed decyzją o rezygnacji z Mobile Calendar:

1. ustalić datę końca subskrypcji i najkrótszą opcję przedłużenia;
2. ustalić wszystkie połączone OTA i sposób blokowania dostępności;
3. wykonać eksport aktywnych oraz przyszłych rezerwacji;
4. zabezpieczyć cennik, szablony i historię potrzebną operacyjnie;
5. wskazać procedurę ręcznego działania w razie awarii Stawy OS.

### P1 — zakres wydania dla taty

1. rola operatora i bezpieczny dostęp;
2. POM-005 — wycena i szybki zapis podczas rozmowy;
3. POM-006 — zgodny, zatwierdzony cennik;
4. POM-004 — stan domków i goście na ekranie „Dzisiaj”;
5. POM-007 — e-mail wysyłany z aplikacji;
6. uzgodnienie danych, shadow mode i rollback.

Wszystkie te elementy są P1, lecz kolejność wykonania wynika z zależności. Wysoka wartość e-maila nie pozwala ominąć poprawności kontaktu, uprawnień, idempotencji ani testów dostawcy.

### Poza MVP

- pełny CRM powracających gości;
- automatyczne kampanie i rekomendacje AI;
- wysyłka marketingowa;
- dwukierunkowa skrzynka pocztowa;
- automatyczna publikacja cen do OTA bez gatewaya;
- rozbudowane raporty roczne niewymagane podczas obsługi telefonu;
- funkcje finansowe niezwiązane bezpośrednio z wyceną i saldem konkretnej rezerwacji.

## Zasada rozdzielenia backlogu od produkcji

1. Każda nowa potrzeba trafia najpierw do `REJESTR_POMYSLOW.md`.
2. Zapis pomysłu nie oznacza rozpoczęcia prac.
3. Do master planu trafia dopiero karta ze statusem, priorytetem, zależnościami i kryteriami akceptacji.
4. PR-y 6–8 zachowują obecny zakres finansowy i architektoniczny. Nie dodajemy do nich interfejsu operatora, kalendarza ani e-maili.
5. Każda funkcja MVP taty powstaje w przewidzianej paczce i przechodzi osobną akceptację.
6. W danym momencie tylko jedna paczka funkcjonalna jest podstawą decyzji o kontynuacji; znalezione pomysły nie rozszerzają jej po cichu.
7. Wpis do backlogu i zmiana priorytetu mogą powstać w dokumentacyjnym PR bez zmian runtime.
8. Numeracja istniejących PR-ów pozostaje bez zmian; „MVP taty” jest bramką wydania przecinającą kilka paczek, a nie jednym dużym PR-em.

## Przypisanie do istniejących PR-ów

| Kolejność zależności | Paczka | Zakres dla MVP taty | Czego nie dokładać |
|---:|---|---|---|
| 1 | PR-7 | jawne konflikty i wielosesyjność | bez nowego UI operatora |
| 2 | PR-8a… | bezpieczne komendy domenowe dla zapisów | bez pełnej przebudowy wszystkich domen naraz |
| 3 | PR-9a | rola `manager/operator`, macierz `read/write/PII/finance/send/export` | bez przyznawania tacie pełnego `owner` |
| 4 | PR-10b | POM-004: stan domków, bieżący i następny gość | bez push notifications w pierwszym kroku |
| 5 | PR-10c | POM-005 i POM-006: szybki wpis, cena z cennika, rabat i saldo | bez pełnego CRM i pól marketingowych |
| 6 | PR-10d | prosty wybór zakresu i bezpieczny kalendarz desktop/mobile | bez publikacji cen lub dostępności do OTA |
| 7 | PR-11c | trzy zatwierdzone szablony e-mail v1 i ich wersje | bez udawania faktycznej dostawy |
| 8 | PR-12 / Etap 7 | dostawca e-mail, statusy, retry, gateway OTA, shadow mode i rollback | bez przełączenia przed spełnieniem bramki |

PR-10b, PR-10c i PR-10d pozostają osobnymi paczkami. Ich kolejność może zostać potwierdzona po PR-8, ale nie wolno scalać ich w jeden duży PR tylko po to, aby szybciej nazwać całość MVP.

## Inwentaryzacja Mobile Calendar przed implementacją

### Rezerwacje i dostępność

- aktywne oraz przyszłe rezerwacje;
- anulacje i blokady właścicielskie;
- wszystkie podłączone OTA;
- opóźnienia i kierunek synchronizacji;
- zewnętrzne identyfikatory rezerwacji;
- procedura potwierdzania rezerwacji telefonicznej.

### Cennik

- stawka bazowa każdego domku;
- sezon niski, średni i wysoki;
- święta i długie weekendy;
- promocje oraz wyjątki;
- minimalne długości pobytu;
- opłata za sprzątanie i inne dopłaty;
- reguły zależne od liczby osób, dnia tygodnia lub długości pobytu;
- daty obowiązywania oraz przykładowe wyceny kontrolne.

### E-mail

- szablony faktycznie używane przez tatę;
- moment oraz warunek użycia każdego szablonu;
- adres nadawcy i adres odpowiedzi;
- języki;
- sposób raportowania błędu lub dostarczenia;
- informacja, czy Mobile Calendar przechowuje historię wysłanych wiadomości.

## Plan wykonania

### Faza 0 — zapis planu

- utrzymać rejestr pomysłów jako jedno źródło prawdy dla intake;
- powiązać POM-004–POM-007 z master planem;
- nie zmieniać kodu w ramach samego zapisu planu.

### Faza 1 — dane i ciągłość

- wykonać inwentaryzację Mobile Calendar;
- przedłużyć subskrypcję, jeśli bramka go-live nie może zostać spełniona przed jej końcem;
- przygotować eksport i ręczną procedurę awaryjną;
- wybrać próbkę 10 wycen i aktywne rezerwacje do późniejszego uzgodnienia.

### Faza 2 — fundament operatora

- zakończyć PR-7 i PR-8;
- w PR-9a dodać właściwą rolę operatora;
- przetestować pozytywne i negatywne uprawnienia do rezerwacji, PII, cen, wiadomości i eksportu.

### Faza 3 — codzienna obsługa rezerwacji

- wdrożyć POM-004 w PR-10b;
- wdrożyć minimalny przepływ POM-005 w PR-10c;
- przepisać i zatwierdzić stawki POM-006;
- poprawić wybór terminu i kalendarz w PR-10d;
- przejść 10 kontrolnych rozmów/wycen z tatą.

### Faza 4 — komunikacja

- zatwierdzić trzy szablony e-mail v1 w PR-11c;
- podłączyć dostawcę w kontrolowanej części Etapu 7;
- rozpocząć od adresów kontrolnych;
- sprawdzić edycję, odpowiedź, retry, status i kill switch;
- dopiero potem dopuścić ręczną wysyłkę do prawdziwego gościa.

### Faza 5 — pilot i przełączenie

- zaimportować i uzgodnić wszystkie aktywne oraz przyszłe rezerwacje;
- prowadzić Stawy OS i Mobile Calendar równolegle przez minimum 14 dni;
- codziennie porównywać rezerwacje, anulacje, blokady, ceny i statusy wiadomości;
- zapisać każdą niewyjaśnioną różnicę;
- sprawdzić rollback;
- dopiero po spełnieniu bramki podjąć osobną decyzję o rezygnacji z Mobile Calendar.

## Bramka akceptacji MVP taty

MVP można uznać za gotowe do codziennej pracy taty, gdy:

1. tata loguje się na własne konto operatora i nie ma zbędnych uprawnień;
2. na telefonie oraz desktopie widzi prawidłowy kalendarz;
3. 10/10 kontrolnych wycen zgadza się ze sprawdzonym cennikiem;
4. cenę da się podać w mniej niż 30 sekund;
5. rezerwację z kontaktem, źródłem, ceną i statusem płatności da się zapisać w mniej niż dwie minuty;
6. ręczny rabat pokazuje cenę z cennika, cenę końcową i powód;
7. ekran „Dzisiaj” pokazuje pełną nazwę bieżącego gościa, termin wyjazdu i następny przyjazd;
8. trzy szablony e-mail można edytować i wysłać z aplikacji;
9. status wysyłki pochodzi od dostawcy, a retry nie tworzy duplikatu;
10. przez minimum 14 dni nie ma niewyjaśnionych różnic między Stawy OS a źródłami rezerwacji;
11. istnieje sprawdzony eksport, procedura awaryjna i rollback;
12. Patryk oraz tata osobno zatwierdzają przełączenie.

Niespełnienie któregokolwiek z punktów 8–11 blokuje rezygnację z narzędzia, które nadal obsługuje odpowiednią funkcję.

## Miary pilota

- czas do podania ceny;
- czas do zapisania kompletnej rezerwacji;
- liczba powrotów do Mobile Calendar podczas rozmowy;
- liczba ręcznych korekt ceny;
- liczba brakujących lub niezrozumiałych pól;
- zgodność aktywnych rezerwacji i blokad;
- liczba niewyjaśnionych różnic cen;
- liczba e-maili wymagających poprawy;
- liczba błędów dostawy i duplikatów;
- liczba sytuacji, w których tata potrzebował pomocy Patryka.

Po pilocie przeprowadzić osobny wywiad z tatą. Jego feedback trafia do rejestru pomysłów, jest oceniany i dopiero potem może zmienić kolejność planu.
