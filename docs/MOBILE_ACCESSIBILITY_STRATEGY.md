# Strategia mobilnej dostępności Stawy OS

Status: wdrożone i iteracyjnie poprawione po testach na telefonach; oczekuje na końcową, uwierzytelnioną wysyłkę Resend

Priorytet: P0 — warunek używalnego MVP dla głównego operatora

Źródło: test na telefonie z powiększonym interfejsem, 15 sierpnia 2026

## Cel

Ojciec ma móc samodzielnie wykonać na telefonie trzy podstawowe zadania:

1. sprawdzić obłożenie obu domków;
2. znaleźć i otworzyć rezerwację;
3. dodać albo edytować rezerwację od początku do końca.

Nie wymagamy od niego zmiany systemowego rozmiaru tekstu, skali ekranu ani zoomu przeglądarki.

## Diagnoza

Problem nie wynika wyłącznie z dużego tekstu. Aplikacja miesza dwa modele:

- responsywny shell i dolną nawigację;
- desktopowe powierzchnie robocze osadzone w mobilnym ekranie.

Przy powiększeniu powoduje to utratę kontekstu, ucinanie boków oraz konieczność jednoczesnego przewijania w pionie i poziomie.

### P0 — blokery

1. **Okno dodawania/edycji rezerwacji nie reflowuje do widocznego obszaru.**
   `NewBookingDialog` jest szerokim modalem z nagłówkiem, trzema krokami, główną kolumną i podsumowaniem. Przy dużym powiększeniu powierzchnia dialogu pozostaje większa od wizualnego viewportu, więc lewa i prawa część treści oraz przyciski mogą znaleźć się poza ekranem.
2. **Oś wyboru dat w formularzu ma stałe minimum 840 px.**
   Jest to poprawne jako lokalnie przewijana wizualizacja, ale przy obecnym dialogu użytkownik nie odróżnia przewijania osi od przesuwania całej strony. Etykiety dni także przestają się mieścić.
3. **Główna oś czasu nie mieści się użytecznie przy powiększeniu.**
   Oś musi pozostać domyślnym widokiem, ponieważ ojciec używa jej jak w Mobile Calendar: podczas rozmowy telefonicznej szybko rozpoznaje wolne daty obu domków. Obecne stałe wymiary — kolumna domku 138 px i dni po 44 px — zostawiają jednak zbyt mało miejsca na daty i rezerwacje.
4. **Stała dolna nawigacja zasłania treść.**
   Shell rezerwuje ogólny `pb-28`, lecz nie wszystkie wewnętrzne listy, dialogi i akcje końcowe uwzględniają rzeczywistą wysokość nawigacji oraz safe area przy dużym tekście.
5. **Poziome przepełnienie nie jest izolowane.**
   Zrzuty pokazują pasek przewijania całej strony. To oznacza, że co najmniej jeden potomek rozszerza dokument zamiast przewijać się w swoim jednoznacznie oznaczonym kontenerze.

### P1 — poważne utrudnienia

1. Nagłówek zużywa zbyt dużo szerokości na logo, wyszukiwanie, powiadomienia i konto jednocześnie.
2. Panel filtrów kalendarza jest pionowy, ale pozostaje wysoki i odsuwa główną treść daleko w dół.
3. Karty rezerwacji używają pojedynczych wierszy dla daty, ceny, statusu i następnej akcji; długie wartości są ucinane zamiast układać się w kolumnę.
4. Liczne etykiety używają bardzo małych rozmiarów CSS i zwiększonego letter-spacingu. Po wymuszonym podbiciu do 12 px zajmują znacznie więcej miejsca niż przewidziano.
5. Dolna nawigacja dla szerszej roli ma pięć pozycji, co przy dużym tekście wymusza skracanie etykiet.

## Decyzja projektowa

Nie dodajemy suwaka zmniejszającego cały interfejs. Systemowe powiększenie jest potrzebą użytkownika, a nie ustawieniem, które aplikacja powinna neutralizować.

Wprowadzamy **tryb kompaktowego przepływu zależny od dostępnej przestrzeni**, a nie od modelu telefonu. Breakpointy powinny reagować również na wąski viewport powstały przez zoom. Treści robocze przechodzą do jednej kolumny, a jedynym wyjątkiem od reflow jest lokalna oś kalendarza.

