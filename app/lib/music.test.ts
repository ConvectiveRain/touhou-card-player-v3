import { describe, expect, it } from "vitest";
import { createTestGlobalData } from "../test/fixtures";
import { musicIdFor, musicInfoFor, musicSourceFor, parseMusicInfo } from "./music";
import { MusicSelectionMap } from "../types/Configs";

function setup() {
  const data = createTestGlobalData({
    alice: { card: ["alice-1"], music: ["Album/ZUN - Title.mp3"] },
    marisa: { card: ["marisa-1"], music: ["Album/Other.mp3"] },
  });
  data.sources.set("Album/ZUN - Title.mp3", "http://example.test/alice.mp3");
  const selection: MusicSelectionMap = new Map([["alice", 0], ["marisa", -1]]);
  return { data, selection };
}

describe("parseMusicInfo", () => {
  it("splits album, artist and extension off a raw music id", () => {
    expect(parseMusicInfo("Album/ZUN - Title.mp3")).toEqual({ album: "Album", title: "Title" });
  });

  it("drops a leading track number", () => {
    expect(parseMusicInfo("Album/07. Title.mp3")).toEqual({ album: "Album", title: "Title" });
  });

  it("tolerates an id without an album path", () => {
    expect(parseMusicInfo("Title.mp3")).toEqual({ album: "", title: "Title" });
  });
});

describe("musicIdFor", () => {
  it("returns the selected track", () => {
    const { data, selection } = setup();
    expect(musicIdFor(data, selection, "alice")).toBe("Album/ZUN - Title.mp3");
  });

  it("returns null for a disabled character", () => {
    const { data, selection } = setup();
    expect(musicIdFor(data, selection, "marisa")).toBeNull();
  });

  it("returns null for an unknown character or an unset selection", () => {
    const { data, selection } = setup();
    expect(musicIdFor(data, selection, "nobody")).toBeNull();
    expect(musicIdFor(data, new Map(), "alice")).toBeNull();
  });

  it("returns null for an out-of-range selection", () => {
    const { data } = setup();
    expect(musicIdFor(data, new Map([["alice", 7]]), "alice")).toBeNull();
  });
});

describe("musicSourceFor", () => {
  it("resolves the track to its url", () => {
    const { data, selection } = setup();
    expect(musicSourceFor(data, selection, "alice")).toBe("http://example.test/alice.mp3");
  });

  it("returns null when there is no track or no url", () => {
    const { data, selection } = setup();
    expect(musicSourceFor(data, selection, "marisa")).toBeNull();
  });
});

describe("musicInfoFor", () => {
  it("returns display info for the selected track", () => {
    const { data, selection } = setup();
    expect(musicInfoFor(data, selection, "alice")).toEqual({
      characterId: "alice", album: "Album", title: "Title",
    });
  });

  it("returns null instead of reading a disabled selection's music list", () => {
    // a -1 selection used to index musics[-1] and throw
    const { data, selection } = setup();
    expect(musicInfoFor(data, selection, "marisa")).toBeNull();
  });
});
