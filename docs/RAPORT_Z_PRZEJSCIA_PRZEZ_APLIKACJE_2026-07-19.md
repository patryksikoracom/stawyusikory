# Stawy OS — wnioski z przejścia przez aplikację

**Data opracowania:** 19 lipca 2026<br>
**Źródło:** spontaniczna rozmowa podczas przechodzenia przez aktualną aplikację<br>
**Charakter dokumentu:** uzupełnienie audytu i planu wdrożenia o perspektywę użytkownika oraz wymagania produktowe<br>
**Nie jest to:** nowy plan zastępujący `MASTER_PLAN_REALIZACJI_STAWY_OS.md`, porada prawna ani zgoda na automatyczną wysyłkę wiadomości

## 1. Najważniejszy wniosek

Stawy OS nie ma być tylko miejscem do zapisywania rezerwacji. Z rozmowy wynika znacznie konkretniejsza ambicja:

> ma być „mózgiem operacji”, który pokazuje co trzeba zrobić, pilnuje powtarzalnych czynności, liczy rzeczywisty wynik i zamienia rozmowy z gośćmi w wiedzę przydatną do sprzedaży.

Aktualna aplikacja zawiera już wiele elementów tej wizji, ale nadal częściej pokazuje **moduły i dane** niż prowadzi użytkownika przez **pracę do wykonania**. Największa wartość nie powstanie przez dodanie kolejnych ekranów, lecz przez uporządkowanie pięciu głównych przepływów:

1. **Dzisiaj:** kto wyjeżdża, kto przyjeżdża, który domek trzeba posprzątać i co blokuje gotowość.
2. **Rezerwacja:** prosty wpis, jasne saldo, potrzebne wiadomości i następna akcja.
3. **Kalendarz:** kontekst przed i po dzisiejszym dniu, widok roku oraz wykrywanie wartościowych luk.
4. **Finanse:** sprzedaż, wpłaty, należności, koszty i wynik jako osobne, wiarygodne pojęcia.
5. **Wiedza o gościach:** skąd przyszli, dlaczego wybrali Stawy, co powiedzieli po pobycie i czy wolno się z nimi ponownie kontaktować.

## 2. Co naprawdę było testowane w tej rozmowie

To nie był uporządkowany test według scenariusza. Był to naturalny walkthrough, dlatego jest szczególnie cenny do wykrywania:

- miejsc, w których użytkownik musi sam przypominać sobie znaczenie ekranu;
- funkcji, które istnieją, ale nie mają właściwej hierarchii informacji;
- pól dodanych „bo mogą się przydać”, ale niespójnych z rzeczywistą pracą;
- powtarzalnych czynności, które użytkownik od razu chce automatyzować;
- decyzji biznesowych, na które aplikacja jeszcze nie potrafi wiarygodnie odpowiedzieć.

Wnioski oznaczono pośrednio przez trzy poziomy pewności:

- **potwierdzone** — potrzeba została powiedziana wprost i/lub widać ją w obecnym kodzie;
- **silny wniosek** — potrzeba wynika z kilku fragmentów rozmowy lub zachowania użytkownika;
- **do decyzji** — istnieje realna potrzeba, ale sposób realizacji wymaga wyboru właściciela albo sprawdzenia procesu w praktyce.

## 3. Podsumowanie zarządcze

### 3.1 Co jest najważniejsze teraz

1. **Dokończyć wiarygodne finanse w PR-6a–PR-6c**, uwzględniając nie tylko ogólny audyt, lecz także konkretne oczekiwanie z walkthrough: cena, zaksięgowane wpłaty i saldo muszą być równorzędne, a prowizja ma być kontekstowa.
2. **Nie rozwijać jeszcze „AI do kampanii” jako autonomicznego agenta.** Najpierw wystarczy deterministyczna reguła wykrywająca luki 4+ nocy, pokazująca dowody i proponująca działanie do zatwierdzenia.
3. **Przestawić interfejs z modułów na następne działania.** Pulpit powinien być chronologiczną agendą dnia, uzupełnioną o stan każdego domku.
4. **Rozdzielić kanał rezerwacji od źródła odkrycia.** Obecne listy mieszają Booking/Airbnb z telefonem, Google, Facebookiem i poleceniem, przez co formularz wydaje się przeładowany, a dane nie nadają się do analizy.
5. **Usunąć automatyczne zadanie „Content” dla każdego pobytu.** Materiał od gościa jest wyjątkiem i okazją rozpoznawaną przez człowieka; prośba o opinię jest procesem powtarzalnym.
6. **Dodać widok roczny i poprawić punkt startu kalendarza.** Brak łatwego porównania miesięcy został wskazany jako bardzo ważna luka biznesowa.
7. **Potraktować integracje jako ostatni etap bezpiecznego procesu**, nie jako samo „podpięcie API”: OTA, SMS, e-mail i reklamy wymagają źródeł prawdy, statusów dostarczenia, idempotencji, zasad kanału i kontroli człowieka.

### 3.2 Co jest dobrym sygnałem

- Użytkownik rozumie wartość osi czasu rezerwacji, kosza, historii zmian, salda, automatycznych zadań i stawek sezonowych.
- Aplikacja prowokuje właściwe pytania biznesowe: udział direct, sezonowość, prowizje, rentowność domków, koszt pustych terminów i źródła popytu.
- Rozmowa ujawnia realne zdarzenia, które system powinien obsłużyć: zła trasa dla gości z Niemiec, zapomniana wiadomość, okno sprzątania, owady pod łóżkiem, niepełna płatność, brak opinii i pojedyncza okazja na dobry materiał wideo.
- Obecny kod zawiera już fundamenty pod kilka z tych procesów. Problemem jest głównie kompletność, hierarchia i spójność, a nie całkowity brak kierunku.

## 4. Docelowi użytkownicy ujawnieni w rozmowie

