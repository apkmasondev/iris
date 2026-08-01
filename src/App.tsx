import { useCallback, useEffect, useRef, useState } from "react";

const VIDEO_ONE = `${import.meta.env.BASE_URL}video/01-iris-opening-gop1.mp4`;
const VIDEO_TWO = `${import.meta.env.BASE_URL}video/02-iris-signal-gop1.mp4`;
const VIDEO_THREE = `${import.meta.env.BASE_URL}video/03-iris-response-gop1.mp4`;
const FRAME_DURATION = 1 / 24;

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

const range = (value: number, from: number, to: number) =>
  clamp((value - from) / (to - from));

const smooth = (value: number) => value * value * (3 - 2 * value);

const envelope = (value: number, enter: number, hold: number, exit: number) => {
  const fadeIn = smooth(range(value, enter, hold));
  const fadeOut = 1 - smooth(range(value, exit, Math.min(exit + 0.07, 1)));
  return Math.min(fadeIn, fadeOut);
};

type CopyRefs = {
  intro: HTMLDivElement | null;
  open: HTMLDivElement | null;
  inward: HTMLDivElement | null;
  response: HTMLDivElement | null;
  final: HTMLDivElement | null;
  cta: HTMLDivElement | null;
};

export default function App() {
  const experienceRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const firstVideoRef = useRef<HTMLVideoElement>(null);
  const secondVideoRef = useRef<HTMLVideoElement>(null);
  const thirdVideoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLSpanElement>(null);
  const progressNumberRef = useRef<HTMLSpanElement>(null);
  const statusRef = useRef<HTMLSpanElement>(null);
  const chapterRef = useRef<HTMLSpanElement>(null);
  const copyRefs = useRef<CopyRefs>({
    intro: null,
    open: null,
    inward: null,
    response: null,
    final: null,
    cta: null,
  });
  const targetTimes = useRef([0, 0, 0]);
  const videoReady = useRef([false, false, false]);
  const rafRef = useRef<number | null>(null);
  const readyTimerRef = useRef<number | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);
  const [booting, setBooting] = useState(true);
  const [slowLoad, setSlowLoad] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const updateLoader = useCallback(() => {
    const videos = [firstVideoRef.current, secondVideoRef.current, thirdVideoRef.current];
    const amount = videos.reduce((sum, video) => {
      if (!video || !Number.isFinite(video.duration) || video.duration <= 0) {
        return sum;
      }
      if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) return sum + 1;
      if (video.buffered.length > 0) {
        return sum + clamp(video.buffered.end(video.buffered.length - 1) / video.duration);
      }
      return sum + 0.04;
    }, 0);
    setLoadProgress(Math.round((amount / videos.length) * 100));
  }, []);

  const markReady = useCallback(
    (index: number, video: HTMLVideoElement) => {
      if (videoReady.current[index]) return;
      videoReady.current[index] = true;
      updateLoader();

      if (reducedMotion && index === 2 && video.duration > 0) {
        video.currentTime = Math.max(0, video.duration - FRAME_DURATION);
      }

      if (videoReady.current.every(Boolean) && readyTimerRef.current === null) {
        setLoadProgress(100);
        readyTimerRef.current = window.setTimeout(() => {
          readyTimerRef.current = null;
          setBooting(false);
        }, 380);
      }
    },
    [reducedMotion, updateLoader],
  );

  const warmVideo = useCallback((video: HTMLVideoElement) => {
    if (video.duration > 0 && video.currentTime === 0) {
      video.currentTime = Math.min(0.001, video.duration);
      requestAnimationFrame(() => {
        if (!reducedMotion) video.currentTime = 0;
      });
    }
    updateLoader();
  }, [reducedMotion, updateLoader]);

  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotion(motionQuery.matches);
    updateMotion();
    motionQuery.addEventListener("change", updateMotion);

    return () => motionQuery.removeEventListener("change", updateMotion);
  }, []);

  useEffect(() => {
    if (!booting) return;

    const fallback = window.setTimeout(() => {
      if (videoReady.current[0]) {
        setSlowLoad(true);
        setBooting(false);
      } else {
        setSlowLoad(true);
      }
    }, 12000);
    const hardFallback = window.setTimeout(() => {
      setSlowLoad(true);
      setBooting(false);
    }, 20000);

    return () => {
      window.clearTimeout(fallback);
      window.clearTimeout(hardFallback);
    };
  }, [booting]);

  useEffect(() => () => {
    if (readyTimerRef.current !== null) window.clearTimeout(readyTimerRef.current);
  }, []);

  useEffect(() => {
    if (!reducedMotion) return;
    const third = thirdVideoRef.current;
    if (third && Number.isFinite(third.duration) && third.duration > 0) {
      third.currentTime = Math.max(0, third.duration - FRAME_DURATION);
    }
  }, [reducedMotion, loadProgress]);

  useEffect(() => {
    const experience = experienceRef.current;
    const stage = stageRef.current;
    if (!experience || !stage) return;

    const copies = copyRefs.current;
    let animationFrame: number | null = null;
    let targetProgress = 0;
    let renderedProgress = 0;
    let lastFrameTime = performance.now();

    const setCopy = (element: HTMLDivElement | null, opacity: number, drift = 0) => {
      if (!element) return;
      element.style.opacity = opacity.toFixed(3);
      element.style.transform = `translate3d(0, ${drift.toFixed(2)}px, 0)`;
    };

    const measureProgress = () => {
      const rect = experience.getBoundingClientRect();
      const distance = Math.max(experience.offsetHeight - window.innerHeight, 1);
      return reducedMotion ? 1 : clamp(-rect.top / distance);
    };

    const render = (progress: number) => {

      const firstCrossfade = smooth(range(progress, 0.3, 0.36));
      const secondCrossfade = smooth(range(progress, 0.6, 0.67));
      const reveal = smooth(range(progress, 0.005, 0.045));
      const finalSignal = smooth(range(progress, 0.78, 0.975));
      const firstOpacity = reveal * (1 - firstCrossfade);
      const secondOpacity = firstCrossfade * (1 - secondCrossfade);
      const thirdOpacity = secondCrossfade;

      const first = firstVideoRef.current;
      const second = secondVideoRef.current;
      const third = thirdVideoRef.current;
      if (first) {
        first.style.opacity = firstOpacity.toFixed(3);
        targetTimes.current[0] = range(progress, 0.04, 0.34) * (first.duration || 0);
      }
      if (second) {
        second.style.opacity = secondOpacity.toFixed(3);
        targetTimes.current[1] = range(progress, 0.34, 0.64) * (second.duration || 0);
      }
      if (third) {
        third.style.opacity = thirdOpacity.toFixed(3);
        targetTimes.current[2] = range(progress, 0.64, 0.91) * (third.duration || 0);
      }

      stage.style.setProperty("--progress", progress.toFixed(4));
      stage.style.setProperty("--signal", finalSignal.toFixed(4));
      stage.style.setProperty("--reticle", (1 - smooth(range(progress, 0.18, 0.72))).toFixed(4));

      setCopy(copies.intro, reducedMotion ? 0 : envelope(progress, 0.012, 0.04, 0.12), -8 * progress);
      setCopy(copies.open, reducedMotion ? 0 : envelope(progress, 0.14, 0.19, 0.29), -9 * range(progress, 0.14, 0.34));
      setCopy(copies.inward, reducedMotion ? 0 : envelope(progress, 0.36, 0.42, 0.53), -10 * range(progress, 0.36, 0.6));
      setCopy(copies.response, reducedMotion ? 0 : envelope(progress, 0.6, 0.67, 0.82), -9 * range(progress, 0.6, 0.88));
      setCopy(copies.final, reducedMotion ? 1 : smooth(range(progress, 0.84, 0.93)), 6 * (1 - finalSignal));
      const ctaOpacity = reducedMotion ? 1 : smooth(range(progress, 0.92, 0.985));
      setCopy(copies.cta, ctaOpacity, 5 * (1 - finalSignal));
      if (copies.cta) copies.cta.style.pointerEvents = ctaOpacity > 0.35 ? "auto" : "none";

      if (progressRef.current) progressRef.current.style.transform = `scaleY(${Math.max(progress, 0.004)})`;
      if (progressNumberRef.current) progressNumberRef.current.textContent = String(Math.round(progress * 100)).padStart(3, "0");

      let chapter = "00";
      let status = "CALIBRATING APERTURE";
      if (progress >= 0.04) { chapter = "01"; status = "APERTURE ACTIVE"; }
      if (progress >= 0.34) { chapter = "02"; status = "THRESHOLD CROSSED"; }
      if (progress >= 0.6) { chapter = "03"; status = "RESPONSE DETECTED"; }
      if (progress >= 0.82) { chapter = "04"; status = "OBSERVATION RECIPROCAL"; }
      if (progress >= 0.93) { chapter = "05"; status = "CONTACT COMPLETE"; }
      if (chapterRef.current) chapterRef.current.textContent = chapter;
      if (statusRef.current) statusRef.current.textContent = status;
    };

    const tick = (time: number) => {
      animationFrame = null;
      const elapsed = Math.min(time - lastFrameTime, 64);
      lastFrameTime = time;
      const distance = targetProgress - renderedProgress;
      const easing = 1 - Math.exp(-elapsed / 145);

      renderedProgress = Math.abs(distance) < 0.00004
        ? targetProgress
        : renderedProgress + distance * easing;
      render(renderedProgress);

      if (Math.abs(targetProgress - renderedProgress) >= 0.00004) {
        animationFrame = requestAnimationFrame(tick);
      }
    };

    const schedule = () => {
      targetProgress = measureProgress();
      if (animationFrame !== null) return;
      lastFrameTime = performance.now();
      animationFrame = requestAnimationFrame(tick);
    };

    targetProgress = measureProgress();
    renderedProgress = targetProgress;
    render(renderedProgress);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });

    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);
    };
  }, [reducedMotion]);

  useEffect(() => {
    const updateVideoTimes = () => {
      if (!document.hidden && !reducedMotion) {
        [firstVideoRef.current, secondVideoRef.current, thirdVideoRef.current].forEach((video, index) => {
          if (!video || !videoReady.current[index] || video.seeking) return;
          const maxTime = Math.max(0, (video.duration || 0) - FRAME_DURATION);
          const rawTarget = clamp(targetTimes.current[index], 0, maxTime);
          const difference = rawTarget - video.currentTime;
          if (Math.abs(difference) > FRAME_DURATION * 0.62) {
            const maximumStep = FRAME_DURATION * 2.25;
            const steppedTime = video.currentTime + clamp(difference, -maximumStep, maximumStep);
            const target = Math.round(steppedTime / FRAME_DURATION) * FRAME_DURATION;
            video.currentTime = clamp(target, 0, maxTime);
          }
        });
      }
      rafRef.current = requestAnimationFrame(updateVideoTimes);
    };

    rafRef.current = requestAnimationFrame(updateVideoTimes);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [reducedMotion]);

  useEffect(() => {
    if (reducedMotion || !window.matchMedia("(pointer: fine)").matches) return;
    const stage = stageRef.current;
    if (!stage) return;

    const move = (event: PointerEvent) => {
      const x = (event.clientX / window.innerWidth - 0.5) * 2;
      const y = (event.clientY / window.innerHeight - 0.5) * 2;
      stage.style.setProperty("--pointer-x", x.toFixed(3));
      stage.style.setProperty("--pointer-y", y.toFixed(3));
      stage.style.setProperty("--copy-x", `${(x * 2.5).toFixed(2)}px`);
      stage.style.setProperty("--copy-y", `${(y * 2.5).toFixed(2)}px`);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, [reducedMotion]);

  const jumpToEnd = () => {
    const experience = experienceRef.current;
    if (!experience) return;
    window.scrollTo({
      top: experience.offsetTop + experience.offsetHeight - window.innerHeight,
      behavior: "auto",
    });
  };

  const replay = () => {
    targetTimes.current = [0, 0, 0];
    [firstVideoRef.current, secondVideoRef.current, thirdVideoRef.current].forEach((video) => {
      if (video && video.readyState >= HTMLMediaElement.HAVE_METADATA) video.currentTime = 0;
    });
    window.scrollTo({ top: experienceRef.current?.offsetTop ?? 0, behavior: reducedMotion ? "auto" : "smooth" });
  };

  return (
    <main>
      <button className="skip-link" type="button" onClick={jumpToEnd}>
        Skip to final message
      </button>

      <section
        ref={experienceRef}
        className={`experience${reducedMotion ? " is-reduced" : ""}`}
        aria-label="The Iris cinematic experience"
      >
        <div ref={stageRef} className="stage">
          <div className="video-field" aria-hidden="true">
            <video
              ref={firstVideoRef}
              className="iris-video iris-video--one"
              src={VIDEO_ONE}
              muted
              playsInline
              preload="auto"
              tabIndex={-1}
              onLoadedMetadata={(event) => warmVideo(event.currentTarget)}
              onCanPlay={(event) => markReady(0, event.currentTarget)}
              onProgress={updateLoader}
              onError={() => setSlowLoad(true)}
            />
            <video
              ref={secondVideoRef}
              className="iris-video iris-video--two"
              src={VIDEO_TWO}
              muted
              playsInline
              preload="auto"
              tabIndex={-1}
              onLoadedMetadata={(event) => warmVideo(event.currentTarget)}
              onCanPlay={(event) => markReady(1, event.currentTarget)}
              onProgress={updateLoader}
              onError={() => setSlowLoad(true)}
            />
            <video
              ref={thirdVideoRef}
              className="iris-video iris-video--three"
              src={VIDEO_THREE}
              muted
              playsInline
              preload="auto"
              tabIndex={-1}
              onLoadedMetadata={(event) => warmVideo(event.currentTarget)}
              onCanPlay={(event) => markReady(2, event.currentTarget)}
              onProgress={updateLoader}
              onError={() => setSlowLoad(true)}
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
            <div className="scene-copy scene-copy--intro" ref={(node) => { copyRefs.current.intro = node; }}>
              <p>VISUAL EXPERIMENT / 01</p>
              <h1>LOOK<br />CLOSER</h1>
            </div>

            <div className="scene-copy scene-copy--open" ref={(node) => { copyRefs.current.open = node; }}>
              <p>APERTURE RESPONSE</p>
              <h2>THE DARKNESS<br />OPENS</h2>
            </div>

            <div className="scene-copy scene-copy--inward" ref={(node) => { copyRefs.current.inward = node; }}>
              <p>PROXIMITY / UNKNOWN</p>
              <h2>YOU ARE NOT<br />LOOKING IN</h2>
            </div>

            <div className="scene-copy scene-copy--response" ref={(node) => { copyRefs.current.response = node; }}>
              <p>SIGNAL / RECIPROCAL</p>
              <h2>IT IS LOOKING<br />BACK</h2>
            </div>

            <div className="scene-copy scene-copy--final" ref={(node) => { copyRefs.current.final = node; }}>
              <p>OBSERVATION COMPLETE</p>
              <h2>YOU HAVE<br />BEEN SEEN</h2>
            </div>

            <div className="final-action" ref={(node) => { copyRefs.current.cta = node; }}>
              <span className="action-line" aria-hidden="true" />
              <button type="button" onClick={replay}>REPLAY THE ENCOUNTER <span>↗</span></button>
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
            <span className="progress-track"><span ref={progressRef} /></span>
            <span className="progress-end">100</span>
          </div>

          <p className="sr-only">
            An interactive cinematic sequence reveals a mechanical iris opening into a distant signal. The signal responds, observes the viewer, and ends with the message: you have been seen.
          </p>

          <div className={`loader${booting ? "" : " loader--complete"}`} aria-busy={booting}>
            <span className="sr-only" aria-live="polite">{booting ? "Loading the cinematic experience." : "The cinematic experience is ready."}</span>
            <div className="loader-core" aria-hidden="true"><span /></div>
            <div className="loader-readout" aria-hidden="true">
              <span>CALIBRATING OPTICS</span>
              <strong>{String(loadProgress).padStart(3, "0")}</strong>
            </div>
            <div className="loader-track" aria-hidden="true"><span style={{ transform: `scaleX(${loadProgress / 100})` }} /></div>
            {slowLoad && booting && <p role="status">Signal delayed. Loading the primary aperture…</p>}
          </div>
        </div>
      </section>
    </main>
  );
}
