/**
 * Pure timeline math for THE IRIS.
 *
 * Everything here is a side-effect-free function of scroll progress (0..1), so
 * the render loop stays trivially testable and the scrubber never has to know
 * what the experience actually looks like.
 */

/** Source frame rate of the master. */
export const FRAME = 1 / 24;

/**
 * Nominal length of the generated master, in seconds.
 * Must match MASTER_DURATION in scripts/build-media.mjs (3 x 10s clips joined
 * by two 0.4s dissolves). The real file lands within a frame of this; the map
 * below is rescaled by the decoded duration at runtime so a re-encode that
 * shifts by a frame or two cannot desynchronise the timeline.
 */
export const MASTER_DURATION = 29.2;

export const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

/** Normalised position of `value` inside [from, to], clamped to 0..1. */
export const range = (value: number, from: number, to: number) =>
  clamp((value - from) / (to - from));

/** Smoothstep. */
export const smooth = (value: number) => value * value * (3 - 2 * value);

export const fadeOut = (value: number, exit: number) =>
  1 - smooth(range(value, exit, Math.min(exit + 0.07, 1)));

/** Fade in over [enter, hold], hold, then fade out from `exit`. */
export const envelope = (value: number, enter: number, hold: number, exit: number) =>
  Math.min(smooth(range(value, enter, hold)), fadeOut(value, exit));

/**
 * Scroll progress -> master time, in seconds of the nominal master.
 *
 * The pacing is inherited verbatim from the three-clip build: a beat of stillness
 * at the top, each act played out over its own stretch of scroll, and the two
 * dissolves deliberately drawn out (0.4s of footage across 0.05 of scroll, four
 * times slower than the acts themselves) so the cross-fade reads as a held
 * moment rather than a cut.
 *
 * Monotonically increasing by construction, which is what lets the scrubber
 * drive the video forward by playing it instead of seeking frame by frame.
 */
const FINAL_SECONDS = MASTER_DURATION - 0.04;

const KEYFRAMES: ReadonlyArray<readonly [progress: number, seconds: number]> = [
  [0.0, 0.02],
  [0.06, 0.2],
  [0.34, 9.6], // act one runs out
  [0.39, 10.0], // first dissolve complete
  [0.68, 19.2], // act two runs out
  [0.73, 19.6], // second dissolve complete
  [0.97, FINAL_SECONDS],
  [1.0, FINAL_SECONDS],
];

export function videoTimeAt(progress: number, duration: number): number {
  const scale = duration / MASTER_DURATION;
  let seconds = FINAL_SECONDS;

  for (let i = 1; i < KEYFRAMES.length; i += 1) {
    const from = KEYFRAMES[i - 1];
    const to = KEYFRAMES[i];
    if (!from || !to) break;
    if (progress > to[0]) continue;

    const span = to[0] - from[0];
    const position = span <= 0 ? 0 : (progress - from[0]) / span;
    seconds = from[1] + (to[1] - from[1]) * position;
    break;
  }

  // Never ask for the very last frame: decoders treat `duration` as an open
  // bound and a seek to it can land on a blank frame or stall the pipeline.
  return clamp(seconds * scale, 0, Math.max(0, duration - FRAME));
}

export type Chapter = { readonly id: string; readonly status: string };

const OPENING_CHAPTER: Chapter = { id: "00", status: "CALIBRATING APERTURE" };

const CHAPTERS: ReadonlyArray<readonly [from: number, chapter: Chapter]> = [
  [0.93, { id: "05", status: "CONTACT COMPLETE" }],
  [0.82, { id: "04", status: "OBSERVATION RECIPROCAL" }],
  [0.6, { id: "03", status: "RESPONSE DETECTED" }],
  [0.34, { id: "02", status: "THRESHOLD CROSSED" }],
  [0.04, { id: "01", status: "APERTURE ACTIVE" }],
];

export function chapterAt(progress: number): Chapter {
  for (const [from, chapter] of CHAPTERS) {
    if (progress >= from) return chapter;
  }
  return OPENING_CHAPTER;
}
