# THE IRIS — wstępny plan realizacji strony scroll-driven

> **Status końcowy:** projekt został rozszerzony do trzech filmów. Finalna wersja wykorzystuje dodatkowy `assets/video/03-iris-response-gop1.mp4` jako akt „RESPONSE”, z crossfadem po filmie 2 i finałem „YOU HAVE BEEN SEEN”. Aktualna implementacja oraz mapowanie progresu w `src/App.tsx` mają pierwszeństwo przed wstępnymi wartościami z tego dokumentu.

## 1. Cel projektu

Zbuduj zjawiskową, minimalistyczną stronę typu cinematic scroll experience. Cała narracja ma być skupiona na jednym mechanicznym oku/przesłonie umieszczonej dokładnie na środku ekranu. Tło pozostaje idealnie czarne, a tekst i efekty są oszczędne. Strona ma wyglądać bardziej jak interaktywne intro filmu science-fiction niż klasyczny landing page.

Nie zakładaj, że przejście między filmami, animacje, responsywność lub wydajność działają poprawnie. Testuj je klatka po klatce i popraw wszystkie widoczne skoki, błyski, zmiany skali, opóźnienia ładowania oraz problemy na mobile.

## 2. Materiały

Użyj dwóch filmów GOP1:

- `assets/video/01-iris-opening-gop1.mp4` — pojawienie się i otwarcie mechanicznej przesłony,
- `assets/video/02-iris-signal-gop1.mp4` — wlot do wnętrza oraz pojawienie się centralnego światła.

Parametry materiałów:

- 1920 × 1080,
- 24 FPS,
- 10 sekund każdy,
- H.264 MP4,
- każda klatka jest klatką kluczową,
- bez audio — strona ma działać jako wyciszone doświadczenie scroll-driven.

## 3. Rekomendowany stack

- React + Vite + TypeScript,
- GSAP + ScrollTrigger,
- CSS Modules albo zwykły uporządkowany CSS,
- bez ciężkiego Three.js w pierwszej wersji,
- opcjonalnie lekki Canvas 2D wyłącznie dla drobin w finale.

Priorytetem jest stabilne przewijanie filmu, nie liczba bibliotek.

## 4. Główna konstrukcja strony

Zbuduj jeden długi kontener doświadczenia oraz przyklejoną scenę:

```text
App
└── IrisExperience
    ├── StickyStage
    │   ├── VideoLayer — film 1
    │   ├── VideoLayer — film 2
    │   ├── Vignette / grain
    │   ├── MinimalTextOverlay
    │   ├── ProgressIndicator
    │   └── FinalSignalEffect
    └── ScrollTrack
```

Założenia:

- `IrisExperience`: około 900–1100 `vh`,
- `StickyStage`: `position: sticky`, `top: 0`, `height: 100svh`,
- obydwa filmy leżą dokładnie jeden nad drugim,
- tło strony i filmów: `#000`,
- `object-fit: contain`, dzięki czemu centralny obiekt nie zostanie ucięty na ekranach pionowych, a czarne marginesy zleją się z tłem,
- brak klasycznego scrollbara projektu lub bardzo subtelny wskaźnik postępu.

## 5. Mapowanie scrolla na filmy

Zastosuj jeden nadrzędny `ScrollTrigger` i mapuj globalny postęp strony na czas obydwu filmów.

Proponowany podział progresu:

| Progres strony | Akcja |
|---|---|
| `0.00–0.05` | czarny ekran, delikatne ujawnienie pierwszej klatki |
| `0.05–0.44` | przewijanie filmu 1 od 0 do końca |
| `0.42–0.49` | płynny crossfade film 1 → film 2 |
| `0.47–0.91` | przewijanie filmu 2 od 0 do końca |
| `0.91–1.00` | zatrzymanie ostatniej klatki i finał typograficzny |

Przejście między filmami musi mieć niewielkie nakładanie. Nie wykonuj twardego przełączenia `display: none`. Animuj opacity obu warstw przez około 5–7% całego progresu. W razie różnicy jasności zastosuj bardzo subtelny wspólny overlay/vignette, a nie agresywny filtr zmieniający charakter filmów.

