import { clamp } from "../../lib/math";

/**
 * Tuning for the 1v1 CPU opponent.
 *
 * Reaction time and mistake rate both grow with how crowded the playground is, measured in
 * doublings of the number of cards on it. A full board is scanned more slowly and misread more
 * often than a nearly cleared one, so the opponent sharpens as the game goes on instead of
 * behaving the same on a 1-card board as on a 150-card one.
 */
export type CPUOpponentSetting = {
  /** Seconds of thinking time on a playground holding a single card. */
  reactionTimeBase: number;
  /** Seconds added to the reaction time for every doubling of the cards on the playground. */
  reactionTimePerDoubling: number;
  /** Multiplicative spread of the reaction time: the sigma of a lognormal distribution. */
  reactionTimeSigma: number;
  /** Mistake probability on a playground holding a single card. */
  mistakeRateBase: number;
  /** Mistake probability added for every doubling of the cards on the playground. */
  mistakeRatePerDoubling: number;
};

/** The CPU never errs more often than this, however crowded the playground gets. */
export const MaxMistakeRate = 0.9;
/** Nobody reacts faster than this, so a lucky noise sample cannot either. */
export const MinReactionTime = 0.15;

/**
 * Difficulty of a playground holding `cardCount` cards, in doublings of the count. Zero cards
 * and one card are the same difficulty, so an empty board cannot divide the curve.
 */
export function boardDifficulty(cardCount: number): number {
  return Math.log2(Math.max(cardCount, 1));
}

/** Mean thinking time in seconds for a playground holding `cardCount` cards. */
export function cpuReactionTimeMean(setting: CPUOpponentSetting, cardCount: number): number {
  return setting.reactionTimeBase + setting.reactionTimePerDoubling * boardDifficulty(cardCount);
}

/**
 * Standard deviation of the sampled reaction time, in seconds.
 *
 * The spread is lognormal, so this is not `sigma` itself: a lognormal with log-mean `m` and shape
 * `sigma` has standard deviation `m * sqrt(exp(sigma^2) - 1)`. The variance still grows with the
 * mean, which is what makes a crowded board both slower and less predictable than a cleared one.
 */
export function cpuReactionTimeStdDev(setting: CPUOpponentSetting, cardCount: number): number {
  const sigma = setting.reactionTimeSigma;
  return cpuReactionTimeMean(setting, cardCount) * Math.sqrt(Math.exp(sigma * sigma) - 1);
}

/** Probability that the CPU grabs a wrong card on a playground holding `cardCount` cards. */
export function cpuMistakeRate(setting: CPUOpponentSetting, cardCount: number): number {
  const rate = setting.mistakeRateBase + setting.mistakeRatePerDoubling * boardDifficulty(cardCount);
  return clamp(rate, 0, MaxMistakeRate);
}

/**
 * One sample of the CPU's reaction time in seconds.
 *
 * The spread is multiplicative (lognormal) rather than additive: the delay is always positive and
 * an unusually slow turn is a long tail instead of the symmetric jitter a uniform spread gives.
 * Subtracting `sigma^2 / 2` keeps the sample mean equal to the mean the settings describe.
 */
export function sampleCPUReactionTime(
  setting: CPUOpponentSetting, cardCount: number, random: () => number = Math.random,
): number {
  const mean = cpuReactionTimeMean(setting, cardCount);
  const sigma = setting.reactionTimeSigma;
  const delay = mean * Math.exp(sigma * standardNormal(random) - sigma * sigma / 2);
  return Math.max(delay, MinReactionTime);
}

/** Box-Muller transform: two uniform samples become one standard normal sample. */
function standardNormal(random: () => number): number {
  // 1 - u keeps the log away from its pole while staying inside (0, 1].
  const u = 1 - random();
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export const DefaultCPUOpponentSetting: CPUOpponentSetting = {
  reactionTimeBase: 2.5,
  reactionTimePerDoubling: 0.7,
  reactionTimeSigma: 0.25,
  mistakeRateBase: 0.02,
  mistakeRatePerDoubling: 0.032,
};

export type CPUOpponentPresetId = "easy" | "normal" | "hard" | "lunatic";

/** Named points on the same curve, so a user can pick a feel without tuning five numbers. */
export const CPUOpponentPresets: Record<CPUOpponentPresetId, CPUOpponentSetting> = {
  easy: {
    reactionTimeBase: 4.0,
    reactionTimePerDoubling: 1.0,
    reactionTimeSigma: 0.35,
    mistakeRateBase: 0.03,
    mistakeRatePerDoubling: 0.05,
  },
  normal: DefaultCPUOpponentSetting,
  hard: {
    reactionTimeBase: 1.2,
    reactionTimePerDoubling: 0.6,
    reactionTimeSigma: 0.15,
    mistakeRateBase: 0.01,
    mistakeRatePerDoubling: 0.018,
  },
  lunatic: {
    reactionTimeBase: 0.8,
    reactionTimePerDoubling: 0.4,
    reactionTimeSigma: 0.08,
    mistakeRateBase: 0,
    mistakeRatePerDoubling: 0.01,
  },
};

/** Which preset (if any) the current setting exactly matches. */
export function matchingCPUOpponentPreset(
  setting: CPUOpponentSetting,
): CPUOpponentPresetId | null {
  for (const id of Object.keys(CPUOpponentPresets) as Array<CPUOpponentPresetId>) {
    if (sameCPUOpponentSetting(setting, CPUOpponentPresets[id])) {
      return id;
    }
  }
  return null;
}

function sameCPUOpponentSetting(a: CPUOpponentSetting, b: CPUOpponentSetting): boolean {
  return a.reactionTimeBase === b.reactionTimeBase
    && a.reactionTimePerDoubling === b.reactionTimePerDoubling
    && a.reactionTimeSigma === b.reactionTimeSigma
    && a.mistakeRateBase === b.mistakeRateBase
    && a.mistakeRatePerDoubling === b.mistakeRatePerDoubling;
}