## Strategia wdrożenia

### Etap 1 — bezpieczna rama mobilna

- zablokować poziome przepełnienie dokumentu i znaleźć każdy element, który rozszerza `body`;
- oprzeć odstępy głównej treści i dialogów o `env(safe-area-inset-*)`;
- zmniejszyć marginesy zewnętrzne na wąskim viewportcie do 8–12 px;
- pozwolić nagłówkowi przejść w wariant uproszczony;
- zapewnić co najmniej 44 px wygodnego pola dotyku dla głównych akcji (minimum normatywne pozostaje niższe).

### Etap 2 — kalendarz mobile-first

- domyślnie otwierać na telefonie `Oś czasu`, zgodnie z utrwalonym sposobem pracy ojca w Mobile Calendar;
- zachować `Agendę` jako pomocniczy widok bieżących zdarzeń;
- w osi zmniejszyć kolumnę domku albo zastąpić ją krótkim selektorem domku nad osią;
- przewijanie poziome ograniczyć do samej siatki dat i dodać czytelny sygnał „Przesuń daty”;
- zachować dostęp do dodania pobytu z agendy bez precyzyjnego trafiania w wąską komórkę.

### Etap 3 — formularz jako pełnoekranowy mobilny flow

- poniżej szerokości reflow dialog staje się pełnoekranowym arkuszem: `inset: 0`, bez bocznych marginesów i zaokrągleń;
- nagłówek kroku i przycisk zamknięcia pozostają widoczne;
- podsumowanie z prawej kolumny trafia pod formularz albo do zwijanego panelu „Podsumowanie”;
- stopka z `Wstecz` i `Dalej/Zapisz` jest stałą strefą poza przewijaną treścią i uwzględnia safe area;
- nazwy kroków mogą skrócić się do numeru i aktywnej nazwy zamiast trzech szerokich zakładek;
- oś 21 dni pozostaje lokalnie przewijana, ale pola dat są zawsze dostępną alternatywą i nie mogą zostać ucięte.

### Etap 4 — lista rezerwacji i tekst

- karty rezerwacji na wąskiej przestrzeni przechodzą z jednego wiersza do sekcji: gość/status, termin, kwota, następna akcja;
- teksty operacyjne mogą zawijać się do dwóch lub więcej wierszy; `truncate` zostaje tylko tam, gdzie pełna wartość jest dostępna po wejściu w szczegóły;
- etykiety o dużym letter-spacingu dostają wariant kompaktowy;
- kontrolujemy długie polskie słowa przez `min-width: 0`, `overflow-wrap` i elastyczne kolumny.

### Etap 5 — weryfikacja

Testujemy co najmniej:

- 320 × 568 CSS px przy 100%;
- 360 × 640 CSS px przy 100%;
- desktop 1280 px przy zoomie 200% i 400% jako test reflow;
- Android/Chrome z konfiguracją ojca w pionie i poziomie;
- otwarcie klawiatury ekranowej w każdym kroku formularza.

## Kryteria akceptacji MVP

1. Dokument nie ma poziomego paska przewijania na ekranach zwykłych i formularzowych.
2. Przy 200% powiększenia żadna treść, kontrolka ani akcja nie jest ucięta lub zasłonięta.
3. Przy szerokości 320 CSS px użytkownik czyta i obsługuje widoki jednym pionowym przepływem; wyjątkiem jest wyłącznie jawnie wydzielona siatka dat.
4. Ojciec potrafi bez pomocy: sprawdzić dzisiejsze/najbliższe pobyty, otworzyć rezerwację i dodać testową rezerwację.
5. Główne przyciski mają wygodne pola dotyku, wyraźny fokus i nie nakładają się po powiększeniu tekstu.
6. Dolna nawigacja i sticky stopka formularza nigdy nie zasłaniają ostatniej kontrolki.
7. Obrót telefonu nie powoduje utraty aktualnego kroku ani wpisanych danych.
8. Testy istniejących reguł rezerwacji przechodzą bez regresji.

## Kolejność wykonania