| Użytkownik | Rzeczywista praca | Czego potrzebuje od systemu | Czego nie powinien widzieć |
|---|---|---|---|
| Ojciec / operator obiektu | przyjmuje rezerwacje, pilnuje pobytów, kontaktuje gości, zleca sprzątanie, ponosi część kosztów | prosty ekran „Dzisiaj”, jasne salda, przypomnienia i gotowe wiadomości | skomplikowane KPI bez wyjaśnienia, nadmiar pól marketingowych w codziennym przepływie |
| Patryk / właściciel produktu i wzrostu | analizuje popyt, reklamę, opinie, direct, koszty i możliwości rozwoju | dane jakościowe, atrybucja, sezonowość, eksperymenty, pełny wgląd | pozornie dokładne rekomendacje z małej lub dziurawej próby |
| Osoba sprzątająca | planuje wejście, sprząta, potwierdza gotowość, zgłasza usterki | mobilny plan, okno czasowe, checklista, uwagi i jeden przycisk „gotowe” | nazwiska, telefony, ceny, płatności, marketing i pełna historia gościa |
| Gość | rezerwuje, płaci, dojeżdża, korzysta z pobytu i przekazuje feedback | krótkie, osobiste, terminowe informacje we właściwym języku i kanale | wewnętrzne statusy, profilowanie i zbędne formularze |
| Księgowość / doradca | weryfikuje dokumenty i znaczenie liczb | eksport, dowody transakcji, definicje, okresy i rozdzielenie faktów od modelu | narracyjne KPI bez ścieżki do danych źródłowych |

**Silny wniosek:** projektowanie wyłącznie „pod Patryka” może stworzyć świetne narzędzie analityczne, którego ojciec nie będzie używał operacyjnie. Projektowanie wyłącznie pod ojca może z kolei nie dać danych potrzebnych do wzrostu. Te dwa tryby powinny być rozdzielone: **operacje najpierw, analiza jako druga warstwa**.

## 5. Stan funkcji: istnieje, częściowo istnieje, brakuje

| Potrzeba z rozmowy | Stan w aktualnym kodzie | Wniosek |
|---|---|---|
| Dodanie i edycja rezerwacji | istnieje | Formularz działa, ale wymaga uproszczenia semantyki pól i progressive disclosure. |
| Cena z reguł sezonowych | istnieje | Zachować; wyraźnie odróżniać cennik od ręcznej korekty/importu. |
| Zaliczka i dopłata | częściowo | Ledger istnieje, lecz hierarchia i część obliczeń wymagają PR-6a oraz PR-6c. |
| Historia rezerwacji | istnieje | Wartość rozpoznana przez użytkownika; zachować i rozbudować o czytelne zdarzenia integracji. |
| Kosz rezerwacji z przywracaniem | istnieje | Funkcja oceniona pozytywnie; nie wymaga nowej koncepcji. |
| Szkice wiadomości względem pobytu | istnieją | Automaty tworzą szkice; treści, języki, zasady kanałów i dostarczenie są niepełne. |
| Faktyczna wysyłka SMS/e-mail | zablokowana / pilot | Słusznie pozostaje wyłączona do testów dostawcy i procesu. |
| Panel sprzątania bez PII i finansów | istnieje w osobnej wersji mobilnej | Kierunek zgodny z rozmową; trzeba zweryfikować na realnym koncie sprzątającej. |
| Checklista sprzątania per zadanie | istnieje mechanizm | Brakuje wygodnego zarządzania szablonami i wyjątkami per domek/sezon. |
| SMS z propozycją okna sprzątania i odpowiedzią | brakuje pełnego przepływu | Potrzebne przyjęcie/odrzucenie terminu oraz eskalacja. |
| Automatyczne zadanie „Content” po każdym pobycie | istnieje | Należy usunąć z domyślnego zestawu zadań. |
| Podsumowanie rozmowy po wyjeździe | istnieje | Bardzo dobrze pokrywa wskazaną potrzebę jakościowego feedbacku; wymaga dopracowania statusu opinii i zgód. |
| Dzisiaj: przyjazdy, wyjazdy i pobyty | istnieje częściowo | Brakuje jednej czytelnej chronologii i jawnego stanu gotowości domku. |
| Kalendarz 28/42/56 dni | istnieje | Dzisiaj jest pierwszym dniem, a nie punktem z kontekstem wstecz. |
| Przeciągnięcie terminu i utworzenie pobytu | brak | Potrzeba potwierdzona; wymaga dostępnego odpowiednika dla klawiatury/telefonu. |
| Roczny przegląd sprzedaży/obłożenia | brak w kalendarzu | Wysoki priorytet decyzyjny, nie kosmetyka. |
| Ikony Booking/Airbnb na paskach | brak | Kolory istnieją, ale kanał nie jest widoczny na samym pasku. |
| Wykrywanie długich luk | brak | Najpierw prosta reguła i próg, później warstwa AI. |
| Wiarygodny zysk, koszty i cashflow | w trakcie | Dokładnie zakres PR-6a–PR-6c; nie wolno opierać decyzji na obecnych kartach pilotażowych. |
| Koszt prowizji zależny od platformy i domku | brak w modelu kosztów | Wymaga reguły `platforma × domek × okres obowiązywania`. |
| Zwrot inwestycji w domek | brak | Wymaga kapitału początkowego, kosztów, wypłat właściciela i reguły alokacji. |
| Import wydatków reklamowych | brak | Zacząć od CSV, nie od API. |
| Zgody marketingowe i medialne | częściowo | Obecny model jest zbyt zbiorczy; potrzebny rejestr celów, kanałów, wersji i wycofań. |
| Język niemiecki | brak w szablonach | W rozmowie występują goście z Niemiec; model obsługuje obecnie tylko polski i angielski. |

## 6. Szczegółowe wnioski według obszarów

### 6.1 Dodawanie rezerwacji

#### Co działa

- Oś czasu i daty przyjazdu/wyjazdu są naturalnym sposobem myślenia o pobycie.
- Automatyczne pobieranie stawki z cennika sezonowego ogranicza ręczne liczenie.
- Dane gościa, liczba osób, kontakt, cena i zaliczka są potrzebne w podstawowym przepływie.
- Możliwość ręcznej ceny pozostaje potrzebna dla rabatu, importu, barteru i wyjątków.

#### Główne tarcie

W rozmowie pada wprost, że źródeł jest „za dużo”. Obecny typ `Channel` rzeczywiście łączy trzy różne pojęcia:

1. **kanał zawarcia rezerwacji** — Booking, Airbnb, strona, telefon, e-mail;
2. **źródło odkrycia** — Google, Facebook, polecenie, AI/czat;
3. **rodzaj współpracy** — influencer/barter.

To prowadzi do złych analiz. Gość może znaleźć Stawy przez Google, zadzwonić i zawrzeć rezerwację direct. Jedna lista nie potrafi zapisać obu faktów.

#### Rekomendowany model

**Krok podstawowy — wymagany przy zapisie:**

- domek;
- przyjazd i wyjazd;
- liczba dorosłych i dzieci;
- imię/nazwa gościa;
- kanał zawarcia: `Booking`, `Airbnb`, `Direct`, `Inny OTA`;
- dla direct: sposób kontaktu `telefon`, `e-mail`, `strona`, `wiadomość`;
- cena lub potwierdzenie użycia cennika;
- status płatności.

