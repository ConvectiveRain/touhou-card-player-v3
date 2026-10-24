import type { MusicUniqueId } from "../types/Configs";

export type LibraryAlbum = {
  id: string;
  name: string;
  circle: string;
  producers?: string[];
  date: string;
  cover?: boolean;
  music: string[];
};

export type LibraryData = {
  circles: string[];
  albums: LibraryAlbum[];
  characterCircles: Record<string, string[]>;
};

/**
 * Original/upstream tracks that have no album entry and therefore no circle attribution.
 * Playlist mode keeps these available even though they are not playlist members.
 */
export function collectOriginalMusicIds(
  library: LibraryData | null,
  playableMusicIds: Iterable<MusicUniqueId>,
): Set<MusicUniqueId> {
  if (!library) { return new Set(); }
  const circleMusicIds = new Set(
    library.albums.flatMap((album) => album.music),
  );
  return new Set(
    [...playableMusicIds].filter((musicId) => !circleMusicIds.has(musicId)),
  );
}
