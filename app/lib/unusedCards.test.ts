import { describe, expect, it } from "vitest";
import { createTestGlobalData } from "../test/fixtures";
import { CardInfo } from "../types/GameTypes";
import { MusicSelectionMap } from "../types/Configs";
import {
  collectCardKeys, collectCharacterIds, computeUnusedCardsList,
} from "./unusedCards";
import type { UnusedCardsInput } from "./unusedCards";

const globalData = createTestGlobalData();

function baseInput(overrides: Partial<UnusedCardsInput> = {}): UnusedCardsInput {
  return {
    characterConfigs: globalData.characterConfigs,
    playingOrder: ["alice", "marisa", "reimu", "youmu"],
    musicSelection: new Map<string, number>(),
    isGameplay: false,
    cardInsideDeck: new Set(),
    cardInsideCollected: new Set(),
    characterInsideDeck: new Set(),
    draggedCard: null,
    baseline: [],
    ...overrides,
  };
}

const keys = (cards: Array<CardInfo>) => cards.map((card) => card.toKey());

describe("computeUnusedCardsList", () => {
  it("is empty while every character is enabled and no deck is filled", () => {
    expect(computeUnusedCardsList(baseInput())).toEqual([]);
  });

  it("includes characters whose music selection is set to -1", () => {
    const musicSelection: MusicSelectionMap = new Map([["alice", -1]]);

    const unused = computeUnusedCardsList(baseInput({ musicSelection }));

    expect(keys(unused)).toEqual(["alice-0", "alice-1"]);
  });

  it("treats a character that is already in a deck as used", () => {
    const unused = computeUnusedCardsList(baseInput({
      characterInsideDeck: new Set(["alice"]),
      cardInsideDeck: new Set(["alice-0"]),
    }));

    // the second alice card has no slot, so it belongs to the unused pile
    expect(keys(unused)).toEqual(["alice-1"]);
  });

  it("flags the sibling cards of the card being dragged", () => {
    const unused = computeUnusedCardsList(baseInput({
      draggedCard: new CardInfo("alice", 0),
    }));

    expect(keys(unused)).toEqual(["alice-1"]);
  });

  it("keeps baseline cards first and appends newly unused ones, so cards animate out instead of jumping", () => {
    const baseline = [new CardInfo("reimu", 0), new CardInfo("alice", 1)];
    const unused = computeUnusedCardsList(baseInput({
      musicSelection: new Map([["alice", -1], ["reimu", -1]]),
      baseline,
    }));

    expect(keys(unused)).toEqual(["reimu-0", "alice-1", "alice-0"]);
  });

  it("drops baseline entries that are no longer unused", () => {
    const baseline = [new CardInfo("alice", 0)];
    const unused = computeUnusedCardsList(baseInput({ baseline }));

    expect(unused).toEqual([]);
  });

  it("during gameplay reports everything outside deck and collected", () => {
    const unused = computeUnusedCardsList(baseInput({
      isGameplay: true,
      playingOrder: ["alice", "marisa"],
      cardInsideDeck: new Set(["alice-0"]),
      cardInsideCollected: new Set(["marisa-0"]),
    }));

    expect(keys(unused)).toEqual(["alice-1"]);
  });

  it("during gameplay ignores characters outside the playing order", () => {
    const unused = computeUnusedCardsList(baseInput({
      isGameplay: true,
      playingOrder: ["alice"],
    }));

    // youmu and reimu are skipped entirely, alice has no cards placed yet
    expect(keys(unused)).toEqual(["alice-0", "alice-1"]);
  });

  it("during gameplay still honours the -1 music selection", () => {
    const unused = computeUnusedCardsList(baseInput({
      isGameplay: true,
      playingOrder: ["alice"],
      musicSelection: new Map([["alice", -1]]),
    }));

    expect(keys(unused)).toEqual(["alice-0", "alice-1"]);
  });
});

describe("pile helpers", () => {
  it("collects the keys and the characters of a flat card list", () => {
    const cards = [
      new CardInfo("alice", 0),
      new CardInfo("alice", 1),
      new CardInfo("marisa", 0),
      new CardInfo(null, 0),
    ];

    expect(Array.from(collectCardKeys(cards))).toEqual([
      "alice-0", "alice-1", "marisa-0", "null-0",
    ]);
    // empty slots carry no character
    expect(Array.from(collectCharacterIds(cards))).toEqual(["alice", "marisa"]);
  });
});
