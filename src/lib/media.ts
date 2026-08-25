/**
 * Picks which master tier to download.
 *
 * The three tiers are the same 29.2s shot at 960x540 (2.5 MB), 1280x720
 * (4.6 MB) and 1920x1080 (10.3 MB). Only one is ever fetched, which is the
 * single biggest win over the previous build: it shipped all three acts at
 * ~20 Mb/s all-intra to every visitor regardless of screen or connection.
 *
 * Resolved once at module load, before the first paint, so the <video> starts
 * fetching from its very first attribute pass.
 */

const BASE = import.meta.env.BASE_URL;

export const POSTER = `${BASE}video/iris-poster.webp`;

type Tier = 540 | 720 | 1080;

type NetworkInformation = {
  readonly saveData?: boolean;
  readonly effectiveType?: string;
};

const SLOW_NETWORKS = new Set(["slow-2g", "2g", "3g"]);

function pickTier(): Tier {
  if (typeof window === "undefined") return 720;

  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  if (connection?.saveData) return 540;
  if (connection?.effectiveType && SLOW_NETWORKS.has(connection.effectiveType)) return 540;

  const longest = Math.max(window.innerWidth, window.innerHeight);

  if (window.matchMedia("(pointer: coarse)").matches) {
    // Tablets get the full master; phones are judged on physical pixels, since
    // a 3x 6" panel genuinely resolves more than a 540p upscale can hide.
    if (longest >= 1000) return 1080;
    return longest * Math.min(window.devicePixelRatio || 1, 2) >= 1500 ? 720 : 540;
  }

  // Desktop: DPR is a poor signal (a 4K panel usually reports 1), so go by the
  // CSS box the video actually has to cover.
  if (longest >= 1400) return 1080;
  return longest >= 900 ? 720 : 540;
}

export const MASTER_SRC = `${BASE}video/iris-master-${pickTier()}.mp4`;
