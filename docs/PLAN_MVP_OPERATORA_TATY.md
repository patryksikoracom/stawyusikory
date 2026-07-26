# Stawy OS — plan MVP operatora dla taty

**Status:** plan zatwierdzony do wpisania w kolejkę; bez zgody na wdrażanie poza kolejnymi, osobnymi PR-ami<br>
**Data:** 25 lipca 2026<br>
**Właściciel potrzeby:** tata — operator obiektu<br>
**Właściciel produktu:** Patryk<br>
**Powiązane pomysły:** POM-004, POM-005, POM-006, POM-007, POM-008<br>
**Raport użytkownika:** `RAPORT_Z_PRZEJSCIA_TATY_MOBILE_2026-07-25.md`

## Cel

Przygotować Stawy OS do codziennej pracy taty bez rozszerzania trwających PR-ów 6–8 i bez przedwczesnego wyłączenia Mobile Calendar.

MVP ma umożliwić operatorowi:

1. po otwarciu aplikacji na telefonie od razu zobaczyć dostępność w kalendarzu;
2. korzystać z kalendarza przy powiększonym tekście ustawionym ze względu na wzrok;
3. podczas rozmowy wybrać domek i zakres bezpośrednio na kalendarzu oraz szybko podać cenę;
4. zastosować kontrolowany rabat kwotowy albo procentowy;
5. dodać osoby, dzieci, zwierzęta, usługi i zaliczkę;
6. zapisać imię i nazwisko lub nazwę rezerwacji, kontakt, źródło, cenę i płatność;
7. zobaczyć rzeczywisty stan synchronizacji z Mobile Calendar/OTA;
8. wybrać, poprawić i wysłać e-mail z poziomu aplikacji;
9. uruchomić właściwe przygotowanie przyjazdu, sprzątanie i procedurę małoletnich;
10. zobaczyć niżej lub osobno brief „Dzisiaj”, zadania i statystyki;
11. pracować na własnym koncie z uprawnieniami operatora, bez pełnych uprawnień właściciela.

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
| mobilny ekran startowy | Dashboard eksponuje powitanie, pobyty i KPI | tata potrzebuje kalendarza jako pierwszego widoku; POM-008 |
| dostępność wzrokowa | część UI używa drobnego tekstu i gęstych kart | test na telefonie taty z jego powiększonym tekstem; PR-10a |
| kalendarz rezerwacji | istnieje oś czasu i agenda mobilna | wizualny wybór całego zakresu i pełny test operatora są w PR-10d |
| dane klienta | formularz zapisuje nazwę, telefon i e-mail | pełna osoba/CRM jest później; MVP może użyć istniejącej etykiety gościa |
| źródło rezerwacji | istnieje wybór kanału i numer zewnętrzny | trzeba zachować rozdział kanału zawarcia od źródła odkrycia |
| szybka wycena | `quoteStay` liczy każdą noc według reguł | prawdziwe stawki Mobile Calendar nie są jeszcze uzgodnione |
| rabat | można ręcznie zmienić cenę | brakuje jawnej wartości/procentu rabatu oraz powodu |
| godziny | formularz pyta o przyjazd i wyjazd | standard 16:00/11:00 ma pochodzić z ustawień i nie obciążać szybkiej ścieżki |
| zwierzęta | brak reguły rezerwacyjnej i ceny | Czapla bez zwierząt; Rybak 100 PLN za zwierzę za pobyt |
| minimum pobytu | cennik obsługuje `minNights` | trzeba doprecyzować 4 doby i wyjątkową minimalną podstawę 3,5 doby |
| zaliczka | formularz ma kwotę i termin zadatku | domyślne 33%, opcjonalne 50%, saldo i dokładny termin pierwszej wpłaty |
| ekran „Dzisiaj” | dane bieżących pobytów istnieją | karta stanu nie pokazuje jeszcze pełnej informacji wymaganej przez POM-004 |
| szablony wiadomości | istnieją szkice, wersje i zatwierdzenie | brak produkcyjnej wysyłki e-mail oraz statusu dostawcy |
| płatność przed przyjazdem | wspólny silnik salda istnieje | pełna wpłata D-2, przypomnienie i czytelna bramka wydania klucza |
| przygotowanie przyjazdu | zadania i checklisty istnieją | informacja po zaliczce, plan tygodnia i odświeżenie po ponad 7 dniach |
| małoletni | zakres PR-9c jest zaplanowany | najpierw zatwierdzony SOP, później ewentualny formularz online i właściwy podpis |
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

