#!/usr/bin/env node
/**
 * Media pipeline for THE IRIS.
 *
 * Takes the three 1080p24 all-intra source clips and bakes them into a single
 * scrub-optimised master, in three resolution tiers plus a poster frame.
 *
 * Why one master instead of three clips:
 *   - one <video> element == one hardware decoder (mobile Safari/Chrome cap
 *     the number of simultaneously decodable videos, and three 1080p decoders
 *     is where the old build fell over),
 *   - the two cross-dissolves are baked in, so the runtime timeline collapses
 *     to a single monotonic progress -> time map,
 *   - only the tier the device actually needs is ever downloaded.
 *
 * Why these encoder flags:
 *   -g 12 -keyint_min 12 -sc_threshold 0  keyframe every 0.5s. GOP1 (every
 *      frame a keyframe) made seeks free but cost ~20 Mb/s; a 12-frame closed
 *      GOP costs at most 12 decoded frames per seek, which is sub-millisecond
 *      on any hardware decoder, and cuts the bitrate by an order of magnitude.
 *   -bf 0  no B-frames: no reordering, so decode latency after a seek is
 *      deterministic and playbackRate scrubbing never stalls on a future ref.
 *   hqdn3d  the sources carry heavy fine dither (the price of dark gradients
 *      out of a generative renderer) which is what actually blew the bitrate
 *      up. It is removed here and re-applied for free by the CSS grain layer.
 *   -movflags +faststart  moov atom up front, so the browser can seek before
 *      the whole file has arrived.
 *
 * Usage: node scripts/build-media.mjs [--force]
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = (name) => resolve(root, "media/source", name);
const out = (name) => resolve(root, "assets/video", name);

const SOURCES = ["01-iris-opening.mp4", "02-iris-signal.mp4", "03-iris-response.mp4"];
const XFADE = 0.4; // seconds of cross-dissolve between consecutive acts
const CLIP = 10; // seconds per source clip
const DENOISE = "hqdn3d=6:4:9:9";

/** Keep in sync with MASTER_DURATION in src/lib/timeline.ts. */
const MASTER_DURATION = SOURCES.length * CLIP - (SOURCES.length - 1) * XFADE; // 29.2

const TIERS = [
  { name: "iris-master-1080.mp4", scale: "1920:1080", crf: 26 },
  { name: "iris-master-720.mp4", scale: "1280:720", crf: 26 },
  { name: "iris-master-540.mp4", scale: "960:540", crf: 27 },
];

const force = process.argv.includes("--force");

function ffmpeg(args) {
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], {
    stdio: ["ignore", "inherit", "inherit"],
  });
}

/** Normalise timebases, then chain the cross-dissolves into one continuous shot. */
function concatGraph() {
  const parts = SOURCES.map(
    (_, i) => `[${i}:v]settb=AVTB,fps=24,format=yuv420p[v${i}]`,
  );
  let label = "v0";
  for (let i = 1; i < SOURCES.length; i += 1) {
    // Output duration after i clips is i*CLIP - (i-1)*XFADE; the next
    // dissolve starts XFADE before that edge.
    const offset = i * CLIP - i * XFADE;
    const next = `x${i}`;
    parts.push(
      `[${label}][v${i}]xfade=transition=fade:duration=${XFADE}:offset=${offset}[${next}]`,
    );
    label = next;
  }
  return { parts, label };
}

function encodeTier({ name, scale, crf }) {
  const target = out(name);
  if (!force && existsSync(target)) {
    console.log(`skip   ${name} (exists, pass --force to rebuild)`);
    return;
  }
  const { parts, label } = concatGraph();
  const graph = [...parts, `[${label}]${DENOISE},scale=${scale}:flags=lanczos,format=yuv420p[out]`].join(";");

  ffmpeg([
    ...SOURCES.flatMap((file) => ["-i", src(file)]),
    "-filter_complex", graph,
    "-map", "[out]",
    "-c:v", "libx264",
    "-profile:v", "high",
    "-level", "4.0",
    "-preset", "slow",
    "-crf", String(crf),
    "-g", "12",
    "-keyint_min", "12",
    "-sc_threshold", "0",
    "-bf", "0",
    "-x264-params", "aq-mode=3:aq-strength=1.1:ref=3",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    "-an",
    target,
  ]);
  const mb = (statSync(target).size / 1e6).toFixed(1);
  console.log(`built  ${name}  ${mb} MB`);
}

function encodePoster() {
  const target = out("iris-poster.webp");
  if (!force && existsSync(target)) {
    console.log("skip   iris-poster.webp (exists)");
    return;
  }
  // Frame 0 of act one, so the poster is exactly what the first painted frame
  // will be and swapping poster -> video is invisible.
  ffmpeg([
    "-i", src(SOURCES[0]),
    "-frames:v", "1",
    "-vf", `${DENOISE},scale=960:540:flags=lanczos`,
    "-c:v", "libwebp",
    "-quality", "72",
    target,
  ]);
  console.log(`built  iris-poster.webp  ${(statSync(target).size / 1e3).toFixed(1)} kB`);
}

function encodeSocialCard() {
  const target = resolve(root, "assets/og.jpg");
  if (!force && existsSync(target)) {
    console.log("skip   og.jpg (exists)");
    return;
  }
  ffmpeg([
    "-i", src(SOURCES[2]),
    "-ss", "8",
    "-frames:v", "1",
    "-vf", "scale=1200:675:flags=lanczos,crop=1200:630",
    "-q:v", "4",
    target,
  ]);
  console.log(`built  og.jpg  ${(statSync(target).size / 1e3).toFixed(1)} kB`);
}

for (const file of SOURCES) {
  if (!existsSync(src(file))) {
    console.error(`missing source: media/source/${file}`);
    process.exit(1);
  }
}
mkdirSync(resolve(root, "assets/video"), { recursive: true });

console.log(`master duration: ${MASTER_DURATION}s (${SOURCES.length} x ${CLIP}s, ${XFADE}s dissolves)`);
TIERS.forEach(encodeTier);
encodePoster();
encodeSocialCard();
