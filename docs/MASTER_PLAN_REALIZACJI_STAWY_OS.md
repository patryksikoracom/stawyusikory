# Stawy OS — nadrzędny plan realizacji

**Status:** plan obowiązujący
**Data aktualizacji:** 17 lipca 2026
**Źródła:** audyt aplikacji, plan wdrożenia poprawek, plan restrukturyzacji, ADR-001, słownik KPI oraz ustalenia z realizacji PR-1 i Etapu 0

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
| Etap 2 jako całość | w toku | PR-5 zaakceptowany; sprzedaż, należności, cashflow i wynik pozostają zakresem PR-6 |

## Mapa Etapów i PR-ów

| Kolejność | Etap | Paczka | Zakres | Bramka po paczce |
|---:|---|---|---|---|
| 0 | Etap 0 — zasady pilota | decyzje, bez osobnego PR | ścieżka A, źródła prawdy, KPI, wyłączona wysyłka | ADR-001 i KPI zaakceptowane |
| 1 | Etap 1 — bezpieczeństwo i zaufanie | PR-1 | loading gate, brak demo/zer, bezpieczne formularze | ukończone |
| 2 | Etap 1 — bezpieczeństwo i zaufanie | PR-2 — zaakceptowany | profil z sesji, rola, dynamiczne alerty, uczciwe copy, zaszyfrowany backup | konto testowe nie widzi `Marcin/MS`; zero stałych alertów |
| 3 | Etap 1 — bezpieczeństwo i zaufanie | PR-3 — zaakceptowany | usunięcie przykładowych insightów i uczciwe empty states | przy braku danych nie ma rekomendacji biznesowej |
| 4 | Etap 1 — bezpieczeństwo i zaufanie | **PR-4 — zaakceptowany z wyjątkiem HIBP** | invitation-only, blokada signup→owner i bramka konfiguracji Auth; HIBP po Pro | ukończone na obecnym planie; HIBP pozostaje przyjętym ryzykiem |
| 5 | Etap 2 — prawidłowe metryki | **PR-5 — zaakceptowany** | wspólny silnik okresów, aktywne rezerwacje, obłożenie, waluty | testy granic miesiąca/roku/DST i preview przeszły; właściciel zatwierdził publikację online |
| 6 | Etap 2 — finanse | PR-6 | sprzedaż, należności, cashflow i wynik zarządczy | pulpit i Finanse używają tych samych definicji |
| 7 | Etap 3 — wielosesyjność | PR-7 | telemetryka, koordynacja kart, czytelny konflikt | brak cichego nadpisania zmian |
| 8 | Etap 3 — zapis domenowy | PR-8a… | komendy per domena i odejście od pełnego snapshotu | migracja etapami; każdy pod-PR osobno |
| 9 | Etap 4 — organizacje i role | PR-9 | active organization, role, RLS i izolacja PII/finansów | dwie organizacje i role przechodzą testy negatywne |
| 10 | Etap 5 — UX i dostępność | PR-10a… | dialogi, klawiatura, mobile, paginacja i wydajność | WCAG smoke test i 1000 rekordów |
| 11 | Etap 6 — CRM i wzrost | PR-11a… | osoby, atrybucja, consent ledger i mierzalne insighty | każda liczba ma rekordy źródłowe |
| 12 | Etap 7 — gateway OTA | seria spike/go-live | Mobile-Calendar Premium vs Beds24, shadow mode i rollback | minimum 7 dni bez niewyjaśnionych różnic |

Numery z sufiksem `a…` oznaczają duży zakres, który przed implementacją zostanie rozbity na mniejsze, osobno akceptowane paczki.

## Aktualna paczka: PR-5 — zaakceptowana do publikacji online

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
- rozbudowane filtry i pełny interfejs dowodów — PR-6b,
- generowanie mierzalnych rekomendacji wzrostu i consent ledger — PR-11,
- pełna macierz ról domenowych i multi-tenant — PR-9,
- płatne podniesienie Supabase do Pro — osobna decyzja właściciela.

### Akceptacja PR-5

1. Dashboard i Finanse używają tej samej funkcji do liczenia okresów, aktywnych rezerwacji i obłożenia.
2. Pobyt przecinający miesiąc lub rok wnosi wyłącznie noce należące do wybranego okresu.
3. Rezerwacje nowe, anulowane, usunięte, z błędnymi datami lub bez znanego domku nie zasilają KPI.
4. PLN i EUR są prezentowane oddzielnie i nigdy nie są sumowane bez kursu.
5. Brak danych nie jest prezentowany jako zero, a niekompletne dane są jawnie oznaczone.
6. Każda karta KPI podaje okres, kompletność i źródło obliczenia.
7. Testy automatyczne, build i test przeglądarkowy desktop/mobile przechodzą bez błędów konsoli.

**Status PR-5 (2026-07-19): zaakceptowany przez właściciela do publikacji online.** Zweryfikowano 100 testów automatycznych, lint, TypeScript, build oraz Dashboard i Finanse na desktopie i telefonie. PR-6 nie został rozpoczęty.

## Stałe zasady do czasu Etapu 7

- Mobile-Calendar/OTA pozostaje nadrzędnym źródłem rezerwacji i dostępności.
- Stawy OS nie jest jeszcze podstawą księgową ani podatkową.
- SMS i inne dostawy wychodzące pozostają domyślnie wyłączone.
- AI nie wysyła, nie publikuje i nie zmienia cen.
- Brak danych nie jest zerem, a próbka poniżej progu nie tworzy insightu.
- Żaden następny PR nie może rozszerzać pełnego snapshotu jako docelowej architektury.

## Dokumenty szczegółowe

- `AUDYT_APLIKACJI_2026-07-15.md` — ustalenia i dowody,
- `PLAN_WDROZENIA_POPRAWEK_2026-07-15.md` — pełne kryteria Etapów,
- `PLAN_RESTRUKTURYZACJI_STAWY_OS.md` — architektura docelowa,
- `ADR_001_PILOT_I_ZRODLA_PRAWDY.md` — decyzja i źródła prawdy,
- `SLOWNIK_KPI_V1.md` — definicje metryk.