Osobną bramką P0 jest posiadanie i stosowanie zatwierdzonych Standardów Ochrony Małoletnich. Aplikacja może wspierać ich wykonanie, ale brak funkcji w aplikacji nie może opóźniać wdrożenia wymaganej procedury organizacyjnej.

### P1 — zakres wydania dla taty

1. rola operatora i bezpieczny dostęp;
2. POM-008 — kalendarz jako dostępny mobilny ekran startowy;
3. POM-006 — zgodny, zatwierdzony cennik i reguły wyjątków;
4. POM-005 — wycena i szybki zapis podczas rozmowy;
5. POM-007 — zaliczka, sekwencja e-mail i wysyłka z aplikacji;
6. przygotowanie przyjazdu: sprzątanie, płatność i procedura małoletnich;
7. POM-004 — stan domków i goście na ekranie „Dzisiaj”, poniżej kalendarza lub osobno;
8. uzgodnienie danych, shadow mode i rollback.

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
| 4 | PR-9c / SOP | zatwierdzona procedura małoletnich i minimalny dowód wykonania | bez zgadywania formularza, danych i rodzaju podpisu |
| 5 | PR-10a | powiększony tekst, pola dotykowe i mobilny fundament POM-008 | bez przebudowy wszystkich widoków w jednym PR |
| 6 | PR-10d | POM-008: ekran startowy operatora, dwa tapnięcia i kalendarz desktop/mobile | bez publikacji cen lub dostępności do OTA |
| 7 | PR-10c | POM-005 i POM-006: szybki wpis, cena, zwierzęta, usługi, rabat, zaliczka i saldo | bez pełnego CRM i pól marketingowych |
| 8 | PR-11c | zatwierdzona sekwencja szablonów e-mail v1 i ich wersje | bez udawania faktycznej dostawy |
| 9 | PR-12 / Etap 7 | dostawca e-mail, statusy, retry, gateway OTA, shadow mode i rollback | bez przełączenia przed spełnieniem bramki |
| 10 | PR-9b | informacja dla sprzątania po zaliczce i odświeżenie po długiej przerwie | bez ujawniania cen i pełnego PII |
| 11 | PR-10b | POM-004: stan domków, bieżący i następny gość | bez umieszczania briefu nad kalendarzem operatora |

Numery PR-ów opisują istniejące paczki, a tabela pokazuje priorytet wartości dla toru operatora. Po PR-8 trzeba potwierdzić techniczną kolejność zależności. PR-10a–PR-10d pozostają osobnymi paczkami i nie wolno scalać ich w jeden duży PR tylko po to, aby szybciej nazwać całość MVP.

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
- potwierdzenie wysokiego sezonu 15 czerwca–15 września;
- święta i długie weekendy;
- dokładna dopłata zamiast „około 10%” oraz sposób zaokrąglenia;
- promocje oraz wyjątki;
- standardowe minimum czterech dób i zasada wyjątkowej podstawy 3,5 doby;
- polityka zwierząt: Czapla bez zwierząt, Rybak 100 PLN za sztukę za pobyt;
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

### Proces i zgodność

- domyślne godziny 16:00/11:00 i sposób zatwierdzania wyjątku;
- domyślna zaliczka 33%, wariant 50% i termin pierwszej płatności;
- pełna płatność D-2 i zasada wydania klucza;
- zasady anulowania, no-show, zmiany terminu i zwrotu zaliczki;
- aktualne Standardy Ochrony Małoletnich oraz używany druk;
- osoba odpowiedzialna za SOP i przygotowanie osób wydających klucze;
- dokładna reguła odświeżenia domku po długiej przerwie.

## Lista spotkania z tatą — rzeczy do zatwierdzenia

