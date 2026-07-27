# Incydent P0 — operator nie może wycenić ani zapisać rezerwacji

**Data zgłoszenia:** 2026-07-27  
**Użytkownik dotknięty:** tata — główny operator rezerwacji  
**Priorytet:** P0 — blokuje pilota i codzienną pracę  
**Status:** przyczyna potwierdzona w kodzie; poprawka zaplanowana jako PR-10f  

## Objawy

1. Po wyborze domku i dat formularz pokazuje sumę `0` zamiast wyceny.
2. Po przejściu formularza rezerwacja znika po chwili i nie zostaje w kalendarzu.
3. Konto operatora nie ma dostępu do potrzebnego kontekstu finansowego rezerwacji.
4. Formularz zamyka się przed potwierdzeniem zapisu przez serwer, więc użytkownik nie widzi prawdziwej przyczyny niepowodzenia.
5. Okno „Nowa rezerwacja” zawiera za dużo opisów i pól jak na rozmowę telefoniczną.
6. Dodanie i przeniesienie rezerwacji do kosza może sprawiać wrażenie zawieszonego: brak stanu „trwa zapis”, a rezultat pojawia się z dużym opóźnieniem.

## Potwierdzona przyczyna

Problemy 1–4 mają wspólną przyczynę w modelu roli `manager` oraz obsłudze zapisu:

- `rolePermissions.manager` ma `write: false` i `finance: false`;
- `isOrganizationEditor()` dopuszcza do `POST /api/bookings` wyłącznie `owner/admin`, dlatego serwer zwraca managerowi `403`;
- projekcja `/api/state` usuwa managerowi pola pasujące do kluczy cenowych, w tym ceny bazowe domków i stawki. `quoteStay()` dostaje więc dane bez ceny i wylicza `0`;
- `addBooking()` jest funkcją bez wyniku (`void`), optymistycznie dodaje rekord lokalnie, a przy odpowiedzi `403` usuwa go ponownie;
- `NewBookingDialog` wywołuje `onAdded()` natychmiast po `addBooking()`, zanim serwer potwierdzi zapis. Dialog zamyka się, a błąd jest widoczny co najwyżej jako ogólny stan synchronizacji poza formularzem.
- wszystkie komendy rekordowe współdzielą jedną globalną `cloudSaveQueue`; wolna wcześniejsza komenda opóźnia wysłanie następnej, również usunięcia;
- `commitBookingMutation()` jest `void`, więc widok usuwania nie może czekać na wynik ani pokazać czasu/rezultatu konkretnej operacji;
- gdy `cloudReady.current` jest fałszywe, część akcji kończy się cichym `return`. Przycisk nie informuje wtedy, czy akcja została przyjęta do wykonania;
- brak pomiaru czasu osobno dla kolejki klienta, żądania API, RPC i ponownego pobrania stanu uniemożliwia odróżnienie wolnego serwera od oczekiwania w przeglądarce.

To nie jest błąd kalendarza ani silnika `quoteStay()` sam w sobie. Kalendarz nie pokazuje rezerwacji, ponieważ autoryzowany zapis nigdy nie został zatwierdzony.

## Zakres PR-10f — hotfix operatora

### 1. Uprawnienia oparte na komendach

- dopuścić `manager` do utworzenia i operacyjnej edycji rezerwacji, anulowania rezerwacji oraz tworzenia/anulowania blokady;
- nie nadawać managerowi ogólnego `write`, dostępu do ustawień, członkostwa, eksportu, wysyłki ani pełnych finansów zarządczych;
- rozdzielić uprawnienie „finanse rezerwacji” od finansów firmy: operator widzi cennik, cenę pobytu, zaliczkę, wpłacono i saldo danej rezerwacji, ale nie koszty, wynik, inwestycje ani eksport;
- odzwierciedlić ten sam zakres w TypeScript, API, RLS/RPC i nawigacji.

### 2. Zapis potwierdzany przez serwer

- zmienić `addBooking` i `updateBooking` na asynchroniczne komendy zwracające wynik;
- podczas zapisu zablokować przycisk i pokazać „Zapisywanie…”;
- zamknąć dialog dopiero po odpowiedzi `200`;
- przy `403`, `409`, `422`, błędzie sieci lub niepełnej odpowiedzi pozostawić formularz otwarty, zachować dane i pokazać komunikat przy przycisku;
- po sukcesie scalić agregat zwrócony przez serwer, a następnie potwierdzić obecność rezerwacji w kalendarzu i szczególe.

### 2a. Czas reakcji i kolejka operacji

- dodać jawny stan per rezerwacja: `Zapisywanie`, `Usuwanie`, `Zapisano`, `Nie udało się`;
- nie przyjmować kolejnej sprzecznej akcji dla tej samej rezerwacji, dopóki poprzednia nie ma wyniku;
- zastąpić jedną globalną kolejkę kolejkami per agregat lub wykazać testem, że niezależna wolna komenda nie blokuje rezerwacji;
- nigdy nie kończyć akcji cichym `return` przy `cloudReady=false`; pokazać komunikat i możliwość ponowienia;
- mierzyć `queue_wait_ms`, `request_ms`, `rpc_ms` i `refresh_ms` z request ID;
- ustawić budżet UX: reakcja wizualna do 100 ms, typowy zapis/usunięcie do 2 s, po 3 s widoczny stan „To trwa dłużej”, po 10 s błąd z bezpiecznym ponowieniem lub jednoznaczne oczekiwanie na rozstrzygnięcie;
- usunięcie ma zniknąć z aktywnego kalendarza natychmiast po przyjęciu akcji, ale otrzymać oznaczenie oczekiwania; przy odrzuceniu serwera rekord wraca wraz z komunikatem.

