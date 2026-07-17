# Stawy OS — słownik KPI v1

**Status:** zaakceptowany do kontynuacji 17 lipca 2026
**Data:** 17 lipca 2026
**Cel:** jedna interpretacja danych operacyjnych, sprzedażowych i zarządczych

## Zasady obowiązkowe

1. Każda liczba biznesowa ma nazwę, okres, walutę, źródło, czas obliczenia i poziom kompletności.
2. Okresy są przedziałami domkniętymi z lewej i otwartymi z prawej: `[od, do)`.
3. Pobyt `[check-in, check-out)` nie obejmuje nocy dnia wyjazdu.
4. Anulowane rezerwacje, kosz i wpisy testowe nie wchodzą do KPI, chyba że metryka jawnie dotyczy anulacji.
5. PLN i EUR nie są sumowane. Przeliczenie jest dozwolone dopiero po zapisaniu źródła kursu, daty i rodzaju kursu.
6. Wartość rezerwacji, przychód zrealizowany, wpłata i saldo to cztery różne pojęcia.
7. Koszty faktyczne i modelowane są prezentowane oddzielnie.
8. Brak danych nie oznacza zera.

## Minimalne metadane każdej karty

| Pole | Znaczenie |
|---|---|
| `metricId` | stabilny identyfikator definicji |
| `periodFrom`, `periodTo` | granice okresu `[od, do)` |
| `currency` | jedna waluta albo `nie dotyczy` |
| `source` | system i typ rekordów wejściowych |
| `calculatedAt` | moment obliczenia |
| `completeness` | `pełne`, `częściowe` albo `brak danych` |
| `sampleSize` | liczba rekordów/nocy użytych w obliczeniu |
| `filters` | statusy, domki i inne jawne ograniczenia |

## Definicje podstawowe

### Rezerwacja aktywna

Rezerwacja, która łącznie:

- ma potwierdzenie w nadrzędnym źródle rezerwacji,
- nie ma statusu `Anulowana`,
- nie znajduje się w koszu (`deletedAt` jest puste),
- ma poprawny przedział `checkIn < checkOut`,
- nie jest rekordem demonstracyjnym lub technicznym.

Status operacyjny `Nowa` nie wystarcza samodzielnie do uznania rezerwacji za aktywną w kanałach.

### Sprzedana noc

Jedna noc jednego domku objęta aktywną rezerwacją. Liczymy przecięcie pobytu z okresem raportowym, noc po nocy.

Przykład: pobyt `30 lipca–2 sierpnia` zawiera trzy noce. Raport lipcowy dostaje dwie noce, a sierpniowy jedną.

### Wartość rezerwacji

Uzgodniona wartość pobytu w walucie rezerwacji, niezależna od momentu wpłaty i realizacji pobytu. Nie jest nazywana przychodem ani gotówką.

Przy braku pełnej ceny wynik ma kompletność `częściowe`; brakująca kwota nie jest zastępowana zerem.

### Przychód zrealizowany — zarządczy

Wartość usług przypisana do nocy faktycznie zrealizowanych w okresie. Dla pobytu przecinającego okres wartość noclegowa jest dzielona na odpowiednie noce.

To metryka zarządcza, nie definicja podatkowa ani księgowa. Dodatki, opłaty i podatki wymagają osobnych składników; dopóki ich nie rozdzielamy, karta musi ujawnić ograniczenie.

### Wpłata

Transakcja pieniężna o statusie `Zaksięgowana`, potwierdzona przez bank, operatora płatności lub raport OTA. Liczymy ją według `occurredAt` i waluty dowodu płatności.

- `Wpłata` i `Zaliczka` zwiększają otrzymaną gotówkę.
- `Zwrot` ją zmniejsza.
- `Prowizja`, `Koszt` i `Wypłata OTA` są prezentowane w osobnych warstwach i nie zastępują wpłat gościa bez uzgodnienia.
- status `Oczekuje` nie zwiększa gotówki.

### Saldo rezerwacji

`wartość rezerwacji − zaksięgowane wpłaty netto` w tej samej walucie.

Wpłaty netto to wpłaty i zaliczki pomniejszone o zwroty. Saldo ujemne jest nadpłatą; nie wolno automatycznie obcinać go do zera.

### Koszt faktyczny

Koszt wynikający z dokumentu, rachunku, faktury, wyciągu lub zaksięgowanej transakcji. Musi mieć datę, kwotę, walutę, kategorię i źródło dowodu. Alokacja do domku lub pobytu musi być jawna.

### Koszt modelowany

