# Rejestr pomysłów Stawy OS

To jest jedno źródło prawdy dla luźnych pomysłów produktowych. Pomysł nie musi być gotową specyfikacją. Najpierw go zapisujemy, potem porównujemy z istniejącym systemem, zawężamy do małego testu i dopiero wtedy kierujemy do realizacji.

Ostatnia aktualizacja: 2026-07-25.

## Jak dodawać pomysły

Wystarczy powiedzieć na przykład:

> Dodaj pomysł: chciałbym móc...

Codex ma wtedy:

1. zapisać pomysł, nawet jeśli jest nieprecyzyjny;
2. sprawdzić, czy coś podobnego już istnieje w kodzie lub planie;
3. wskazać najmniejszy użyteczny zakres;
4. nadać status i priorytet;
5. umieścić go w kolejce;
6. nie wdrażać go bez osobnego polecenia.

## Statusy

| Status | Znaczenie |
|---|---|
| Skrzynka | Pomysł zapisany, ale jeszcze niesprawdzony. |
| Do walidacji | Problem jest zrozumiały, lecz brakuje dowodu, danych lub decyzji. |
| Do pilotażu | Wiemy, jaki mały test może potwierdzić wartość pomysłu. |
| Gotowy do realizacji | Zakres, wartość, zależności i kryteria akceptacji są wystarczająco jasne. |
| W realizacji | Trwa wdrożenie. |
| Zrealizowany | Funkcja działa i została sprawdzona. |
| Wstrzymany | Pomysł ma sens, ale teraz istnieje ważniejsza zależność lub ograniczenie. |
| Odrzucony / scalony | Pomysł nie rozwiązuje istotnego problemu albo został połączony z innym. |

## Priorytety

| Priorytet | Kiedy go używać |
|---|---|
| P0 — pilne | Bezpieczeństwo, zgodność, utrata danych lub blokada bieżącej działalności. |
| P1 — teraz | Jasna wartość operacyjna lub finansowa, częste użycie i mały albo dobrze poznany zakres. |
| P2 — następne | Wartościowe, ale zależne od P1, wymagające pilota lub używane rzadziej. |
| P3 — później | Problem jest jeszcze niejasny, korzyść niepotwierdzona albo istnieje prostsze rozwiązanie. |

Priorytet nie wynika z atrakcyjności funkcji. Liczą się: waga problemu, częstotliwość, pewność, koszt wdrożenia, ryzyko błędnych danych i zależności.

## Kolejka

| Kolejność | ID | Pomysł | Status | Priorytet | Najbliższy krok |
|---:|---|---|---|---|---|
| 1 | POM-005 | Szybka wycena i zapis rezerwacji podczas rozmowy z gościem | Gotowy do realizacji | P1 — teraz | Przejść z tatą 10 rzeczywistych zapytań telefonicznych i zmierzyć zgodność ceny, czas wyceny oraz brakujące pola. |
| 2 | POM-006 | Cennik zgodny z Mobile Calendar: sezony, święta i długie weekendy | Do walidacji | P1 — teraz | Wyeksportować lub sfotografować obowiązujące stawki i porównać 10 terminów z kalkulatorem Stawy OS. |
| 3 | POM-004 | Czytelny stan obiektu: kto jest i co wydarzy się następne | Gotowy do realizacji | P1 — teraz | Sprawdzić prototyp kart domków na rzeczywistym tygodniu rezerwacji, w tym zmianę gości tego samego dnia. |
| 4 | POM-007 | E-mail z aplikacji: szablon, zatwierdzenie, wysyłka i status | Do walidacji | P1 — teraz | Zebrać używane szablony i ustalić, które wiadomości Mobile Calendar wysyła, z jakiego adresu oraz z jakim potwierdzeniem. |
| 5 | POM-001 | Ogólny rejestr faktycznych kosztów | Do pilotażu | P1 — teraz | Wprowadzić ręcznie koszty jednego zamkniętego miesiąca i porównać sumę z rachunkami. |
| 6 | POM-002 | Odczyty liczników i koszt energii | Do pilotażu | P2 — następne | Zapisać 2–3 kolejne odczyty jednego licznika ze zdjęciami i ręcznie potwierdzonymi wartościami. |
| 7 | POM-003 | Rejestr zdarzeń operacyjnych, np. wcześniejszy wyjazd | Do walidacji | P3 — później | Zebrać pięć rzeczywistych przykładów i sprawdzić, których nie obsługuje już podsumowanie pobytu, zadanie lub usterka. |

