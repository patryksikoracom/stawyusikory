# Stawy OS — nadrzędny plan realizacji

**Status:** plan obowiązujący
**Data aktualizacji:** 25 lipca 2026
**Źródła:** audyt aplikacji, plan wdrożenia poprawek, plan restrukturyzacji, ADR-001, słownik KPI, raport z przejścia przez aplikację z 19 lipca oraz ustalenia z realizacji PR-1–PR-5

## Jak czytać plan

- **Etap** to większy rezultat biznesowy i bramka akceptacyjna.
- **PR** to mała paczka zmian wdrażana, testowana i sprawdzana osobno.
- Jeden Etap może zawierać kilka PR-ów.
- Nie wybieramy między „PR-2” i „Etapem 1”: **PR-2 jest kolejną paczką wewnątrz Etapu 1**.

Każdy PR przechodzi tę samą pętlę:

1. potwierdzenie zakresu na podstawie audytu i planu,
2. implementacja wyłącznie tej paczki,
3. testy jednostkowe/integracyjne, lint, TypeScript i build,
4. test właściwego przepływu w przeglądarce,
5. poprawki i ponowienie testów,
6. ręczna akceptacja właściciela,
7. dopiero potem następny PR.

Commit, push i deployment są osobnymi decyzjami. Samo ukończenie lokalnej paczki ich nie uruchamia.

## Aktualny stan

| Element | Status | Znaczenie |
|---|---|---|
| Audyt ogólny | ukończony | stan wejściowy i lista ryzyk są zapisane |
| Etap 0 | zaakceptowany do kontynuacji 17.07.2026 | wybrana ścieżka A, źródła prawdy, słownik KPI i blokada komunikacji |
| PR-1 / Etap 1.1 | ukończony i zaakceptowany do kontynuacji | loading gate, brak demo flash także dla częściowego payloadu chmurowego, bezpieczne Ustawienia |
| PR-2 / Etap 1.2a | zaakceptowany 17.07.2026 | prawdziwa tożsamość, alerty i copy; preview online zweryfikowane przez właściciela |
| PR-3 / Etap 1.2b | zaakceptowany 17.07.2026 | segmenty z rekordów źródłowych, uczciwe empty states i jawna bramka rekomendacji |
| PR-4 / Etap 1.3 | **zaakceptowany 17.07.2026 z wyjątkiem HIBP** | invitation-only, brak domyślnego `owner`, kontrola `disable_signup`; preview desktop/mobile zweryfikowane; właściciel jawnie zaakceptował pozostawienie HIBP do czasu planu Pro |
| Etap 1 jako całość | **warunkowo zamknięty 17.07.2026** | wszystkie zmiany możliwe na obecnym planie są wdrożone; jedyny przyjęty wyjątek to płatna ochrona HIBP |
| PR-5 / Etap 2.1 | **zaakceptowany do publikacji 19.07.2026** | wspólny silnik okresów i KPI, osobne PLN/EUR, metadane jakości; testy lokalne i preview desktop/mobile zakończone powodzeniem |
| Etap 2 jako całość | w toku | PR-5 zaakceptowany; następna paczka to PR-6a. Ustalenia finansowe z walkthrough zostały włączone do PR-6a–PR-6c, a pozostałe potrzeby przypisano do późniejszych paczek bez zmiany kolejności etapów |

## Bramka wydania: MVP operatora dla taty

Potrzeby taty nie rozszerzają zakresu PR-6–PR-8. Są zapisane jako osobna bramka wydania przecinająca istniejące, małe paczki:

- POM-005 — szybka wycena i zapis rezerwacji podczas rozmowy;
- POM-006 — cennik zgodny z Mobile Calendar;
- POM-004 — stan domków, pełna nazwa bieżącego gościa i następna zmiana;
- POM-007 — e-mail wybierany, poprawiany i wysyłany z aplikacji;
- PR-9a — właściwa rola operatora zamiast pełnego konta właściciela;
- PR-12 / Etap 7 — kontrolowane przełączenie źródła prawdy, status dostawcy wiadomości, shadow mode i rollback.

Do czasu spełnienia tej bramki Mobile Calendar/OTA pozostaje nadrzędnym źródłem rezerwacji i dostępności. Jeżeli subskrypcja kończy się wcześniej, należy ją przedłużyć na najkrótszy praktyczny okres zamiast przełączać system bez uzgodnienia danych.

Pełny zakres, kolejność zależności, inwentaryzacja danych, kryteria akceptacji i miary pilota są źródłem prawdy w `PLAN_MVP_OPERATORA_TATY.md`.

