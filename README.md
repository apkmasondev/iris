# THE IRIS — cinematic scroll experience

Jednokadrowe, interaktywne doświadczenie filmowe sterowane scrollem. Trzy materiały GOP1 są płynnie łączone w pełnoekranowej scenie z preloaderem, narracją typograficzną i dostępnym trybem ograniczonego ruchu.

## Lokalny podgląd

```bash
npm install
npm run dev
```

## Wersja produkcyjna

```bash
npm run build
```

Gotowe pliki trafiają do `dist/`. Projekt używa relatywnej ścieżki bazowej, dlatego działa zarówno pod domeną główną, jak i w podkatalogu repozytorium GitHub Pages.

## Publikacja na GitHub Pages

Workflow `.github/workflows/deploy-pages.yml` buduje i publikuje stronę po każdym pushu do gałęzi `main`. W ustawieniach repozytorium wybierz **Settings → Pages → Source: GitHub Actions**.

## Materiały

- `assets/video/01-iris-opening-gop1.mp4`
- `assets/video/02-iris-signal-gop1.mp4`
- `assets/video/03-iris-response-gop1.mp4`
- `PLAN.md`

Filmy mają 1920×1080, 24 FPS, H.264, GOP1 i nie zawierają audio. Trzeci akt rozwija sygnał w odpowiedź mechanizmu i kończy sekwencję komunikatem „YOU HAVE BEEN SEEN”.

## Optymalizacja i obsługa mobile

- **Dynamiczny Viewport Mobile (`100dvh`)**: Kontener sceny korzysta z dynamicznych jednostek wysokości CSS (`100vh` / `100dvh`), wykluczając problem powstawania czarnego paska przy chowaniu paska adresu w Chrome na Androidzie.
- **Silnik osi czasu `timelineFor` (z projektu Origin)**: Matematycznie czysta kalkulacja przezroczystości i czasów docelowych (`timelineFor`) z buforem bezpieczeństwa `duration - 0.04`, co całkowicie wyklucza migotanie, mruganie czarnego ekranu oraz dławienie dekodera przy końcówce filmu.