Lista jest protokołem decyzji, a nie luźnym zbiorem pytań. Przy każdym punkcie należy zapisać: `zatwierdzone / do poprawy / odłożone`, ostateczną wartość, osobę odpowiedzialną i datę obowiązywania.

### Codzienna obsługa

- [ ] Potwierdzić, że kalendarz jest pierwszym ekranem operatora i ustalić najważniejsze informacje widoczne bez przewijania.
- [ ] Zatwierdzić godziny 16:00/11:00, sposób obsługi wcześniejszego przyjazdu/późniejszego wyjazdu i osobę akceptującą wyjątek.
- [ ] Zatwierdzić minimalny formularz rezerwacji: kontakt, domek, termin, dorośli, dzieci, zwierzęta, cena, zaliczka, saldo i źródło.
- [ ] Przejść wspólnie 10 rzeczywistych scenariuszy wyceny i zaakceptować wynik, czas obsługi oraz sposób zapisu wyjątku.
- [ ] Zatwierdzić moment przekazania rezerwacji do przygotowania domku, odpowiedzialność za sprzątanie oraz regułę odświeżenia po ponad siedmiu dniach.

### Ceny, płatności i rezygnacje

- [ ] Zatwierdzić stawki obu domków, sezony, święta, minimum pobytu, dopłaty, zwierzęta i reguły zaokrąglania.
- [ ] Zatwierdzić zaliczkę 33%/50%, termin płatności, pełną płatność D-2 i twardą bramkę wydania klucza.
- [ ] Zatwierdzić zasady anulowania, no-show, zmiany terminu, zwrotu zaliczki i ręcznego rabatu wraz z wymaganym powodem.

### Komunikacja i ciągłość

- [ ] Zatwierdzić cztery wiadomości v1: rezerwacja/zaliczka, potwierdzenie zaliczki, przypomnienie o saldzie i instrukcja przyjazdu.
- [ ] Potwierdzić nadawcę, adres odpowiedzi, języki, możliwość ręcznej korekty oraz sposób zgłaszania błędu dostarczenia.
- [ ] Potwierdzić zakres importu z Mobile Calendar, 14-dniowy shadow mode, codzienne porównanie i warunek powrotu do starego procesu.

### Dopracowanie i zatwierdzenie ochrony małoletnich

- [ ] Przejść z tatą pełny projekt 0.9 i trzystronicową wersję dla dzieci; zebrać poprawki do języka, kolejności kroków i realiów wydawania kluczy.
- [ ] Potwierdzić formalną nazwę podmiotu oraz dokładny zakres obiektów objętych SOP.
- [ ] Imiennie wyznaczyć koordynatora ochrony małoletnich i zastępcę wraz z numerami kontaktowymi oraz zasadą dyżuru.
- [ ] Zatwierdzić sześć kroków wykonywanych przed wydaniem klucza/kodu, w tym obsługę samoobsługowego przyjazdu i późnego przyjazdu.
- [ ] Przećwiczyć pięć scenariuszy: zwykły pobyt, brak dokumentu, dorosły niebędący opiekunem, ujawnienie przemocy i niedostępny koordynator.
- [ ] Zatwierdzić miejsce bezpiecznego rejestru interwencji, listę osób z dostępem, sposób nadawania numeru sprawy i zakaz zapisywania danych dziecka w Stawy OS.
- [ ] Przekazać projekt prawnikowi/osobie odpowiedzialnej za RODO do zatwierdzenia podstaw, zakresu danych, retencji i procedury usuwania; okres 24 miesięcy/6 lat pozostaje propozycją do decyzji.
- [ ] Zatwierdzić pełną i dziecięcą wersję jako 1.0, datę wejścia w życie, termin pierwszego przeglądu, publikację HTTPS i miejsce wywieszenia w obiekcie.
- [ ] Przeszkolić wszystkie osoby wydające klucz/kod, zebrać oświadczenia i dopiero wtedy aktywować wersję 1.0 w Stawy OS.

## Plan wykonania

### Faza 0 — zapis planu

- utrzymać rejestr pomysłów jako jedno źródło prawdy dla intake;
- powiązać POM-004–POM-008 z master planem;
- zachować pełne ustalenia z testu w `RAPORT_Z_PRZEJSCIA_TATY_MOBILE_2026-07-25.md`;
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

