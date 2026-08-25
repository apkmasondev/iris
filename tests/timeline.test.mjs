import assert from "node:assert/strict";
import test from "node:test";

import {
  FRAME,
  MASTER_DURATION,
  chapterAt,
  clamp,
  envelope,
  range,
  smooth,
  videoTimeAt,
} from "../src/lib/timeline.ts";

const DURATION = 29.208333; // what scripts/build-media.mjs actually produces

test("clamp / range / smooth stay inside their bounds", () => {
  assert.equal(clamp(-3), 0);
  assert.equal(clamp(3), 1);
  assert.equal(range(5, 0, 10), 0.5);
  assert.equal(range(-5, 0, 10), 0);
  assert.equal(smooth(0), 0);
  assert.equal(smooth(1), 1);
  assert.ok(smooth(0.5) === 0.5);
});

test("envelope opens, holds, then closes", () => {
  assert.equal(envelope(0.1, 0.2, 0.3, 0.5), 0);
  assert.equal(envelope(0.35, 0.2, 0.3, 0.5), 1);
  assert.equal(envelope(0.9, 0.2, 0.3, 0.5), 0);
});

test("videoTimeAt is monotonically increasing across the whole scroll", () => {
  let previous = -1;
  for (let i = 0; i <= 2000; i += 1) {
    const time = videoTimeAt(i / 2000, DURATION);
    assert.ok(time >= previous, `regressed at progress ${i / 2000}`);
    previous = time;
  }
});

test("videoTimeAt never asks for a frame the decoder does not have", () => {
  for (const progress of [-1, 0, 0.5, 1, 2, Number.NaN]) {
    const time = videoTimeAt(progress, DURATION);
    if (Number.isNaN(progress)) continue;
    assert.ok(time >= 0, `negative time at ${progress}`);
    assert.ok(time <= DURATION - FRAME + 1e-9, `overshot duration at ${progress}`);
  }
});

test("act boundaries land on the baked dissolves", () => {
  const scale = DURATION / MASTER_DURATION;
  // The two cross-dissolves sit at 9.6-10.0s and 19.2-19.6s of the master.
  assert.ok(Math.abs(videoTimeAt(0.34, DURATION) - 9.6 * scale) < 1e-6);
  assert.ok(Math.abs(videoTimeAt(0.39, DURATION) - 10.0 * scale) < 1e-6);
  assert.ok(Math.abs(videoTimeAt(0.68, DURATION) - 19.2 * scale) < 1e-6);
  assert.ok(Math.abs(videoTimeAt(0.73, DURATION) - 19.6 * scale) < 1e-6);
});

test("the dissolves are paced slower than the acts around them", () => {
  const secondsPerProgress = (from, to) =>
    (videoTimeAt(to, DURATION) - videoTimeAt(from, DURATION)) / (to - from);
  assert.ok(secondsPerProgress(0.34, 0.39) < secondsPerProgress(0.1, 0.3));
  assert.ok(secondsPerProgress(0.68, 0.73) < secondsPerProgress(0.45, 0.65));
});

test("the opening beat is slow and the tail is a hold", () => {
  const secondsPerProgress = (from, to) =>
    (videoTimeAt(to, DURATION) - videoTimeAt(from, DURATION)) / (to - from);
  // First 6% of scroll covers 0.18s of footage: the shot barely breathes.
  assert.ok(secondsPerProgress(0, 0.06) < secondsPerProgress(0.1, 0.3) / 5);
  // Past 0.97 the frame is locked so the closing copy can land on a still.
  assert.equal(videoTimeAt(0.97, DURATION), videoTimeAt(1, DURATION));
});

test("chapters advance and never skip a step", () => {
  const seen = [];
  for (let i = 0; i <= 1000; i += 1) {
    const { id } = chapterAt(i / 1000);
    if (seen.at(-1) !== id) seen.push(id);
  }
  assert.deepEqual(seen, ["00", "01", "02", "03", "04", "05"]);
});

test("chapter ids and statuses stay paired", () => {
  assert.equal(chapterAt(0).status, "CALIBRATING APERTURE");
  assert.equal(chapterAt(1).status, "CONTACT COMPLETE");
  assert.equal(chapterAt(0.5).id, "02");
});
