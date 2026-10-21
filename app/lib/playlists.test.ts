import { describe, expect, it } from "vitest";
import { GlobalData } from "../types/Configs";
import {
  addUniqueTracks, buildPlaylistGameSelection, createPlaylist, normalizePlaylistStore,
} from "./playlists";

function dataWithTracks(): GlobalData {
  const data = new GlobalData();
  data.applyFetchedCharacters({
    alice: { card: "alice.png", music: ["album/A - one.mp3", "album/A - two.mp3"] },
    marisa: { card: "marisa.png", music: ["album/M - one.mp3"] },
  });
  data.applyFetchedSources({
    "album/A - one.mp3": "one.mp3",
    "album/A - two.mp3": "two.mp3",
    "album/M - one.mp3": "three.mp3",
  });
  return data;
}

describe("playlist persistence helpers", () => {
  it("deduplicates tracks by music id and validates imported data", () => {
    const track = {
      musicId: "album/A - one.mp3", characterId: "alice",
      title: "one", album: "album", addedAt: "2026-10-21T00:00:00.000Z",
    };
    expect(addUniqueTracks([track], [track])).toHaveLength(1);

    const normalized = normalizePlaylistStore({
      version: 99,
      playlists: [{ id: "p1", name: "测试", tracks: [track, track] }],
    });
    expect(normalized.version).toBe(1);
    expect(normalized.playlists[0].tracks).toHaveLength(1);
  });

  it("builds a game selection that contains only playlist characters", () => {
    const data = dataWithTracks();
    const playlist = createPlaylist("game", [
      {
        musicId: "album/A - two.mp3", characterId: "alice",
        title: "two", album: "album", addedAt: "2026-10-21T00:00:00.000Z",
      },
      {
        musicId: "album/A - one.mp3", characterId: "alice",
        title: "one", album: "album", addedAt: "2026-10-21T00:00:00.000Z",
      },
      {
        musicId: "album/M - one.mp3", characterId: "marisa",
        title: "one", album: "album", addedAt: "2026-10-21T00:00:00.000Z",
      },
    ]);
    const game = buildPlaylistGameSelection(playlist, data);

    expect(game.order).toEqual(["alice", "marisa"]);
    expect(game.selection.get("alice")).toBe(1);
    expect(game.selection.get("marisa")).toBe(0);
  });
});
