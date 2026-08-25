import { FRAME, clamp, videoTimeAt } from "./timeline.ts";

/**
 * Scroll-driven video scrubber.
 *
 * Two ideas carry the whole thing:
 *
 * 1. Scroll position is read from `window.scrollY` against geometry cached on
 *    resize. The previous build called `getBoundingClientRect()` inside the
 *    scroll handler, forcing a layout flush on every single scroll event.
 *
 * 2. Forward motion is produced by *playing* the video at a variable
 *    `playbackRate`, not by assigning `currentTime` every frame. A seek is an
 *    asynchronous pipeline flush; at 60-120 Hz that is what made the old build
 *    stutter on phones. Playing keeps the hardware decoder in its happy path
 *    and the compositor does the rest. Seeks are reserved for the cases where
 *    playback genuinely cannot help: scrolling backwards, jumps larger than a
 *    couple of seconds, and the final snap to an exact frame once the scroll
 *    settles.
 */

const SMOOTHING_MS = 110; // exponential follow of the raw scroll position
const SETTLED = 4e-5; // progress delta below which the scroll is "at rest"
const SNAP_TOLERANCE = FRAME * 0.6; // at rest: closer than this is exact enough
const START_PLAYING = FRAME * 1.5; // in motion: closer than this is invisible
// Hysteresis. Without a lower release threshold the engine toggles play/pause
// several times a second around START_PLAYING, and every toggle is a real cost
// on a hardware decoder.
const KEEP_PLAYING = FRAME * 0.35;
const SEEK_AHEAD_LIMIT = 2.5; // seconds of gap beyond which seeking beats playing
const RATE_HORIZON = 0.22; // close the remaining gap in roughly this long
const MAX_RATE = 4; // Safari clamps hard above this
const MIN_RATE = 0.5;
const MAX_FRAME_DELTA = 64; // ignore tab-switch sized gaps in the rAF clock

export type ScrubberOptions = {
  /** The tall section whose scroll range drives the timeline. */
  track: HTMLElement;
  /** The sticky, viewport-sized element pinned inside the track. */
  stage: HTMLElement;
  video: HTMLVideoElement;
  /** Paints everything that is not the video. Called once per animation frame. */
  onRender: (progress: number) => void;
  /** When true the timeline is pinned to its final frame and never animates. */
  reducedMotion: boolean;
};

export type Scrubber = {
  /** Detaches every listener, stops the loop and parks the video. */
  destroy: () => void;
};

