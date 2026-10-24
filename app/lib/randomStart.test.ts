import { describe, expect, it } from "vitest";
import { RandomSeedMax, takeRandomStartSeed } from "./randomStart";

describe("takeRandomStartSeed", () => {
  it("consumes a queued game-sync seed exactly once", () => {
    const seedRef = { current: 12345 };
    expect(takeRandomStartSeed(seedRef, () => 0.5)).toBe(12345);
    expect(seedRef.current).toBeNull();
    expect(takeRandomStartSeed(seedRef, () => 0.5)).toBe(Math.floor(RandomSeedMax * 0.5));
  });

  it("draws a different relative position for each new seed", () => {
    const seedRef = { current: null as number | null };
    const draws = [0.1, 0.9];
    const first = takeRandomStartSeed(seedRef, () => draws.shift() as number);
    const second = takeRandomStartSeed(seedRef, () => draws.shift() as number);
    expect(first).not.toBe(second);
  });
});
