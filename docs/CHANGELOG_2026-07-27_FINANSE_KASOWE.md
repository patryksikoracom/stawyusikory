# Finanse kasowe — 2026-07-27

- Karta „Wpłynęło na konto” rozpoznaje wypłaty Airbnb i Booking według daty wypłaty.
- Przyszłe wypłaty oraz wyceny z Mobile Calendar nie są liczone jako środki otrzymane.
- Zaksięgowany ledger ma pierwszeństwo przed importem OTA, aby ta sama wypłata nie została policzona dwa razy.
- Każda kwota ma w raporcie finansowym rekord źródłowy i trafia do eksportu CSV z dowodami.
- Konto `marcin@stawyusikory.pl` otrzymało rolę `owner`, zgodnie z decyzją o pełnym dostępie na obecnym etapie.

Weryfikacja: 444 testy, `tsc --noEmit` oraz produkcyjny build Next.js.
