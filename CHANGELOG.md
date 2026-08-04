# Changelog

All notable changes to **The Iris** project will be documented in this file.

## [Unreleased] - 2026-08-04

### Fixed
- **Mobile Bottom Black Bar**: Replaced static `100svh` on `.stage` and `.experience` with dynamic viewport height fallbacks (`100vh` and `100dvh`). Fixes issue on mobile devices (e.g. Android Chrome) where hiding the address bar created an unrendered black gap at the bottom of the screen.
- **Fast Scroll Video Frame Sync & Master-Loop Engine**:
  - Ported Origin's unified `requestAnimationFrame` master-loop architecture to `App.tsx`.
  - Implemented dynamic scroll-velocity frame step scaling (`speedMultiplier` up to 6x) in `advanceVideo`, eliminating mobile stuttering during rapid scrolling.
  - Implemented video `seeking` frame hold in `tick()`, keeping RAF active until video hardware decoders render target frames.
  - Added `timeline.active` filtering so inactive background videos skip decoding cycles.

