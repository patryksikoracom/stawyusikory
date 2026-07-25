# Stawy OS — raport z przejścia taty przez aplikację na telefonie

**Data rozmowy:** 25 lipca 2026  
**Użytkownik:** tata — główny operator rezerwacji  
**Urządzenie:** telefon; około 99% użycia  
**Warunki dostępności:** powiększony tekst systemowy ze względu na wzrok  
**Status:** ustalenia produktowe zapisane; bez zgody na implementację poza osobnymi PR-ami  
**Powiązania:** POM-004–POM-008, `PLAN_MVP_OPERATORA_TATY.md`, PR-9a–PR-12

## Najważniejszy wniosek

Pierwszym ekranem taty nie powinien być ogólny Dashboard z powitaniem, statystykami ani briefem operacyjnym. Ekran startowy operatora ma odpowiadać na pytanie zadawane podczas rozmowy telefonicznej:

> Kiedy jest wolny termin, w którym domku, ile kosztuje i jak od razu zrobić rezerwację?

Kalendarz i dostępność są więc pierwszą czynnością oraz pierwszą informacją. Stan bieżących pobytów, zadania, sprzątanie i statystyki pozostają ważne, ale trafiają niżej lub do osobnego widoku.

To zmienia kolejność wartości w torze operatora:

1. mobilny kalendarz i dostępność;
2. szybka, wiarygodna wycena;
3. zapis rezerwacji i blokada terminu;
4. zaliczka, saldo i wiadomości;
5. przygotowanie przyjazdu, procedura małoletnich i sprzątanie;
6. brief „Dzisiaj”, zadania i statystyki.

## Proces obecny — Mobile Calendar

### 1. Telefon od potencjalnego gościa

Tata otwiera kalendarz, aby zobaczyć zajęte oraz wolne terminy. Nie wybiera dat w oderwanych polach formularza — potrzebuje wizualnego kontekstu całego miesiąca lub osi rezerwacji.

### 2. Wybór terminu i cena

Po znalezieniu luki tata ustala z klientem pierwszy i ostatni dzień pobytu. System wylicza cenę według domku, sezonu i wyjątków. Tata może indywidualnie udzielić rabatu.

### 3. Karta rezerwacji

Po akceptacji terminu wprowadzane są:

- imię i nazwisko lub nazwa rezerwacji;
- numer telefonu;
- adres e-mail;
- opcjonalny adres lub dane potrzebne do dokumentu sprzedaży;
- liczba dorosłych i dzieci;
- domek;
- termin;
- zwierzęta;
- dodatkowe usługi;
- cena z cennika;
- rabat kwotowy albo procentowy;
- cena końcowa;
- procent i kwota zaliczki.

### 4. Blokada terminu i synchronizacja

Po zapisie termin zostaje zablokowany w kalendarzu. Obecne narzędzie ma synchronizować dostępność z Booking, Airbnb i Aloha Camp. Dokładny kierunek, opóźnienie oraz źródło prawdy wymagają potwierdzenia przed zastąpieniem Mobile Calendar.

### 5. Zaliczka i pierwszy e-mail

Domyślna zaliczka wynosi zwykle 33% ceny, ale tata może ustawić np. 50% dla konkretnej rezerwacji. Pierwszy e-mail zawiera co najmniej:

- obiekt;
- termin;
- cenę i kwotę zaliczki;
- termin płatności zaliczki;
- numer konta;
- warunki rezerwacji.

Wiadomość może otrzymać także tata albo inny operator wskazany na liście kopii.

### 6. Po wpłacie zaliczki

Operator ręcznie oznacza wpłatę. Gość otrzymuje kolejną wiadomość z regulaminem, zasadami pobytu, informacjami o łowisku, możliwościach spędzania czasu i innymi przygotowanymi treściami.

### 7. Dopłata

Pełna kwota ma być zaksięgowana najpóźniej dwa dni przed przyjazdem. Jeżeli jej nie ma:

- operator dzwoni albo wysyła przypomnienie;
- brak środków do dnia przyjazdu blokuje wydanie kluczy.

### 8. Przyjazd

Przed przyjazdem gość otrzymuje trasę i informacje organizacyjne. Klucz często wydaje dziadek, dlatego musi mieć dostęp do prostego potwierdzenia:

- właściwa rezerwacja;
- obiekt;
- liczba osób;
- płatność pozwala wydać klucz;
- procedura małoletnich została wykonana, jeżeli była wymagana;
- ewentualne uwagi operacyjne.

Nie potrzebuje pełnego CRM, historii marketingowej ani wszystkich finansów.

### 9. Małoletni

Jeżeli przyjeżdżają dzieci, obecnie pojawia się papierowy druk związany ze Standardami Ochrony Małoletnich. Rozważany jest formularz online z podpisem elektronicznym, ale technologia nie może zostać wybrana przed zatwierdzeniem samej procedury, zakresu danych i wymaganej formy podpisu.

### 10. Sprzątanie

Po potwierdzeniu zaliczki tata informuje osobę sprzątającą o pobytach na najbliższy tydzień. Jeżeli domek pozostawał pusty dłużej niż tydzień, potrzebne może być krótkie odświeżenie dzień przed przyjazdem: kurz, pajęczyny, owady i szybka kontrola gotowości.

## Potwierdzone reguły biznesowe

Poniższe reguły pochodzą z rozmowy i mają zostać zweryfikowane na rzeczywistych przykładach przed zakodowaniem.

### Kalendarz i urządzenie

- telefon jest urządzeniem podstawowym;
- kalendarz jest ekranem startowym roli operatora;
- najważniejsze informacje muszą działać z powiększonym tekstem systemowym;
- wybór terminu ma być wizualny, z widocznymi rezerwacjami i lukami;
- wybór początku i końca pobytu ma otwierać kartę rezerwacji z zachowanym terminem;
- interfejs nie może polegać tylko na kolorze.

### Godziny

- standardowy check-in: od 16:00;
- standardowy check-out: do 11:00;
- pola godzin nie są potrzebne w szybkim formularzu;
- wcześniejszy przyjazd lub późniejszy wyjazd są wyjątkiem zależnym od gotowości domku i wymagają jawnego ustalenia.

Godziny powinny być ustawieniem obiektu, a nie stałą zaszytą w kodzie.

### Zwierzęta

- Czapla: zwierzęta niedozwolone;
- Rybak: zwierzęta dozwolone;
- opłata: 100 PLN za jedno zwierzę za cały pobyt;
- wybór liczby zwierząt automatycznie aktualizuje cenę;
- próba dodania zwierzęcia do Czapli pokazuje regułę obiektu i blokuje zwykły zapis, chyba że właściciel kiedyś zdefiniuje audytowany wyjątek.

### Minimalna długość i minimalna wartość

- standardowy minimalny pobyt: cztery doby;
- krótszy pobyt jest bardzo rzadkim wyjątkiem;
- według rozmowy pobyt krótszy może być rozliczany jak 3,5 doby;
- wyjątek jest decyzją operatora i musi mieć powód.

Reguła „minimum cztery doby, lecz krótszy pobyt liczony jak 3,5 doby” wymaga doprecyzowania. System musi odróżniać:

- faktyczną liczbę noclegów;
- minimalną liczbę noclegów dopuszczoną do rezerwacji;
- minimalną podstawę cenową;
- ręczny wyjątek.

Nie należy zapisywać fikcyjnej daty wyjazdu tylko po to, aby uzyskać wyższą cenę.

### Sezony

- wysoki sezon: 15 czerwca–15 września;
- poza nim obowiązuje niższa cena;
- święta i długie weekendy są wyjątkami;
- święto w wysokim sezonie jest około 10% droższe;
- święto lub długi weekend poza wysokim sezonem ma być według rozmowy około 10% droższy od ceny wysokiego sezonu;
- wyjątki są obecnie ustawiane ręcznie w cenniku.