## Mapa Etapów i PR-ów

| Kolejność | Etap | Paczka | Zakres | Bramka po paczce |
|---:|---|---|---|---|
| 0 | Etap 0 — zasady pilota | decyzje, bez osobnego PR | ścieżka A, źródła prawdy, KPI, wyłączona wysyłka | ADR-001 i KPI zaakceptowane |
| 1 | Etap 1 — bezpieczeństwo i zaufanie | PR-1 | loading gate, brak demo/zer, bezpieczne formularze | ukończone |
| 2 | Etap 1 — bezpieczeństwo i zaufanie | PR-2 — zaakceptowany | profil z sesji, rola, dynamiczne alerty, uczciwe copy, zaszyfrowany backup | konto testowe nie widzi `Marcin/MS`; zero stałych alertów |
| 3 | Etap 1 — bezpieczeństwo i zaufanie | PR-3 — zaakceptowany | usunięcie przykładowych insightów i uczciwe empty states | przy braku danych nie ma rekomendacji biznesowej |
| 4 | Etap 1 — bezpieczeństwo i zaufanie | **PR-4 — zaakceptowany z wyjątkiem HIBP** | invitation-only, blokada signup→owner i bramka konfiguracji Auth; HIBP po Pro | ukończone na obecnym planie; HIBP pozostaje przyjętym ryzykiem |
| 5 | Etap 2 — prawidłowe metryki | **PR-5 — zaakceptowany** | wspólny silnik okresów, aktywne rezerwacje, obłożenie, waluty | testy granic miesiąca/roku/DST i preview przeszły; właściciel zatwierdził publikację online |
| 6 | Etap 2 — finanse | PR-6a | saldo gościa i cztery perspektywy: sprzedaż, należności, cashflow, wynik | ręczne fixture'y potwierdzają wpłaty, zwroty, saldo i nadpłatę |
| 7 | Etap 2 — finanse | PR-6b | koszty faktyczne/modelowane, prowizje i wynik zarządczy | koszt nie zmienia salda gościa; strata i nadpłata nie są ukrywane |
| 8 | Etap 2 — finanse | PR-6c | prezentacja, dowody, kompletność i eksport finansowy | szczegół rezerwacji, Dashboard, Finanse i CSV są zgodne |
| 9 | Etap 3 — wielosesyjność | PR-7 | telemetryka, koordynacja kart, czytelny konflikt | brak cichego nadpisania zmian |
| 10 | Etap 3 — zapis domenowy | PR-8a… | komendy per domena i odejście od pełnego snapshotu | migracja etapami; każdy pod-PR osobno |
| 11 | Etap 4 — organizacje i role | PR-9a | active organization, role, RLS i izolacja PII/finansów | dwie organizacje i role przechodzą testy negatywne |
| 12 | Etap 4 — operacje zespołu | PR-9b | zlecenia sprzątania, przyjęcie, checklisty per domek i eskalacja | sprzątająca wykonuje pełny turnover bez dostępu do PII/finansów |
| 13 | Etap 4 — zgodność operacyjna | PR-9c | procedura małoletnich wynikająca z zatwierdzonego SOP i minimalizacja danych | zapisuje się wykonanie procedury, nie zbędne dane dziecka |
| 14 | Etap 5 — fundament UX | PR-10a | wspólne dialogi, klawiatura, mobile, paginacja i wydajność | WCAG smoke test i 1000 rekordów |
| 15 | Etap 5 — Dzisiaj | PR-10b | chronologiczna agenda, stan domków i same-day turnover | w 5 sekund widać przyjazdy, wyjazdy i brak gotowości |
| 16 | Etap 5 — rezerwacje | PR-10c | prosty formularz, jawne filtry/sortowanie, lista i szczegół | powrót zachowuje filtry; kanał zawarcia nie miesza się ze źródłem odkrycia |
| 17 | Etap 5 — kalendarz | PR-10d | kontekst 7 dni wstecz, kanały na paskach, drag/touch/klawiatura | szybkie utworzenie pobytu bez utraty dostępności |
| 18 | Etap 5 — przegląd roku | PR-10e | roczny widok sprzedaży/obłożenia i deterministyczne wykrywanie luk | luki mają daty, domek, próg i dowody; brak automatycznej kampanii |
| 19 | Etap 6 — CRM | PR-11a | osoba niezależna od pobytu, deduplikacja i atrybucja | powracający gość ma jedną tożsamość i wiele pobytów |
| 20 | Etap 6 — relacja i zgody | PR-11b | debrief, status opinii i consent ledger per cel/kanał | wycofanie właściwej zgody natychmiast blokuje daną wysyłkę/użycie |
| 21 | Etap 6 — komunikacja | PR-11c | szkice PL/DE/EN, dojazd, reguły kanałowe i historia statusów | poprawny język i kanał; wysyłka nadal zablokowana do bramki |
| 22 | Etap 6 — wzrost | PR-11d | import reklam CSV, eksperymenty ofertowe, payback i mierzalne rekomendacje | insight pokazuje próbę, koszt, źródła i nie wykonuje akcji samodzielnie |
| 23 | Etap 7 — integracje i go-live | seria PR-12/spike/go-live | gateway OTA, dostawcy SMS/e-mail, shadow mode i rollback | minimum 7 dni bez niewyjaśnionych różnic i potwierdzone dostarczenie wiadomości |

