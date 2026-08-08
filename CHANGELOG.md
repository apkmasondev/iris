# Changelog

All notable changes to **The Iris** project will be documented in this file.

## [Unreleased] - 2026-08-08

### Fixed
- **Stale frame after reload / scroll restoration**: `markReady()` never triggered a render pass, so a video that became decodable *after* the initial render kept showing frame 0. Reloading the page at 62% scroll left act 2 frozen on its first frame while the HUD already read `CH.03 / RESPONSE DETECTED`, and it stayed wrong until the next scroll event. `markReady()` and `warmVideo()` now re-enter the master loop through a `scheduleRef`.
- **Failed video blocked the whole experience**: `onError` only set `slowLoad`, so a video that failed to load never entered the ready set and the intro loader hung on the 12 s emergency fallback. Loader readiness is now tracked by a separate `videoSettled` flag that counts both "can play" and "failed for good" (measured: 12171 ms → 521 ms with a dead third source).
- **Invisible replay button was keyboard reachable**: `.final-action` sat at `opacity: 0` with only `pointer-events` toggled, so the first <kbd>Tab</kbd> from the top of the page landed on the hidden "REPLAY THE ENCOUNTER" control (WCAG 2.4.3/2.4.7). It now starts `visibility: hidden` and is revealed by the render loop alongside its fade-in.
- **Empty landing screen**: the intro copy used a fade-in envelope starting at `progress 0.012`, so with act 1 opening on an almost black frame (avg luma 3.8/255) the page rendered with no headline at all until ~90 px of scroll. "LOOK CLOSER" is now on screen the moment the loader clears; the fade-out timing is unchanged.
- **Stale `reducedMotion` closure**: the `requestAnimationFrame` callback in `warmVideo()` captured the value from render time; it now reads `reducedMotionRef`.

### Removed
- Dead `targetTimes` ref (written every frame, never read) and the `--pointer-x` / `--pointer-y` custom properties (recomputed on every `pointermove`, referenced by no CSS rule).
- Stale `PLAN.md` entry in the README asset list.

## [0.1.0] - 2026-08-04

### Fixed
- **Mobile Bottom Black Bar**: Replaced static `100svh` on `.stage` and `.experience` with dynamic viewport height fallbacks (`100vh` and `100dvh`). Fixes issue on mobile devices (e.g. Android Chrome) where hiding the address bar created an unrendered black gap at the bottom of the screen.
- **Fast Scroll Video Frame Sync & Master-Loop Engine**:
  - Ported Origin's unified `requestAnimationFrame` master-loop architecture to `App.tsx`.
  - Implemented dynamic scroll-velocity frame step scaling (`speedMultiplier` up to 6x) in `advanceVideo`, eliminating mobile stuttering during rapid scrolling.
  - Implemented video `seeking` frame hold in `tick()`, keeping RAF active until video hardware decoders render target frames.
  - Added `timeline.active` filtering so inactive background videos skip decoding cycles.
- **Origin 1:1 timelineFor State Engine**:
  - Replaced ad-hoc opacity and time calculations with Origin's pure `timelineFor(progress, durations)` engine.
  - Implemented `ends = duration - 0.04` target time clamping, preventing HTML5 `<video>` EOF buffer stalls and flickering.
  - Stabilized third video opacity (`opacities[2]`) to solid 1.0 from `progress >= 0.73` to `1.00`, completely eliminating end-of-page black flashes and frame flickering.



