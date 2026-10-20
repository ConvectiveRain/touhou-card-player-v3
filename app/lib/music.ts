import { CharacterId, GlobalData, MusicInfo, MusicSelectionMap, MusicUniqueId } from "../types/Configs";

/**
 * Music lookup, in one place.
 *
 * The rules used to be spread over `types/Configs` and the audio hook, with different answers for
 * the same inputs: a `-1` selection ("disabled") and an unknown character were handled
 * inconsistently, and callers had to know whether a character's music list could be empty.
 * Everything here answers `null` for "there is no music for this".
 */

/** The chosen track for a character, or null when it is disabled/unknown/out of range. */
export function musicIdFor(
  globalData: GlobalData, musicSelection: MusicSelectionMap, characterId: CharacterId,
): MusicUniqueId | null {
  const selection = musicSelection.get(characterId);
  if (selection === undefined || selection === -1) { return null; }
  const characterConfig = globalData.characterConfigs.get(characterId);
  if (!characterConfig) { return null; }
  const musics = characterConfig.musics;
  if (selection < 0 || selection >= musics.length) { return null; }
  return musics[selection];
}

/** Playable URL for a character's current track, or null when there is none. */
export function musicSourceFor(
  globalData: GlobalData, musicSelection: MusicSelectionMap, characterId: CharacterId,
): string | null {
  const musicId = musicIdFor(globalData, musicSelection, characterId);
  if (musicId === null) { return null; }
  return globalData.sources.get(musicId) || null;
}

/** Display title/album for a character's current track, or null when there is none. */
export function musicInfoFor(
  globalData: GlobalData, musicSelection: MusicSelectionMap, characterId: CharacterId,
): MusicInfo | null {
  const musicId = musicIdFor(globalData, musicSelection, characterId);
  if (musicId === null) { return null; }
  return { characterId, ...parseMusicInfo(musicId) };
}

/** Splits a raw music id ("<album>/<index>. <author> - <title>.ext") into title and album. */
export function parseMusicInfo(musicName: string): { title: string; album: string } {
  const album = musicName.substring(0, musicName.indexOf("/"));
  let title = musicName;

  const lastSlash = title.lastIndexOf("/");
  const lastDot = title.lastIndexOf(".");
  if (lastDot > lastSlash) {
    title = title.substring(lastSlash + 1, lastDot);
  }

  for (const author of MusicAuthors) {
    if (title.startsWith(author + " - ")) {
      title = title.substring(author.length + 3);
      break;
    }
  }

  // drop a leading track number, e.g. "07. Title"
  if (/^\d+\./.test(title)) {
    title = title.substring(title.indexOf(".") + 1);
    if (title.startsWith(" ")) { title = title.substring(1); }
  }

  return { title, album };
}

/** Wraps an album-queue cursor for the previous/next controls. */
export function stepMusicQueueIndex(index: number, length: number, direction: 1 | -1): number {
  if (!Number.isInteger(index) || length <= 0) { return 0; }
  return (index + direction + length) % length;
}

const MusicAuthors = [
  "黄昏フロンティア・上海アリス幻樂団",
  "上海アリス幻樂団",
  "ZUN",
  "あきやまうに",
  "黄昏フロンティア",
];
