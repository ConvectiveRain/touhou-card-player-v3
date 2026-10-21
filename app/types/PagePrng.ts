class PagePRNG {
  static seed: number = 0;
  private state: number;

  constructor() {
    if (PagePRNG.seed === 0) {
      PagePRNG.seed = Math.floor(Date.now() * 2147483647);
    }
    this.state = PagePRNG.seed;
  }

  next(): number {
    // Linear congruential generator (LCG) algorithm
    this.state = (this.state * 48271) % 2147483647;
    return this.state;
  }

  static hash(str: string | null | undefined): number {
    if (str === null || str === undefined) {
      return 0;
    }
    // Hashing is used during SSR too. It must not depend on the time-seeded PRNG state,
    // otherwise the server and client render different text/style values and React reports a
    // hydration mismatch. FNV-1a gives both sides the same stable value for the same string.
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash % 2147483647;
  }
}

export { PagePRNG };
