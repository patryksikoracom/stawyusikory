# Stawy OS

Produkcyjny fundament systemu operacyjnego Stawów u Sikory: rezerwacje, wspólny kalendarz, sprzątanie, komunikacja, finanse, dane gości, media i integracje iCal.

## Zaimplementowane

- prawdziwe logowanie Supabase e-mail/hasło, reset hasła, chronione trasy i wylogowanie;
- synchronizacja danych między urządzeniami przez wersjonowane rekordy organizacji, z ochroną przed nadpisaniem zmian z innego urządzenia;
- organizacje, członkostwa i RLS izolujące dane właścicieli;
- tworzenie, edycja, anulowanie, deep-link i historia rezerwacji;
- kontrola konfliktów, pobyty stykające się tego samego dnia i blokady z kalendarza;
- trwałe zadania, checklisty sprzątania, usterki, SMSAPI i transakcyjne e-maile Resend z kluczem idempotencji;
- rejestr płatności, prowizji, kosztów, zwrotów, faktur/rachunków oraz raporty ADR, RevPAR i obłożenia;
- profile gości, zgody marketingowe oraz biblioteka mediów;
- bezpieczny import Mobile Calendar z opcjonalnym uzgodnieniem rozliczeń Airbnb i Booking: podgląd, walidacja, deduplikacja, rzeczywiste opłaty OTA i scalanie bez kasowania danych;
- import i eksport iCal z widocznym stanem synchronizacji i ostrzeżeniem o opóźnieniach;
- backup JSON, audit log, mobilne menu wszystkich modułów i instalowalna PWA;
- testy reguł terminów, polskich dat oraz importu.

Bez skonfigurowanego Supabase aplikacja działa w wyraźnie oznaczonym trybie lokalnym. Nie udaje wtedy synchronizacji chmurowej. Wysyłka SMS i e-mail jest domyślnie zablokowana przez osobne przełączniki; sam token dostawcy nie otwiera kanału.

## Uruchomienie

```bash
npm install
cp .env.example .env.local
npm run dev
```

Potem otwórz **http://localhost:3000**. To jest lokalny podgląd — możesz z niego korzystać i zapisywać zmiany bez commita. Serwer zostaje włączony w terminalu, aż zatrzymasz go skrótem `Ctrl+C`.

Jeśli port 3000 jest już zajęty, Next poda w terminalu następny adres (zwykle `http://localhost:3001`). Sam lokalny commit nie publikuje aplikacji; Vercel wdroży wersję online po `git push` do podłączonego repozytorium/brancha.

Kontrola jakości:

```bash
npm run lint
npm run typecheck
npm test
npm run check:release
npm run check:auth-config
npm run build
```

Build oraz odczyt danych chmurowych mają bramkę zgodności kodu ze schematem. Zasady wydania i rollbacku opisuje [`docs/MANIFEST_WYDANIA.md`](docs/MANIFEST_WYDANIA.md).

## Supabase

1. Utwórz projekt w europejskim regionie Supabase.
2. Uruchom kolejno migracje z `supabase/migrations`.
3. Włącz logowanie e-mail/hasło, pozostaw publiczny signup wyłączony i utwórz pierwszego właściciela ręcznie. Kolejne konta zapraszaj z ekranu Ustawienia; baza nie nadaje już nikomu automatycznie roli `owner`.
4. Uzupełnij `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` i `SUPABASE_SERVICE_ROLE_KEY`.
5. Nigdy nie wystawiaj service role w zmiennej `NEXT_PUBLIC_*`.

Kontrola `npm run check:auth-config` używa lokalnych `SUPABASE_PROJECT_REF` i `SUPABASE_ACCESS_TOKEN`. Kończy się błędem, jeśli publiczny signup zostanie włączony albo minimalna długość hasła spadnie poniżej 12 znaków. Ochrona HIBP jest raportowana jako ostrzeżenie na planie Free; po przejściu na Pro ustaw `REQUIRE_SUPABASE_HIBP=1`, aby stała się twardą bramką. Osobistego tokenu administracyjnego nie zapisujemy w Vercel ani GitHub Actions.

Wbudowane dane demonstracyjne są rozpoznawane i nie mogą zostać automatycznie zapisane do chmury. Legacy snapshot pozostaje kopią awaryjną, a produkcyjny zapis używa `operational_records` oraz wersji organizacji. Przed importem pobierz backup JSON z ekranu Integracje lub Ustawienia.

## iCal