Słowo „około” nie jest regułą systemową. Przed implementacją trzeba zatwierdzić dokładną cenę albo procent, sposób zaokrąglenia i listę okresów.

### Zaliczka i saldo

- domyślna zaliczka: 33%;
- operator może wybrać inną wartość per rezerwacja, np. 50%;
- kwota zaliczki wynika z ceny końcowej po rabacie;
- termin zapłaty zaliczki nie został jeszcze jednoznacznie ustalony;
- pełna kwota ma być zaksięgowana dwa dni przed przyjazdem;
- brak pełnej wpłaty blokuje wydanie kluczy;
- potwierdzenie przelewu i zaksięgowane środki nie mogą być automatycznie traktowane jako ten sam dowód bez jawnej reguły.

## Docelowy proces wspierany przez aplikację

### Krok 1 — otwarcie aplikacji

Operator po zalogowaniu trafia bezpośrednio do kalendarza dostępności. Powitanie, statystyki i brief nie zajmują miejsca nad kalendarzem.

Na pierwszym ekranie widzi:

- Czapla i Rybak;
- bieżące oraz przyszłe rezerwacje;
- dzisiejszą datę;
- najbliższe wolne luki;
- źródło rezerwacji tekstem lub ikoną, nie tylko kolorem;
- stan synchronizacji i czas ostatniego uzgodnienia.

### Krok 2 — rozmowa i wybór zakresu

Operator wybiera początek i koniec pobytu dwoma tapnięciami na osi lub widoku miesiąca. System:

- wyróżnia cały zakres;
- sprawdza oba domki i blokady;
- pokazuje konflikt przed przejściem dalej;
- zachowuje kontekst sąsiednich rezerwacji;
- nie wymaga ręcznego wpisania standardowych godzin.

### Krok 3 — wycena

Karta ceny pokazuje:

- liczbę faktycznych nocy;
- zastosowane reguły sezonowe noc po nocy;
- cenę noclegów;
- zwierzęta i inne usługi jako osobne pozycje;
- cenę z cennika;
- rabat kwotowy albo procentowy;
- cenę końcową;
- zaliczkę 33% lub wartość ustawioną przez operatora;
- pozostałą kwotę i termin dopłaty.

Jeżeli pobyt łamie minimum, operator widzi wyjątek i podaje powód. System nie zmienia dat pobytu.

### Krok 4 — dane rezerwacji

Minimalna karta na telefonie:

- imię i nazwisko lub nazwa rezerwacji;
- telefon;
- e-mail;
- liczba dorosłych;
- liczba dzieci;
- liczba zwierząt;
- domek i termin odziedziczone z kalendarza;
- źródło/kanał zawarcia;
- dodatkowe usługi;
- uwagi;
- opcjonalne dane do faktury lub dokumentu sprzedaży w osobnej, rozwijanej sekcji.

### Krok 5 — zapis i synchronizacja

Zapis tworzy stan:

1. `oczekuje na synchronizację`;
2. `potwierdzona w źródle`;
3. `konflikt`;
4. `błąd synchronizacji`.

Dopiero potwierdzenie przez właściwy gateway pozwala opisać termin jako bezpiecznie zablokowany w OTA. Lokalny sukces zapisu nie może udawać sukcesu Booking, Airbnb ani Aloha Camp.

### Krok 6 — zaliczka i komunikacja

Po potwierdzeniu rezerwacji system tworzy pierwszy szkic wiadomości. Wdrażanie automatyzacji jest stopniowe:

1. szkic i ręczne zatwierdzenie;
2. ręczna wysyłka z aplikacji i status dostawcy;
3. dopiero po pilocie automatyczna wysyłka dla zatwierdzonego szablonu i bezpiecznego stanu rezerwacji.

Zmiana ceny, terminu, kontaktu, obiektu albo języka po zatwierdzeniu cofa wiadomość do sprawdzenia.

### Krok 7 — płatności

Rezerwacja ma odrębne stany:

- czeka na zaliczkę;
- zaliczka częściowa;
- zaliczka zaksięgowana;
- czeka na dopłatę;
- całość zaksięgowana;
- nadpłata;
- zwrot;
- płatność spóźniona;
- wymaga uzgodnienia.

Zmiana statusu musi wynikać z transakcji albo jawnego wpisu otwarcia, a nie z samego wyboru etykiety.

### Krok 8 — przygotowanie przyjazdu

Po zaksięgowaniu zaliczki:

- powstaje informacja dla sprzątania o nadchodzącym pobycie;
- pobyt trafia do tygodniowego planu;
- jeżeli od ostatniego potwierdzonego sprzątania lub kontroli gotowości minęło ponad siedem dni, system proponuje odświeżenie przed przyjazdem;
- przy dzieciach powstaje zadanie wykonania zatwierdzonej procedury małoletnich;
- przed przyjazdem system sprawdza pełną płatność, trasę, wiadomość i gotowość domku.

## Sekwencja wiadomości v1

| Moment | Wiadomość | Warunek | Tryb początkowy |
|---|---|---|---|
| po potwierdzeniu rezerwacji | potwierdzenie, obiekt, termin, cena, zaliczka, termin, konto i warunki | prawidłowy e-mail, potwierdzony zapis | szkic → ręczne zatwierdzenie |
| po zaksięgowaniu zaliczki | potwierdzenie wpłaty, regulamin, łowisko, pobyt i atrakcje | zaksięgowana zaliczka | szkic → ręczne zatwierdzenie |
| dwa dni przed przyjazdem | przypomnienie o brakującej dopłacie | saldo > 0 | zadanie operatora + szkic |
| przed przyjazdem | trasa, godziny, zasady odbioru kluczy i kontakt | aktualne dane, właściwy język | szkic → ręczne zatwierdzenie |
| w dniu przyjazdu | alert dla wydającego klucze | płatność lub jawna blokada | wewnętrzny alert |

Automatyczna wysyłka może zostać włączona osobno dla każdego szablonu dopiero po testach odbiorcy, idempotencji, statusu dostawcy, retry i kill switcha.

## Dostępność i mobilny standard akceptacji

Testy na typowym rozmiarze 390 px nie wystarczą. Trzeba sprawdzić aplikację na rzeczywistym telefonie taty i przy jego ustawieniu tekstu.

Minimalne wymagania:

- po otwarciu aplikacji kalendarz jest widoczny bez przewijania przez powitanie i KPI;
- podstawowe informacje rezerwacyjne używają czytelnego rozmiaru, docelowo co najmniej 16 px dla treści operacyjnej;
- interfejs zachowuje funkcjonalność przy powiększeniu tekstu/zoomie do 200%;
- kontrolki mają duże pola dotykowe;
- wybór terminu nie wymaga precyzyjnego trafienia w małą komórkę;
- żaden status nie zależy wyłącznie od koloru;
- powiększenie nie ukrywa ceny, nazwiska, dat ani przycisku przejścia dalej;
- oś może przewijać się poziomo, ale aktywny domek, dzień i wybrany zakres pozostają zrozumiałe;
- operację można dokończyć bez obracania telefonu;
- błędy są napisane prostym językiem i wskazują jedną następną akcję.

## Standardy Ochrony Małoletnich — granica prawna

Prawidłowa nazwa to tzw. „ustawa Kamilka”. Obowiązek nie sprowadza się do zebrania podpisanego druku.

Podmioty świadczące usługi hotelarskie i prowadzące miejsca zakwaterowania zbiorowego muszą mieć Standardy Ochrony Małoletnich. Powinny one obejmować m.in.:

- bezpieczne relacje personelu z małoletnim;
- identyfikację małoletniego i jego relacji z dorosłym;
- reakcję na uzasadnione podejrzenie zagrożenia dobra dziecka;
- osoby oraz procedury odpowiedzialne za zawiadomienia;
- przygotowanie personelu i dokumentowanie tego przygotowania;
- uwzględnienie dzieci z niepełnosprawnościami i specjalnymi potrzebami;
- wersję pełną i skróconą, zrozumiałą dla dzieci;
- udostępnienie standardów na stronie i w widocznym miejscu;
- okresowy przegląd oraz pisemne udokumentowanie wniosków.

### Co aplikacja może zrobić

- przechowywać wersję zatwierdzonego SOP;
- utworzyć zadanie tylko dla pobytu z dziećmi;
- pokazać osobie wydającej klucze kroki wynikające z SOP;
- zapisać wykonanie, datę, operatora, wersję procedury i wynik;
- udostępnić zatwierdzony formularz online;
- zachować minimalny dowód wymagany przez zatwierdzoną procedurę;
- uruchomić kontrolowaną ścieżkę reakcji.

### Czego aplikacja nie powinna zgadywać

- czy każdy pobyt z dzieckiem wymaga identycznego oświadczenia;
- czy potrzebna jest kopia dokumentu;
- jakie dane dziecka należy przechowywać;
- czy prosty podpis DocuSign wystarcza;
- jak długo przechowywać formularz;
- kto może go odczytać;
- czy podpis jest w ogóle wymagany dla danego kroku SOP.

Zgodnie z art. 25 eIDAS podpisowi elektronicznemu nie można odmówić skutku wyłącznie dlatego, że jest elektroniczny, ale tylko kwalifikowany podpis elektroniczny ma skutek równoważny podpisowi własnoręcznemu. Nazwa „DocuSign” nie przesądza poziomu podpisu — zależy on od konkretnej usługi, konfiguracji i wymagań dokumentu.

Najpierw należy zatwierdzić procedurę z osobą kompetentną prawnie i w zakresie ochrony danych. Dopiero potem wybiera się formularz oraz rodzaj podpisu. System nie powinien przechowywać skanów dokumentów „na zapas”.

### Źródła urzędowe

