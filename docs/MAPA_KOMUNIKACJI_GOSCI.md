# Komunikacja z gościem - etapy i treści

Cel: jedna konkretna sprawa w każdej wiadomości, krótka treść, czytelne akapity. Ton uprzejmy i swobodny, bez urzędowych zwrotów i przesadnego entuzjazmu. PL używa „Ty”, DE „Sie”; EN naturalnego „you”.

## Mapa potrzeb

| Moment | Potrzeba gościa / gospodarza | Wiadomość i obecny tryb |
|---|---|---|
| Nowa rezerwacja | Wiedzieć, na kiedy i jaki domek jest zarezerwowany oraz co zapłacić | **Automatyczny e-mail:** daty, godziny, domek, cena, odpowiednia do stanu płatności instrukcja |
| Wpłata od gościa | Mieć pewność, że pieniądze dotarły | **Automatyczny e-mail:** potwierdzenie zaksięgowanej wpłaty i pozostała kwota. Sam status bez dowodu wpłaty nie wystarcza |
| 5 dni przed przyjazdem | Trafić na miejsce i przygotować się do pobytu | **Automatyczny e-mail:** przyjazd, wyjazd, zatwierdzony dojazd i przewodnik, prośba o orientacyjną godzinę |
| Dzień przed przyjazdem | Krótko potwierdzić jutrzejszy przyjazd | **Automatyczny e-mail:** domek, godzina i możliwość zgłoszenia zmiany. Pomijany dla rezerwacji utworzonych dzień przed przyjazdem lub później |
| Rezerwacja na dziś / jutro | Szybko dostać potwierdzenie i dojazd | Potwierdzenie i pełne informacje przyjazdowe kwalifikują się od razu do kolejki. Bez trzeciej, podobnej wiadomości „jutro przyjazd” |
| Po przyjeździe | Wiedzieć, jak poprosić o pomoc | **Ręczny szkic OTA:** krótkie powitanie. Brak nowego automatu e-mail |
| W trakcie pobytu | Zgłosić problem, otrzymać odpowiedź | Dostępny szablon krótkiego pytania i szablon odpowiedzi po rozwiązaniu problemu. Gospodarz używa ich wtedy, gdy są potrzebne |
| Dzień przed wyjazdem | Znać godzinę wyjazdu, zgłosić problem | **Ręczny szkic OTA:** godzina wyjazdu, prośba o kontakt w razie potrzeby. Nie wymyślamy sposobu oddania kluczy ani dodatkowych obowiązków |
| Dzień po wyjeździe | Zamknąć pobyt i przekazać prywatne uwagi | **Automatyczny e-mail:** podziękowanie i możliwość odpowiedzi. Bez dokładania automatycznej prośby o publiczną ocenę |
| Publiczna opinia | Dobrowolnie wystawić opinię we właściwym miejscu | Obecne szkice SMS/e-mail pozostają ręczne i zależne od zgód. Przed użyciem trzeba dobrać właściwy link; nie włączono seryjnych przypomnień |
| Zmiana terminu / anulowanie | Mieć jednoznaczne potwierdzenie nowych ustaleń | Brak osobnego automatu. Odpowiedź gospodarza po sprawdzeniu zmiany i rozliczenia; propozycje poniżej |

## Tytuł przelewu

Dane osoby rezerwującej oraz krótki zakres dat, bez numeru rezerwacji:

- `Jan Kowalski 12-19.06.26`
- Przy zmianie miesiąca: `Jan Kowalski 30.06-02.07.26`
- Przy zmianie roku: `Jan Kowalski 30.12.26-02.01.27`

Nie prosimy o osobne zgłaszanie danych płacącego - są widoczne w przelewie. W tytule pozostaje osoba z rezerwacji.

## Instrukcja płatności zależy od danych

- Nieopłacona zaliczka: pozostała część zaliczki, konkretny termin, konto z odbiorcą, gotowy tytuł przelewu.
- Zaliczka już rozliczona: informacja o rozliczeniu i pozostałym saldzie; bez ponownej prośby o zaliczkę.
- Pobyt opłacony: brak nowego żądania wpłaty.
- Rezerwacja z platformy OTA: odwołanie do jej potwierdzenia płatności; brak dodatkowej prośby o przelew poza platformą.
- Brak kwoty, terminu lub wiarygodnego rozliczenia: blokada szkicu z informacją, co uzupełnić. Nie wysyłamy „do do ustalenia” ani fikcyjnego terminu.
- Zmiana treści nie wysyła ponownie wiadomości już dostarczonych i nie wznawia komunikacji dla historii.

## Kształt maila

1. Krótkie powitanie i cel wiadomości.
2. Dane pobytu w osobnych liniach.
3. Jedno główne działanie, np. wpłata albo podanie godziny przyjazdu.
4. Krótka możliwość odpowiedzi i podpis.

HTML zachowuje pojedyncze entery przez `<br>`, a akapity przez osobne elementy `<p>`. Wiadomość ma także wersję tekstową, poprawny język PL/EN/DE i tytuł. Konto i daty nie zlewają się w jeden akapit. Oryginalne importy Mobile Calendar oraz własne edycje gospodarza nie są nadpisywane aktualizacją domyślnych szablonów.

## Gotowe odpowiedzi ręczne do uzgodnienia przed użyciem

### Zmieniony termin

Dzień dobry,

potwierdzamy zmianę terminu pobytu.

Domek: [domek]
Nowy przyjazd: [data] od [godzina]
Nowy wyjazd: [data] do [godzina]
[Sprawdzone ustalenia dotyczące zmiany ceny i rozliczenia.]

Jeśli coś się nie zgadza, daj nam znać w odpowiedzi.

Do zobaczenia,
Stawy u Sikory

### Anulowanie

Dzień dobry,

potwierdzamy anulowanie rezerwacji domku [domek] w terminie [daty].

[Indywidualnie sprawdzone ustalenia dotyczące wpłaty i ewentualnego zwrotu.]

Jeśli masz pytania, odpowiedz na tego maila.

Pozdrawiamy,
Stawy u Sikory

Te dwie propozycje wymagają uzupełnienia i nie są włączone do automatycznej wysyłki.
