# THE IRIS — cinematic scroll experience

Jednokadrowe, interaktywne doświadczenie filmowe sterowane scrollem. Jeden master
wideo jest przewijany klatka po klatce razem z pozycją scrolla, w pełnoekranowej
scenie z preloaderem, narracją typograficzną i trybem ograniczonego ruchu.

## Lokalny podgląd

```bash
npm install
npm run dev
```

## Wersja produkcyjna

```bash
npm run build
```

Gotowe pliki trafiają do `dist/`. Projekt używa relatywnej ścieżki bazowej,
dlatego działa zarówno pod domeną główną, jak i w podkatalogu repozytorium
GitHub Pages.

## Testy

```bash
npm test
```

Testy (`node --test`, bez dodatkowych zależności) pokrywają czystą matematykę osi
czasu oraz sam silnik scrubbingu — na atrapach DOM/media, więc sprawdzają
prawdziwe decyzje `play` vs `seek`, a nie tylko kształt API.

## Materiały wideo

Źródła (1920×1080, 24 FPS, H.264, bez dźwięku) leżą w `media/source/` i **nie są
publikowane** — nie znajdują się w `publicDir`. Pliki wysyłane do przeglądarki
generuje jednorazowo:

```bash
npm run media -- --force
```

Skrypt `scripts/build-media.mjs` skleja trzy akty w jeden master z wtopionymi
przenikaniami (2 × 0,4 s) i koduje trzy warianty rozdzielczości plus poster i
kartę OG.

| plik | rozdzielczość | rozmiar |
| --- | --- | --- |
| `assets/video/iris-master-1080.mp4` | 1920×1080 | ~10,3 MB |
| `assets/video/iris-master-720.mp4` | 1280×720 | ~4,6 MB |
| `assets/video/iris-master-540.mp4` | 960×540 | ~2,5 MB |

Przeglądarka pobiera **dokładnie jeden** z nich (`src/lib/media.ts`), na podstawie
rozmiaru viewportu, typu wskaźnika, `devicePixelRatio` oraz `saveData` /
`effectiveType`.

## Dlaczego tak — założenia architektury

Poprzednia wersja wysyłała każdemu odwiedzającemu trzy osobne klipy 1080p
zakodowane jako GOP1 (każda klatka kluczowa, ~20 Mb/s) — łącznie **74 MB** — i
trzymała trzy równoległe dekodery, przewijane przypisaniem `currentTime` w każdej
klatce animacji. To jest dokładnie ten zestaw decyzji, który na telefonie kończy
się zacinaniem i pustym ekranem.

- **Jeden master zamiast trzech klipów.** Jeden element `<video>` to jeden
  dekoder sprzętowy; mobilne Safari i Chrome limitują liczbę jednocześnie
  dekodowanych filmów. Przenikania są wtopione w materiał, więc cała logika
  przejść znika z runtime'u i zostaje jedna monotoniczna funkcja
  `postęp → czas`.
- **GOP 12 zamiast GOP 1.** GOP1 dawał darmowe przewijanie kosztem
  dziesięciokrotnego bitrate'u. Zamknięty GOP co 0,5 s kosztuje przy seeku
  najwyżej 12 zdekodowanych klatek — poniżej milisekundy na dekoderze
  sprzętowym.
- **Brak klatek B (`-bf 0`).** Bez zmiany kolejności opóźnienie dekodowania po
  seeku jest deterministyczne, a scrubbing przez `playbackRate` nie utyka na
  referencji do przyszłej klatki.
- **Odszumianie (`hqdn3d`).** To drobny dither w ciemnych gradientach windował
  bitrate. Jest usuwany przy kodowaniu i odtwarzany za darmo warstwą ziarna w
  CSS.
- **Ruch do przodu przez odtwarzanie, nie przez seek.** Seek to asynchroniczne
  opróżnienie potoku dekodera; przy 60–120 Hz to właśnie on szarpał obraz.
  Silnik zamiast tego odtwarza materiał ze zmiennym `playbackRate` i sięga po
  seek tylko tam, gdzie odtwarzanie nie pomoże: przy scrollu w tył, przy skokach
  powyżej 2,5 s i przy końcowym dociągnięciu do dokładnej klatki.
- **Zero renderów Reacta w pętli scrolla.** Stan Reacta to wyłącznie preloader;
  wszystko, czego dotyka pętla animacji, idzie prosto do DOM przez refy, z
  cache'em zapisów (`src/lib/dom.ts`), który pomija wartości bez zmian.

Efekt: **74 MB → 2,5–10,3 MB na odwiedzającego** (97% mniej na telefonie), jeden
dekoder zamiast trzech, brak wymuszonego layoutu przy scrollu i brak przepływów
przez scheduler Reacta.

## Mobile

- **Długość scrolla w `svh`**, wysokość sceny w `dvh`. `svh` nie zmienia się,
  gdy przeglądarka chowa pasek adresu, więc postęp nie skacze w trakcie
  przewijania.
- **Warstwa wideo w `lvh`**, zakotwiczona do góry i przycinana przez scenę.
  Element `<video>` ma przez całą sesję jeden rozmiar — nie ma czarnego paska
  przy chowaniu paska adresu i nie ma relayoutu wideo.
- **Ziarno bez `mix-blend-mode`** na urządzeniach dotykowych. Mieszanie
  pełnoekranowej warstwy z ruchomym wideo to najdroższy krok kompozytora na
  GPU telefonu.
- Wszystkie wartości sterowane scrollem animują wyłącznie `opacity` i
  `transform`; kolory, obramowania i cienie są statyczne, żeby nie wymuszać
  repaintu w każdej klatce.

## Dostępność

`prefers-reduced-motion` zatrzymuje oś czasu na ostatniej klatce i wyłącza całą
animację. Dostępne są też link pomijający do końcowego komunikatu, opis sceny dla
czytników ekranu i komunikaty stanu preloadera.

## Publikacja na GitHub Pages

Workflow `.github/workflows/deploy-pages.yml` buduje i publikuje stronę po każdym
pushu do gałęzi `main`. W ustawieniach repozytorium wybierz
**Settings → Pages → Source: GitHub Actions**. CI nie uruchamia ffmpeg — pliki z
`assets/video/` są wersjonowane.