**Pola pokazywane warunkowo:**

- numer zewnętrzny tylko dla OTA;
- prowizja/wypłata tylko dla OTA;
- termin i kwota zadatku tylko gdy zadatek jest wymagany;
- informacje o dzieciach tylko w zakresie potrzebnym do bezpieczeństwa i przygotowania;
- źródło odkrycia jako pole opcjonalne „wiemy teraz / dopytamy później”.

**Pola zbierane później:** motywacja, dokładna fraza, NPS, cytat, zamiar powrotu i zgody marketingowe nie powinny obciążać prostego wpisu rezerwacji.

#### Dodatkowe wymagania

- Zapisać preferowany język gościa: co najmniej `pl`, `de`, `en`.
- Pokazać przed zatwierdzeniem jedno krótkie podsumowanie: domek, termin, noce, osoby, kanał, cena, należność teraz.
- Dla importu oznaczać źródło i nie pozwalać ręcznej edycji pól, które przy następnym syncu zostaną nadpisane, bez jasnego ostrzeżenia.

### 6.2 Szczegóły rezerwacji i płatności

#### Potwierdzone oczekiwanie

Najważniejsze informacje na karcie płatności powinny mieć równą wagę:

1. **Wartość pobytu**;
2. **Zaksięgowano**;
3. **Pozostało do zapłaty** albo **Nadpłata**.

Prowizja i wypłata OTA są ważne tylko wtedy, gdy rezerwacja faktycznie pochodzi z kanału prowizyjnego. Dla direct ta karta powinna być ukryta albo zastąpiona prostym komunikatem „bez prowizji OTA”.

#### Problem potwierdzony w kodzie

Obecna karta pokazuje „pozostało” jako mały tekst pod dużą kwotą zaksięgowaną. Dodatkowo obliczenie `paid` w szczegółach rezerwacji odejmuje od wpłat pozycje `Prowizja` i `Koszt`. To miesza pieniądze otrzymane od gościa z kosztami biznesu. Saldo gościa nie powinno spadać dlatego, że właściciel zapisał prowizję Booking albo koszt sprzątania.

Obecne ekrany miejscami używają też `Math.max(0, saldo)`, co ukrywa nadpłatę. Jest to sprzeczne z przyjętym słownikiem KPI.

#### Docelowe znaczenie

- `Zaksięgowano od gościa` = wpłaty + zaliczki − zwroty;
- `Pozostało` = wartość rezerwacji − zaksięgowane od gościa;
- wartość ujemna = **nadpłata**, nie zero;
- `Prowizja OTA` = osobny koszt;
- `Wypłata OTA` = osobny przepływ do uzgodnienia, a nie automatyczny dowód wpłaty gościa;
- `Koszt` = wydatek operacyjny, nigdy część salda gościa.

#### Kryteria akceptacji

- Po zapisaniu zaliczki 300 zł dla pobytu 550 zł interfejs pokazuje obok siebie `550 zł`, `300 zł`, `250 zł`.
- Po zaksięgowaniu 600 zł pokazuje `nadpłata 50 zł`.
- Dodanie prowizji 80 zł nie zmienia kwoty zapłaconej przez gościa.
- Direct nie pokazuje „prowizja nieuzupełniona” jako problemu jakości danych.
- Każda kwota pokazuje walutę i źródło.

### 6.3 Wiadomości i automatyzacje

#### Potrzeby potwierdzone w rozmowie

- potwierdzenie rezerwacji;
- przypomnienie o płatności;
- informacja przed przyjazdem;
- prawidłowa trasa dojazdu, aby nawigacja nie poprowadziła złą drogą;
- proces dotyczący pobytu z małoletnim;
- informacja do osoby sprzątającej;
- prośba o opinię po pobycie;
- możliwość użycia e-maila, ale z krótkim SMS-em zwracającym uwagę na ważną wiadomość;
- osobisty, ludzki ton zamiast brzmienia masowej automatyzacji.

#### Co już istnieje

Kod zawiera szablony i reguły dla potwierdzenia, płatności, informacji przed przyjazdem, kontaktu po przyjeździe, wyjazdu i opinii. Działa model `draft-first`, czyli przygotowanie szkicu bez automatycznej wysyłki. To właściwy fundament.

#### Braki

- brak języka niemieckiego;
- brak wyboru języka na rezerwacji;
- brak wersjonowanej instrukcji dojazdu per język;
- brak osobnej procedury małoletnich jako kontrolowanego procesu;
- brak warunków zależnych od kanału i polityki OTA w domyślnych regułach;
- brak potwierdzonego pełnego cyklu: kolejka → dostawca → dostarczono/błąd → retry → alert;
- prośba o opinię nie zapisuje jeszcze pełnego wyniku: zaplanowano, wysłano, kliknięto, opinia powstała.

#### Rekomendowany zestaw szablonów v1

| Moment | Odbiorca | Kanał | Treść / cel | Warunek |
|---|---|---|---|---|
| po potwierdzeniu | gość | e-mail lub OTA | termin, domek, cena, zasady płatności | zawsze, kanał zgodny z rezerwacją |
| termin zadatku | gość | SMS/OTA | konkretna pozostała kwota i termin | tylko gdy saldo > 0 |
| 2 dni przed | gość | SMS/OTA | godzina, dojazd, skład grupy, ważne informacje | wybrany język, zatwierdzona trasa |
| przed przyjazdem z dzieckiem | operator | zadanie wewnętrzne | wykonanie procedury ochrony małoletnich | dzieci > 0 |
| po przyjeździe | gość | preferowany kanał | możliwość łatwego zgłoszenia problemu | bez nachalnego „czy wszystko super?” |
| po wyjeździe | gość | kanał właściwy dla rezerwacji | podziękowanie i neutralna prośba o opinię | zgodnie z polityką kanału |
| po utworzeniu turnoveru | sprzątanie | SMS + link do panelu | okno pracy i prośba o przyjęcie | osoba przypisana |

#### Zasada tonu

„Osobisty SMS” nie oznacza udawania, że człowiek napisał ręcznie. Powinien być krótki, konkretny, podpisany i dawać prostą możliwość odpowiedzi. Treść automatyczna może brzmieć naturalnie bez wprowadzania odbiorcy w błąd.

### 6.4 Małoletni — ważna korekta pojęcia „ankiety”

