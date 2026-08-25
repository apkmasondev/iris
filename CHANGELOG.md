# Changelog

All notable changes to **The Iris** project will be documented in this file.

## [1.0.1] - 2026-08-25

### Fixed
- **Loader hung until the emergency timeout.** The release gate waited for
  `buffered / duration >= 0.5`, a threshold the browser never reaches: with
  `preload="auto"` on a *paused* element Chrome fills its buffer and then sends
  `suspend` and stops downloading. Measured against the deployed 1080p master:
  `readyState` reaches `HAVE_ENOUGH_DATA` and `canplaythrough` fires at 514 ms,
  buffering plateaus at 0.477 by 1079 ms and never moves again — so the readout
  parked on `095` and only the 16 s hard fallback let anyone through. The gate
  is now `HAVE_ENOUGH_DATA`, which is the browser's own estimate that it can
  play to the end; the byte-count path survives only as a fallback, lowered to
  0.3. Release time from navigation start: **~16 s → ~1.3 s**.
- **iOS Safari fetched nothing until playback.** It treats `preload="auto"` as a
  suggestion and commonly stops at metadata, which would have left the same
  loader waiting on data that was never coming. A muted inline video is allowed
  to start without a gesture, so the pipeline is now primed with one
  `play()`/`pause()` while booting.
- Slow-signal notice moved to 6 s and the emergency release to 12 s, now that
  neither is load-bearing.

## [1.0.0] - 2026-08-25

Full rebuild of the media pipeline and the scroll engine. The original design
sent every visitor three separate 1080p clips encoded as GOP1 (every frame a
keyframe, ~20 Mb/s) — **74 MB** — and drove three simultaneous decoders by
assigning `currentTime` on every animation frame. That set of assumptions is
what made the experience unusable on phones, so it was replaced rather than
patched.

### Changed
- **One master instead of three clips.** `scripts/build-media.mjs` joins the
  three acts into a single continuous shot with the two cross-dissolves baked in
  (2 × 0.4 s, matching the old transition pacing exactly). One `<video>` element
  is one hardware decoder; mobile Safari and Chrome cap how many can run at once,
  and three 1080p decoders is where the previous build fell over. The runtime
  timeline collapses from a three-clip state machine to one monotonic
  `progress → time` map (`src/lib/timeline.ts`).
- **GOP 12 instead of GOP 1, no B-frames, mild denoise.** All-intra bought free
  seeks at ten times the bitrate. A closed 12-frame GOP costs at most 12 decoded
  frames per seek — sub-millisecond on a hardware decoder. `-bf 0` keeps
  post-seek decode latency deterministic. `hqdn3d` strips the fine dither in the
  dark gradients that was actually driving the bitrate; the CSS grain layer puts
  the texture back for free.
- **Three resolution tiers, one download.** 1920×1080 (10.3 MB), 1280×720
  (4.6 MB) and 960×540 (2.5 MB); `src/lib/media.ts` picks one from viewport size,
  pointer type, `devicePixelRatio`, `saveData` and `effectiveType`. Per-visitor
  payload drops from 74 MB to 2.5–10.3 MB — 97% less on a phone.
- **Forward scrubbing plays the video instead of seeking it.** A seek is an
  asynchronous decoder pipeline flush; at 60–120 Hz that was the stutter. The
  engine now rides a variable `playbackRate` towards the target and reserves
  seeks for backward scroll, jumps over 2.5 s, and the final snap onto an exact
  frame. Measured on the test harness: a 1.4 s hand-speed scroll issues **one**
  `play()` and **one** seek, against ~90 seeks for the old approach.
- **Scroll position no longer forces layout.** The old handler called
  `getBoundingClientRect()` on every scroll event. Geometry is now cached and
  refreshed by a `ResizeObserver`, so the hot path is a `window.scrollY` read.
- **Zero React renders in the scroll loop.** The loader was React state updated
  from the media `progress` event, re-rendering the whole tree during load.
  React state is now only `booting` / `slowLoad` / `failed`; everything the
  animation loop touches is written straight to the DOM through refs, behind a
  write-through cache (`src/lib/dom.ts`) that skips unchanged values.
- **Viewport units split by role.** Scroll length is `svh` (constant while a
  mobile address bar animates, so progress cannot jump mid-scroll), the stage is
  `dvh` (chrome stays framed against what is visible), and the media layer is
  `lvh` anchored to the top and cropped by the stage — so the `<video>` element
  keeps exactly one size for the whole session. No black bar, no video relayout.
- **`assets/og.png` → `assets/og.jpg`**, 1672×941/1.34 MB → 1200×630/48 kB.
  `assets/favicon.png` (the apple-touch-icon) 1254×1254/995 kB → 180×180/16 kB.
- Source clips moved to `media/source/`, outside `publicDir`, so they are no
  longer copied into `dist/` and shipped.

### Fixed
- **Per-frame repaints from scroll-driven paint properties.** `--reticle` fed a
  border colour, `--signal` fed a `box-shadow` radius and a `text-shadow` blur.
  Each one repainted its element on every animation frame instead of staying on
  the compositor; all three are now static, driven by `opacity` alone.
- **Full-screen `soft-light` blend over live video on mobile.** The grain layer
  forced the compositor to re-blend the whole viewport for every video frame.
  Touch devices now get a flat alpha overlay.
- **Effect re-running on every loader tick.** The reduced-motion effect listed
  `loadProgress` in its dependency array, so it re-ran for each buffering
  update. Removed along with the state it depended on.
- **A dead master left the visitor in an empty black page.** `onError` released
  the loader and cleared the only message explaining what happened. A failed load
  is now terminal and says so.
- **Loader kept animating after release.** The calibration dot ran its keyframes
  forever behind `visibility: hidden`.
- Scrubber now re-derives the timeline on `pageshow`, so a back/forward-cache
  restore (which fires neither `scroll` nor `resize`) does not leave a stale
  frame on screen; and it resets `playbackRate` on teardown.

### Added
- `npm test` — `node --test`, no new dependencies. Covers the timeline math
  (monotonicity, dissolve placement, never seeking past `duration - 1 frame`,
  chapter sequencing) and the scrubber itself against DOM/media stubs, including
  the play-vs-seek decisions, hidden-tab behaviour, reduced motion and teardown.
- `npm run media` — reproducible ffmpeg pipeline with the reasoning for every
  encoder flag recorded next to it.
- Stricter TypeScript: `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`,
  `noUncheckedIndexedAccess`, `verbatimModuleSyntax`.

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