Każda paczka z sufiksem jest osobnym PR-em i ma własną bramkę. Nie łączymy kilku pozycji tylko dlatego, że należą do tego samego Etapu.

## Ostatnia zamknięta paczka: PR-5 — zaakceptowana do publikacji online

### Zakres

- wprowadzić jedną, odporną na DST definicję okresu `[od, do)` i przecięcia pobytu z okresem,
- ujednolicić predykat aktywnej rezerwacji dla KPI,
- liczyć sprzedane i dostępne noce oraz obłożenie komercyjne bez maskowania wartości powyżej 100%,
- pomniejszać dostępność wyłącznie o nieanulowane bloki `Serwis` i `Remont`, bez podwójnego odjęcia nakładających się bloków,
- liczyć wartość noclegów, ADR i RevPAR osobno dla PLN i EUR,
- pokazywać okres, kompletność i źródło obliczeń na Dashboardzie i w Finansach,
- pokryć testami granice miesiąca, roku, DST, 29 lutego i błędne rekordy.

### Poza zakresem PR-5

- sprzedaż, należności, cashflow i wynik zarządczy — PR-6a,
- docelowy interfejs dowodów finansowych — PR-6c; filtry listy operacyjnej — PR-10c,
- consent ledger — PR-11b; mierzalne rekomendacje wzrostu — PR-11d,
- pełna macierz ról domenowych i multi-tenant — PR-9a,
- płatne podniesienie Supabase do Pro — osobna decyzja właściciela.

### Akceptacja PR-5

1. Dashboard i Finanse używają tej samej funkcji do liczenia okresów, aktywnych rezerwacji i obłożenia.
2. Pobyt przecinający miesiąc lub rok wnosi wyłącznie noce należące do wybranego okresu.
3. Rezerwacje nowe, anulowane, usunięte, z błędnymi datami lub bez znanego domku nie zasilają KPI.
4. PLN i EUR są prezentowane oddzielnie i nigdy nie są sumowane bez kursu.
5. Brak danych nie jest prezentowany jako zero, a niekompletne dane są jawnie oznaczone.
6. Każda karta KPI podaje okres, kompletność i źródło obliczenia.
7. Testy automatyczne, build i test przeglądarkowy desktop/mobile przechodzą bez błędów konsoli.

**Status PR-5 (2026-07-19): zaakceptowany przez właściciela do publikacji online.** Zweryfikowano 100 testów automatycznych, lint, TypeScript, build oraz Dashboard i Finanse na desktopie i telefonie. PR-6a jest następną nierozpoczętą paczką.

## Aktualna paczka: PR-6a — saldo gościa i cztery perspektywy finansowe

### Cel

Zbudować jedno źródło prawdy dla wartości pobytu, wpłat gościa, zwrotów, salda i nadpłaty oraz wyznaczyć rozłączne wejścia do sprzedaży, należności, cashflow i wyniku zarządczego. PR-6a nie przebudowuje jeszcze całego interfejsu Finansów ani modelu wszystkich kosztów.

### Zakres PR-6a

- zdefiniować `wpłacono od gościa = wpłaty + zaliczki − zwroty`, wyłącznie dla zaksięgowanych transakcji w walucie rezerwacji;
- nie wliczać prowizji, kosztu ani wypłaty OTA do kwoty zapłaconej przez gościa;
- liczyć `saldo = wartość rezerwacji − wpłacono od gościa` bez obcinania wyniku do zera;
- pokazywać saldo ujemne jako nadpłatę;
- rozdzielić wejścia i identyfikatory metryk dla sprzedaży, należności, cashflow i wyniku;
- obsłużyć brak ceny, różne waluty, zwrot częściowy, nadpłatę i wpis otwarcia bez udawania zera;
- użyć tej samej funkcji salda w szczególe rezerwacji, Finansach, alertach i eksporcie;
- przygotować ręcznie policzone fixture'y i testy regresji.

