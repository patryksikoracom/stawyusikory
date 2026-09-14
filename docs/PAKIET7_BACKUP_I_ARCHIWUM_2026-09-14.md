# Pakiet 7 — kopia danych i archiwum

## Zmiany lokalne

- Rezerwacje z kosza pozostają w stanie aplikacji po 30 dniach. Normalizacja nie usuwa ich ze snapshotu ani eksportu.
- Po 30 dniach pozycja jest widoczna jako archiwalna, a przywracanie jest wyłączone. Aplikacja nie obiecuje nieistniejącego automatycznego trwałego kasowania. Powiązania finansowe i historia pozostają zachowane.
- Przywracanie z kosza czeka na wynik, blokuje ponowne kliknięcia i pokazuje błąd.
- Eksport AES-256-GCM ma odpowiadającą mu funkcję odszyfrowania. Walidacja odrzuca nieobsługiwany format/KDF, uszkodzone dane i niewłaściwe hasło.
- Ustawienia zawierają lokalne sprawdzenie zaszyfrowanego pliku. Hasło i plik nie są wysyłane do serwera; sprawdzenie nie zmienia danych.
- Próba automatyczna odzyskuje cały zestaw danych, w tym archiwalne rezerwacje, bez zmiany identyfikatorów.

## Granice dowodu

To jest kopia wyeksportowanych danych operacyjnych, nie pełny backup Supabase. Nie obejmuje kont Auth, RLS, uprawnień, kolejek dostaw i całego audytu serwera. Odszyfrowanie nie jest dowodem odtworzenia bazy.

Do zamknięcia pakietu potrzebna jest osobna baza: zastosowanie migracji, odtworzenie danych, porównanie liczebności i powiązań, test logowania/uprawnień, odczyt przez API oraz symulacja uszkodzonej/niepełnej kopii. Wysyłki i cron muszą pozostać wyłączone w środowisku odtworzenia.

Użytkownik potwierdził brak osobnego projektu testowego. Lokalnie brak silnika kontenerów; odczyt dysku wykazał około 6 GiB wolnego miejsca. Pobrano CLI Supabase; nie uruchomiono lokalnej bazy. Użytkownik zlecił sprawdzenie kosztu projektu testowego w chmurze.