- [tekst jednolity ustawy w ELI](https://eli.gov.pl/api/acts/DU/2024/560/text.html);
- [odpowiedzi Ministerstwa Sprawiedliwości dotyczące ustawy Kamilka](https://www.gov.pl/web/sprawiedliwosc/ministerstwo-sprawiedliwosci-odpowiada-na-najczesciej-zadawane-pytania-dotyczace-tzw-ustawy-kamilka);
- [wskazówki UODO dotyczące ochrony danych w standardach małoletnich](https://uodo.gov.pl/pl/138/3278);
- [art. 25 rozporządzenia eIDAS](https://eur-lex.europa.eu/legal-content/EN-PL/TXT/?uri=CELEX%3A32014R0910).

Raport opisuje bezpieczny kierunek produktowy, ale nie zastępuje zatwierdzonego SOP ani porady prawnej.

## Rzeczy pominięte lub wymagające decyzji

### Rezerwacje i ceny

- dokładne ceny Czapli i Rybaka w każdym sezonie;
- dokładne daty wszystkich wyjątków;
- sposób zaokrąglania procentowych dopłat i rabatów;
- relacja minimum czterech dób do rozliczenia 3,5 doby;
- limit osób, dzieci i niemowląt per domek;
- czy sprzątanie jest dopłatą gościa, kosztem wewnętrznym czy obiema pozycjami;
- lista dodatkowych usług i ich podatki/waluta;
- zasady zmiany terminu, anulowania, no-show, zwrotu i utraty zaliczki;
- czy istnieje opłata miejscowa, kaucja, faktura lub paragon;
- dane firmy, NIP i adres tylko wtedy, gdy są potrzebne do dokumentu;
- zasada ochrony ceny już potwierdzonej po późniejszej zmianie cennika.

### Płatności

- termin zapłaty pierwszej zaliczki;
- numer rachunku per waluta i sposób jego bezpiecznej konfiguracji;
- kto może ręcznie oznaczyć wpłatę;
- jaki dowód oznacza `zaksięgowana`;
- płatność gotówką, przelew natychmiastowy i zagraniczny;
- częściowa dopłata, nadpłata, zwrot i obciążenie zwrotne;
- co dokładnie widzi osoba wydająca klucze.

### Komunikacja

- zatwierdzone treści i języki;
- adres nadawcy oraz reply-to;
- operatorzy otrzymujący kopię;
- zgoda/podstawa dla komunikacji operacyjnej i oddzielenie jej od marketingu;
- polityki wiadomości Booking, Airbnb i Aloha Camp;
- niedostarczony e-mail i kanał zapasowy;
- wersjonowanie numeru konta, trasy, regulaminu i warunków.

### Operacje

- kto potwierdza gotowość domku;
- czy próg siedmiu dni liczy się od ostatniego pobytu, sprzątania czy kontroli;
- kto przyjmuje lub odrzuca zlecenie odświeżenia;
- awaryjna zmiana osoby sprzątającej;
- przekazanie klucza przez dziadka i minimalne uprawnienia;
- wcześniejszy przyjazd, późny wyjazd i konflikt z turnoverem;
- postępowanie przy awarii internetu lub telefonu.

### Integracje i ryzyko

- pełna lista kanałów sprzedaży i właściciel każdego konta;
- czy Mobile Calendar jest channel managerem, tylko kalendarzem czy również dostawcą wiadomości;
- opóźnienia iCal/API oraz sposób wykrycia błędu;
- duplikaty przy ponowieniu synchronizacji;
- ręczny fallback podczas awarii;
- eksport danych przed końcem subskrypcji;
- RTO, RPO i rollback.

### Prywatność i zgodność

- minimalizacja danych gościa i dziecka;
- retencja rezerwacji, wiadomości, formularzy oraz logów;
- kto widzi PII, finanse i dokumenty zgodności;
- procedura korekty i usunięcia danych;
- pełna oraz skrócona wersja Standardów Ochrony Małoletnich;
- szkolenie taty, dziadka i innych osób realizujących przyjazd;
- okresowy przegląd i właściciel SOP.

## Proponowana strategia zmiany procesu

### Etap A — odwzorowanie obecnego sposobu pracy

- kalendarz jako start;
- wycena, karta klienta, zaliczka i ręcznie zatwierdzane e-maile;
- operator nadal rozstrzyga wyjątki;
- Mobile Calendar/OTA pozostaje źródłem prawdy.

Cel: tata nie musi jednocześnie uczyć się nowej aplikacji i nowej polityki prowadzenia rezerwacji.

### Etap B — kontrolowane uprocesowienie

- jawne stany synchronizacji i płatności;
- szablony, checklisty i automatycznie tworzone szkice;
- tygodniowy plan sprzątania;
- zadanie małoletnich wynikające z zatwierdzonego SOP;
- alerty tylko wtedy, gdy istnieje konkretna akcja.

### Etap C — bezpieczna automatyzacja

- automatyczna wysyłka wybranych wiadomości;
- synchronizacja write-through z OTA;
- automatyczne przypomnienia o dopłacie;
- propozycja odświeżenia domku po długiej przerwie;
- raport wyjątków wymagających operatora.

Automatyzacja jest włączana per reguła po pilocie. Nie należy automatyzować decyzji uznaniowych taty, takich jak rabat, wyjątek od minimum pobytu, wcześniejszy przyjazd czy ocena ryzyka płatności.

## Następny krok walidacyjny

Na kolejnym przejściu zebrać:

1. zrzuty kalendarza Mobile Calendar na telefonie;
2. dokładny cennik obu domków;
3. pięć przykładowych rezerwacji, w tym pies, święto, krótki pobyt, rabat i dzieci;
4. wszystkie aktywne szablony e-mail;
5. aktualny druk/standard dotyczący małoletnich;
6. listę połączonych OTA;
7. zasady anulowania i zwrotu zaliczki;
8. informację, kiedy pierwsza zaliczka ma wpłynąć.