### Poza zakresem PR-6a

- pełny model kosztów i prowizji — PR-6b;
- docelowy układ kart, dowody i eksport — PR-6c;
- agenda Dzisiaj — PR-10b;
- lista/formularz rezerwacji — PR-10c;
- kalendarz i widok roczny — PR-10d/PR-10e;
- CRM, zgody, języki i wiadomości — PR-11a–PR-11c;
- automatyczne kampanie i zmiany ceny — pozostają zabronione.

### Akceptacja PR-6a

1. Pobyt 550 PLN z zaliczką 300 PLN pokazuje: wartość 550, wpłacono 300, pozostało 250.
2. Dopłata do 600 PLN pokazuje nadpłatę 50 PLN, nie saldo zero.
3. Prowizja 80 PLN i koszt sprzątania nie zmieniają kwoty wpłaconej przez gościa.
4. Zwrot zmniejsza wpłaty netto i odpowiednio zwiększa saldo.
5. Direct bez prowizji nie jest oznaczony jako niekompletny tylko dlatego, że nie ma prowizji OTA.
6. Brak ceny i konflikt walut zwracają jawny stan niekompletności.
7. Wszystkie miejsca pokazujące saldo korzystają z jednego silnika i przechodzą te same testy.

## Pełne przypisanie ustaleń z walkthrough

Ta tabela jest kontrolą kompletności. Szczegółowe uzasadnienie i scenariusze znajdują się w `RAPORT_Z_PRZEJSCIA_PRZEZ_APLIKACJE_2026-07-19.md`.

| Ustalenie | Paczka docelowa | Warunek zachowania zakresu |
|---|---|---|
| wartość / wpłacono / pozostało lub nadpłata | PR-6a i PR-6c | obliczenia w 6a, hierarchia wizualna w 6c |
| prowizja, koszt i wypłata OTA poza saldem gościa | PR-6a/PR-6b | zero wspólnego sumowania z wpłatą gościa |
| koszty faktyczne i modelowane | PR-6b | jawne źródło i zakaz dublowania |
| prowizja per platforma, domek i okres | PR-6b | fakt z importu ma pierwszeństwo przed modelem |
| strata i nadpłata nieobcinane do zera | PR-6a/PR-6b | przypadki ujemne w fixture'ach |
| rentowność i spłata domku | PR-11d po PR-6b | kapitał, nakłady, wypłaty właściciela i koszty wspólne są jawne |
| automatyczne zadanie Content nie dla każdego pobytu | PR-10c | content staje się ręczną okazją, opinia pozostaje osobnym procesem |
| chronologiczne przyjazdy, wyjazdy, sprzątanie i wiadomości | PR-10b | rodzaj zdarzenia i kanał są osobnymi znacznikami |
| stan domku wyliczany z pobytu i turnoveru | PR-9b/PR-10b | `gotowy` wynika z checklisty lub audytowanego nadpisania |
| sprzątająca przyjmuje/odrzuca okno | PR-9b | brak odpowiedzi ma eskalację do operatora |
| checklisty per domek, sezon i wyjątek | PR-9b | stałe punkty oddzielone od jednorazowych uwag |
| zadania ojca/Patryka: zakupy, płatności, naprawy | PR-9b | zadanie ma konto/rolę, termin, priorytet i regułę powiadomienia |
| kalendarz z 7 dniami kontekstu wstecz | PR-10d | `Dzisiaj` ustawia dzień około 1/4–1/3 widoku |
| jedna spójna nawigacja osi | PR-10d | scroll i zakres nie rozjeżdżają się |
| kanał widoczny na pasku bez polegania na kolorze | PR-10d | tekst lub ikona plus dostępna nazwa |
| zaznaczenie zakresu drag/touch/klawiatura | PR-10d | konflikt jest widoczny przed zapisem |
| roczny przegląd popytu | PR-10e | miesiące, domki i stan sprzedaży na dziś są rozróżnione |
| wykrywanie luk 1–3/4–6/7+ nocy | PR-10e | deterministyczna reguła, zero automatycznej kampanii |
| sezonowe cele obłożenia | PR-10e | cele są konfigurowalną hipotezą per domek, nie hardcoded 95%/50% |
| domyślnie nadchodzące i trwające rezerwacje | PR-10c | historia pozostaje dostępna osobno |
| jednoznaczne filtry i sortowanie | PR-10c | nazwa opisuje faktyczne pole, np. najbliższy przyjazd |
| globalna wartość historyczna poza listą operacyjną | PR-10c/PR-6c | lista pokazuje działania, Finanse pokazują wartości z okresem |
| prosty wpis i pola warunkowe | PR-10c | minimum operacyjne nie zawiera pełnego CRM |
| kanał zawarcia oddzielony od źródła odkrycia | PR-10c/PR-11a | direct i odkrycie przez Google mogą współistnieć |
| jedna osoba, wiele pobytów | PR-11a | deduplikacja kontrolowana przez człowieka |
| fraza/prompt, źródło, metoda, kontakt i kampania osobno | PR-11a | brak wiedzy jest prawidłowym stanem |
| debrief, NPS, cytat i status opinii | PR-11b | dokładny cytat nie jest zastępowany streszczeniem AI |
| zgody e-mail/SMS/cytat/media/reklama osobno | PR-11b | wersja, źródło, timestamp i wycofanie |
| procedura ochrony małoletnich | PR-9c | najpierw zatwierdzony SOP, później minimalny zapis wykonania |
| język gościa PL/DE/EN | PR-11c | język steruje szablonem, nie jest zgadywany z kraju |
| zatwierdzona trasa dojazdu per język | PR-11c | wersjonowana treść i właściciel akceptacji |
| status opinii od prośby do otrzymania | PR-11b/PR-11c | status dostawcy nie jest udawany przez UI |
| osobisty SMS i e-mail/OTA zależnie od celu | PR-11c | kanał wynika z celu, danych i polityki rezerwacji |
| przypomnienie o powrocie przed podobnym terminem | PR-11d | trigger wynika z lead time i działa tylko przy właściwej zgodzie |
| produkcyjny delivery, retry i alert | Etap 7 | wysyłka dopiero po testach dostawcy i zgodności |
| wydatki reklamowe i okresy kampanii | PR-11d | najpierw CSV, API dopiero po stabilnym modelu |
| pakiet wędkarski poza sezonem | PR-11d | eksperyment z kosztem, kodem i kryterium decyzji |
| AI do wniosków i kampanii | PR-11d+ | tylko propozycja z dowodami; bez wysyłki, publikacji i zmiany ceny |
| odczyty prądu | PR-11d / integracja późniejsza | najpierw ręczny zapis i ocena wartości API |
| realny test ojca i sprzątającej | bramka po Etapie 5 | minimum 2 tygodnie równolegle; osobny feedback i mierzone tarcia |

