import { describe, expect, it } from "vitest";
import { collectOriginalMusicIds, LibraryData } from "./library";

const library: LibraryData = {
  circles: ["Circle A"],
  albums: [{
    id: "album-1",
    name: "Album",
    circle: "Circle A",
    date: "2026-01-01",
    music: ["Circle A - Album/arranged.mp3"],
  }],
  characterCircles: {},
};

describe("collectOriginalMusicIds", () => {
  it("keeps playable tracks that have no circle album entry", () => {
    const originals = collectOriginalMusicIds(library, [
      "Circle A - Album/arranged.mp3",
      "Original Album/ZUN - theme.mp3",
    ]);
    expect([...originals]).toEqual(["Original Album/ZUN - theme.mp3"]);
  });

  it("only includes ids from the active playable source", () => {
    const originals = collectOriginalMusicIds(
      library,
      ["Original Album/ZUN - theme.mp3"],
    );
    expect(originals.size).toBe(1);
  });

  it("returns an empty set until the library finishes loading", () => {
    expect(collectOriginalMusicIds(null, ["anything.mp3"]).size).toBe(0);
  });
});