1. Reprodukcja i test ochronny na szerokości reflow.
2. Globalny shell, viewport i izolacja overflow.
3. Pełnoekranowy mobilny formularz rezerwacji.
4. Oś czasu jako domyślny kalendarz mobilny oraz pomocnicza Agenda.
5. Karty listy rezerwacji i pozostałe przepełnienia tekstu.
6. Test na realnym telefonie ojca.
7. Test wiadomości e-mail i decyzja „MVP gotowe”.

## Poza pierwszym zakresem

- przeprojektowanie całej wersji desktopowej;
- osobny „tryb seniora” utrzymywany jako drugi interfejs;
- zmniejszanie tekstu poniżej preferencji systemowych użytkownika;
- przebudowa pomocniczych tabel finansowych, jeśli nie należą do podstawowej ścieżki ojca.

## Wynik wdrożenia — 18 sierpnia 2026

Zrealizowano:

- jawny viewport `device-width` z obsługą safe area;
- brak poziomego przepełnienia dokumentu;
- pełnoekranowy formularz rezerwacji na telefonie;
- stały nagłówek i stopkę formularza poza osobno przewijaną treścią, również w orientacji poziomej;
- kompaktowe kroki i jednokolumnowy wybór domku przy minimalnej szerokości;
- lokalnie przewijaną oraz opisaną oś wyboru dat;
- domyślną Oś czasu kalendarza zgodnie ze sposobem pracy ojca w Mobile Calendar;
- węższą przyklejoną kolumnę domku i izolowane przewijanie osi kalendarza;
- kompaktowy panel sterowania kalendarzem;
- zawijające się karty rezerwacji;
- zwijane filtry i podsumowanie na liście rezerwacji;
- większe pola dotyku w nagłówku.

Dowody automatyczne:

- 320 × 568 CSS px — brak poziomego przepełnienia strony i dialogu;
- 360 × 640 CSS px — Oś czasu jest domyślna i przewija się wyłącznie we własnym regionie;
- 568 × 320 CSS px — pełny formularz, nagłówek i stopka mieszczą się w viewportcie;
- wszystkie trzy kroki formularza są dostępne przy 320 px;
- lista historycznych rezerwacji nie przepełnia viewportu;
- brak błędów konsoli i overlayu Next.js;
- `npm run typecheck` i `npm run lint` przechodzą;
- `npm test`: 106 plików, 504 testy przechodzą;
- pakiet e-mail: 7 plików, 31 testów przechodzi;
- `npm run build` przechodzi wraz z manifestem wydania.

### Regresja wykryta na realnym iPhonie — 18 sierpnia 2026

Pierwsze wdrożenie nadal zajmowało zbyt dużo miejsca w pionie. Zdjęcie z rzeczywistego iPhone'a pokazało, że:

- `Anuluj` i `Dalej` układały się w dwóch rzędach, przez co stopka zabierała dużą część widocznego obszaru;
- przewijanie całej powierzchni dialogu oparte o `sticky` było zbyt zależne od zachowania pasków przeglądarki;
- oddzielne, duże karty dostępności i wyceny odsuwały oś dat oraz pola formularza.

Poprawka produkcyjna `dpl_9VBwgG2QhU4GtR5gUHbdeLBUubuC` wprowadziła:

- układ `header / scrollable content / footer` oparty o flex i `100dvh`;
- przewijanie wyłącznie środkowej części formularza;
- jeden poziomy rząd akcji mobilnych;
- wspólny, dwukolumnowy pas dostępności i wyceny z krótszą treścią mobilną.

Kolejny test użytkownika ujawnił poziome przesuwanie całej środkowej części formularza. Przyczyną było połączenie pionowego `overflow-y: auto` z potomkami o szerokości wewnętrznej większej od kontenera. Kontrakt został zaostrzony: formularz i jego przewijana część mają `width/max-width: 100%`, `min-width: 0` oraz zablokowany poziomy overflow; poziome przewijanie pozostaje dozwolone wyłącznie w regionie osi dat. Test komponentu sprawdza obecność tej izolacji.

Po poprawce ponownie przeszły: build produkcyjny, TypeScript, ESLint oraz 12 testów dialogu i formularza. Alias `https://stawyusikory.vercel.app` wskazuje nowe wdrożenie o statusie `Ready`, a kontrola logów nie wykazała błędów runtime.