## 6. Sterowanie czasem filmu

Każdy film:

- `muted`,
- `playsInline`,
- `preload="auto"`,
- bez kontrolek,
- pozostaje zapauzowany,
- czas jest ustawiany na podstawie progresu scrolla.

Po `loadedmetadata` odczytaj rzeczywisty `duration`. Nie wpisuj czasu 10 sekund na sztywno. Aktualizuj `currentTime` w `requestAnimationFrame` i ogranicz zbędne ustawienia czasu, gdy różnica jest mniejsza niż około pół klatki.

Przykładowa logika:

```ts
const frameDuration = 1 / 24;
const targetTime = localProgress * video.duration;

if (Math.abs(video.currentTime - targetTime) > frameDuration / 2) {
  video.currentTime = targetTime;
}
```

Po załadowaniu filmu wykonaj bezpieczny warm-up, np. ustawiając `currentTime` na `0.001`, a następnie wracając do zera. Usuń wszystkie timery i instancje ScrollTrigger przy unmount.

## 7. Narracja i teksty

Tekst ma być bardzo oszczędny. Nie zasłaniaj centralnego obiektu. Używaj krótkich komunikatów, które pojawiają się na obrzeżach ekranu lub w dolnej części.

Proponowane etapy:

### Intro

Mały techniczny napis w lewym górnym rogu:

```text
APERTURE / 01
VISUAL EXPERIMENT
```

Centralnie, bardzo subtelnie:

```text
LOOK CLOSER
```

### Otwarcie przesłony

Po lewej lub prawej stronie:

```text
THE DARKNESS OPENS
```

### Wlot do środka

Tekst przechodzi za obiekt lub gaśnie:

```text
YOU ARE NOT LOOKING IN
```

### Finał

Gdy pojawia się punkt światła:

```text
IT IS LOOKING BACK
```

Na końcu mały podpis/CTA:

```text
ENTER THE UNKNOWN
```

CTA nie powinno wyglądać jak typowy kolorowy przycisk. Zastosuj cienką linię, mały symbol lub minimalistyczny link.

## 8. Kierunek wizualny

- absolutna czerń jako główne tło,
- kolory tekstu: przygaszona biel i chłodna szarość,
- subtelne metaliczne akcenty,
- brak neonowych ramek i przypadkowych gradientów,
- typografia uppercase, szeroki tracking,
- dużo pustej przestrzeni,
- delikatna winieta oraz bardzo subtelne ziarno filmowe,
- elementy interfejsu cienkie, precyzyjne i techniczne.

Przykładowe zmienne:

```css
:root {
  --bg: #000;
  --text: rgba(238, 241, 245, 0.92);
  --muted: rgba(238, 241, 245, 0.45);
  --line: rgba(238, 241, 245, 0.18);
}
```

Nie dodawaj kolorów tylko po to, aby strona była bardziej efektowna. Efekt WOW ma wynikać z ruchu, skali, ciemności, rytmu i centralnego światła.

## 9. Efekty uzupełniające

### Obowiązkowe

- delikatne wejście strony z czerni,
- crossfade między filmami,
- subtelna winieta,
- bardzo lekki grain,
- cienki pionowy wskaźnik postępu,
- preloader pokazujący stan ładowania obu filmów.

### Opcjonalne po ukończeniu rdzenia

- delikatny puls wokół punktu światła w finale,
- niewielkie, bardzo rzadkie drobiny zasysane do centrum,
- mikroreakcja tekstu na ruch kursora,
- krótki kontrolowany błysk przy pojawieniu się centralnego światła.

Nie dodawaj efektów opcjonalnych, dopóki podstawowe przewijanie filmów nie jest płynne.

## 10. Preloader

Oba filmy są cięższe ze względu na GOP1, dlatego ekran startowy jest konieczny.

Preloader:

- czarne tło,
- mały punkt lub cienki okrąg na środku,
- procent ładowania,
- po załadowaniu metadanych i wystarczającej ilości danych płynnie znika,
- strona nie zaczyna animacji przed gotowością filmów,
- posiada timeout i komunikat awaryjny, gdy materiał nie może zostać odtworzony.

