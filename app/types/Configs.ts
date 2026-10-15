type MusicUniqueId = string;
type CharacterId = string;
type CardId = string;
type CharacterConfig = {
  id: CharacterId;
  card: Array<CardId>;
  musics: Array<MusicUniqueId>;
  searchNames?: Array<string>;
  tags: Array<string>;
}
type MusicSourceMap = Map<MusicUniqueId, string>;
type CharacterConfigMap = Map<CharacterId, CharacterConfig>;
type MusicSelectionMap = Map<CharacterId, number>;
type MusicPresets = Map<string, MusicSelectionMap>;
type MusicInfo = {
  characterId: CharacterId;
  title: string;
  album: string;
}
export const CardAspectRatio = 703 / 1000;

class GlobalData {
  characterConfigs: CharacterConfigMap;
  sources: MusicSourceMap;
  cardSourcePrefix: string;
  presets: MusicPresets;
  cardCollection: string;

  /** A copy with a different card collection. The dataset itself is shared. */
  withCardCollection(cardCollection: string): GlobalData {
    const copy = new GlobalData();
    copy.characterConfigs = this.characterConfigs;
    copy.sources = this.sources;
    copy.cardSourcePrefix = this.cardSourcePrefix;
    copy.presets = this.presets;
    copy.cardCollection = cardCollection;
    return copy;
  }

  /** A copy whose music sources are the given payload. */
  withFetchedSources(jsonData: unknown): GlobalData {
    const copy = this.withCardCollection(this.cardCollection);
    copy.sources = new Map(this.sources);
    copy.applyFetchedSources(jsonData);
    return copy;
  }

  constructor() {
    this.characterConfigs = new Map();
    this.sources = new Map();
    this.cardSourcePrefix = "";
    this.presets = new Map();
    this.cardCollection = "dairi-sd";
  }

  applyFetchedCharacters(jsonData: unknown) {
    const characterData = jsonData as Record<string, unknown>; // this is a map
    for (const charId in characterData) {
      const charConfig = characterData[charId] as {
        card: string | Array<string>;
        music: string | Array<string>;
        tags?: Array<string>;
        searchNames?: Array<string>;
      };
      let card = charConfig.card;
      if (typeof card === "string") {
        card = [card];
      }
      let music = charConfig.music;
      if (typeof music === "string") {
        music = [music];
      }
      this.characterConfigs.set(charId, {
        id: charId,
        card: card,
        musics: music,
        tags: charConfig.tags || [],
        searchNames: charConfig.searchNames || undefined,
      });
    }
  };

  applyFetchedSources(jsonData: unknown) {
    const sourceData = jsonData as Record<string, string>;
    for (const musicId in sourceData) {
      const sourceUrl = sourceData[musicId];
      this.sources.set(musicId, sourceUrl);
    }
  };

  applyFetchedPresets(jsonData: unknown) {
    const presetsData = jsonData as Record<string, Record<string, number>>;
    for (const presetName in presetsData) {
      const selectionMap = presetsData[presetName] as Record<string, number>;
      const musicSelectionMap: MusicSelectionMap = new Map();
      for (const charId in selectionMap) {
        const musicIndex = selectionMap[charId];
        musicSelectionMap.set(charId, musicIndex);
      }
      this.presets.set(presetName, musicSelectionMap);
    }
  };

  getAnyCardSource(): string {
    for (const charConfig of this.characterConfigs.values()) {
      if (charConfig.card.length > 0) {
        return charConfig.card[0];
      }
    }
    return "";
  }
}

enum PlaybackState {
  Stopped,
  Playing,
  CountingDown,
  TimeoutPause,
}

type PlaybackSetting = {
  countdown: boolean;
  randomStartPosition: boolean;
  playbackDuration: number;
  /** 切歌不播放：上一首 / 下一首只换曲目，按播放键才真正出声。 */
  pauseOnSwitch: boolean;
}

function createPlayingOrder(
  globalData: GlobalData,
  musicSelection: MusicSelectionMap,
  temporaryDisabled: Map<CharacterId, boolean>,
  randomize: boolean
): Array<CharacterId> {
  const characterIds = Array.from(globalData.characterConfigs.keys());
  const filteredIds = characterIds.filter((charId) => {
    return musicSelection.get(charId) !== -1 && !temporaryDisabled.get(charId);
  });

  if (randomize) {
    // Shuffle the array
    for (let i = filteredIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [filteredIds[i], filteredIds[j]] = [filteredIds[j], filteredIds[i]];
    }
  }
  
  return filteredIds;
}

export type {
  MusicUniqueId,
  CharacterId,
  CardId,
  CharacterConfig,
  MusicSourceMap,
  CharacterConfigMap,
  MusicSelectionMap,
  MusicPresets,
  MusicInfo,
  PlaybackSetting,
};

export { 
  GlobalData, PlaybackState,
  createPlayingOrder
};