---

## POM-001 — Ogólny rejestr faktycznych kosztów

**Data dodania:** 2026-07-24<br>
**Status:** Do pilotażu<br>
**Priorytet:** P1 — teraz<br>
**Źródło:** rozmowa z Patrykiem

### Oryginalna potrzeba

Chcę móc szybko zapisać koszt, na przykład: „zapłaciłem 200 zł za wymianę”, „dokupiłem wyposażenie” albo „zapłaciłem za spawanie huśtawki”, a następnie widzieć historię i sumę wszystkich kosztów.

### Problem i oczekiwany efekt

Koszty działalności powstają niezależnie od konkretnych rezerwacji. Bez prostego rejestru uciekają, a wynik finansowy jest zaniżony lub nie da się go wiarygodnie policzyć.

Efektem ma być baza faktycznie poniesionych kosztów z filtrowaniem i sumą dla miesiąca, roku, kategorii oraz — gdy ma to sens — domku.

### Co już istnieje

- Model finansowy rozróżnia koszt faktyczny od modelowanego.
- Transakcja może mieć typ `Koszt`, kategorię, datę, kwotę, walutę, źródło i powiązanie z domkiem lub modelem kosztu.
- Wynik zarządczy potrafi uwzględnić faktyczne koszty i chronić przed częścią duplikatów.
- Koszt można obecnie dodać tylko z panelu konkretnej rezerwacji. To nie pasuje do naprawy huśtawki, zakupu wyposażenia ani kosztu wspólnego.

### Najmniejszy sensowny zakres

Formularz „Dodaj koszt” dostępny bez wchodzenia do rezerwacji:

- data poniesienia kosztu;
- kwota i waluta;
- kategoria;
- krótki opis;
- źródło: paragon, faktura, przelew, umowa albo jawny szacunek;
- opcjonalny numer dokumentu;
- przypisanie: konkretny domek, wiele domków albo koszt wspólny;
- opcjonalne zdjęcie lub załącznik;
- opcjonalne powiązanie z modelem kosztu, aby nie policzyć tej samej pozycji dwa razy.

Pierwsza wersja nie jest programem księgowym, nie rozlicza podatków i nie wysyła danych do KSeF.

### Walidacja

1. Wybrać jeden zamknięty miesiąc.
2. Wprowadzić 10–20 rzeczywistych kosztów na podstawie rachunków i pamięci właściciela.
3. Porównać sumę aplikacji z ręcznym zestawieniem.
4. Sprawdzić, czy każdą pozycję da się przypisać bez tworzenia fikcyjnej rezerwacji.
5. Sprawdzić, czy koszt faktyczny nie dubluje kosztu modelowanego.

### Kryterium decyzji

Przenieść do „Gotowy do realizacji”, jeżeli próbkę jednego miesiąca da się wprowadzić bez sztucznych obejść, a suma i podział kosztów zgadzają się z ręcznym rachunkiem.

### Ryzyka i pytania

- Czy zdjęcie dokumentu ma być obowiązkowe, czy tylko opcjonalne?
- Jak dzielić koszty wspólne między domki: równo, według przychodu czy ręcznie?
- Czy potrzebne są koszty ujemne/korekty?
- Trzeba zachować rozdział między rejestrem operacyjnym a księgowością.

---

## POM-002 — Odczyty liczników i koszt energii

**Data dodania:** 2026-07-24<br>
**Status:** Do pilotażu<br>
**Priorytet:** P2 — następne<br>
**Źródło:** rozmowa z Patrykiem

### Oryginalna potrzeba