Pozostałe bramki MVP:

1. powtórzyć główne ścieżki na rzeczywistym telefonie ojca i ustawieniach powiększenia, w tym z otwartą klawiaturą;
2. wykonać kontrolną wysyłkę e-mail przez Resend z zalogowanej sesji właściciela;
3. potwierdzić dostarczenie i zapis webhooka (wcześniejsza próba wykazała nieprawidłowy klucz; sama obecność nowej wartości w Vercel nie dowodzi jeszcze poprawności).

## Preflight wydania — 18 sierpnia 2026

- repozytorium jest połączone z projektem Vercel `stawyusikory`;
- aktualny alias produkcyjny to `https://stawyusikory.vercel.app` i wskazuje wdrożenie o statusie `Ready`;
- środowisko Production ma wszystkie wymagane nazwy konfiguracji e-mail, ale kontrolna próba wysyłki wykazała, że wartość `RESEND_API_KEY` jest nieprawidłowa (`400 API key is invalid`); automatycznej wysyłki nie można uznać za działającą do czasu wymiany klucza;
- środowisko Preview ma konfigurację Supabase i `CRON_SECRET`, lecz nie ma Resend — dzięki temu test UI nie uruchomi przypadkowej wysyłki;
- odczyt logów produkcyjnych z ostatnich 24 godzin nie zwrócił błędów runtime.

Bezpieczna sekwencja wydania:

1. utworzyć wdrożenie Preview z bieżącego drzewa roboczego;
2. zalogować ojca na Preview i powtórzyć: odczyt dostępności z Osi czasu, otwarcie rezerwacji oraz przejście formularza bez zapisu lub z oznaczoną rezerwacją testową;
3. po pozytywnym teście promować ten sam zweryfikowany artefakt do Production;
4. wysłać jedną kontrolną wiadomość na wskazany adres;
5. potwierdzić status wysłania, dostarczenia oraz zapis webhooka;
6. dopiero wtedy oznaczyć MVP jako gotowe.

## Audyt końcowy po poprawkach użytkownika — 18 sierpnia 2026

Powtórna kontrola rzeczywistego przepływu wykazała i naprawiła jeszcze dwa problemy:

- przy efektywnej szerokości około 290 px trzy akcje stopki formularza łamały tekst niemal po literach; na telefonie zamknięcie pozostaje teraz pod dużym `X`, a stopka pokazuje maksymalnie dwie podstawowe akcje z niełamanymi etykietami;
- edycję pobytu z Booking mógł blokować odpowiadający mu wpis iCal `CLOSED - Not available`; dopasowany wpis źródłowy jest teraz ignorowany wyłącznie dla tej samej platformy, jednostki i niemal identycznego zakresu dat, a obce blokady nadal zatrzymują zapis.

Dowody z interaktywnej kontroli zalogowanego lokalnego buildu:

- pionowy kalendarz przy override 320 × 568: domyślna `Oś czasu`, brak poziomego overflow dokumentu, lokalny region dat `overflow-x: auto`;
- poziomy kalendarz przy override 844 × 390: tytuł i shell ukryte, toolbar zaczyna się przy górnej krawędzi, a oś zajmuje pozostałą wysokość;
- formularz przy 320 × 568: dialog mieści się w viewporcie, środek ma wyłącznie pionowy scroll, jedynym szerszym potomkiem jest jawnie przewijana oś dat;
- obrót formularza w kroku `Finanse` zachowuje krok oraz dane, nie tworzy poziomego overflow i utrzymuje nagłówek oraz stopkę w viewporcie;
- lista rezerwacji przy 360 × 640: wszystkie pięć kart pozostaje w szerokości dokumentu, dolna nawigacja nie rozszerza strony;
- edycja rzeczywistego wpisu Booking przechodzi z kroku `Termin` do `Gość` mimo odpowiadającego wpisu iCal, bez ignorowania innych blokad.

Pozostała jedna bramka zewnętrzna: zalogowana próba wysyłki na `PatrykSikora98@gmail.com`, identyfikator wiadomości Resend oraz zdarzenie dostarczenia/webhook.
