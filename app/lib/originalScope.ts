import {
  CharacterConfigMap, GlobalData, MusicSelectionMap, MusicUniqueId,
} from "../types/Configs";

/**
 * 「全部曲目 / 仅单原曲」两种曲目范围，对应本地播放器顶栏的同一个开关。
 *
 * 仅单原曲 = 只保留角色归属唯一（a track that points at a single character）的曲目：
 *   · 本地曲库曲目用的是本地播放器算好的名单（`public/single_local.json`，见 build_player.py
 *     的 `single` 字段——「角色曲恰好一首」或「多首角色曲全指向同一位角色」）；
 *   · 其余音源（网易云 163 / R2 / THBWiki）的曲目没有本地归属信息，只按「
 *     是否只挂在一位角色名下」判断。
 *
 * `applyMusicScope` returns the same object for the "all" scope, so the filter costs
 * nothing while the toggle is off.
 */

export type MusicScope = "all" | "single";

/** 默认「仅单原曲」，和本地播放器一致。 */
export const DefaultMusicScope: MusicScope = "single";

export function isMusicScope(value: unknown): value is MusicScope {
  return value === "all" || value === "single";
}

/** The file listing the local library's unique-attribution tracks. */
export const SingleScopePayloadFile = "single_local.json";

/** Parses `single_local.json`; a missing/unreadable payload means "no local overrides". */
export function parseSingleScopePayload(payload: unknown): Set<MusicUniqueId> {
  const ids = (payload as { ids?: unknown } | null)?.ids;
  if (!Array.isArray(ids)) { return new Set(); }
  return new Set(ids.filter((id): id is MusicUniqueId => typeof id === "string"));
}

/** How many characters each music id is attached to. */
export function countMusicOwners(characterConfigs: CharacterConfigMap): Map<MusicUniqueId, number> {
  const counts = new Map<MusicUniqueId, number>();
  characterConfigs.forEach((config) => {
    for (const musicId of config.musics) {
      counts.set(musicId, (counts.get(musicId) ?? 0) + 1);
    }
  });
  return counts;
}

/** The music ids that survive the "single original" rule. */
export function singleScopeMusicIds(
  characterConfigs: CharacterConfigMap,
  localSingleIds: ReadonlySet<MusicUniqueId>,
): Set<MusicUniqueId> {
  const kept = new Set<MusicUniqueId>();
  countMusicOwners(characterConfigs).forEach((count, musicId) => {
    if (count === 1 || localSingleIds.has(musicId)) { kept.add(musicId); }
  });
  return kept;
}

/**
 * A copy of `data` whose characters only keep the tracks allowed by `scope`.
 *
 * Written here instead of on `GlobalData` so the class in `types/Configs` (upstream file)
 * stays untouched; the fields it copies are the same ones `withCardCollection` shares.
 */
export function applyMusicScope(
  data: GlobalData,
  scope: MusicScope,
  localSingleIds: ReadonlySet<MusicUniqueId>,
): GlobalData {
  if (scope === "all") { return data; }

  const kept = singleScopeMusicIds(data.characterConfigs, localSingleIds);
  const characterConfigs: CharacterConfigMap = new Map();
  data.characterConfigs.forEach((config, characterId) => {
    const musics = config.musics.filter((musicId) => kept.has(musicId));
    characterConfigs.set(
      characterId,
      musics.length === config.musics.length ? config : { ...config, musics },
    );
  });

  const copy = new GlobalData();
  copy.characterConfigs = characterConfigs;
  copy.sources = data.sources;
  copy.cardSourcePrefix = data.cardSourcePrefix;
  copy.presets = data.presets;
  copy.cardCollection = data.cardCollection;
  return copy;
}

/**
 * Moves a selection from the full dataset onto a scoped one.
 *
 * A character whose chosen track is filtered out falls back to its first surviving track
 * (index 0), and is disabled (-1) when nothing survives. Missing entries stay missing:
 * `musicIdFor` reads them as "disabled", which is what the caller meant.
 */
export function toScopedSelection(
  data: GlobalData,
  scoped: GlobalData,
  selection: MusicSelectionMap,
): MusicSelectionMap {
  if (scoped === data) { return selection; }

  const result: MusicSelectionMap = new Map();
  selection.forEach((index, characterId) => {
    const musics = scoped.characterConfigs.get(characterId)?.musics ?? [];
    if (musics.length === 0) { result.set(characterId, -1); return; }
    if (index === -1) { result.set(characterId, -1); return; }
    const musicId = data.characterConfigs.get(characterId)?.musics[index];
    const scopedIndex = musicId === undefined ? -1 : musics.indexOf(musicId);
    result.set(characterId, scopedIndex >= 0 ? scopedIndex : 0);
  });
  return result;
}

/** The inverse of {@link toScopedSelection}: back to indices of the full dataset. */
export function toFullSelection(
  data: GlobalData,
  scoped: GlobalData,
  selection: MusicSelectionMap,
): MusicSelectionMap {
  if (scoped === data) { return selection; }

  const result: MusicSelectionMap = new Map();
  selection.forEach((index, characterId) => {
    if (index === -1) { result.set(characterId, -1); return; }
    const musicId = scoped.characterConfigs.get(characterId)?.musics[index];
    const musics = data.characterConfigs.get(characterId)?.musics ?? [];
    const fullIndex = musicId === undefined ? -1 : musics.indexOf(musicId);
    result.set(characterId, fullIndex >= 0 ? fullIndex : 0);
  });
  return result;
}