W rozmowie pojawia się niepewne wspomnienie o „specjalnej ankiecie, bo jest ustawa”. Oficjalne przepisy rzeczywiście obejmują podmioty świadczące usługi hotelarskie, turystyczne i inne miejsca zakwaterowania zbiorowego. Standardy mają określać m.in. zasady identyfikacji małoletniego i jego relacji z osobą dorosłą oraz procedurę reakcji na podejrzenie zagrożenia dobra dziecka. Źródła: [tekst ustawy w ELI](https://eli.gov.pl/api/acts/DU/2024/560/text.html) oraz [wyjaśnienia Ministerstwa Sprawiedliwości](https://www.gov.pl/web/sprawiedliwosc/pytania-do-ustawy-o-ochronie-dzieci2).

Z tego **nie wynika automatycznie**, że aplikacja ma wysyłać każdej rodzinie rozbudowaną ankietę i przechowywać kopie dokumentów dziecka.

#### Rekomendowany kierunek produktowy

Najpierw właściciel powinien przyjąć zweryfikowany standard i procedurę. Dopiero z niej wynikają pola w aplikacji. Minimalny zapis operacyjny może obejmować:

- procedura wymagana: tak/nie;
- procedura wykonana: tak/nie;
- data i osoba wykonująca;
- sposób weryfikacji zgodny z przyjętym standardem;
- wynik: bez uwag / wymaga reakcji;
- notatka tylko jeśli rzeczywiście konieczna;
- wersja obowiązującej procedury.

Nie łączyć tego procesu ze zgodą marketingową, ankietą satysfakcji ani profilem dziecka. Zakres danych i retencję powinien zatwierdzić prawnik lub osoba odpowiedzialna za ochronę danych.

### 6.5 Zadania, sprzątanie i gotowość domku

#### Co wynika z rozmowy

- zadanie sprzątania ma wynikać z wyjazdu;
- osoba sprzątająca powinna dostać informację o oknie między wyjazdem a następnym przyjazdem;
- powinna móc potwierdzić, kiedy wykona pracę;
- checklista jest szczególnie wartościowa dla nowej lub zastępczej osoby;
- część zadań jest standardowa, część specyficzna dla domku, np. sprawdzenie martwych owadów pod łóżkiem;
- właściciel i ojciec potrzebują osobnych zadań dotyczących zakupów, płatności i napraw;
- status „czysty” nie może być luźną etykietą oderwaną od wykonania pracy.

#### Co już jest dobrym fundamentem

Osobny mobilny panel sprzątania już ogranicza dane, pokazuje okno turnoveru, checklistę i możliwość zgłoszenia problemu. Stan „gotowe” zależy od ukończenia checklisty. To jest bliżej realnej potrzeby niż prosty status pokoju `Czysty`.

#### Co poprawić

1. Dodać **szablon checklisty per domek**, z wersją i datą obowiązywania.
2. Rozdzielić punkty:
   - zawsze;
   - sezonowe;
   - wynikające z ostatniego pobytu;
   - wynikające z usterki;
   - jednorazowe.
3. Dodać stan zlecenia: `do przyjęcia → przyjęte → w toku → gotowe → problem`.
4. Przy braku przyjęcia w określonym czasie wysłać alert właścicielowi.
5. Wyliczać stan domku z procesu:
   - `goście`;
   - `wyjazd dzisiaj`;
   - `do sprzątania`;
   - `sprzątanie w toku`;
   - `gotowy`;
   - `zablokowany usterką`.
6. Nie pokazywać nazwiska gościa osobie sprzątającej, jeśli do wykonania zadania wystarczy liczba osób, liczba miejsc do spania i uwagi operacyjne.

#### Content a opinia

Obecnie każda nowa rezerwacja automatycznie tworzy zadanie typu `Content`. Rozmowa wprost kwestionuje ten mechanizm. Rekomendacja:

- prośba o opinię — standardowy, kanałowo zgodny proces;
- materiał wideo/zdjęcia — ręcznie oznaczona „okazja na content” tylko wtedy, gdy ktoś na miejscu rozpozna dobry moment;
- zgoda na wizerunek/media — osobny proces, zakres i dowód;
- nagranie opinii nie może być warunkiem żadnej korzyści ani zastępować neutralnej prośby o publiczną opinię.

### 6.6 Pulpit „Dzisiaj”

#### Problem z rozmowy

Użytkownik początkowo nie rozumie układu przyjazdów i wyjazdów, potem orientuje się, że chodzi o różne osoby. To sygnał, że dane są poprawne, ale model ekranu nie jest od razu czytelny.

#### Rekomendowany układ

**Główna część: jedna agenda chronologiczna**

- `11:00 · WYJAZD · Dom Rybaka · Anna K.`;
- `11:15 · SPRZĄTANIE MOŻE SIĘ ZACZĄĆ · Dom Rybaka`;
- `16:00 · PRZYJAZD · Dom Rybaka · Booking`;
- `18:00 · WIADOMOŚĆ KONTROLNA · Czapla`.

Każdy wiersz ma dwa niezależne znaczniki:

1. **rodzaj zdarzenia/status pobytu** — wyjazd, przyjazd, trwa pobyt, do sprzątania, gotowy;
2. **kanał** — Booking, Airbnb, direct.

**Druga część: stan obiektów**

| Domek | Teraz | Następna zmiana | Blokada |
|---|---|---|---|
| Czapla | goście | wyjazd jutro 11:00 | brak |
| Dom Rybaka | do sprzątania | przyjazd dziś 16:00 | 5 h do przyjazdu |

Nie używać samego koloru do odróżniania kanału albo statusu. Tekst/ikona muszą działać także bez legendy.

#### Kryteria akceptacji

- W ciągu pięciu sekund użytkownik odpowiada: kto dziś przyjeżdża, kto wyjeżdża i który domek nie jest gotowy.
- Same-day turnover jest wyróżniony jako ryzyko.
- Kliknięcie zdarzenia prowadzi od razu do właściwej czynności, a nie tylko do ogólnej karty rezerwacji.

### 6.7 Kalendarz

#### Potwierdzone problemy

1. Widok zaczyna się od dzisiaj, więc użytkownik traci kontekst poprzedniego wyjazdu.
2. Dwa zestawy nawigacji wykonują podobną pracę: przesunięcie zakresu o 7 dni oraz przewijanie samej osi.
3. Brakuje ikony/oznaczenia kanału bezpośrednio na rezerwacji.
4. Nie można przeciągnąć zakresu, aby od razu zacząć tworzenie pobytu.
5. Nie ma przeglądu roku pozwalającego szybko zobaczyć mocne i słabe miesiące.

#### Rekomendacja dla domyślnego widoku 42 dni

- zakres: **7 dni wstecz + dzisiaj + 34 dni naprzód**;
- przycisk `Dzisiaj` ustawia dzisiejszy dzień około 1/4–1/3 szerokości, nie na samym początku;
- poprzedni wyjazd i aktualny pobyt pozostają widoczne;
- nawigacja zakresu i scroll powinny być jednym sprzężonym mechanizmem;
- miesiące są stałymi nagłówkami na osi, a nie oddzielnymi przyciskami udającymi nieskończony kalendarz.

#### Przeciąganie

- przeciągnięcie od wolnego dnia do dnia wyjazdu otwiera formularz z uzupełnionym domkiem i terminem;
- dotyk: pierwszy tap ustawia początek, drugi koniec;
- klawiatura: wybór dat od/do w formularzu pozostaje pełnoprawną alternatywą;
- zaznaczenie nie może obejmować zajętego terminu bez natychmiastowego ostrzeżenia.

#### Widok roczny

Widok roczny powinien odpowiadać na pytania:

- które miesiące i tygodnie sprzedają się najlepiej;
- od kiedy zaczyna się realny niski sezon;
- gdzie są luki 1–3 noce, a gdzie okazje 4+ nocy;
- jak różnią się domki;
- jak bieżący rok wygląda wobec poprzedniego na ten sam dzień sprzedaży.

Najprostsza forma to 12 mini-kalendarzy lub heatmapa `miesiąc × domek`, z przełącznikiem: obłożenie, ADR, wartość rezerwacji i lead time. Nie łączyć walut bez kursu.

### 6.8 Wykrywanie luk i „proste AI”

Rozmowa zawiera sensowną hipotezę operacyjną:

- luka 1–3 noce może być trudna do sprzedania i posprzątania;
- luka 4+ nocy jest już realną okazją kampanijną;
- w wysokim sezonie reklama może być lepsza niż automatyczny rabat;
- poza sezonem można testować inne pakiety, np. weekend wędkarski.

#### Rekomendacja v1 bez AI

Reguła codziennie wykrywa wolne ciągi dla każdego domku i klasyfikuje:

- `1 noc` — trudna luka;
- `2–3 noce` — luka do ręcznej oceny;
- `4–6 nocy` — okazja sprzedażowa;
- `7+ nocy` — wysoki priorytet.

Karta rekomendacji pokazuje:

- dokładne daty i domek;
- sezon i obowiązującą minimalną długość pobytu;
- czas do rozpoczęcia luki;
- porównanie z podobnym okresem w poprzednich latach;
- bieżącą cenę i dostępność sprzątania;
- sugerowaną akcję: nic, poprawa oferty, post organiczny, kampania, zmiana min-stay;
- pole `zaakceptuj / odrzuć / przypomnij później`.

#### Kiedy AI ma sens

Dopiero gdy system ma wiarygodne dane o cenach, reklamach, źródłach rezerwacji i wynikach poprzednich akcji. AI może wtedy przygotować wariant komunikatu lub podsumować podobne sytuacje. Nie powinno samodzielnie obniżać ceny, uruchamiać reklamy ani wysyłać kampanii.

### 6.9 Lista rezerwacji

#### Problemy potwierdzone lub silnie sugerowane

- domyślnie widoczne są wszystkie rekordy, więc historia miesza się z pracą bieżącą;
- filtry mają wartości `Wszystkie`, ale nie zawsze jest od razu jasne, czego dotyczą;
- `Najnowsze` jest mylące: kod sortuje po dacie przyjazdu, nie po dacie utworzenia rezerwacji;
- `Najbliższe` bez domyślnego filtra aktywnych może mieszać przeszłość i przyszłość;
- „Wartość rezerwacji” sumuje całą aktywną bazę i nie odpowiada bieżącemu filtrowi, okresowi ani walutom;
- otwarcie szczegółu wewnątrz listy nie ma wystarczająco wyraźnej informacji „gdzie jestem”.

#### Rekomendowane filtry

Domyślny zapisany widok: **Nadchodzące i trwające**.

Filtry z widocznymi etykietami:

- okres pobytu;
- domek;
- status pobytu;
- kanał zawarcia;
- płatność/saldo;
- jakość danych;
- źródło/import;
- usunięte osobno w koszu.

Sortowanie powinno nazywać faktyczną kolumnę:

- `Najbliższy przyjazd`;
- `Najpóźniejszy przyjazd`;
- `Ostatnio dodane`;
- `Największe saldo`;
- `Ostatnio zmienione`.

#### Nawigacja szczegółu

- desktop może zachować master–detail, jeśli wybrany rekord jest bardzo wyraźnie podświetlony;
- telefon powinien otwierać osobny szczegół z widocznym `Wróć do rezerwacji`;
- URL ma wskazywać wybraną rezerwację;
- powrót zachowuje filtry, sortowanie i pozycję listy.

#### Karta wartości

Globalna wartość wszystkich historycznych rezerwacji nie pomaga w pracy z listą. Przenieść ją do Finansów albo liczyć wyłącznie dla jawnie wskazanego okresu i filtrów, osobno dla PLN/EUR. Na liście bardziej użyteczne są:

- przyjazdy w najbliższych 14 dniach;
- salda wymagające działania;
- rekordy bez kontaktu/ceny;
- konflikty i błędy synchronizacji.

### 6.10 Finanse

#### Najważniejszy sygnał

Kwota około 438 tys. zł uruchamia naturalne pytanie: „dużo czego?”. Sama duża liczba nie odpowiada na pytanie, czy biznes zarobił, ile gotówki wpłynęło ani czy domek się spłacił.

#### Cztery obowiązkowe perspektywy

1. **Sprzedaż / wartość rezerwacji** — co zostało zakontraktowane.
2. **Należności** — ile goście nadal powinni zapłacić.
3. **Cashflow** — ile faktycznie wpłynęło i wypłynęło w danym okresie.
4. **Wynik zarządczy** — zrealizowana wartość usług minus koszty faktyczne i jawnie opisane koszty modelowane.

To jest zgodne z istniejącym słownikiem KPI i powinno zostać domknięte w PR-6a–PR-6c.

#### Model kosztów wynikający z rozmowy

| Koszt | Typ domyślny | Jednostka / źródło |
|---|---|---|
| Sprzątanie | zmienny | per pobyt / fakt lub uzgodniona stawka |
| Prowizja Booking/Airbnb | zmienny | % albo kwota per rezerwacja; zależna od platformy, domku i okresu |
| Prąd | zmienny lub mieszany | pomiar licznika, ewentualnie model per zajęta noc |
| Woda i szambo | zmienny lub mieszany | faktyczny rachunek / wywóz; model per osobonoc, jeśli brak pomiaru |
| Starlink/Wi-Fi | stały | miesięcznie |
| Ubezpieczenie, podatki stałe | stały | rok lub miesiąc |
| Amortyzacja | model zarządczy | miesięcznie, jawnie opisana metoda |
| Naprawy | faktyczny, nieregularny | dokument/wydatek, przypisanie do domku |
| Reklama | faktyczny | kampania + okres + kanał |
| Wypłata właściciela | przepływ kapitałowy/właścicielski | nie udawać kosztu pobytu bez przyjętej polityki |

#### Prowizje

Obecny `CostSetting` nie ma wymiaru platformy. Potrzebny jest model:

`platforma + domek/listing + data od + data do + typ prowizji + stawka + źródło`.

Rzeczywista prowizja z raportu/importu ma pierwszeństwo. Reguła procentowa jest modelem dla brakujących danych i musi być tak oznaczona.

#### Zwrot inwestycji i „spłacenie domku”

Nie wolno odejmować kosztu budowy od przychodu brutto i na tej podstawie ogłaszać spłaty. Potrzebne są:

- kapitał początkowy per domek;
- dodatkowe nakłady inwestycyjne;
- przychód zrealizowany;
- koszty operacyjne;
- podatki, jeśli mają wchodzić do modelu;
- wpłaty i wypłaty właściciela;
- reguła podziału kosztów wspólnych między domki;
- data rozpoczęcia działalności i ewentualne saldo otwarcia.

Wtedy można pokazać:

- skumulowany wynik operacyjny;
- skumulowany cashflow właścicielski;
- pozostały kapitał do odzyskania;
- orientacyjny payback przy dotychczasowym tempie;
- scenariusze, a nie jedną pozornie pewną datę.

#### Reklamy a obłożenie

Najpierw dodać import CSV: data, platforma reklamowa, kampania, wydatek, kliknięcia/leady, ewentualny kod/UTM. Na osi rocznej zaznaczyć okresy kampanii. Sam wzrost obłożenia w czasie reklamy jest korelacją, nie dowodem wpływu. Lepszy dowód daje źródło odkrycia, UTM, kod kampanii lub pytanie gościa.

### 6.11 Goście, feedback i wzrost

#### Potrzeba jest wyraźna i wartościowa

Użytkownik chce gromadzić zarówno dane ilościowe, jak i słowa gości:

- skąd dowiedzieli się o obiekcie;
- czego szukali i jakiego hasła użyli;
- jak zawarli rezerwację;
- co najbardziej im się podobało;
- co było trudne;
- NPS 0–10;
- jak poleciliby miejsce własnymi słowami;
- czy wrócą;
- czy powstała publiczna opinia.

Obecny `DepartureDebriefSheet` już zbiera dużą część tych danych. To jeden z najlepiej dopasowanych do rozmowy elementów aplikacji.

#### Co poprawić w modelu

1. **Osoba nie może być wyłącznie profilem przypiętym do rezerwacji.** Powracający gość powinien mieć jedną tożsamość i wiele pobytów, z kontrolowaną deduplikacją po telefonie/e-mailu.
2. Oddzielić:
   - źródło odkrycia;
   - metodę szukania;
   - frazę/prompt;
   - kanał pierwszego kontaktu;
   - kanał zawarcia rezerwacji;
   - kampanię/UTM.
3. `Fraza wyszukiwania` musi być opcjonalna. Wielu gości jej nie pamięta; „nie wiem” jest prawidłową daną.
4. Zapisać status opinii:
   - nie proszono;
   - prośba zaplanowana;
   - wysłana;
   - kliknięta, jeśli kanał to mierzy;
   - opinia otrzymana;
   - brak opinii;
   - nie dotyczy.
5. Zachować dokładny cytat osobno od streszczenia wykonanego przez AI.
6. Insight jakościowy zawsze pokazuje liczbę rozmów, okres i kompletność.

#### Zgody

Obecne pojedyncze `marketingConsent` jest za szerokie. Potrzebna jest macierz:

- kontakt operacyjny — podstawa i okres wynikające z obsługi rezerwacji;
- marketing e-mail;
- marketing SMS;
- publikacja cytatu;
- zdjęcie/wideo na stronie;
- zdjęcie/wideo w social media;
- użycie w reklamie płatnej;
- data, źródło, treść/wersja, osoba zbierająca i wycofanie.

Zgody marketingowej nie łączyć z meldunkiem, obowiązkową procedurą małoletnich ani prośbą o opinię.

#### Powrót po roku

Pomysł przypomnienia przed podobnym terminem jest sensowny, ale wiadomość nie powinna iść dokładnie w rocznicę pobytu. Lepszy trigger uwzględnia historyczny lead time, np. 10–20 dni wcześniej niż poprzedni moment decyzji. Tylko dla osób z właściwą zgodą i zgodnie z zasadami kanału.

#### Pakiet wędkarski poza sezonem

To nie jest od razu funkcja aplikacji, lecz hipoteza oferty. System powinien umożliwić jej test:

- segment `wędkarze`;
- okres obowiązywania;
- min. 2–3 noce lub weekend;
- zakres pakietu i koszt łowiska;
- późniejszy wyjazd jako opcja;
- kod kampanii;
- liczba zapytań, rezerwacji, ADR netto i wynik;
- decyzja po pilocie: zachować, zmienić, wyłączyć.

### 6.12 Integracje

#### OTA

iCal jest przydatny do dostępności, lecz ma opóźnienie i zwykle nie dostarcza pełnych finansów, płatności, gości i wiadomości. Nie należy dokładać automatycznej edycji cen ani traktować iCal jako pełnego źródła rezerwacji. Nadal obowiązuje decyzja ze strategii: porównać Mobile-Calendar Premium i Beds24, wykonać shadow mode, uzgodnić dane i dopiero potem przełączać zapis.

#### SMS i e-mail

„Podłączenie API” to dopiero część funkcji. Gotowy proces wymaga:

- normalizacji numerów do E.164;
- wyboru języka i szablonu;
- zgody/podstawy dla danego celu;
- zatwierdzenia albo jawnej reguły auto-send;
- idempotencji;
- statusu dostawcy;
- retry i limitów;
- logu audytowego;
- alarmu, gdy wiadomość ważna operacyjnie nie dotarła.

#### Reklamy

Zacząć od importu CSV z Meta/Google. API ma sens dopiero po ustaleniu stałego modelu kampanii i sposobu łączenia rezerwacji z kampanią. W innym przypadku automatyzuje się chaos, nie analizę.

#### Liczniki prądu

Na początku wystarczy kontrolowany zapis odczytu: domek, licznik, data/godzina, wartość, źródło/zdjęcie. Dopiero po kilku pobytach można policzyć średnie zużycie i zdecydować, czy integracja z urządzeniem ma zwrot z pracy.

## 7. Niejasności i decyzje, których nie należy zgadywać

| Pytanie | Dlaczego jest ważne | Rekomendowany domyślny kierunek |
|---|---|---|
| Kto jest głównym operatorem systemu przez najbliższe 2 miesiące? | Inny ekran potrzebuje ojciec, inny Patryk. | Ojciec: Dzisiaj/Rezerwacja; Patryk: pełne analizy i konfiguracja. |
| Czy `direct` oznacza kanał umowy, czy sposób odkrycia? | Od tego zależy udział direct i prowizje. | Kanał zawarcia bez OTA; źródło odkrycia osobno. |
| Które dane są wymagane przy szybkim telefonicznym wpisie? | Zbyt długi formularz będzie omijany. | Termin, domek, osoby, nazwa, kontakt, kanał, cena/status. |
| Jaki jest zatwierdzony proces ochrony małoletnich? | Aplikacja nie może wymyślić procedury prawnej. | Najpierw SOP i konsultacja, potem minimalna checklista wykonania. |
| Czy sprzątająca potwierdza konkretną godzinę, czy tylko przyjęcie okna? | Zmienia model zlecenia i alerty. | Najpierw `przyjmuję / nie mogę`, godzina opcjonalna. |
| Kto i kiedy oznacza domek jako gotowy? | Status musi mieć właściciela i dowód. | Osoba sprzątająca po pełnej checkliście; operator może awaryjnie nadpisać z audytem. |
| Jakie są rzeczywiste prowizje per listing? | Procent różni się między kanałami i obiektami. | Import faktu, reguła tylko jako fallback. |
| Co oznacza „spłacony domek”? | Wynik, gotówka i wypłaty właściciela to różne miary. | Zdefiniować kapitał do odzyskania i osobno wynik operacyjny. |
| Jakie są sezony i cele obłożenia? | 95% w sezonie i 40–50% poza sezonem są hipotezami. | Zdefiniować okresy, ograniczenia min-stay i cel per domek. |
| Czy dane historyczne zawierają wiarygodne ceny i prowizje? | Od tego zależy możliwość liczenia zwrotu. | Pokazać kompletność per rok i nie uzupełniać braków zerem. |
| Jakie kanały opinii są dozwolone dla Booking/Airbnb/direct? | Reguły platform różnią się. | Szablony zależne od kanału, sprawdzone przed wysyłką. |
| Czy content ma być procesem firmowym czy okazją właściciela? | Domyślne zadanie dla każdego pobytu tworzy szum. | Ręczna okazja, nie automatyczny obowiązek. |

## 8. Proponowany backlog produktowy

### P0 — włączyć do PR-6a–PR-6c / przed decyzjami finansowymi

1. Poprawić definicję wpłat i salda w szczegółach rezerwacji.
2. Pokazać `wartość / zaksięgowano / pozostało lub nadpłata` z równą wagą.
3. Oddzielić prowizję, wypłatę OTA i koszt od salda gościa.
4. Nie obcinać straty ani nadpłaty do zera.
5. Dodać tabelę źródeł i kompletności dla kosztów/prowizji.
6. Uzgodnić model kosztów per miesiąc/rok/pobyt/noc/% oraz brakujący wymiar platformy.

### P1 — małe poprawki o dużym wpływie na codzienną pracę

1. Usunąć automatyczne zadanie `Content` dla każdej rezerwacji.
2. Zmienić domyślny widok listy na `nadchodzące i trwające`.
3. Nazwać filtry i sortowanie zgodnie z faktycznym znaczeniem.
4. Zastąpić globalną historyczną wartość na liście licznikami działań.
5. Ustawić kalendarz domyślnie na 7 dni wstecz i 34 dni naprzód.
6. Dodać tekst/ikonę kanału na pasku rezerwacji.
7. Zbudować chronologiczną agendę dnia i stan domków.

### P2 — pełne przepływy operacyjne

1. Przeciąganie zakresu w kalendarzu z alternatywą dotykową i klawiaturową.
2. Szablony checklist per domek i obsługa wyjątków.
3. Przyjęcie/odrzucenie zlecenia sprzątania oraz eskalacja.
4. Status opinii od prośby do otrzymania.
5. Wersjonowana instrukcja dojazdu PL/DE/EN.
6. Pole preferowanego języka gościa.
7. Procedura małoletnich wynikająca z zatwierdzonego SOP.

### P3 — widoki decyzyjne i wzrost

1. Widok roczny sprzedaży, obłożenia, ADR i luk.
2. Regułowe wykrywanie luk 4+ nocy.
3. Import wydatków reklamowych CSV i oznaczenie kampanii na osi czasu.
4. Tożsamość gościa niezależna od rezerwacji i deduplikacja.
5. Rejestr zgód per cel i kanał.
6. Eksperyment pakietu wędkarskiego poza sezonem.
7. Model nakładów i zwrotu inwestycji per domek.

### P4 — integracje i ostrożna automatyzacja

1. Wybrany gateway OTA po spike i shadow mode.
2. Produkcyjna wysyłka SMS/e-mail z delivery trackingiem.
3. Dwukierunkowe wiadomości tylko jeśli wybrany gateway i polityki na to pozwolą.
4. API reklam dopiero po stabilnym imporcie CSV i atrybucji.
5. Integracja liczników dopiero po sprawdzeniu wartości ręcznych odczytów.
6. AI jako warstwa podsumowania i propozycji, nie samodzielnego działania.

## 9. Mapowanie na obowiązujący master plan

| Wniosek z walkthrough | Miejsce w planie | Proponowana zmiana |
|---|---|---|
| saldo i wpłaty gościa | PR-6a | jedno obliczenie, zwroty i nadpłata bez prowizji/kosztów |
| prowizje, koszty i wynik | PR-6b | fakt/model, platforma × domek × okres i widoczna strata |
| prezentacja i dowody finansowe | PR-6c | szczegół, Dashboard, Finanse i CSV zgodne |
| chronologia dnia i stan domków | PR-10b | osobna paczka UX operacyjnego po fundamentach dostępu/zapisu |
| lista, formularz, filtry i szczegół rezerwacji | PR-10c | osobna paczka z usunięciem domyślnego zadania Content |
| kalendarz: kontekst, drag, kanały | PR-10d | osobna paczka z testami desktop/mobile/klawiatura |
| widok roczny i luki | PR-10e | widok i reguły wcześniej, rekomendacje wzrostu dopiero w PR-11d |
| cleaner flow i checklist templates | PR-9b | dokończyć po rolach/RLS z pełnym testem realnego konta |
| procedura małoletnich | PR-9c | najpierw zatwierdzony SOP, później minimalny zapis |
| źródło odkrycia i tożsamość osoby | PR-11a | osoba ma wiele pobytów; kanał i odkrycie osobno |
| feedback, status opinii i rejestr zgód | PR-11b | rozbić e-mail/SMS, cytat i media |
| PL/DE/EN, dojazd i treści operacyjne | PR-11c | szkice wcześniej; wysyłka dopiero w Etapie 7 |
| reklamy, payback i eksperymenty | PR-11d | najpierw dane wejściowe, później mierzalne rekomendacje |
| produkcyjne integracje OTA/SMS/e-mail | Etap 7 / PR-12+ | shadow mode, delivery tracking, retry i rollback |

**Wniosek:** walkthrough nie uzasadnia porzucenia istniejącej kolejności prac technicznych. Uzasadnia rozszerzenie finansów jako PR-6a–PR-6c oraz rozbicie PR-9, PR-10, PR-11 i Etapu 7 na mniejsze, użytkowe rezultaty.

## 10. Scenariusze akceptacyjne wynikające z rozmowy

### Scenariusz A — szybka rezerwacja direct

1. Ojciec odbiera telefon.
2. Wybiera domek i zaznacza termin.
3. Wpisuje gościa, osoby, telefon, cenę i informację o zadatku.
4. System zapisuje `kanał zawarcia: direct`, `kontakt: telefon`.
5. Źródło odkrycia może zostać puste i trafić do późniejszego dopytania.
6. Powstają potrzebne zadania i szkice; nie powstaje automatyczne zadanie contentowe.

### Scenariusz B — częściowa wpłata

1. Pobyt kosztuje 550 zł.
2. Operator księguje zaliczkę 300 zł.
3. Karta natychmiast pokazuje: wartość 550, wpłacono 300, pozostało 250.
4. Dodanie prowizji nie zmienia salda gościa.
5. Po dopłacie system pokazuje saldo zero i nie tworzy kolejnego przypomnienia.

### Scenariusz C — gość z Niemiec

1. Rezerwacja ma język `de`.
2. Dwa dni przed przyjazdem powstaje niemiecki szkic wiadomości.
3. Szkic zawiera zatwierdzoną trasę i ostrzeżenie przed błędną drogą z nawigacji.
4. Operator widzi odbiorcę, język, kanał i treść przed zatwierdzeniem.
5. Po wysyłce dostawca potwierdza status albo system tworzy alert.

### Scenariusz D — turnover tego samego dnia

1. Gość wyjeżdża o 11:00, kolejny przyjeżdża o 16:00.
2. Agenda pokazuje oba zdarzenia i pięciogodzinne okno.
3. Sprzątająca dostaje propozycję i przyjmuje zadanie.
4. Panel pokazuje checklistę właściwego domku i uwagę po poprzednim pobycie.
5. Dopiero ukończenie checklisty ustawia domek jako gotowy.
6. Zgłoszona usterka może zablokować gotowość i alarmuje właściciela.

### Scenariusz E — spojrzenie na rok

1. Patryk wybiera rok 2026.
2. Widzi obłożenie obu domków miesiąc po miesiącu.
3. System pokazuje, że dane są częściowe do 19 lipca, a przyszłe miesiące oznaczają stan sprzedaży na dziś, nie wynik końcowy.
4. Może porównać stan sprzedaży z tym samym dniem poprzedniego roku.
5. Luki 4+ nocy są widoczne, ale żadna kampania nie uruchamia się automatycznie.

### Scenariusz F — rozmowa po wyjeździe

1. Operator zapisuje źródło odkrycia, motywację, najlepszą część pobytu, problem, NPS i dokładny cytat.
2. Brak pamięci dokładnej frazy jest zapisany jako brak wiedzy, nie wymuszona odpowiedź.
3. Usterka tworzy osobne zgłoszenie.
4. Zgoda na cytat jest oddzielna od zgody marketingowej i medialnej.
5. Insight po kilku miesiącach pokazuje próbę i kompletność.

## 11. Co zmierzyć podczas realnego pilotażu

Najlepszy następny test nie polega na kolejnym oglądaniu ekranów, lecz na prowadzeniu systemu przez 2–4 tygodnie równolegle z obecnym źródłem prawdy.

Rejestrować:

- ile razy trzeba było wrócić do innego narzędzia;
- ile pól pominięto przy nowej rezerwacji i dlaczego;
- ile zadań było automatycznie zbędnych;
- ile wiadomości wymagało ręcznej korekty;
- ile razy operator nie wiedział, co zrobić jako następne;
- ile razy status domku nie odpowiadał rzeczywistości;
- czas od wyjazdu do przyjęcia i zakończenia sprzątania;
- liczbę sald niezgodnych z bankiem/OTA;
- kompletność źródła odkrycia i feedbacku;
- liczbę wykrytych usterek oraz czy zostały zamknięte przed kolejnym pobytem;
- różnice rezerwacji i blokad Stawy OS ↔ Mobile-Calendar/OTA.

Po pilotażu przeprowadzić dwa osobne wywiady:

1. z ojcem — co spowalnia codzienną pracę;
2. z osobą sprzątającą — co jest zbędne, czego brakuje i czy telefon/SMS rzeczywiście pomaga.

Patryk nie powinien odpowiadać za nich na te pytania, nawet jeśli zna proces bardzo dobrze.

## 12. Ostateczna rekomendacja

Najbliższy rozwój powinien trzymać się następującej kolejności wartości:

1. **prawda o pieniądzach**;
2. **jasność dzisiejszej pracy**;
3. **prosty i pewny kalendarz**;
4. **sprzątanie i wiadomości bez pamiętania o rutynie**;
5. **wiarygodna wiedza o popycie i gościach**;
6. **dopiero potem rekomendacje AI i bardziej ambitne integracje**.

Największym ryzykiem produktowym nie jest brak funkcji. Jest nim stworzenie systemu, który potrafi dużo, ale w codziennym użyciu wymaga od operatora interpretowania zbyt wielu pól, statusów i dużych liczb. Najlepszy kierunek to mniej informacji naraz, więcej kontekstu i jedna wyraźna następna akcja.