## Stałe zasady do czasu Etapu 7

- Mobile-Calendar/OTA pozostaje nadrzędnym źródłem rezerwacji i dostępności.
- Stawy OS nie jest jeszcze podstawą księgową ani podatkową.
- SMS i inne dostawy wychodzące pozostają domyślnie wyłączone.
- AI nie wysyła, nie publikuje i nie zmienia cen.
- Content od gościa jest ręcznie rozpoznaną okazją, nie automatycznym obowiązkiem każdego pobytu.
- Kanał zawarcia rezerwacji i źródło odkrycia są osobnymi danymi.
- Stan `gotowy` domku wynika z wykonanego procesu albo audytowanego nadpisania, nie z luźnej etykiety.
- Brak danych nie jest zerem, a próbka poniżej progu nie tworzy insightu.
- Żaden następny PR nie może rozszerzać pełnego snapshotu jako docelowej architektury.

## Dokumenty szczegółowe

- `AUDYT_APLIKACJI_2026-07-15.md` — ustalenia i dowody,
- `PLAN_WDROZENIA_POPRAWEK_2026-07-15.md` — pełne kryteria Etapów,
- `PLAN_RESTRUKTURYZACJI_STAWY_OS.md` — architektura docelowa,
- `PLAN_MVP_OPERATORA_TATY.md` — priorytety, zależności i bramka bezpiecznego zastąpienia Mobile Calendar,
- `ADR_001_PILOT_I_ZRODLA_PRAWDY.md` — decyzja i źródła prawdy,
- `SLOWNIK_KPI_V1.md` — definicje metryk,
- `RAPORT_Z_PRZEJSCIA_PRZEZ_APLIKACJE_2026-07-19.md` — wymagania produktowe, niejasności, scenariusze i pełne uzasadnienie podziału PR-6a–PR-6c, PR-9a–PR-9c, PR-10a–PR-10e i PR-11a–PR-11d.