### 3. Wycena w pierwszym kroku

- udostępnić operatorowi stawki potrzebne przez `quoteStay()` bez ujawniania kosztów i wyniku;
- po wyborze domku i obu dat pokazać stale widoczne: liczbę nocy, cenę łączną, cenę średnią za noc i sugerowaną zaliczkę;
- dodać test roli `manager`, który dla znanej stawki otrzymuje tę samą wycenę co `owner`;
- nie przechodzić automatycznie do finansów ani nie zapisywać szkicu przy samym sprawdzaniu ceny.

### 4. Uproszczenie okna „Nowa rezerwacja”

- zastąpić select domku dwoma dużymi kaflami: „Rybak” z ikoną ryby i „Czapla” z ikoną ptaka; tekst pozostaje obok ikony dla dostępności;
- usunąć opisowe akapity „Krok 1/2/3” i pozostawić krótkie etykiety `Termin`, `Gość`, `Cena`;
- w pierwszym kroku eksponować domek, daty, dostępność i wycenę; godziny, dzieci i wyjątki pozostawić zwijane;
- w drugim kroku pokazać minimum: imię/nazwa rezerwacji, telefon oraz kanał; e-mail i źródło odkrycia jako opcjonalne;
- w trzecim kroku pokazać cenę, zaliczkę i saldo; pola OTA tylko dla OTA, pozostałe opcje pod „Więcej”.

### 5. Kalendarz — odzyskanie przestrzeni

- kalendarz ma być pierwszym elementem widoku, bez kart obłożenia nad osią;
- połączyć `Dzisiaj`, strzałki, legendę i blokadę w jeden zwarty pasek;
- usunąć mylący, statyczny opis zakresu `lipiec 2026`; aktualny miesiąc i rok mają wynikać z pozycji scrolla;
- przykleić nagłówek miesiąca i roku do górnej krawędzi przewijanej osi;
- rozszerzyć nawigację daleko w obie strony przez doładowywanie okna dat przy zbliżeniu do krawędzi, bez skoku pozycji scrolla;
- zachować przyklejone nazwy domków po lewej i jeden poziomy scroll dla miesięcy, dni oraz obu domków.

## Kolejność naprawy i publikacji

1. Test regresyjny odtwarzający konto `manager`: widoczna wycena, zapis `403`, zniknięcie optymistycznego rekordu.
2. Test wydajnościowy: wolna wcześniejsza komenda, następnie dodanie i usunięcie rezerwacji; zapisać czasy kolejki, API, RPC i odświeżenia.
3. Migracja/RPC z uprawnieniami per komenda i bez rozszerzenia pełnego `write`.
4. Serwerowa projekcja cennika oraz salda pojedynczej rezerwacji.
5. Asynchroniczny kontrakt zapisu, kolejki per agregat i komunikaty w dialogu.
6. Uproszczenie formularza.
7. Zagęszczenie i nieskończona nawigacja kalendarza.
8. Pełne testy, lint, TypeScript i build.
9. Preview na koncie taty: desktop oraz jego telefon z docelowym powiększeniem tekstu.
10. Produkcyjny smoke na jednej kontrolnej rezerwacji: dodanie, odświeżenie, przeniesienie do kosza i potwierdzenie braku w aktywnym kalendarzu.
11. Dopiero po potwierdzeniu wyceny, trwałego zapisu, czasu operacji i widoczności w kalendarzu można wznowić pilot.

## Kryteria akceptacji

- tata wybiera domek i daty, a kwota pojawia się przed podaniem danych gościa;
- ta sama wycena dla konta taty i ownera przy tych samych danych;
- przycisk „Dodaj rezerwację” nie zamyka okna przed potwierdzeniem serwera;
- udany zapis jest po odświeżeniu widoczny w kalendarzu, rezerwacjach i finansach rezerwacji;
- odrzucony zapis pozostawia dane w formularzu i pokazuje zrozumiały błąd;
- kliknięcie dodania lub usunięcia daje widoczny rezultat do 100 ms; użytkownik zawsze wie, czy operacja czeka, zakończyła się czy została odrzucona;
- typowy zapis i usunięcie na produkcji kończą się do 2 s, a przypadki powyżej 3 s mają telemetrykę wskazującą warstwę opóźnienia;
- wolna, niezależna komenda nie blokuje dodania ani usunięcia rezerwacji;
- manager nadal nie może zmieniać stawek, kosztów, wyniku, ról, ustawień, eksportu ani wysyłki;
- kalendarz otwiera się od osi, pokazuje przyklejony miesiąc i rok oraz pozwala iść daleko wstecz i wprzód;
- test na rzeczywistym telefonie taty przechodzi bez poziomego overflow strony i bez utraty podstawowych akcji przy powiększeniu tekstu.