- wdrożyć mobilny fundament dostępności i POM-008;
- przepisać i zatwierdzić stawki POM-006;
- poprawić wybór terminu i kalendarz w PR-10d;
- wdrożyć minimalny przepływ POM-005 w PR-10c;
- dodać zwierzęta, usługi, rabat i zaliczkę bez rozbudowywania pełnego CRM;
- wdrożyć POM-004 niżej lub w osobnym widoku, bez przesuwania kalendarza;
- przejść 10 kontrolnych rozmów/wycen z tatą.

### Faza 4 — komunikacja

- zatwierdzić sekwencję e-mail v1: rezerwacja i zaliczka, potwierdzenie zaliczki, przypomnienie o saldzie oraz przyjazd;
- podłączyć dostawcę w kontrolowanej części Etapu 7;
- rozpocząć od adresów kontrolnych;
- sprawdzić edycję, odpowiedź, retry, status i kill switch;
- dopiero potem dopuścić ręczną wysyłkę do prawdziwego gościa.

Równolegle zatwierdzić SOP małoletnich przed projektowaniem formularza online i określić, czy w ogóle jest wymagany podpis oraz jakiego rodzaju. Po zaliczce uruchamiać tygodniowy plan sprzątania i propozycję kontroli odświeżającej po ponad siedmiu dniach od ostatniego potwierdzonego sprzątania lub kontroli.

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
2. na jego telefonie i z jego ustawieniem tekstu kalendarz jest pierwszym użytecznym ekranem;
3. przy powiększeniu do 200% nie znikają daty, domek, cena ani główna akcja;
4. zakres można wybrać wizualnie dwoma tapnięciami;
5. 10/10 kontrolnych wycen zgadza się ze sprawdzonym cennikiem;
6. cenę da się podać w mniej niż 30 sekund;
7. rezerwację z kontaktem, źródłem, osobami, zwierzętami, ceną, zaliczką i płatnością da się zapisać w mniej niż dwie minuty;
8. ręczny rabat pokazuje cenę z cennika, cenę końcową i powód;
9. reguły Czapli/Rybaka, minimum pobytu i standardowe godziny działają zgodnie z zatwierdzoną polityką;
10. ekran „Dzisiaj” pokazuje pełną nazwę bieżącego gościa, termin wyjazdu i następny przyjazd, ale nie zasłania kalendarza;
11. zatwierdzoną sekwencję e-mail można edytować i wysłać z aplikacji;
12. status wysyłki pochodzi od dostawcy, a retry nie tworzy duplikatu;
13. saldo D-2 i bramka wydania klucza są jednoznaczne;
14. procedura małoletnich ma zatwierdzony SOP, minimalny zapis i przeszkolone osoby;
15. sprzątanie otrzymuje właściwą informację po zaliczce i propozycję odświeżenia po długiej przerwie;
16. przez minimum 14 dni nie ma niewyjaśnionych różnic między Stawy OS a źródłami rezerwacji;
17. istnieje sprawdzony eksport, procedura awaryjna i rollback;
18. Patryk oraz tata osobno zatwierdzają przełączenie.

Niespełnienie któregokolwiek z punktów 11–17 blokuje rezygnację z narzędzia, które nadal obsługuje odpowiednią funkcję.

## Miary pilota

- czas do podania ceny;
- czas do zapisania kompletnej rezerwacji;
- liczba pomyłek lub blokad spowodowanych powiększonym tekstem;
- liczba tapnięć od otwarcia aplikacji do wyceny;
- liczba powrotów do Mobile Calendar podczas rozmowy;
- liczba ręcznych korekt ceny;
- liczba brakujących lub niezrozumiałych pól;
- zgodność aktywnych rezerwacji i blokad;
- liczba niewyjaśnionych różnic cen;
- liczba e-maili wymagających poprawy;
- liczba błędów dostawy i duplikatów;
- liczba sytuacji, w których tata potrzebował pomocy Patryka.

Po pilocie przeprowadzić osobny wywiad z tatą. Jego feedback trafia do rejestru pomysłów, jest oceniany i dopiero potem może zmienić kolejność planu.
