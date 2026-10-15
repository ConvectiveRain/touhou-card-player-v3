import { CharacterId, MusicSelectionMap } from "../types/Configs";
import {
  DefaultCardWidthPercentage, DefaultDeckColumns, DefaultDeckRows,
  MaxDeckColumns, MaxDeckRows,
} from "./geometry";
import { DefaultMusicScope, isMusicScope, MusicScope } from "./originalScope";

/**
 * Every localStorage key the app uses, with the validation that used to be inlined in
 * page.tsx / ConfigTab / GameTab. Keeping it in one module means a stored payload only
 * has one place to be checked for shape and staleness.
 */

export const StorageKeys = {
  musicSelection: "musicSelection",
  playingOrder: "playingOrder",
  characterTemporaryDisabled: "characterTemporaryDisabled",
  currentCharacterId: "currentCharacterId",
  musicSourceKey: "musicSourceKey",
  musicScope: "musicScope",
  playerName: "myName",
  volume: "volume",
  gameSetting: "gameSetting",
} as const;

function hasStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readItem(key: string): string | null {
  if (!hasStorage()) { return null; }
  return window.localStorage.getItem(key);
}

function writeItem(key: string, value: string): void {
  if (!hasStorage()) { return; }
  window.localStorage.setItem(key, value);
}

function readJson<T>(key: string): T | null {
  const raw = readItem(key);
  if (raw === null) { return null; }
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error(`[persistence] Ignoring unreadable "${key}" entry:`, error);
    return null;
  }
}

export type SelectionState = {
  musicSelection: MusicSelectionMap;
  playingOrder: Array<CharacterId>;
  characterTemporaryDisabled: Map<CharacterId, boolean>;
  currentCharacterId: CharacterId;
};

/**
 * Loads the saved selection. Returns null when there is nothing usable to restore, in
 * which case the caller should build defaults from the freshly fetched character list.
 */
export function loadSelection(knownCharacterIds: Iterable<CharacterId>): SelectionState | null {
  const characterSet = new Set<CharacterId>(knownCharacterIds);
  let complete = true;

  const selectionObj = readJson<Record<string, number>>(StorageKeys.musicSelection);
  const musicSelection: MusicSelectionMap = new Map();
  if (selectionObj) {
    for (const key in selectionObj) {
      if (characterSet.has(key)) {
        musicSelection.set(key, selectionObj[key]);
      }
    }
    if (musicSelection.size === 0) { complete = false; }
  } else {
    complete = false;
  }
  // characters added since the last visit are enabled by default
  for (const characterId of characterSet) {
    if (!musicSelection.has(characterId)) {
      musicSelection.set(characterId, 0);
    }
  }

  const orderArr = readJson<Array<CharacterId>>(StorageKeys.playingOrder);
  const playingOrder: Array<CharacterId> = [];
  if (orderArr) {
    for (const characterId of orderArr) {
      if (characterSet.has(characterId)) {
        playingOrder.push(characterId);
      }
    }
    if (playingOrder.length === 0) { complete = false; }
  } else {
    complete = false;
  }

  const disabledObj = readJson<Record<string, boolean>>(StorageKeys.characterTemporaryDisabled);
  const characterTemporaryDisabled = new Map<CharacterId, boolean>();
  if (disabledObj) {
    for (const key in disabledObj) {
      if (characterSet.has(key)) {
        characterTemporaryDisabled.set(key, disabledObj[key]);
      }
    }
  } else {
    complete = false;
  }

  const currentCharacterId = readItem(StorageKeys.currentCharacterId);
  if (!currentCharacterId || !characterSet.has(currentCharacterId)) {
    complete = false;
  }

  if (!complete) { return null; }

  return {
    musicSelection,
    playingOrder,
    characterTemporaryDisabled,
    currentCharacterId: currentCharacterId as CharacterId,
  };
}

export function saveSelection(state: SelectionState): void {
  const selectionObj: Record<string, number> = {};
  state.musicSelection.forEach((value, key) => { selectionObj[key] = value; });
  writeItem(StorageKeys.musicSelection, JSON.stringify(selectionObj));

  writeItem(StorageKeys.playingOrder, JSON.stringify(state.playingOrder));

  const disabledObj: Record<string, boolean> = {};
  state.characterTemporaryDisabled.forEach((value, key) => { disabledObj[key] = value; });
  writeItem(StorageKeys.characterTemporaryDisabled, JSON.stringify(disabledObj));

  writeItem(StorageKeys.currentCharacterId, state.currentCharacterId);
}

export function loadMusicSourceKey(): string | null {
  return readItem(StorageKeys.musicSourceKey);
}

export function saveMusicSourceKey(key: string): void {
  writeItem(StorageKeys.musicSourceKey, key);
}

/** 全部曲目 / 仅单原曲；读不出来或写坏了都回到默认（仅单原曲）。 */
export function loadMusicScope(): MusicScope {
  const stored = readJson<unknown>(StorageKeys.musicScope);
  return isMusicScope(stored) ? stored : DefaultMusicScope;
}

export function saveMusicScope(scope: MusicScope): void {
  writeItem(StorageKeys.musicScope, JSON.stringify(scope));
}

export function loadPlayerName(): string {
  return readItem(StorageKeys.playerName) ?? "";
}

export function savePlayerName(name: string): void {
  writeItem(StorageKeys.playerName, name);
}

export const DefaultVolume = 1.0;

export function loadVolume(): number {
  const raw = readItem(StorageKeys.volume);
  if (raw === null) { return DefaultVolume; }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) { return DefaultVolume; }
  return parsed;
}

export function saveVolume(volume: number): void {
  writeItem(StorageKeys.volume, String(volume));
}

export type GameSetting = {
  cardWidthPercentage: number;
  deckRows: number;
  deckColumns: number;
};

export const DefaultGameSetting: GameSetting = {
  cardWidthPercentage: DefaultCardWidthPercentage,
  deckRows: DefaultDeckRows,
  deckColumns: DefaultDeckColumns,
};

/** Partial and already validated, so callers can apply it field by field. */
export function loadGameSetting(): Partial<GameSetting> | null {
  const stored = readJson<Partial<GameSetting>>(StorageKeys.gameSetting);
  if (!stored) { return null; }

  const setting: Partial<GameSetting> = {};
  if (typeof stored.cardWidthPercentage === "number") {
    setting.cardWidthPercentage = stored.cardWidthPercentage;
  }
  if (typeof stored.deckRows === "number" && stored.deckRows >= 1 && stored.deckRows <= MaxDeckRows) {
    setting.deckRows = stored.deckRows;
  }
  if (
    typeof stored.deckColumns === "number" &&
    stored.deckColumns >= 1 && stored.deckColumns <= MaxDeckColumns
  ) {
    setting.deckColumns = stored.deckColumns;
  }
  return Object.keys(setting).length > 0 ? setting : null;
}

export function saveGameSetting(setting: GameSetting): void {
  // skip writing when nothing was customised, so the defaults stay "unset"
  if (
    setting.cardWidthPercentage === DefaultGameSetting.cardWidthPercentage &&
    setting.deckRows === DefaultGameSetting.deckRows &&
    setting.deckColumns === DefaultGameSetting.deckColumns
  ) {
    return;
  }
  writeItem(StorageKeys.gameSetting, JSON.stringify(setting));
}
