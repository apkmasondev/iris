# Changelog

All notable changes to **The Iris** project will be documented in this file.

## [Unreleased] - 2026-08-04

### Fixed
- **Mobile Bottom Black Bar**: Replaced static `100svh` on `.stage` and `.experience` with dynamic viewport height fallbacks (`100vh` and `100dvh`). Fixes issue on mobile devices (e.g. Android Chrome) where hiding the address bar created an unrendered black gap at the bottom of the screen.
- **Fast Scroll Video Frame Sync & Race Conditions**:
  - Gated video layer opacity crossfades (`firstOpacity`, `secondOpacity`, `thirdOpacity`) on target video frame readiness (`readyState >= HAVE_CURRENT_DATA`), preventing black flashes during rapid scene transitions.
  - Dynamically scaled seek step capping during large scroll jumps (> 4 frames) in `updateVideoTimes` to avoid frame lag and decoder seeking queue bottlenecks.
