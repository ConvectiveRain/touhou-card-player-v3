export const RandomSeedMax = 2147483647;

type MutableSeed = { current: number | null };

/**
 * Consumes a seed queued by the game sync, or draws a fresh one.
 *
 * The queued seed is deliberately one-shot. Keeping it in place after use made every
 * track seek to the same relative position, which made "Random Start" look broken.
 */
export function takeRandomStartSeed(
  seedRef: MutableSeed,
  random: () => number = Math.random,
): number {
  const seed = seedRef.current ?? Math.floor(random() * RandomSeedMax);
  seedRef.current = null;
  return seed;
}
