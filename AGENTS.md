# Instrukcje projektu Stawy OS

## Rejestr pomysłów

Gdy użytkownik mówi „dodaj pomysł”, „zapisz pomysł”, „wrzuć to do pomysłów” albo używa podobnego sformułowania:

1. Zapisz pomysł w `docs/REJESTR_POMYSLOW.md`, nawet jeśli jest niepełny albo podyktowany luźno.
2. Przed oceną sprawdź kod i dokumentację, aby wykryć istniejącą funkcję, duplikat, zależność albo konflikt.
3. Nie wdrażaj pomysłu bez osobnej, wyraźnej prośby użytkownika.
4. Zachowaj sens oryginalnej wypowiedzi, a następnie uzupełnij kartę o:
   - problem i oczekiwany efekt;
   - to, co już istnieje;
   - najmniejszy sensowny zakres;
   - sposób walidacji;
   - ryzyka i zależności;
   - status, priorytet i miejsce w kolejce.
5. Nie blokuj zapisu z powodu brakujących informacji. Niewiadome wpisz jako pytania do walidacji.
6. Nadaj kolejny identyfikator `POM-###`. Jeśli pomysł jest duplikatem, nie twórz nowej pozycji — dopisz nowy kontekst do istniejącej karty.
7. W odpowiedzi podaj identyfikator, priorytet, krótkie uzasadnienie i najbliższy krok walidacyjny.

Reguły statusów i priorytetów są źródłem prawdy w `docs/REJESTR_POMYSLOW.md`.

Rejestr przyjmuje również rzeczywiste problemy operacyjne, usterki procesu i zdarzenia z obsługi — nie tylko propozycje funkcji. Dla takiego wpisu:

1. Zachowaj fakt, skutek i kontekst zdarzenia.
2. Najpierw zaproponuj działanie doraźne możliwe bez zmian w aplikacji.
3. Wskaż prostą procedurę lub checklistę, właściciela, moment kontroli i sposób walidacji.
4. Automatyzację opisz jako późniejszą możliwość, jeżeli naprawdę daje wartość. Nie zakładaj, że każdy problem wymaga funkcji Stawy OS.
5. Jeżeli problem jest duplikatem, dopisz nowe zdarzenie i kontekst do istniejącej karty zamiast tworzyć nowy identyfikator.
