/**
 * Minimal DOM/media stubs for exercising the scrubber without a browser.
 *
 * The engine only touches a handful of platform APIs, all of them at call time
 * rather than module scope, so installing globals before `createScrubber` runs
 * is enough to drive the real code path — including the actual play/seek
 * decisions, which is the part worth testing.
 */

export class FakeVideo {
  constructor(duration = 29.208333) {
    this.duration = duration;
    this.paused = true;
    this.playbackRate = 1;
    this.seeking = false;
    this.readyState = 4;
    this.style = { setProperty() {}, opacity: "" };
    this.seeks = 0;
    this.plays = 0;
    this.listeners = new Map();
    this._currentTime = 0;
  }

  get currentTime() {
    return this._currentTime;
  }

  set currentTime(value) {
    this.seeks += 1;
    this._currentTime = Math.max(0, Math.min(value, this.duration));
  }

  play() {
    if (this.paused) this.plays += 1;
    this.paused = false;
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(handler);
  }

  removeEventListener(type, handler) {
    this.listeners.get(type)?.delete(handler);
  }

  emit(type) {
    for (const handler of this.listeners.get(type) ?? []) handler();
  }

  /** Advance playback by `seconds` of wall clock. */
  advance(seconds) {
    if (this.paused) return;
    this._currentTime = Math.min(this._currentTime + seconds * this.playbackRate, this.duration);
    if (this._currentTime >= this.duration) this.emit("ended");
  }
}

export class FakeElement {
  constructor(height) {
    this.offsetHeight = height;
    this.offsetTop = 0;
    this.style = { setProperty() {} };
  }

  getBoundingClientRect() {
    return { top: this.offsetTop - globalThis.window.scrollY, height: this.offsetHeight };
  }
}

/** Installs the globals the scrubber expects and returns a controllable clock. */
export function installEnvironment() {
  let now = 0;
  let nextHandle = 1;
  const frames = new Map();
  const windowListeners = new Map();
  const documentListeners = new Map();

  const listen = (map) => (type, handler) => {
    if (!map.has(type)) map.set(type, new Set());
    map.get(type).add(handler);
  };
  const unlisten = (map) => (type, handler) => {
    map.get(type)?.delete(handler);
  };

  const fakeWindow = {
    scrollY: 0,
    innerHeight: 900,
    innerWidth: 1440,
    addEventListener: listen(windowListeners),
    removeEventListener: unlisten(windowListeners),
    requestAnimationFrame(callback) {
      const handle = nextHandle++;
      frames.set(handle, callback);
      return handle;
    },
    cancelAnimationFrame(handle) {
      frames.delete(handle);
    },
  };

  const fakeDocument = {
    hidden: false,
    addEventListener: listen(documentListeners),
    removeEventListener: unlisten(documentListeners),
  };

  globalThis.window = fakeWindow;
  globalThis.document = fakeDocument;
  globalThis.performance = { now: () => now };
  globalThis.cancelAnimationFrame = fakeWindow.cancelAnimationFrame;
  globalThis.requestAnimationFrame = fakeWindow.requestAnimationFrame;
  globalThis.HTMLMediaElement = { HAVE_METADATA: 1, HAVE_CURRENT_DATA: 2, HAVE_FUTURE_DATA: 3 };
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  return {
    get now() {
      return now;
    },
    /** Drop back to the top of the document without notifying anyone. */
    reset() {
      fakeWindow.scrollY = 0;
      frames.clear();
    },
    /** Move `window.scrollY` and fire the scroll event, as a browser would. */
    scrollTo(y) {
      fakeWindow.scrollY = y;
      for (const handler of windowListeners.get("scroll") ?? []) handler();
    },
    /** Advance the clock by one frame, playing the video and running callbacks. */
    frame(video, ms = 16) {
      now += ms;
      video?.advance(ms / 1000);
      const pending = [...frames.entries()];
      frames.clear();
      for (const [, callback] of pending) callback(now);
      return pending.length;
    },
    /** Run frames until the loop stops asking for more, or `limit` is hit. */
    settle(video, limit = 600) {
      let ran = 0;
      while (ran < limit && this.frame(video) > 0) ran += 1;
      return ran;
    },
  };
}
