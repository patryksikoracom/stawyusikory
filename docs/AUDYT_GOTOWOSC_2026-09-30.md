# Gotowość funkcji obsługi pobytu

Dokumentacja techniczna pakietu: rozliczenie sprzątania, wiadomości i harmonogram. Szczegółowe dowody produkcyjne, identyfikatory dostarczenia i dane rezerwacji są przechowywane poza publicznym repozytorium.

## Zakres

- Wykonanie sprzątania, należność dla osoby sprzątającej, zbiorcza zapłata i cofnięcie płatności. Kwota należna wykonawcy jest niezależna od opłaty gościa.
- Ograniczony interfejs operatora oraz odrębne uprawnienia do zmian wykonania i rozliczenia.
- Historyczne rezerwacje nie tworzą zaległych obowiązków ani wiadomości. Serwer ponownie weryfikuje historię przed wysyłką.
- Rezerwacja na dziś może otrzymać potwierdzenie i informacje przed przyjazdem; spóźnione „jutro przyjazd” jest blokowane.
- Ekran wiadomości: historia, kolejka, wyszukiwanie i filtrowanie. Edytor szablonów: zmienne, podgląd, kontrola wersji i błędów zapisu. Odpowiedzi gości trafiają do skonfigurowanej skrzynki Reply-To.

## Bezpieczeństwo kolejki

Procesor ponownie sprawdza stan rezerwacji, kontakt, cenę, zgodę i treść. Anulowanie, usunięcie i istotna zmiana danych blokują nieaktualną wiadomość. Unikalny klucz, blokada przejęcia oraz deduplikacja dostawcy ograniczają powtórzenia. Niepewne próby po wygaśnięciu bezpiecznego okna ponowień wymagają ręcznego sprawdzenia dostawcy; nie wolno bez tego zerować prób.

## Harmonogram

Migracja `database_email_scheduler` tworzy nieaktywny job Supabase Cron co 5 minut i prywatną funkcję SECURITY INVOKER. Role anon/authenticated nie mają dostępu do schematu ani funkcji. Klucz EMAIL_CRON_SECRET jest przechowywany w Vercel oraz w Vault pod nazwą stawy_email_cron_secret. Funkcja korzysta ze stałego endpointu aplikacji i odmawia działania bez klucza. Aktywacja joba jest oddzielnym krokiem wdrożenia po sprawdzeniu konfiguracji i kolejki.

GitHub zachowuje krok e-mail tylko dla ręcznej obsługi awaryjnej. Regularne maile obsługuje Supabase Cron; harmonogram GitHub nadal obsługuje iCal i opcjonalny SMS. [GitHub dokumentuje możliwe opóźnienia harmonogramów](https://docs.github.com/en/actions/how-tos/troubleshoot-workflows).

## Walidacja kodu

- 116 plików / 586 testów: PASS.
- Build produkcyjny i TypeScript: PASS.
- Testy SQL harmonogramu: role, brak klucza, nieaktywny job po migracji i zawartość kolejki HTTP. Transakcja kończy się ROLLBACK, bez żądania sieciowego.
- Testy HTTP obejmują osobny klucz i odrzucenie wywołań bez skonfigurowanych kluczy.
- Testy kolejki obejmują nieaktualne dane, ponowienia, równoległe przejęcie i wyścigi webhooków.

## Diagnostyka i obsługa

1. Sprawdzić status wiadomości i powód ewentualnej blokady w aplikacji.
2. Sprawdzić job stawy-email-queue w Supabase Cron. SQL succeeded oznacza tylko zlecenie HTTP; wynik endpointu sprawdza się osobno w net._http_response.
3. Historia SQL tego joba jest utrzymywana przez 14 dni. Odpowiedzi HTTP mają krótszą retencję pg_net.
4. Zatrzymanie joba: `select cron.alter_job(job_id := jobid, active := false) from cron.job where jobname = 'stawy-email-queue';`. Ponowne włączenie: active := true, po sprawdzeniu konfiguracji.
5. Globalna blokada wysyłki: STAWY_OS_EMAIL_ENABLED=false w Production, następnie wdrożenie pobierające tę wartość.
6. Rotacja klucza wymaga uzgodnienia EMAIL_CRON_SECRET w Vercel i stawy_email_cron_secret w Vault. Nie zmieniać ogólnego CRON_SECRET obsługującego inne integracje.
7. Wpłaty i zapłatę za sprzątanie oznaczać po faktycznej płatności. Wysłany mail nie stanowi dowodu wpłaty.

Ten dokument nie jest opinią prawną ani certyfikatem zgodności. Importowane szablony pozostają materiałem źródłowym, dopóki nie zostaną świadomie zastąpione aktywną konfiguracją.
