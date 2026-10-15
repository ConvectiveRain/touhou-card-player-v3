import { describe, expect, it } from "vitest";
import { GlobalData } from "../types/Configs";
import {
  applyMusicScope, parseSingleScopePayload, singleScopeMusicIds, toFullSelection, toScopedSelection,
} from "./originalScope";

/** alice/marisa share "shared", which only the local list marks as single-attribution. */
function createScopeFixture(): GlobalData {
  const data = new GlobalData();
  data.applyFetchedCharacters({
    alice: { card: ["alice-1"], music: ["zun-1", "alice-own", "shared"] },
    marisa: { card: ["marisa-1"], music: ["shared", "marisa-own"] },
    reimu: { card: ["reimu-1"], music: "reimu-own" },
  });
  return data;
}

describe("parseSingleScopePayload", () => {
  it("reads the ids array", () => {
    expect(parseSingleScopePayload({ ids: ["a", "b"] })).toEqual(new Set(["a", "b"]));
  });

  it("treats a missing payload as an empty set", () => {
    expect(parseSingleScopePayload(null)).toEqual(new Set());
    expect(parseSingleScopePayload({})).toEqual(new Set());
    expect(parseSingleScopePayload({ ids: "nope" })).toEqual(new Set());
  });
});

describe("singleScopeMusicIds", () => {
  it("keeps uniquely owned tracks plus the local single list", () => {
    const kept = singleScopeMusicIds(createScopeFixture().characterConfigs, new Set(["shared"]));
    expect(kept).toEqual(new Set(["zun-1", "alice-own", "shared", "marisa-own", "reimu-own"]));
  });

  it("drops shared tracks without the local override", () => {
    const kept = singleScopeMusicIds(createScopeFixture().characterConfigs, new Set());
    expect(kept.has("shared")).toBe(false);
    expect(kept.size).toBe(4);
  });
});

describe("applyMusicScope", () => {
  it("returns the same dataset for the all scope", () => {
    const data = createScopeFixture();
    expect(applyMusicScope(data, "all", new Set())).toBe(data);
  });

  it("keeps character entries but shortens their track lists", () => {
    const data = createScopeFixture();
    const scoped = applyMusicScope(data, "single", new Set());
    expect(Array.from(scoped.characterConfigs.keys())).toEqual(["alice", "marisa", "reimu"]);
    expect(scoped.characterConfigs.get("alice")?.musics).toEqual(["zun-1", "alice-own"]);
    expect(scoped.characterConfigs.get("marisa")?.musics).toEqual(["marisa-own"]);
    // a single-music string in the payload still behaves like a one-track list
    expect(scoped.characterConfigs.get("reimu")?.musics).toEqual(["reimu-own"]);
    // the original dataset is untouched
    expect(data.characterConfigs.get("alice")?.musics).toHaveLength(3);
  });
});

describe("selection mapping", () => {
  it("maps a filtered-out choice to the first surviving track", () => {
    const data = createScopeFixture();
    const scoped = applyMusicScope(data, "single", new Set());
    // alice had "shared" (index 2) selected, which the scope drops
    const scopedSelection = toScopedSelection(data, scoped, new Map([["alice", 2], ["marisa", 0]]));
    expect(scopedSelection.get("alice")).toBe(0);
    expect(scopedSelection.get("marisa")).toBe(0);
  });

  it("keeps the chosen track when it survives", () => {
    const data = createScopeFixture();
    const scoped = applyMusicScope(data, "single", new Set());
    const scopedSelection = toScopedSelection(data, scoped, new Map([["alice", 1]]));
    // "alice-own" is index 1 in the scoped list too
    expect(scopedSelection.get("alice")).toBe(1);
    expect(scoped.characterConfigs.get("alice")?.musics[1]).toBe("alice-own");
  });

  it("carries disabled characters and missing entries over untouched", () => {
    const data = createScopeFixture();
    const scoped = applyMusicScope(data, "single", new Set());
    const scopedSelection = toScopedSelection(data, scoped, new Map([["alice", -1]]));
    expect(scopedSelection.get("alice")).toBe(-1);
    expect(scopedSelection.has("marisa")).toBe(false);
  });

  it("round-trips through the full dataset", () => {
    const data = createScopeFixture();
    const scoped = applyMusicScope(data, "single", new Set());
    const full = new Map([["alice", 1], ["marisa", 1], ["reimu", 0], ["youmu", -1]]);
    const scopedSelection = toScopedSelection(data, scoped, full);
    const back = toFullSelection(data, scoped, scopedSelection);
    expect(back).toEqual(full);
  });

  it("falls back to the first track when the round trip loses a track", () => {
    const data = createScopeFixture();
    const scoped = applyMusicScope(data, "single", new Set());
    // alice's scoped track 0 is "zun-1", which is index 0 of the full list too
    const back = toFullSelection(data, scoped, new Map([["alice", 0]]));
    expect(back.get("alice")).toBe(0);
  });
});