Ojciec przesyła zrzut ekranu albo zdjęcie ze stanem licznika. Chcę zapisać obraz i odczyt, a potem móc policzyć zużycie oraz koszt energii.

### Problem i oczekiwany efekt

Zdjęcia odczytów giną w wiadomościach, a sam koszt energii nie ma trwałego powiązania z odczytami. Potrzebna jest historia, z której da się odtworzyć: kiedy wykonano odczyt, którego licznika dotyczył, jaka była wartość i skąd się wzięła.

### Co już istnieje

- Energia jest kategorią kosztu w modelu finansowym.
- Plan wdrożenia już zakłada najpierw ręczne odczyty z datą, identyfikatorem licznika i źródłem lub zdjęciem, a integrację API dopiero po potwierdzeniu wartości.
- Nie ma jeszcze rekordu odczytu licznika ani interfejsu do jego dodawania.

### Najmniejszy sensowny zakres

Etap A — wiarygodna historia odczytów:

- licznik i jego lokalizacja;
- data oraz godzina odczytu;
- wartość w kWh;
- zdjęcie lub zrzut ekranu jako dowód;
- osoba lub kanał, z którego pochodzi odczyt;
- notatka;
- automatycznie policzona różnica względem poprzedniego odczytu.

W pierwszej wersji wartość jest wpisywana ręcznie. Później OCR może tylko zasugerować liczbę, którą człowiek musi zatwierdzić.

Etap B — koszt energii, dopiero po wiarygodnych odczytach:

- okres obowiązywania taryfy;
- cena energii za kWh;
- osobno opłaty stałe i inne składniki faktury;
- koszt wyliczony z zużycia, wyraźnie oznaczony jako estymacja;
- koszt z faktury oznaczony jako fakt i mający pierwszeństwo przed estymacją.

### Walidacja

1. Dodać 2–3 kolejne odczyty tego samego licznika.
2. Porównać różnicę kWh z ręcznym obliczeniem.
3. Dla jednego okresu rozliczeniowego porównać estymację z prawdziwą fakturą.
4. Spisać składniki faktury, których nie da się wyliczyć przez proste `kWh × stawka`.

### Kryterium decyzji

Historia odczytów przechodzi do realizacji, jeśli zapis zdjęcia i ręcznej wartości oszczędza szukanie danych w wiadomościach i daje poprawną różnicę kWh. Kalkulator kosztu przechodzi dalej dopiero wtedy, gdy model jednej prawdziwej faktury mieści się w uzgodnionej tolerancji.

### Ryzyka i pytania

- Czy istnieje jeden licznik, czy osobne liczniki dla domków i części wspólnych?
- Czy przesyłane są zdjęcia fizycznego licznika, zrzuty z aplikacji operatora, czy oba rodzaje?
- Taryfa może zawierać strefy czasowe, opłaty dystrybucyjne, stałe i korekty.
- Błędny OCR nie może automatycznie zatwierdzić wartości ani tworzyć kosztu.
- Potrzebne jest ustalenie sposobu przypisania zużycia wspólnego do domków.

### Zależności

- POM-001 dla zapisu kosztu z faktury i uniknięcia dublowania estymacji.
- Magazyn załączników lub zdjęć.

---

## POM-003 — Rejestr zdarzeń operacyjnych

**Data dodania:** 2026-07-24<br>
**Status:** Do walidacji<br>
**Priorytet:** P3 — później<br>
**Źródło:** rozmowa z Patrykiem

### Oryginalna potrzeba

Chcę móc dodać rekord w stylu „ktoś wyjechał wcześniej” i zachować takie informacje w historii.

### Problem i oczekiwany efekt

Nietypowe zdarzenia z pobytu mogą być ważne później, ale giną w rozmowach i pamięci. Nie jest jeszcze jasne, czy potrzebny jest uniwersalny dziennik zdarzeń, czy tylko kilka brakujących pól w istniejących procesach.

### Co już istnieje

