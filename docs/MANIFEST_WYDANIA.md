# Stawy OS — manifest wydania

**Status:** obowiązująca bramka techniczna od 10 sierpnia 2026

Źródłem prawdy dla zgodności aplikacji i bazy jest `release-manifest.json`. Manifest wskazuje identyfikator wydania, wersję schematu i ostatnią wymaganą migrację.

## Jak działa bramka

1. `npm run check:release` sprawdza, czy manifest wskazuje najnowszą migrację i czy migracja zawiera ten sam znacznik.
2. `npm run build` uruchamia tę kontrolę przed kompilacją Next.js.
3. Migracja manifestu zapisuje dokładnie tę samą wersję w `app_release_manifest`.
4. `/api/state` porównuje znacznik bazy z manifestem w buildzie. Przy braku lub różnicy zwraca `503` i nie otwiera danych operacyjnych.
5. Odpowiedź stanu zawiera identyfikator wydania oraz commit z `VERCEL_GIT_COMMIT_SHA`, dzięki czemu można wskazać kod obsługujący wdrożenie.

## Procedura kolejnego wydania ze zmianą schematu

1. Utworzyć migrację przez Supabase CLI.
2. Na końcu migracji zaktualizować pojedynczy rekord `app_release_manifest`.
3. Zmienić `schemaVersion` i `requiredMigration` w `release-manifest.json`.
4. Uruchomić `npm run check:release`, testy, lint, typecheck i build.
5. Przed wdrożeniem wykonać backup oraz zapisać identyfikatory: commit, deployment i ostatnia migracja.
6. Najpierw zastosować migrację, potem wdrożyć odpowiadający jej build. Jeżeli aplikacja zwraca `503`, nie obchodzić bramki — przywrócić zgodną parę kod–schema.

## Rollback

Rollback aplikacji jest bezpieczny tylko do builda oczekującego tej samej wersji schematu. Cofnięcie migracji wymaga osobnego, przetestowanego skryptu i backupu; nie wykonujemy go automatycznie na produkcji. Do czasu przećwiczenia rollbacku na odizolowanym Supabase Stawy OS pozostaje w pilocie równoległym.
