import type {
  CharacterId, GlobalData, MusicSelectionMap, MusicUniqueId,
} from "../types/Configs";

export type PlaylistTrack = {
  musicId: MusicUniqueId;
  characterId: CharacterId;
  title: string;
  album: string;
  addedAt: string;
};

export type MusicPlaylist = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  tracks: Array<PlaylistTrack>;
};

export type PlaylistStoreFile = {
  version: 1;
  playlists: Array<MusicPlaylist>;
};

export const PlaylistStorageKey = "card-player-playlists-v1";
export const ActivePlaylistStorageKey = "card-player-active-playlist-v1";
export const DefaultPlaylistName = "默认歌单";

function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `playlist_${crypto.randomUUID()}`;
  }
  return `playlist_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function normalizePlaylistStore(raw: unknown): PlaylistStoreFile {
  const source = raw !== null && typeof raw === "object"
    ? (raw as { playlists?: unknown }).playlists
    : null;
  const items = Array.isArray(source) ? source : [];
  const seenPlaylistIds = new Set<string>();
  const playlists: Array<MusicPlaylist> = [];

  for (const item of items) {
    if (item === null || typeof item !== "object") { continue; }
    const record = item as Record<string, unknown>;
    let id = stringValue(record.id).trim();
    if (!id || seenPlaylistIds.has(id)) { id = makeId(); }
    const name = stringValue(record.name, "未命名歌单").trim().slice(0, 120) || "未命名歌单";
    const seenTracks = new Set<string>();
    const tracks: Array<PlaylistTrack> = [];

    const rawTracks = Array.isArray(record.tracks) ? record.tracks : [];
    for (const rawTrack of rawTracks) {
      if (rawTrack === null || typeof rawTrack !== "object") { continue; }
      const track = rawTrack as Record<string, unknown>;
      const musicId = stringValue(track.musicId).trim();
      if (!musicId || seenTracks.has(musicId)) { continue; }
      seenTracks.add(musicId);
      tracks.push({
        musicId,
        characterId: stringValue(track.characterId),
        title: stringValue(track.title),
        album: stringValue(track.album),
        addedAt: stringValue(track.addedAt),
      });
    }

    seenPlaylistIds.add(id);
    playlists.push({
      id,
      name,
      createdAt: stringValue(record.createdAt),
      updatedAt: stringValue(record.updatedAt),
      tracks,
    });
  }
  return { version: 1, playlists };
}

export function loadPlaylistStore(): PlaylistStoreFile {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return { version: 1, playlists: [] };
  }
  try {
    const raw = window.localStorage.getItem(PlaylistStorageKey);
    return raw === null ? { version: 1, playlists: [] } : normalizePlaylistStore(JSON.parse(raw));
  } catch (error) {
    console.error("[playlists] failed to load the saved playlists", error);
    return { version: 1, playlists: [] };
  }
}

export function savePlaylistStore(playlists: Array<MusicPlaylist>): void {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") { return; }
  try {
    window.localStorage.setItem(
      PlaylistStorageKey,
      JSON.stringify({ version: 1, playlists } satisfies PlaylistStoreFile),
    );
  } catch (error) {
    console.error("[playlists] failed to save the playlists", error);
  }
}

export function loadActivePlaylistId(playlists: Array<MusicPlaylist>): string {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") { return ""; }
  const id = window.localStorage.getItem(ActivePlaylistStorageKey) ?? "";
  return playlists.some((playlist) => playlist.id === id) ? id : "";
}

export function saveActivePlaylistId(playlistId: string): void {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") { return; }
  if (playlistId) {
    window.localStorage.setItem(ActivePlaylistStorageKey, playlistId);
  } else {
    window.localStorage.removeItem(ActivePlaylistStorageKey);
  }
}

export function createPlaylist(
  name: string,
  tracks: Array<PlaylistTrack> = [],
): MusicPlaylist {
  const now = new Date().toISOString();
  return {
    id: makeId(),
    name: name.trim().slice(0, 120) || "未命名歌单",
    createdAt: now,
    updatedAt: now,
    tracks: addUniqueTracks([], tracks),
  };
}

export function addUniqueTracks(
  existing: Array<PlaylistTrack>,
  incoming: Array<PlaylistTrack>,
): Array<PlaylistTrack> {
  const seen = new Set(existing.map((track) => track.musicId));
  const result = existing.slice();
  for (const track of incoming) {
    if (!track.musicId || seen.has(track.musicId)) { continue; }
    seen.add(track.musicId);
    result.push(track);
  }
  return result;
}

export function addTrackToPlaylist(
  playlists: Array<MusicPlaylist>,
  playlistId: string,
  track: PlaylistTrack,
): { playlists: Array<MusicPlaylist>; added: number } {
  const target = playlists.find((playlist) => playlist.id === playlistId);
  if (!target) { return { playlists, added: 0 }; }
  const tracks = addUniqueTracks(target.tracks, [track]);
  const added = tracks.length - target.tracks.length;
  if (added === 0) { return { playlists, added: 0 }; }
  return {
    playlists: playlists.map((playlist) => (
      playlist.id === target.id
        ? { ...playlist, tracks, updatedAt: new Date().toISOString() }
        : playlist
    )),
    added,
  };
}

export function addTrackToDefaultPlaylist(
  playlists: Array<MusicPlaylist>,
  track: PlaylistTrack,
): { playlists: Array<MusicPlaylist>; playlistId: string; added: number } {
  const existing = playlists.find((playlist) => playlist.name === DefaultPlaylistName);
  const target = existing ?? createPlaylist(DefaultPlaylistName);
  const nextPlaylists = existing ? playlists : [...playlists, target];
  const result = addTrackToPlaylist(nextPlaylists, target.id, track);
  return { ...result, playlistId: target.id };
}

/**
 * The card game can put each character on the board only once. A playlist may contain many
 * tracks by one character, so selection builders collapse the playlist to one track per
 * character. Callers can supply a random picker; the default keeps the first track.
 */
export function groupPlaylistTracksByCharacter(
  playlist: MusicPlaylist,
  globalData: GlobalData,
): Map<CharacterId, Array<PlaylistTrack>> {
  const groups = new Map<CharacterId, Array<PlaylistTrack>>();
  for (const track of playlist.tracks) {
    if (!globalData.sources.has(track.musicId)) { continue; }
    let characterId = track.characterId;
    let config = globalData.characterConfigs.get(characterId);
    let index = config ? config.musics.indexOf(track.musicId) : -1;
    if (index < 0) {
      for (const [candidateId, candidateConfig] of globalData.characterConfigs) {
        const candidateIndex = candidateConfig.musics.indexOf(track.musicId);
        if (candidateIndex >= 0) {
          characterId = candidateId;
          config = candidateConfig;
          index = candidateIndex;
          break;
        }
      }
    }
    if (!config || index < 0) { continue; }
    if (!groups.has(characterId)) { groups.set(characterId, []); }
    groups.get(characterId)?.push(track);
  }
  return groups;
}

export function buildPlaylistGameSelection(
  playlist: MusicPlaylist,
  globalData: GlobalData,
  pickTrack: (tracks: Array<PlaylistTrack>) => PlaylistTrack = (tracks) => tracks[0],
): { selection: MusicSelectionMap; order: Array<CharacterId> } {
  const selection: MusicSelectionMap = new Map();
  globalData.characterConfigs.forEach((_config, characterId) => {
    selection.set(characterId, -1);
  });

  const groups = groupPlaylistTracksByCharacter(playlist, globalData);
  const order = [...groups.keys()];
  for (const [characterId, tracks] of groups) {
    const chosen = pickTrack(tracks);
    const config = globalData.characterConfigs.get(characterId);
    const index = config ? config.musics.indexOf(chosen.musicId) : -1;
    if (index >= 0) { selection.set(characterId, index); }
  }
  return { selection, order };
}