- Podsumowanie wyjazdu zapisuje faktyczny czas zapisu wyjazdu, status „Wyjechali”, „Późny wyjazd” albo „Niepotwierdzone”, uwagi dla sprzątania, szkody i usterki.
- Zadania oraz zgłoszenia usterek obsługują rzeczy wymagające dalszej pracy.
- Brakuje jawnego statusu „Wcześniejszy wyjazd” i porównania faktycznej godziny z planem.

### Hipoteza najmniejszego zakresu

Najpierw rozszerzyć podsumowanie wyjazdu o:

- faktyczną datę i godzinę wyjazdu;
- status „wcześniej / zgodnie z planem / później” wyliczony względem planu;
- krótką przyczynę lub notatkę;
- oznaczenie, czy zdarzenie wymaga działania.

Uniwersalny dziennik zdarzeń tworzyć dopiero wtedy, gdy pojawią się ważne przypadki, których nie da się sensownie umieścić w rezerwacji, koszcie, zadaniu, podsumowaniu pobytu albo usterce.

### Walidacja

Zebrać pięć rzeczywistych przykładów zdarzeń, które warto zachować. Dla każdego wskazać, kto później korzysta z tej informacji i jaką decyzję dzięki niej podejmuje.

### Kryterium decyzji

- Jeśli większość przykładów dotyczy wyjazdu, rozwinąć istniejące podsumowanie pobytu.
- Jeśli przykłady regularnie przecinają wiele modułów i mają późniejszego odbiorcę, zaprojektować dziennik zdarzeń.
- Jeśli informacja nie prowadzi do żadnej decyzji ani działania, pozostawić zwykłą notatkę zamiast budować nowy moduł.

### Pytania

- Jakie zdarzenia poza wcześniejszym wyjazdem mają być zapisywane?
- Czy zapis ma uruchamiać zadanie, powiadomienie albo zmianę planu sprzątania?
- Kto dodaje rekord: Patryk, ojciec, osoba sprzątająca czy system?

---

## POM-004 — Czytelny stan obiektu: kto jest i co wydarzy się następne

**Data dodania:** 2026-07-24<br>
**Status:** Gotowy do realizacji<br>
**Priorytet:** P1 — teraz<br>
**Źródło:** rozmowa z Patrykiem

### Oryginalna potrzeba

Chcę otworzyć aplikację i od razu zobaczyć stan każdego obiektu: czy jest zajęty, kto teraz w nim mieszka, jak długo jeszcze zostaje oraz kto przyjeżdża następny. Przydałoby się też przypomnienie w stylu „jutro przyjeżdża ta osoba”.

### Problem i oczekiwany efekt

Sam komunikat „Zajęty do…” odpowiada tylko na część pytania. W bieżącej pracy potrzebna jest odpowiedź możliwa do odczytania w kilka sekund:

1. Czy domek jest teraz zajęty?
2. Kto w nim jest?
3. Kiedy wyjeżdża i ile nocy zostało?
4. Kto i kiedy przyjeżdża następny?

Ekran „Dzisiaj” ma pełnić rolę odprawy operacyjnej, bez konieczności otwierania kalendarza lub szczegółów kilku rezerwacji.

### Co już istnieje

- Dashboard wylicza aktywne pobyty oraz najbliższe przyjazdy i wyjazdy.
- Sekcja „Stan obiektu” pokazuje każdy domek jako „Zajęty do…” albo „Wolny i gotowy”.
- Imię i nazwisko lub etykieta gościa (`guestLabel`) są już zapisane i widoczne w listach przyjazdów, wyjazdów, kalendarzu oraz wyszukiwarce.
- Karta „Stan obiektu” nie pokazuje obecnie nazwy gościa ani względnego czasu do wyjazdu.
- System alertów obejmuje synchronizację, płatności, rekordy do sprawdzenia i zablokowane zadania, ale nie ostrzega o jutrzejszym przyjeździe.

Wniosek: większość potrzebnych danych i obliczeń już istnieje. To głównie poprawa hierarchii informacji i dodanie prostej reguły alertu, a nie nowy moduł.

### Najmniejszy sensowny zakres

#### Etap A — karta każdego domku na ekranie „Dzisiaj”

Dla trwającego pobytu pokazać:

- status „Goście na miejscu”;
- imię i nazwisko lub obecną etykietę gościa;
- datę wyjazdu;
- czytelny opis względny, np. „wyjazd jutro · została 1 noc”;
- liczbę osób;
- przejście do szczegółów rezerwacji po kliknięciu.

Dla wolnego domku pokazać:

- status „Wolny”;
- najbliższy przyjazd;
- imię i nazwisko kolejnego gościa;
- opis względny, np. „przyjazd jutro” albo „za 3 dni”.

Jeżeli jednego dnia jest wyjazd i kolejny przyjazd, karta ma pokazać stan „Zmiana gości dzisiaj”, zamiast błędnie sugerować zwykłą wolność lub zajętość.

#### Etap B — przypomnienia wewnątrz aplikacji

- Alert „Jutro przyjeżdża [gość] · [domek]”.
- Opcjonalnie alert „Dzisiaj zmiana gości” dla wyjazdu i przyjazdu w tym samym domku.
- Kliknięcie alertu otwiera właściwą rezerwację.
- Jedno zdarzenie tworzy jeden alert; odświeżenie aplikacji nie może go dublować.

Na początku wystarczy alert widoczny po otwarciu aplikacji. Zewnętrzne powiadomienia push są osobnym zakresem, ponieważ wymagają konfiguracji urządzenia, uprawnień oraz decyzji dotyczącej pokazywania danych gościa na ekranie blokady.

### Walidacja

Przez tydzień otwierać ekran „Dzisiaj” podczas codziennej odprawy i sprawdzać, czy bez przechodzenia do kalendarza da się w mniej niż pięć sekund odpowiedzieć:

1. kto jest teraz w każdym domku;
2. kiedy nastąpi najbliższy wyjazd;
3. kto przyjeżdża następny;
4. czy dzisiaj albo jutro jest zmiana wymagająca działania.

Próba powinna obejmować domek wolny, pobyt wielodniowy, przyjazd jutro oraz wyjazd i przyjazd tego samego dnia.

### Kryteria akceptacji

- Karta zawsze wskazuje właściwego bieżącego gościa i prowadzi do jego rezerwacji.
- Liczba pozostałych nocy oraz opis „dzisiaj / jutro / za N dni” zgadzają się z datami rezerwacji w polskiej strefie czasowej.
- Rezerwacje anulowane, usunięte i historyczne nie pojawiają się jako bieżący stan.
- Zmiana gości tego samego dnia nie jest przedstawiana jako „Wolny i gotowy”.
- Alert o jutrzejszym przyjeździe pojawia się dokładnie raz i prowadzi do właściwej rezerwacji.

### Ryzyka i decyzje

- „Zostały N dni” może być niejednoznaczne; bezpieczniej pokazywać dokładną datę oraz liczbę pozostałych nocy.
- Pełne dane gościa powinny być widoczne wyłącznie po zalogowaniu.
- W przyszłym powiadomieniu push domyślnie można ukryć nazwisko na ekranie blokady, np. pokazać „Jutro przyjazd · Domek 1”.
- Trzeba poprawnie obsłużyć godzinę wymeldowania, a nie uznawać domku za wolny od północy w dniu wyjazdu.

---

## POM-005 — Szybka wycena i zapis rezerwacji podczas rozmowy z gościem

**Data dodania:** 2026-07-25<br>
**Status:** Gotowy do realizacji<br>
**Priorytet:** P1 — teraz<br>
**Źródło:** rozmowa Patryka z tatą

### Oryginalna potrzeba

Podczas rozmowy telefonicznej tata chce zaznaczyć domek i zakres dat, natychmiast podać klientowi cenę, zdecydować o rabacie, a następnie zapisać rezerwację wraz z danymi klienta, źródłem rezerwacji i kwotą do zapłaty.

### Problem i oczekiwany efekt

Operator nie może w trakcie rozmowy przechodzić przez wiele ekranów ani ręcznie liczyć stawek dla kolejnych nocy. Potrzebuje jednego, krótkiego przepływu:

1. wybrać domek i termin;
2. potwierdzić dostępność;
3. zobaczyć cenę z cennika i jej podstawę;
4. opcjonalnie udzielić rabatu;
5. podać klientowi cenę;
6. zapisać dane rezerwacji bez ponownego wpisywania terminu.

Docelowo wycena ma być możliwa w kilkadziesiąt sekund, a pełny zapis rezerwacji w mniej niż dwie minuty.

### Co już istnieje

- Kalendarz pozwala rozpocząć nową rezerwację po kliknięciu wolnego dnia.
- Formularz sprawdza konflikty rezerwacji i blokad.
- Po wybraniu domku i zakresu `quoteStay` liczy cenę każdej nocy według aktywnej reguły.
- Formularz zbiera imię, nazwisko lub nazwę rezerwacji, telefon, e-mail, źródło, numer zewnętrzny, liczbę osób, cenę i status płatności.
- Cena może pochodzić z cennika albo zostać ustawiona ręcznie.
- Import Mobile Calendar przechowuje nazwę gościa, cenę, kontakt, źródło i identyfikator zewnętrzny.

### Najmniejszy sensowny zakres

#### Etap A — szybka wycena bez utraty danych

- wybór domku oraz dat przyjazdu i wyjazdu;
- natychmiastowa informacja o dostępności lub konflikcie;
- cena z cennika: suma, średnia cena za noc i rozbicie według zastosowanych sezonów;
- ostrzeżenie o minimalnej długości pobytu;
- możliwość przejścia z wyceny do formularza rezerwacji bez ponownego wpisywania danych;
- brak zapisu rezerwacji, jeżeli operator tylko sprawdza cenę.

#### Etap B — kontrolowany rabat i zapis

- cena z cennika pozostaje widoczna jako punkt odniesienia;
- operator może podać cenę końcową;
- system pokazuje wartość i procent rabatu albo dopłaty;
- ręczna zmiana wymaga krótkiego powodu, np. stały klient, ostatnia chwila, barter albo indywidualne ustalenie;
- zapis obejmuje co najmniej: termin, domek, osoby, imię i nazwisko lub nazwę rezerwacji, kontakt, kanał zawarcia, cenę, walutę i status płatności;
- rezerwacja utworzona w pilocie ma czytelny stan „wymaga potwierdzenia w źródle nadrzędnym”, dopóki Mobile Calendar/OTA pozostaje źródłem prawdy.

### Walidacja

1. Wybrać 10 rzeczywistych zapytań obejmujących niski sezon, wysoki sezon, święto lub długi weekend, zmianę stawki w środku pobytu i ręczny rabat.
2. Tata wykonuje wycenę bez pomocy Patryka.
3. Porównać cenę z aktywnym cennikiem Mobile Calendar.
4. Zmierzyć czas do podania ceny oraz czas do pełnego zapisu.
5. Zapisać każde pole, którego operator szukał poza tym przepływem.

### Kryteria akceptacji

- 10/10 wycen bez rabatu odpowiada zatwierdzonemu cennikowi.
- Każda noc ma możliwą do wskazania regułę lub cenę bazową.
- Rabat nie nadpisuje po cichu ceny z cennika i ma zapisany powód.
- Konflikt jest widoczny przed przedstawieniem terminu jako dostępnego.
- Tata potrafi samodzielnie podać cenę w mniej niż 30 sekund i zapisać kompletną rezerwację w mniej niż dwie minuty.
- W pilocie lokalny zapis nie udaje potwierdzenia w OTA.

### Zależności i miejsce w planie

- PR-7 i PR-8 dla bezpiecznej wielosesyjności oraz zapisu domenowego.
- PR-9a dla roli operatora/managera.
- PR-10c dla prostego formularza, listy i szczegółu rezerwacji.
- PR-10d dla docelowej obsługi wyboru zakresu w kalendarzu.
- POM-006 dla potwierdzonego cennika.
- Kontrolowany gateway i uzgodnienie danych przed przejęciem źródła prawdy.

---

## POM-006 — Cennik zgodny z Mobile Calendar: sezony, święta i długie weekendy