export function createScrubber(options: ScrubberOptions): Scrubber {
  const { track, stage, video, onRender, reducedMotion } = options;

  let trackTop = 0;
  let scrollDistance = 1;
  let targetProgress = 0;
  let renderedProgress = 0;
  let frameHandle: number | null = null;
  let lastFrameTime = 0;
  let ready = false;
  // Set when play() is refused (autoplay policy, low power mode). From then on
  // the scrubber degrades to seek-only, which is slower but always works.
  let seekOnly = reducedMotion;
  let destroyed = false;

  const measure = () => {
    const rect = track.getBoundingClientRect();
    trackTop = rect.top + window.scrollY;
    scrollDistance = Math.max(track.offsetHeight - stage.offsetHeight, 1);
  };

  const readProgress = () =>
    reducedMotion ? 1 : clamp((window.scrollY - trackTop) / scrollDistance);

  const pause = () => {
    if (!video.paused) video.pause();
  };

  const seek = (time: number) => {
    // A seek already in flight will be superseded by the next frame's target,
    // so issuing another one now only thrashes the decoder.
    if (video.seeking) return;
    video.currentTime = time;
  };

  const play = () => {
    if (!video.paused) return;
    const started = video.play();
    if (!started) return;
    started.catch((error: DOMException) => {
      // AbortError just means we paused before playback got going, which is
      // normal here. Only a policy refusal is worth degrading for.
      if (error?.name === "NotAllowedError") seekOnly = true;
    });
  };

  /**
   * Move the video towards `progress`.
   * @returns true while the video still has work to do, so the loop keeps running.
   */
  const driveVideo = (progress: number, settled: boolean): boolean => {
    if (!ready || document.hidden) return false;

    const { duration } = video;
    if (!Number.isFinite(duration) || duration <= 0) return false;

    const targetTime = videoTimeAt(progress, duration);
    const drift = targetTime - video.currentTime;

    if (seekOnly) {
      if (Math.abs(drift) <= SNAP_TOLERANCE) return false;
      seek(targetTime);
      return true;
    }

    if (settled) {
      pause();
      if (Math.abs(drift) <= SNAP_TOLERANCE) return false;
      seek(targetTime);
      return true;
    }

    // Ahead of us and within reach: ride the decoder forward.
    const worthPlaying = video.paused ? drift > START_PLAYING : drift > KEEP_PLAYING;
    if (worthPlaying && drift < SEEK_AHEAD_LIMIT) {
      const rate = clamp(drift / RATE_HORIZON, MIN_RATE, MAX_RATE);
      // Rounded, because assigning playbackRate is not free and a 1% change is
      // not something anyone can see.
      if (Math.abs(video.playbackRate - rate) > 0.01) video.playbackRate = rate;
      play();
      return true;
    }

    // Behind us, or a jump too big to play through.
    if (Math.abs(drift) > START_PLAYING) {
      pause();
      seek(targetTime);
      return true;
    }

    pause();
    return false;
  };

  const tick = (now: number) => {
    frameHandle = null;
    if (destroyed) return;

    const elapsed = Math.min(Math.max(now - lastFrameTime, 0), MAX_FRAME_DELTA);
    lastFrameTime = now;

    const delta = targetProgress - renderedProgress;
    renderedProgress =
      reducedMotion || Math.abs(delta) < SETTLED
        ? targetProgress
        : renderedProgress + delta * (1 - Math.exp(-elapsed / SMOOTHING_MS));

    const settled = Math.abs(targetProgress - renderedProgress) < SETTLED;
    onRender(renderedProgress);
    const videoBusy = driveVideo(renderedProgress, settled);

    if (!settled || videoBusy) {
      frameHandle = window.requestAnimationFrame(tick);
    }
  };

  const schedule = () => {
    if (destroyed) return;
    targetProgress = readProgress();
    if (frameHandle !== null) return;
    lastFrameTime = performance.now();
    frameHandle = window.requestAnimationFrame(tick);
  };

  const remeasure = () => {
    measure();
    schedule();
  };

  const onMetadata = () => {
    ready = true;
    if (reducedMotion && Number.isFinite(video.duration)) {
      video.currentTime = Math.max(0, video.duration - FRAME);
    }
    schedule();
  };

  const onVisibility = () => {
    if (document.hidden) pause();
    schedule();
  };

  // Playing past the target between two animation frames is possible when the
  // main thread hiccups; stopping at `ended` keeps the last frame on screen
  // instead of letting the element reset or go blank.
  const onEnded = () => pause();

  // Geometry first: `onMetadata` schedules, and scheduling against an
  // unmeasured track reads a bogus progress on a page restored mid-scroll.
  measure();
  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) onMetadata();
  video.addEventListener("loadedmetadata", onMetadata);
  video.addEventListener("ended", onEnded);

  const resizeObserver = new ResizeObserver(remeasure);
  resizeObserver.observe(track);
  resizeObserver.observe(stage);

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("orientationchange", remeasure);
  // Back/forward cache restores scroll position without a resize or a scroll
  // event, so the timeline has to be re-derived by hand.
  window.addEventListener("pageshow", remeasure);
  document.addEventListener("visibilitychange", onVisibility);

  targetProgress = readProgress();
  renderedProgress = targetProgress;
  onRender(renderedProgress);
  schedule();

  return {
    destroy() {
      destroyed = true;
      resizeObserver.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("orientationchange", remeasure);
      window.removeEventListener("pageshow", remeasure);
      document.removeEventListener("visibilitychange", onVisibility);
      video.removeEventListener("loadedmetadata", onMetadata);
      video.removeEventListener("ended", onEnded);
      if (frameHandle !== null) cancelAnimationFrame(frameHandle);
      frameHandle = null;
      pause();
      // A successor scrubber (reduced motion toggled, StrictMode remount)
      // must not inherit whatever rate this one left behind.
      video.playbackRate = 1;
    },
  };
}
