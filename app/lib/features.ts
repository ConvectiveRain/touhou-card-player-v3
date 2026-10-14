/**
 * URL query-parameter feature flags, read once and cached.
 *
 * These used to be re-parsed inside individual components (and, for `r2`, assigned to a
 * module global from a `useEffect` — which meant the very first paint used the local card
 * prefix). Reading them eagerly keeps the value stable for the whole session.
 */

export type FeatureFlags = {
  /** `?g` — render cards with a pseudo-random tilt. */
  glitch: boolean;
  /** `?r2` — load card images from the Cloudflare R2 bucket instead of the local copies. */
  useR2: boolean;
  /** `?locale=en|zh` — explicit locale override. */
  locale: string | null;
  /** `?cheatcode=...` — enables cheat mode when it matches. */
  cheatcode: string | null;
};

const NoFeatures: FeatureFlags = {
  glitch: false,
  useR2: false,
  locale: null,
  cheatcode: null,
};

export function readFeaturesFromSearch(search: string): FeatureFlags {
  const params = new URLSearchParams(search);
  return {
    glitch: params.get("g") !== null,
    useR2: params.get("r2") !== null,
    locale: params.get("locale"),
    cheatcode: params.get("cheatcode"),
  };
}

let cachedFeatures: FeatureFlags | null = null;

export function getFeatures(): FeatureFlags {
  if (cachedFeatures === null) {
    cachedFeatures = typeof window === "undefined"
      ? NoFeatures
      : readFeaturesFromSearch(window.location.search);
  }
  return cachedFeatures;
}

/** Test seam: forces the next {@link getFeatures} call to re-read the URL. */
export function resetFeaturesCache(): void {
  cachedFeatures = null;
}