- `GET /api/calendar/feeds/{signedToken}.ics` eksportuje zajętość jednej jednostki.
- `POST /api/integrations/ical/sync` pobiera skonfigurowane feedy i zapisuje je jako zewnętrzne blokady.
- Harmonogram GitHub Actions wywołuje synchronizację z nagłówkiem `Authorization: Bearer $CRON_SECRET`. Wymaga sekretów repozytorium `STAWY_OS_APP_URL` i `STAWY_OS_CRON_SECRET`.
- W panelu portalu trzeba potwierdzić, czy dana oferta Booking.com ma import i eksport iCal.
- iCal nie przenosi ceny, danych gościa ani płatności i może odświeżać się z opóźnieniem.

Workflow `.github/workflows/operations-cron.yml` uruchamia synchronizację co 15 minut, ale interfejs zakłada próg nieaktualności czterech godzin ze względu na ograniczenia portali. Kanały SMS i e-mail są wywoływane dopiero po ustawieniu odpowiadających im sekretów GitHub na `true`, a endpointy wymagają dodatkowo tej samej wartości w środowisku aplikacji. Warunki otwarcia kanału SMS opisuje ADR-001.

## Testy integracyjne Supabase

Test tworzy odizolowanego, tymczasowego użytkownika i organizacje, sprawdza Auth, RLS, zapis rekordów oraz konflikt wersji, a następnie usuwa dane testowe. Uruchamiaj go wyłącznie przeciwko osobnemu projektowi Supabase przeznaczonemu do testów — nigdy wobec bazy operacyjnej:

```bash
RUN_SUPABASE_INTEGRATION=1 SUPABASE_INTEGRATION_TEST_PROJECT=1 npm run test:integration
```

## SMSAPI

W pilocie pozostaw `STAWY_OS_SMS_ENABLED=false`. Po formalnym przejściu bramki wysyłki ustaw `SMSAPI_TOKEN` i `STAWY_OS_SMS_ENABLED=true`, a następnie wpisz numer osoby sprzątającej w Ustawieniach. Endpoint `POST /api/messages/sms` waliduje numer i treść, wymaga zalogowanego użytkownika oraz chroni przed powtórnym wysłaniem tym samym kluczem idempotencji.

## Resend i automatyczne e-maile

Konto Resend może być założone na `patryksikora98@gmail.com`; adres logowania nie musi być adresem nadawcy. W Resend dodaj i zweryfikuj całą domenę `stawyusikory.pl` rekordami SPF i DKIM. Wiadomości wychodzą z `rezerwacja@stawyusikory.pl`, odpowiedzi trafiają do `marcin@stawyusikory.pl`, a Marcin zawsze otrzymuje także kopię przez CC.

1. Ustaw `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_REPLY_TO` i sekret webhooka `RESEND_WEBHOOK_SECRET` w środowisku aplikacji.
2. W Resend dodaj webhook `https://<adres-aplikacji>/api/webhooks/resend` dla zdarzeń wysłania, dostarczenia, odbicia, skargi, błędu i blokady.
3. Zastosuj migrację `20260810200914_resend_email_delivery.sql`.
4. Sprawdź i zatwierdź treści oraz przewodniki dojazdowe w ustawieniach. Dziewięć treści z Mobile Calendar jest importowanych wyłącznie jako nieaktywne materiały do przeglądu; jawne hasła i dane płatnicze zostały z nich usunięte.
5. Wyślij test na własny adres. Dopiero po sprawdzeniu nadawcy, odpowiedzi, linków, języków oraz webhooków ustaw `STAWY_OS_EMAIL_ENABLED=true` w aplikacji i w sekrecie GitHub Actions.

Proces tworzy automatycznie: potwierdzenie rezerwacji, potwierdzenie zaliczki, informacje pięć dni przed przyjazdem, krótkie przypomnienie dzień wcześniej i podziękowanie dzień po wyjeździe. Wiadomości z prośbą o publiczną opinię wymagają aktywnej zgody marketingowej. Lokalny limit `STAWY_OS_EMAIL_DAILY_LIMIT` domyślnie wynosi 80 wiadomości w ruchomych 24 godzinach.

## Granice obecnej wersji

- Rejestr faktur nie wysyła danych do KSeF i nie zastępuje programu księgowego.
- Pełne API Booking/Airbnb nie jest aktywne; model integracji jest przygotowany pod przyszły adapter/channel manager.
- AI jest ograniczone do jawnych sugestii. Nie zmienia cen, nie wysyła wiadomości i nie publikuje kampanii.
- Marketing pozostaje wyłączony bez aktywnej zgody; transakcyjne e-maile Resend wymagają osobnego przełącznika bezpieczeństwa.

Szczegółowa strategia produktu znajduje się w [`docs/PLAN_RESTRUKTURYZACJI_STAWY_OS.md`](docs/PLAN_RESTRUKTURYZACJI_STAWY_OS.md).
