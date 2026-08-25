import assert from "node:assert/strict";
import test from "node:test";

import { FakeElement, FakeVideo, installEnvironment } from "./harness.mjs";

const clock = installEnvironment();

// Imported after the globals exist, matching how the module runs in a browser.
const { createScrubber } = await import("../src/lib/scrubber.ts");
const { FRAME, videoTimeAt } = await import("../src/lib/timeline.ts");

const TRACK_HEIGHT = 9360; // 1040svh at a 900px viewport
const STAGE_HEIGHT = 900;
const DISTANCE = TRACK_HEIGHT - STAGE_HEIGHT;

function mount({ reducedMotion = false } = {}) {
  // Tests share one fake window, so every mount starts from the top.
  clock.reset();
  const track = new FakeElement(TRACK_HEIGHT);
  const stage = new FakeElement(STAGE_HEIGHT);
  const video = new FakeVideo();
  const rendered = [];

  const scrubber = createScrubber({
    track,
    stage,
    video,
    reducedMotion,
    onRender: (progress) => rendered.push(progress),
  });

  return { track, stage, video, rendered, scrubber };
}

/** Scroll to `progress` the way a finger does — in steps, not one jump. */
function scrollTo(video, progress, steps = 24) {
  const from = globalThis.window.scrollY;
  const to = progress * DISTANCE;
  for (let i = 1; i <= steps; i += 1) {
    clock.scrollTo(from + ((to - from) * i) / steps);
    clock.frame(video);
  }
  clock.settle(video);
}

test("settles on the exact frame the timeline asks for", (t) => {
  const { video, scrubber } = mount();
  t.after(() => scrubber.destroy());

  for (const progress of [0.2, 0.5, 0.75, 0.95, 1]) {
    scrollTo(video, progress);
    const expected = videoTimeAt(progress, video.duration);
    assert.ok(
      Math.abs(video.currentTime - expected) <= FRAME,
      `progress ${progress}: got ${video.currentTime.toFixed(3)}, want ${expected.toFixed(3)}`,
    );
  }
});

test("a hand-speed scroll rides playback instead of seeking", (t) => {
  const { video, scrubber } = mount();
  t.after(() => scrubber.destroy());

  // 20% of the track over ~1.4s: roughly 3x playback, which is what a
  // comfortable two-finger scroll actually asks of the timeline.
  scrollTo(video, 0.2, 90);

  assert.ok(video.plays > 0, "never started playback");
  // A seek-per-frame implementation would be in the dozens here; what remains
  // is the final snap onto an exact frame once the scroll comes to rest.
  assert.ok(video.seeks <= 3, `seeked ${video.seeks} times while scrolling forward`);
  t.diagnostic(`plays=${video.plays} seeks=${video.seeks}`);
});

test("a fast fling falls back to seeking, and still lands on the right frame", (t) => {
  const { video, scrubber } = mount();
  t.after(() => scrubber.destroy());

  // Past ~4x playback the decoder cannot keep up by playing, so the engine is
  // expected to give up on smoothness and jump.
  scrollTo(video, 0.9, 8);

  assert.ok(video.seeks > 0, "tried to play through a fling");
  const expected = videoTimeAt(0.9, video.duration);
  assert.ok(
    Math.abs(video.currentTime - expected) <= FRAME,
    `landed on ${video.currentTime.toFixed(3)}, want ${expected.toFixed(3)}`,
  );
});

test("scrolling backwards seeks, because playback cannot run in reverse", (t) => {
  const { video, scrubber } = mount();
  t.after(() => scrubber.destroy());

  scrollTo(video, 0.8);
  const before = video.seeks;
  scrollTo(video, 0.3);

  assert.ok(video.seeks > before, "did not seek while scrolling backwards");
  const expected = videoTimeAt(0.3, video.duration);
  assert.ok(Math.abs(video.currentTime - expected) <= FRAME);
});

test("leaves the video paused once the scroll comes to rest", (t) => {
  const { video, scrubber } = mount();
  t.after(() => scrubber.destroy());

  scrollTo(video, 0.45);
  assert.equal(video.paused, true);
});

test("a hidden document stops the loop instead of spinning", (t) => {
  const { video, scrubber } = mount();
  t.after(() => {
    globalThis.document.hidden = false;
    scrubber.destroy();
  });

  scrollTo(video, 0.3);
  const settled = video.currentTime;

  globalThis.document.hidden = true;
  clock.scrollTo(0.7 * DISTANCE);
  clock.settle(video);

  assert.equal(video.paused, true, "kept playing in a hidden tab");
  assert.equal(video.currentTime, settled, "kept decoding in a hidden tab");
});

test("reduced motion pins the last frame and never animates", (t) => {
  const { video, rendered, scrubber } = mount({ reducedMotion: true });
  t.after(() => scrubber.destroy());

  clock.settle(video);
  assert.ok(Math.abs(video.currentTime - (video.duration - FRAME)) <= FRAME);
  assert.ok(rendered.every((progress) => progress === 1));

  scrollTo(video, 0.2);
  assert.ok(rendered.every((progress) => progress === 1), "reduced motion followed the scroll");
});

test("destroy releases every listener and stops the loop", (t) => {
  const { video, rendered, scrubber } = mount();
  scrollTo(video, 0.4);

  scrubber.destroy();
  const renders = rendered.length;
  const time = video.currentTime;

  clock.scrollTo(0.9 * DISTANCE);
  clock.settle(video);

  assert.equal(rendered.length, renders, "still rendering after destroy");
  assert.equal(video.currentTime, time, "still scrubbing after destroy");
  assert.equal(video.listeners.get("loadedmetadata").size, 0);
  assert.equal(video.listeners.get("ended").size, 0);
  t.diagnostic(`renders during the run: ${renders}`);
});