Nie blokuj użytkownika bez końca. W razie wolnego łącza pozwól wejść po załadowaniu pierwszego filmu, a drugi doczytuj w tle.

## 11. Responsywność

### Desktop

- obiekt zajmuje dużą część ekranu,
- teksty mogą pojawiać się przy bocznych krawędziach,
- wskaźnik postępu po prawej stronie.

### Mobile

- użyj `100svh`, nie samego `100vh`,
- filmy `object-fit: contain`,
- zmniejsz teksty i przenieś je bliżej dolnej krawędzi,
- nie umieszczaj kluczowych treści pod paskami przeglądarki,
- zrezygnuj z efektów kursora,
- przetestuj Safari i Chrome na urządzeniach mobilnych,
- nie odtwarzaj filmów automatycznie w klasyczny sposób — steruj wyłącznie ich `currentTime`.

## 12. Reduced motion i dostępność

Dla `prefers-reduced-motion: reduce`:

- nie wykonuj pełnego scrubowania obu filmów,
- pokaż statyczne klatki lub krótkie kontrolowane przejścia opacity,
- zachowaj pełną treść tekstową,
- pozwól przejść do finału bez długiego przewijania.

Dodaj semantyczne nagłówki poza warstwą dekoracyjną, poprawny kontrast tekstu oraz dostępny link końcowy. Filmy dekoracyjne powinny mieć `aria-hidden="true"`.

## 13. Wydajność

- nie renderuj filmów w Canvas, jeśli natywne `<video>` działa płynnie,
- unikaj ciągłego `setState` podczas scrollowania,
- aktualizuj wartości bezpośrednio przez referencje,
- używaj `will-change` wyłącznie na animowanych warstwach,
- usuń zbędne filtry CSS na pełnym ekranie,
- grain najlepiej wykonać małą powtarzalną teksturą lub lekkim pseudoelementem,
- wstrzymaj logikę, gdy karta jest niewidoczna,
- przetestuj działanie przy szybkim przewijaniu w obie strony.

## 14. SEO i struktura dokumentu

Mimo eksperymentalnej formy strona musi mieć:

- unikalny `title`,
- meta description,
- Open Graph,
- jeden logiczny `h1`,
- favicon,
- krótki opis projektu dostępny dla robotów i czytników ekranu,
- poprawne linki oraz brak pustych przycisków.

Proponowany tytuł:

```text
The Iris — Interactive Cinematic Experiment
```

## 15. Etapy realizacji

1. Utworzenie projektu i podstawowej struktury komponentów.
2. Załadowanie obu filmów i preloader.
3. Poprawne sterowanie `currentTime` filmu 1.
4. Dodanie filmu 2 i precyzyjny crossfade.
5. Dodanie tekstów i ich choreografii.
6. Finał z centralnym punktem światła.
7. Mobile oraz reduced motion.
8. Optymalizacja i testy.
9. SEO, metadane i ostateczny polishing.

## 16. Kryteria odbioru

Projekt jest gotowy dopiero wtedy, gdy:

- przewijanie w przód i w tył jest płynne,
- nie ma białych błysków ani widocznego przeładowania filmu,
- przejście między filmami nie wygląda jak cięcie,
- obiekt nie zmienia nagle położenia ani skali,
- ostatnia klatka pozostaje stabilna,
- tekst nie zasłania najważniejszych elementów,
- strona działa na desktopie i mobile,
- preloader nie blokuje strony bez końca,
- brak błędów w konsoli,
- wszystkie linki i interakcje działają,
- layout nie skacze po załadowaniu fontów lub filmów,
- tryb reduced motion jest użyteczny,
- wynik Lighthouse nie jest sztucznie obniżany przez niepotrzebne biblioteki.

## 17. Zakaz przypadkowego rozbudowywania projektu

Nie zmieniaj strony w klasyczny landing z wieloma kartami, sekcjami usług, statystykami i kolorowymi przyciskami. Jej siłą ma być jeden centralny obiekt, kontrolowane napięcie oraz filmowa narracja. Najpierw perfekcyjnie wykonaj główne doświadczenie, dopiero później rozważ krótkie minimalistyczne outro z informacją o autorze projektu.
