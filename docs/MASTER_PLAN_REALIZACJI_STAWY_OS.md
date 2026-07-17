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
| PR-2 / Etap 1.2a | **gotowy do ręcznej akceptacji** | prawdziwa tożsamość, alerty i copy; automatyczna weryfikacja ukończona 17.07.2026 |
| Etap 1 jako całość | w toku | zakończy się dopiero po PR-4 |

## Mapa Etapów i PR-ów

| Kolejność | Etap | Paczka | Zakres | Bramka po paczce |
|---:|---|---|---|---|
| 0 | Etap 0 — zasady pilota | decyzje, bez osobnego PR | ścieżka A, źródła prawdy, KPI, wyłączona wysyłka | ADR-001 i KPI zaakceptowane |
| 1 | Etap 1 — bezpieczeństwo i zaufanie | PR-1 | loading gate, brak demo/zer, bezpieczne formularze | ukończone |
| 2 | Etap 1 — bezpieczeństwo i zaufanie | **PR-2 — gotowy do akceptacji** | profil z sesji, rola, dynamiczne alerty, uczciwe copy, zaszyfrowany backup | konto testowe nie widzi `Marcin/MS`; zero stałych alertów |
| 3 | Etap 1 — bezpieczeństwo i zaufanie | PR-3 — po akceptacji PR-2 | usunięcie przykładowych insightów i uczciwe empty states | przy braku danych nie ma rekomendacji biznesowej |
| 4 | Etap 1 — bezpieczeństwo i zaufanie | PR-4 | leaked passwords, invitation-only, blokada signup→owner | domknięta akceptacja całego Etapu 1 |
| 5 | Etap 2 — prawidłowe metryki | PR-5 | wspólny silnik okresów, aktywne rezerwacje, obłożenie, waluty | testy granic miesiąca/roku/DST |
| 6 | Etap 2 — finanse | PR-6 | sprzedaż, należności, cashflow i wynik zarządczy | pulpit i Finanse używają tych samych definicji |
| 7 | Etap 3 — wielosesyjność | PR-7 | telemetryka, koordynacja kart, czytelny konflikt | brak cichego nadpisania zmian |
| 8 | Etap 3 — zapis domenowy | PR-8a… | komendy per domena i odejście od pełnego snapshotu | migracja etapami; każdy pod-PR osobno |
| 9 | Etap 4 — organizacje i role | PR-9 | active organization, role, RLS i izolacja PII/finansów | dwie organizacje i role przechodzą testy negatywne |
| 10 | Etap 5 — UX i dostępność | PR-10a… | dialogi, klawiatura, mobile, paginacja i wydajność | WCAG smoke test i 1000 rekordów |
| 11 | Etap 6 — CRM i wzrost | PR-11a… | osoby, atrybucja, consent ledger i mierzalne insighty | każda liczba ma rekordy źródłowe |
| 12 | Etap 7 — gateway OTA | seria spike/go-live | Mobile-Calendar Premium vs Beds24, shadow mode i rollback | minimum 7 dni bez niewyjaśnionych różnic |

Numery z sufiksem `a…` oznaczają duży zakres, który przed implementacją zostanie rozbity na mniejsze, osobno akceptowane paczki.

## Aktualna paczka: PR-2 — gotowa do ręcznej akceptacji

### Zakres

- pobrać e-mail, nazwę i rolę z aktualnej sesji/członkostwa,
- wyliczać bezpieczny fallback nazwy oraz inicjałów bez stałych `Marcin/MS`,
- pokazać prawdziwą rolę i e-mail w menu konta,
- generować alerty wyłącznie z aktualnych danych aplikacji,
- usunąć stały alert `1 płatność do sprawdzenia`,
- poprawić komunikaty synchronizacji/profilu objęte tą paczką,
- zmienić etykietę backupu na `Pobierz zaszyfrowany backup`,
- poprawić odmianę liczebników dotkniętych przez nowe alerty i copy.

### Poza zakresem PR-2

- przebudowa modułu Goście i marketing — PR-3,
- zmiana polityk Auth, signup i provisioning — PR-4,
- naprawa sposobu liczenia KPI — PR-5/PR-6,
- role domenowe i multi-tenant — PR-9.

### Akceptacja PR-2

1. Konto testowe pokazuje własny e-mail i rolę `admin`/`Administrator`.
2. W interfejsie nie występują stałe `Marcin`, `MS` ani `Panel właściciela` dla innego użytkownika.
3. Liczba i treść alertów wynikają z fixture'ów i danych chmurowych.
4. Przy zerowej liczbie alertów interfejs pokazuje uczciwy stan pusty.
5. Backup jest opisany jako zaszyfrowany.
6. Testy automatyczne i test przeglądarkowy przechodzą bez błędów konsoli.

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
