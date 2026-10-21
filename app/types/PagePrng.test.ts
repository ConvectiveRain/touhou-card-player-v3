import { describe, expect, it } from "vitest";
import { PagePRNG } from "./PagePrng";

describe("PagePRNG", () => {
  it("hashes the same string deterministically across calls", () => {
    const first = PagePRNG.hash("Alice");
    const second = PagePRNG.hash("Alice");
    expect(first).toBe(second);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(2147483647);
  });

  it("keeps the time-seeded generator separate from stable hashing", () => {
    const hash = PagePRNG.hash("Alice");
    const generator = new PagePRNG();
    generator.next();
    expect(PagePRNG.hash("Alice")).toBe(hash);
  });
});
