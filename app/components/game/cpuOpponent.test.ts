import { describe, expect, it } from "vitest";
import { GameJudge } from "../../types/GameJudge";
import { CardInfo, MatchType, SendOption } from "../../types/GameTypes";
import { createTestOuterRef } from "../../test/fixtures";
import {
  CPUOpponentPresets, DefaultCPUOpponentSetting, MaxMistakeRate, MinReactionTime,
  boardDifficulty, cpuMistakeRate, cpuReactionTimeMean, cpuReactionTimeStdDev,
  matchingCPUOpponentPreset, sampleCPUReactionTime,
} from "./cpuOpponent";
import type { CPUOpponentPresetId, CPUOpponentSetting } from "./cpuOpponent";

const DontSend: SendOption = { send: false, except: null };

/** Deterministic uniform source, so the sampled statistics do not flake. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cardsOnFullDefaultBoard(): number {
  return 3 * 8 * 2;
}

describe("boardDifficulty", () => {
  it("treats an empty and a single-card playground as the same difficulty", () => {
    expect(boardDifficulty(0)).toBe(0);
    expect(boardDifficulty(1)).toBe(0);
  });

  it("measures the playground in doublings of its card count", () => {
    expect(boardDifficulty(2)).toBeCloseTo(1);
    expect(boardDifficulty(4)).toBeCloseTo(2);
    expect(boardDifficulty(48)).toBeCloseTo(Math.log2(48));
  });
});

describe("cpuReactionTimeMean", () => {
  it("never gets faster as cards are added", () => {
    let previous = 0;
    for (let count = 1; count <= 200; count++) {
      const mean = cpuReactionTimeMean(DefaultCPUOpponentSetting, count);
      expect(mean).toBeGreaterThanOrEqual(previous);
      previous = mean;
    }
  });

  it("keeps the presets ordered from easiest to hardest on any board", () => {
    const order: Array<CPUOpponentPresetId> = ["easy", "normal", "hard", "lunatic"];
    for (const count of [1, 12, 48, 150]) {
      for (let i = 1; i < order.length; i++) {
        const easier = CPUOpponentPresets[order[i - 1]];
        const harder = CPUOpponentPresets[order[i]];
        expect(cpuReactionTimeMean(harder, count)).toBeLessThan(cpuReactionTimeMean(easier, count));
        expect(cpuMistakeRate(harder, count)).toBeLessThan(cpuMistakeRate(easier, count));
      }
    }
  });
});

describe("cpuReactionTimeStdDev", () => {
  it("is zero when the spread is zero", () => {
    const setting: CPUOpponentSetting = { ...DefaultCPUOpponentSetting, reactionTimeSigma: 0 };
    expect(cpuReactionTimeStdDev(setting, 48)).toBe(0);
  });

  it("grows with the mean, so a crowded board is also less predictable", () => {
    let previous = 0;
    for (let count = 1; count <= 200; count++) {
      const deviation = cpuReactionTimeStdDev(DefaultCPUOpponentSetting, count);
      expect(deviation).toBeGreaterThanOrEqual(previous);
      previous = deviation;
    }
    expect(previous).toBeGreaterThan(0);
  });

  it("matches the standard deviation of the samples it describes", () => {
    const random = mulberry32(99);
    const samples = 40000;
    const values: Array<number> = [];
    for (let i = 0; i < samples; i++) {
      values.push(sampleCPUReactionTime(DefaultCPUOpponentSetting, 48, random));
    }
    const mean = values.reduce((total, value) => total + value, 0) / samples;
    const variance = values.reduce((total, value) => total + (value - mean) ** 2, 0) / samples;
    expect(Math.sqrt(variance))
      .toBeCloseTo(cpuReactionTimeStdDev(DefaultCPUOpponentSetting, 48), 1);
  });
});

describe("cpuMistakeRate", () => {
  it("defaults to the rate the old model used on a full default board", () => {
    expect(cpuMistakeRate(DefaultCPUOpponentSetting, cardsOnFullDefaultBoard()))
      .toBeCloseTo(0.2, 2);
  });

  it("never gets safer as cards are added and stays inside the cap", () => {
    let previous = 0;
    for (let count = 1; count <= 200; count++) {
      const rate = cpuMistakeRate(DefaultCPUOpponentSetting, count);
      expect(rate).toBeGreaterThanOrEqual(previous);
      expect(rate).toBeLessThanOrEqual(MaxMistakeRate);
      previous = rate;
    }
  });

  it("caps a runaway setting", () => {
    const runaway: CPUOpponentSetting = { ...DefaultCPUOpponentSetting, mistakeRatePerDoubling: 5 };
    expect(cpuMistakeRate(runaway, 150)).toBe(MaxMistakeRate);
  });
});

describe("sampleCPUReactionTime", () => {
  it("is exactly the mean when the spread is zero", () => {
    const setting: CPUOpponentSetting = { ...DefaultCPUOpponentSetting, reactionTimeSigma: 0 };
    const random = mulberry32(1);
    for (let i = 0; i < 20; i++) {
      expect(sampleCPUReactionTime(setting, 48, random))
        .toBeCloseTo(cpuReactionTimeMean(setting, 48), 6);
    }
  });

  it("never drops below the human floor", () => {
    const setting: CPUOpponentSetting = { ...DefaultCPUOpponentSetting, reactionTimeSigma: 2 };
    const random = mulberry32(7);
    for (let i = 0; i < 5000; i++) {
      expect(sampleCPUReactionTime(setting, 1, random)).toBeGreaterThanOrEqual(MinReactionTime);
    }
  });

  it("keeps the configured mean on average", () => {
    const random = mulberry32(42);
    const target = cpuReactionTimeMean(DefaultCPUOpponentSetting, 48);
    let total = 0;
    const samples = 40000;
    for (let i = 0; i < samples; i++) {
      total += sampleCPUReactionTime(DefaultCPUOpponentSetting, 48, random);
    }
    expect(total / samples).toBeCloseTo(target, 1);
  });
});

describe("matchingCPUOpponentPreset", () => {
  it("recognises the default preset", () => {
    expect(matchingCPUOpponentPreset({ ...DefaultCPUOpponentSetting })).toBe("normal");
  });

  it("returns null once a value is hand-tuned", () => {
    expect(matchingCPUOpponentPreset({
      ...DefaultCPUOpponentSetting, reactionTimeBase: 1.7,
    })).toBeNull();
  });
});

describe("GameJudge.playgroundCardCount", () => {
  it("counts only the face-up cards of every deck", () => {
    const judge = new GameJudge(createTestOuterRef());
    expect(judge.playgroundCardCount()).toBe(0);

    judge.addToDeck(0, new CardInfo("alice", 0), 0, DontSend);
    judge.addToDeck(0, new CardInfo("marisa", 1), 1, DontSend);
    expect(judge.playgroundCardCount()).toBe(2);
  });

  it("adds both decks in a CPU match", () => {
    const judge = new GameJudge(createTestOuterRef());
    judge.matchType = MatchType.CPU;
    judge.addCPUPlayer();
    judge.addToDeck(0, new CardInfo("alice", 0), 0, DontSend);
    judge.players[1].deck = [new CardInfo("marisa", 1), new CardInfo("reimu", 2)];
    expect(judge.playgroundCardCount()).toBe(3);
  });
});