**Data dodania:** 2026-07-25<br>
**Status:** Do walidacji<br>
**Priorytet:** P1 — teraz<br>
**Źródło:** rozmowa Patryka z tatą

### Oryginalna potrzeba

Tata ma w Mobile Calendar stawki zależne od domku, sezonu, świąt i długich weekendów. Po wybraniu zakresu aplikacja ma podać właściwą cenę za cały pobyt.

### Problem i oczekiwany efekt

Silnik kalkulacji istnieje, ale jego wynik będzie wiarygodny dopiero po przeniesieniu i zatwierdzeniu prawdziwych stawek. Błędna albo niepełna reguła cenowa może spowodować podanie klientowi złej ceny.

Efektem ma być wersjonowany cennik, w którym dla każdej nocy można wskazać domek, obowiązującą regułę, cenę i minimalną długość pobytu.

### Co już istnieje

- Cena bazowa na noc jest przypisana do domku.
- Datowane reguły cenowe obsługują sezony: niski, średni, wysoki, święta/długi weekend, promocja i specjalny.
- Reguły mogą mieć minimalną liczbę nocy.
- Każda noc pobytu jest liczona oddzielnie, a bardziej szczegółowa reguła ma pierwszeństwo.
- Cennik nie publikuje jeszcze cen do OTA i w pilocie nie jest nadrzędnym źródłem sprzedaży.

### Najmniejszy sensowny zakres

- spis wszystkich aktywnych stawek Mobile Calendar per domek;
- okres obowiązywania każdej stawki;
- kategoria sezonu lub wyjątku;
- cena za noc i waluta;
- minimalna długość pobytu;
- źródło oraz data weryfikacji;
- jawne pierwszeństwo reguł przy nakładaniu się sezonu, święta, promocji lub wyjątku;
- test terminu przecinającego dwie różne reguły;
- historia zmiany cennika albo co najmniej data obowiązywania, aby nowa cena nie przepisywała wcześniejszych rezerwacji.

### Walidacja

1. Wyeksportować, sfotografować albo ręcznie spisać aktywny cennik Mobile Calendar.
2. Wybrać co najmniej 10 terminów dla różnych domków i rodzajów sezonu.
3. Porównać cenę Mobile Calendar ze Stawy OS noc po nocy i łącznie.
4. Wyjaśnić każdą różnicę przed dopuszczeniem kalkulatora do rozmów z klientami.
5. Potwierdzić z tatą minimalne długości pobytu i regułę pierwszeństwa dla świąt oraz długich weekendów.

### Kryteria decyzji

Przenieść do „Gotowy do realizacji”, gdy istnieje kompletna tabela obowiązujących stawek z datami, źródłem i regułą pierwszeństwa. Kalkulator można uznać za gotowy dla taty po zgodności 10/10 kontrolnych terminów.

### Ryzyka i pytania

- Czy Mobile Calendar dolicza osobno sprzątanie, usługi lub opłatę dodatkową?
- Czy cena zależy także od liczby osób, długości pobytu albo dnia tygodnia?
- Czy stawki różnych domków są zawsze niezależne?
- Jak traktować rezerwację złożoną przed zmianą cennika?
- Które święta i długie weekendy są wyjątkami względem zwykłego sezonu?

### Zależności i miejsce w planie

- PR-10c dla prezentacji ceny i ręcznej korekty.
- POM-005 jako przepływ, który korzysta z cennika.
- Dane lub zrzuty z Mobile Calendar.
- Gateway cenowy pozostaje poza zakresem do Etapu 7.

---

## POM-007 — E-mail z aplikacji: szablon, zatwierdzenie, wysyłka i status

**Data dodania:** 2026-07-25<br>
**Status:** Do walidacji<br>
**Priorytet:** P1 — teraz<br>
**Źródło:** rozmowa Patryka z tatą

### Oryginalna potrzeba

Tata korzysta z gotowych szablonów i wysyła e-maile bezpośrednio z Mobile Calendar. Pierwsza wersja Stawy OS przeznaczona do zastąpienia tego narzędzia również musi umożliwiać wysyłkę z poziomu aplikacji, a nie tylko kopiowanie treści do osobnego programu pocztowego.