Założenie używane do scenariusza, np. koszt miesięczny, koszt pobytu, koszt nocy albo procent przychodu. Nie może być pokazany jako wydatek faktyczny. Karta podaje nazwę reguły, wartość, datę obowiązywania i zakres.

### Rezerwacja direct

Rezerwacja zawarta bez umowy prowizyjnej OTA, nawet jeśli gość wcześniej odkrył obiekt przez Google, Facebook lub polecenie.

Kanał rezerwacji i źródło odkrycia są osobnymi polami. Do czasu normalizacji kanałów klasyfikacja direct wymaga braku referencji OTA oraz zweryfikowanego kanału zawarcia, np. telefon, e-mail, strona własna lub kontakt bezpośredni. Rekord niejednoznaczny nie jest automatycznie klasyfikowany jako direct.

## KPI pochodne

### Obłożenie komercyjne

`sprzedane noce / dostępne noce × 100%`

Dostępne noce to pojemność aktywnych domków w okresie pomniejszona o potwierdzone wyłączenia techniczne. Blokada właścicielska nie jest sprzedażą i domyślnie pozostaje w mianowniku; jeśli biznes chce osobną metrykę wykorzystania dostępnego inventory, musi ona mieć inną nazwę.

### ADR

`zrealizowana wartość noclegowa / sprzedane noce`

ADR liczymy osobno dla każdej waluty. Rezerwacje bez uzgodnionej ceny obniżają kompletność i nie są dodawane jako zero.

### RevPAR

`zrealizowana wartość noclegowa / dostępne noce`

Okres i reguła dostępnych nocy muszą być identyczne jak w obłożeniu komercyjnym.

### Udział direct

Musi jawnie wskazać podstawę:

- `direct share — rezerwacje`: liczba aktywnych rezerwacji direct / liczba wszystkich aktywnych rezerwacji,
- `direct share — wartość`: wartość aktywnych rezerwacji direct / wartość wszystkich aktywnych rezerwacji w jednej walucie,
- `direct share — noce`: sprzedane noce direct / wszystkie sprzedane noce.

Nie wolno prezentować samego „udział direct” bez wskazania podstawy.

### Gotówka netto

Zaksięgowane wpływy pieniężne minus zaksięgowane zwroty i wydatki w okresie. Nie jest równa wartości rezerwacji ani przychodowi zrealizowanemu.

### Wynik zarządczy

`przychód zrealizowany − koszty faktyczne − jawnie wskazane koszty modelowane`

Wynik może być ujemny. Interfejs nie może obcinać straty do zera.

## Kompletność i poziom zaufania

| Poziom | Warunek | Dozwolone użycie |
|---|---|---|
| Pełne | wszystkie rekordy okresu mają wymagane pola i przeszły uzgodnienie | raport operacyjny i decyzja biznesowa |
| Częściowe | istnieją braki, importy oczekujące lub nieuzgodnione kwoty | obserwacja z widocznym ostrzeżeniem; bez automatycznej rekomendacji |
| Brak danych | brak wiarygodnych rekordów albo nieznane źródło | wyłącznie komunikat o braku danych |

Dla insightów marketingowych:

- próbka `< 10`: nie pokazujemy rekomendacji,
- próbka `10–29`: wniosek kierunkowy o niskim poziomie zaufania,
- próbka `≥ 30`: można pokazać wniosek, nadal z okresem i kompletnością.

Próg próbki nie naprawia błędu selekcji ani brakujących danych.

## Minimalne przypadki testowe

1. Pobyt przecinający miesiąc i rok.
2. Wyjazd i kolejny przyjazd tego samego dnia.
3. Rezerwacja anulowana oraz rekord w koszu.
4. Pobyt bez ceny i pobyt w EUR obok pobytu w PLN.
5. Częściowa wpłata, zwrot i nadpłata.
6. Koszt faktyczny oraz modelowany dotyczący tego samego pobytu — bez podwójnego naliczenia.
7. Blokada techniczna i właścicielska wpływające inaczej na mianownik.
8. Direct z polecenia oraz rezerwacja OTA odkryta wcześniej przez Google.
9. Próbka marketingowa równa 0, 9, 10, 29 i 30.
10. 29 lutego oraz zmiana czasu Europe/Warsaw.

## Stan obecnych ekranów

Do zakończenia PR-5 i PR-6 istniejące KPI pulpitu i Finansów są wskaźnikami pilotażowymi. Nie mogą być traktowane jako wdrożenie tego słownika, dopóki:

- nie korzystają ze wspólnego silnika okresów,
- nie rozdzielają sprzedaży, realizacji, gotówki i wyniku,
- nie pokazują źródła, kompletności oraz waluty,
- nie przejdą przypadków testowych powyżej.
