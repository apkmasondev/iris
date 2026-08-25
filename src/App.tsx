import { useCallback, useEffect, useRef, useState } from "react";
import { createWriter } from "./lib/dom.ts";
import { MASTER_SRC, POSTER } from "./lib/media.ts";
import { chapterAt, clamp, envelope, fadeOut, range, smooth } from "./lib/timeline.ts";
import { createScrubber } from "./lib/scrubber.ts";

/** Buffered fraction that is enough to start; the rest keeps arriving behind the scenes. */
const BUFFER_TO_START = 0.5;
/** Tell the visitor something is wrong, but keep waiting. */
const SLOW_LOAD_MS = 9000;
/** Give up waiting and show the experience with whatever has arrived. */
const HARD_RELEASE_MS = 16000;
/** Loader hold once we hit 100%, so the readout is legible rather than a flicker. */
const RELEASE_HOLD_MS = 360;

export default function App() {
  const trackRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const progressBarRef = useRef<HTMLSpanElement>(null);
  const progressNumberRef = useRef<HTMLSpanElement>(null);
  const statusRef = useRef<HTMLSpanElement>(null);
  const chapterRef = useRef<HTMLSpanElement>(null);
  const loaderBarRef = useRef<HTMLSpanElement>(null);
  const loaderNumberRef = useRef<HTMLElement>(null);

  const introRef = useRef<HTMLDivElement>(null);
  const openRef = useRef<HTMLDivElement>(null);
  const inwardRef = useRef<HTMLDivElement>(null);
  const responseRef = useRef<HTMLDivElement>(null);
  const finalRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);

  const releaseTimerRef = useRef<number | null>(null);

  // All React state here is load state and preferences: a handful of renders
  // for the entire session, none of them driven by scrolling. Everything the
  // animation loop touches is written straight to the DOM through refs, so a
  // 120 Hz scroll never enters the React scheduler.
  const [booting, setBooting] = useState(true);
  const [slowLoad, setSlowLoad] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  const release = useCallback(() => {
    if (releaseTimerRef.current !== null) return;
    releaseTimerRef.current = window.setTimeout(() => {
      releaseTimerRef.current = null;
      setBooting(false);
    }, RELEASE_HOLD_MS);
  }, []);

  const updateLoader = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const { duration } = video;
    let fraction = 0;
    if (Number.isFinite(duration) && duration > 0 && video.buffered.length > 0) {
      fraction = clamp(video.buffered.end(video.buffered.length - 1) / duration);
    } else if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      fraction = 0.06;
    }

    const enough =
      video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA && fraction >= BUFFER_TO_START;
    const shown = enough ? 1 : Math.min(fraction / BUFFER_TO_START, 0.99);

    if (loaderNumberRef.current) {
      loaderNumberRef.current.textContent = String(Math.round(shown * 100)).padStart(3, "0");
    }
    if (loaderBarRef.current) {
      loaderBarRef.current.style.transform = `scaleX(${shown.toFixed(3)})`;
    }
    if (enough) release();
  }, [release]);

  // Keep the reduced-motion preference live: switching it mid-session rebuilds
  // the scrubber below rather than leaving a half-animated timeline behind.
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    // A failed master is terminal: hold the loader as a deliberate end state
    // rather than releasing the visitor into an empty black page.
    if (!booting || failed) return;
    const slow = window.setTimeout(() => setSlowLoad(true), SLOW_LOAD_MS);
    const hard = window.setTimeout(() => {
      setSlowLoad(true);
      setBooting(false);
    }, HARD_RELEASE_MS);
    return () => {
      window.clearTimeout(slow);
      window.clearTimeout(hard);
    };
  }, [booting, failed]);

  useEffect(
    () => () => {
      if (releaseTimerRef.current !== null) window.clearTimeout(releaseTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    const track = trackRef.current;
    const stage = stageRef.current;
    const video = videoRef.current;
    if (!track || !stage || !video) return;

    const write = createWriter();
    const copy = {
      intro: introRef.current,
      open: openRef.current,
      inward: inwardRef.current,
      response: responseRef.current,
      final: finalRef.current,
      cta: ctaRef.current,
    };

    const setCopy = (element: HTMLDivElement | null, opacity: number, drift: number) => {
      write.style(element, "opacity", opacity.toFixed(3));
      write.style(element, "transform", `translate3d(0,${drift.toFixed(2)}px,0)`);
    };

    const render = (progress: number) => {
      const reveal = smooth(range(progress, 0.005, 0.045));
      const signal = smooth(range(progress, 0.78, 0.975));

      write.style(video, "opacity", reveal.toFixed(3));
      write.variable(stage, "--progress", progress.toFixed(4));
      write.variable(stage, "--signal", signal.toFixed(4));
      write.variable(stage, "--reticle", (1 - smooth(range(progress, 0.18, 0.72))).toFixed(4));

      setCopy(copy.intro, reducedMotion ? 0 : fadeOut(progress, 0.12), -8 * progress);
      setCopy(
        copy.open,
        reducedMotion ? 0 : envelope(progress, 0.14, 0.19, 0.29),
        -9 * range(progress, 0.14, 0.34),
      );
      setCopy(
        copy.inward,
        reducedMotion ? 0 : envelope(progress, 0.36, 0.42, 0.53),
        -10 * range(progress, 0.36, 0.6),
      );
      setCopy(
        copy.response,
        reducedMotion ? 0 : envelope(progress, 0.6, 0.67, 0.78),
        -9 * range(progress, 0.6, 0.85),
      );
      setCopy(copy.final, reducedMotion ? 1 : smooth(range(progress, 0.85, 0.93)), 6 * (1 - signal));

      const cta = reducedMotion ? 1 : smooth(range(progress, 0.92, 0.985));
      setCopy(copy.cta, cta, 5 * (1 - signal));
      write.style(copy.cta, "pointer-events", cta > 0.35 ? "auto" : "none");
      // Keep the replay button out of the tab order while it is invisible.
      write.style(copy.cta, "visibility", cta > 0.01 ? "visible" : "hidden");

      write.style(
        progressBarRef.current,
        "transform",
        `scaleY(${Math.max(progress, 0.004).toFixed(4)})`,
      );
      write.text(progressNumberRef.current, String(Math.round(progress * 100)).padStart(3, "0"));

      const chapter = chapterAt(progress);
      write.text(chapterRef.current, chapter.id);
      write.text(statusRef.current, chapter.status);
    };

    const scrubber = createScrubber({ track, stage, video, onRender: render, reducedMotion });
    return () => scrubber.destroy();
  }, [reducedMotion]);

  // Desktop-only pointer parallax. `(pointer: fine)` keeps the listener off
  // touch devices entirely instead of attaching one that never usefully fires.
  useEffect(() => {
    if (reducedMotion || !window.matchMedia("(pointer: fine)").matches) return;
    const stage = stageRef.current;
    if (!stage) return;

    let handle: number | null = null;
    let x = 0;
    let y = 0;

    const apply = () => {
      handle = null;
      stage.style.setProperty("--copy-x", `${x.toFixed(2)}px`);
      stage.style.setProperty("--copy-y", `${y.toFixed(2)}px`);
    };

    const move = (event: PointerEvent) => {
      x = (event.clientX / window.innerWidth - 0.5) * 5;
      y = (event.clientY / window.innerHeight - 0.5) * 5;
      if (handle === null) handle = window.requestAnimationFrame(apply);
    };

    window.addEventListener("pointermove", move, { passive: true });
    return () => {
      window.removeEventListener("pointermove", move);
      if (handle !== null) cancelAnimationFrame(handle);
    };
  }, [reducedMotion]);

  const scrollToEnd = () => {
    const track = trackRef.current;
    const stage = stageRef.current;
    if (!track || !stage) return;
    window.scrollTo({
      top: track.offsetTop + track.offsetHeight - stage.offsetHeight,
      behavior: "auto",
    });
  };

  const replay = () => {
    window.scrollTo({
      top: trackRef.current?.offsetTop ?? 0,
      behavior: reducedMotion ? "auto" : "smooth",
    });
  };

  return (
    <main>
      <button className="skip-link" type="button" onClick={scrollToEnd}>
        Skip to final message
      </button>

      <section
        ref={trackRef}
        className={`experience${reducedMotion ? " is-reduced" : ""}`}
        aria-label="The Iris cinematic experience"
      >
        <div ref={stageRef} className="stage">
          <div className="video-field" aria-hidden="true">
            <video
              ref={videoRef}
              className="iris-video"
              src={MASTER_SRC}
              poster={POSTER}
              muted
              playsInline
              preload="auto"
              tabIndex={-1}
              disablePictureInPicture
              disableRemotePlayback
              onLoadedMetadata={updateLoader}
              onLoadedData={updateLoader}
              onProgress={updateLoader}
              onCanPlayThrough={updateLoader}
              onError={() => setFailed(true)}
            />
          </div>

          <div className="vignette" aria-hidden="true" />
          <div className="grain" aria-hidden="true" />
          <div className="signal-flare" aria-hidden="true" />

          <div className="frame" aria-hidden="true">
            <i className="corner corner--tl" />
            <i className="corner corner--tr" />
            <i className="corner corner--bl" />
            <i className="corner corner--br" />
            <div className="reticle"><span /></div>
          </div>

          <header className="system-header">
            <div className="system-mark">
              <span className="system-index">I—01</span>
              <span>THE IRIS</span>
            </div>
            <div className="system-mode">
              <span>OPTICAL EVENT</span>
              <span className="live-dot">LIVE</span>
            </div>
          </header>

          <div className="chapter" aria-hidden="true">
            <span>CH.</span>
            <span ref={chapterRef}>00</span>
          </div>

          <div className="copy-layer">
            <div className="scene-copy scene-copy--intro" ref={introRef}>
              <p>VISUAL EXPERIMENT / 01</p>
              <h1>LOOK<br />CLOSER</h1>
            </div>

            <div className="scene-copy scene-copy--open" ref={openRef}>
              <p>APERTURE RESPONSE</p>
              <h2>THE DARKNESS<br />OPENS</h2>
            </div>

            <div className="scene-copy scene-copy--inward" ref={inwardRef}>
              <p>PROXIMITY / UNKNOWN</p>
              <h2>YOU ARE NOT<br />LOOKING IN</h2>
            </div>

            <div className="scene-copy scene-copy--response" ref={responseRef}>
              <p>SIGNAL / RECIPROCAL</p>
              <h2>IT IS LOOKING<br />BACK</h2>
            </div>

            <div className="scene-copy scene-copy--final" ref={finalRef}>
              <p>OBSERVATION COMPLETE</p>
              <h2>YOU HAVE<br />BEEN SEEN</h2>
            </div>

            <div className="final-action" ref={ctaRef}>
              <span className="action-line" aria-hidden="true" />
              <button type="button" onClick={replay}>
                REPLAY THE ENCOUNTER <span aria-hidden="true">↗</span>
              </button>
            </div>
          </div>

          <footer className="system-footer">
            <div className="coordinates" aria-hidden="true">
              <span>SIGNAL: LOCKED</span>
              <span>ORIGIN: UNKNOWN</span>
            </div>
            <div className="system-status">
              <span className="status-pulse" aria-hidden="true" />
              <span ref={statusRef}>CALIBRATING APERTURE</span>
            </div>
            <span className="scroll-instruction">SCROLL TO OBSERVE</span>
          </footer>

          <div className="progress" aria-hidden="true">
            <span className="progress-number" ref={progressNumberRef}>000</span>
            <span className="progress-track"><span ref={progressBarRef} /></span>
            <span className="progress-end">100</span>
          </div>

          <p className="sr-only">
            An interactive cinematic sequence reveals a mechanical iris opening into a distant
            signal. The signal responds, observes the viewer, and ends with the message: you have
            been seen.
          </p>
        </div>
      </section>

      <div className={`loader${booting ? "" : " loader--complete"}`} aria-busy={booting && !failed}>
        <span className="sr-only" aria-live="polite">
          {failed
            ? "The cinematic experience could not be loaded."
            : booting
              ? "Loading the cinematic experience."
              : "The cinematic experience is ready."}
        </span>
        <div className="loader-core" aria-hidden="true"><span /></div>
        <div className="loader-readout" aria-hidden="true">
          <span>CALIBRATING OPTICS</span>
          <strong ref={loaderNumberRef}>000</strong>
        </div>
        <div className="loader-track" aria-hidden="true"><span ref={loaderBarRef} /></div>
        {failed ? (
          <p role="alert">Signal lost. The aperture could not be reached.</p>
        ) : (
          slowLoad && booting && <p role="status">Signal delayed. Loading the aperture…</p>
        )}
      </div>
    </main>
  );
}