### Problem i oczekiwany efekt

Sam szablon lub przycisk „wyślij” nie wystarczają. Operator musi wiedzieć, do kogo, z jakiego adresu i jaka wersja treści została wysłana oraz czy dostawca przyjął wiadomość. Ponowienie po błędzie nie może tworzyć duplikatu.

Efektem ma być prosty przepływ: wybierz szablon → sprawdź odbiorcę i treść → popraw → zatwierdź → wyślij → zobacz prawdziwy status.

### Co już istnieje

- Model wiadomości zawiera wersjonowane szablony, szkice, odbiorcę, temat, status, klucz idempotencji i fingerprint rezerwacji.
- Automaty mogą tworzyć szkice dla potwierdzenia, płatności, przyjazdu, wyjazdu i opinii.
- Interfejs pozwala edytować i zatwierdzić szkic.
- Produkcyjna dostawa e-mail nie jest jeszcze podłączona.
- Zgodnie z ADR wysyłka pozostaje zablokowana do czasu testów dostawcy, statusów, retry, monitoringu i jawnej akceptacji.

### Najmniejszy sensowny zakres

#### Etap A — biblioteka wiadomości operatora

- zinwentaryzować aktualne szablony Mobile Calendar;
- wybrać minimalnie: potwierdzenie rezerwacji, informację o płatności i wiadomość przed przyjazdem;
- przypisać język i wersję;
- dodać zatwierdzony adres nadawcy oraz możliwość odpowiedzi;
- przed wysyłką pokazać odbiorcę, temat, treść, termin, domek, cenę i aktualność danych;
- każda ręczna korekta jest widoczna w finalnej wersji wiadomości.

#### Etap B — produkcyjna dostawa

- wybrać dostawcę i rozdzielić środowisko testowe od produkcyjnego;
- wysyłać tylko po jawnej akcji operatora lub odrębnie zatwierdzonej regule;
- użyć klucza idempotencji, aby retry nie wysłał duplikatu;
- zapisać identyfikator i status dostawcy: kolejka, wysłana, dostarczona, błąd albo odrzucona;
- ograniczony retry z alertem dla niedostarczonej wiadomości ważnej operacyjnie;
- zmiana terminu, ceny, odbiorcy lub języka po zatwierdzeniu cofa wiadomość do ponownego sprawdzenia;
- kill switch wyłącza produkcyjną dostawę bez wyłączania biblioteki szkiców.

### Walidacja

1. Zebrać szablony faktycznie używane przez tatę.
2. Ustalić, z jakiego adresu i przez jakiego dostawcę obecnie wychodzą wiadomości.
3. Wskazać trzy wiadomości niezbędne w pierwszej wersji.
4. Wysłać każdą na adresy kontrolne i sprawdzić temat, format, odpowiedź, status oraz brak duplikatu po retry.
5. Dopiero potem przeprowadzić kontrolowaną wysyłkę do prawdziwego gościa.

### Kryteria decyzji i akceptacji

- Do realizacji przechodzi po zatwierdzeniu nadawcy, trzech szablonów v1 i zasad retry.
- Status `wysłana` lub `dostarczona` pochodzi od dostawcy, nie z samego kliknięcia.
- Ponowienie tego samego żądania nie tworzy drugiego e-maila.
- Tata może edytować i wysłać wiadomość bez otwierania zewnętrznego programu pocztowego.
- Błąd dostawy jest widoczny i prowadzi do jednej konkretnej akcji.
- Produkcyjna bramka może zostać natychmiast zamknięta.

### Zależności i miejsce w planie

- PR-9a dla uprawnienia `send` roli operatora.
- PR-11c dla biblioteki komunikacji, języków i reguł kanałowych.
- Etap 7 / PR-12 dla dostawcy, idempotencji, retry, statusów i monitoringu.
- Zweryfikowany kontakt gościa oraz aktualna rezerwacja.
- Kontrolowany pilot przed rezygnacją z Mobile Calendar.
