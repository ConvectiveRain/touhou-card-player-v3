"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CharacterId, createPlayingOrder, GlobalData, MusicSelectionMap,
} from "../types/Configs";
import { DefaultMusicSource, MusicSources } from "../types/Consts";
import { setLocale } from "../types/Localization";
import { enableCheat, isCheatString } from "../types/Cheat";
import { getFeatures } from "./features";
import { fetchJson } from "./fetchJson";
import { loadMusicSourceKey, loadSelection, saveSelection } from "./persistence";

/**
 * Owns the character/music dataset plus the user's selection, and keeps the selection in
 * localStorage. Previously all of this lived inside the page component, which is why the
 * page had to thread ~20 props into every tab.
 */
export type GameDataStore = {
  globalData: GlobalData;
  /** False until the dataset has been fetched and a selection is available. */
  ready: boolean;
  /** Picks the card artwork collection. */
  setCardCollection: (cardCollection: string) => void;
  /** Loads and applies a music source payload (the Config tab's choice). */
  setMusicSource: (url: string) => void;
  musicSelection: MusicSelectionMap;
  setMusicSelection: (selection: MusicSelectionMap) => void;
  playingOrder: Array<CharacterId>;
  setPlayingOrder: (order: Array<CharacterId>) => void;
  characterTemporaryDisabled: Map<CharacterId, boolean>;
  setCharacterTemporaryDisabled: (map: Map<CharacterId, boolean>) => void;
  currentCharacterId: CharacterId;
  setCurrentCharacterId: (characterId: CharacterId) => void;
};

/** Picks the locale from `?locale=`, falling back to the browser language. */
function applyLocale(): void {
  const features = getFeatures();
  if (features.locale === "en" || features.locale === "zh") {
    setLocale(features.locale);
    return;
  }
  const browserLanguage = navigator.language || navigator.languages?.[0] || "en";
  setLocale(browserLanguage.startsWith("zh") ? "zh" : "en");
}

export function useGameData(): GameDataStore {
  const [globalData, setGlobalDataState] = useState<GlobalData>(() => new GlobalData());
  const [ready, setReady] = useState<boolean>(false);
  const [musicSelection, setMusicSelection] = useState<MusicSelectionMap>(() => new Map());
  const [playingOrder, setPlayingOrder] = useState<Array<CharacterId>>([]);
  const [characterTemporaryDisabled, setCharacterTemporaryDisabled] =
    useState<Map<CharacterId, boolean>>(() => new Map());
  const [currentCharacterId, setCurrentCharacterId] = useState<CharacterId>("");

  useEffect(() => {
    let cancelled = false;

    applyLocale();
    const features = getFeatures();
    if (features.cheatcode && isCheatString(features.cheatcode)) {
      enableCheat();
      console.log("Cheat mode enabled!");
    }

    const load = async () => {
      let musicSourcesUrl = DefaultMusicSource.url;
      const storedMusicSourceKey = loadMusicSourceKey();
      if (storedMusicSourceKey) {
        const source = MusicSources.find((candidate) => candidate.key === storedMusicSourceKey);
        if (source) {
          musicSourcesUrl = source.url;
        }
      }

      const [characters, sources, presets] = await Promise.all([
        fetchJson("character.json"),
        fetchJson(musicSourcesUrl),
        fetchJson("idpresets.json"),
      ]);
      if (cancelled) { return; }

      const loaded = new GlobalData();
      loaded.applyFetchedCharacters(characters);
      loaded.applyFetchedSources(sources);
      loaded.applyFetchedPresets(presets);

      const restored = loadSelection(loaded.characterConfigs.keys());
      if (restored) {
        setMusicSelection(restored.musicSelection);
        setPlayingOrder(restored.playingOrder);
        setCharacterTemporaryDisabled(restored.characterTemporaryDisabled);
        setCurrentCharacterId(restored.currentCharacterId);
      } else {
        // first visit (or stale data): enable every character and queue them all
        const initialSelection: MusicSelectionMap = new Map();
        loaded.characterConfigs.forEach((_config, characterId) => {
          initialSelection.set(characterId, 0);
        });
        const initialOrder = createPlayingOrder(loaded, initialSelection, new Map(), false);
        setMusicSelection(initialSelection);
        setPlayingOrder(initialOrder);
        setCharacterTemporaryDisabled(new Map());
        setCurrentCharacterId(initialOrder.length > 0 ? initialOrder[0] : "");
      }

      setGlobalDataState(loaded);
      setReady(true);
    };

    load().catch((error) => {
      console.error("Failed to load public data", error);
    });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!ready) { return; }
    saveSelection({
      musicSelection, playingOrder, characterTemporaryDisabled, currentCharacterId,
    });
  }, [ready, musicSelection, playingOrder, characterTemporaryDisabled, currentCharacterId]);

  const setCardCollection = useCallback((cardCollection: string) => {
    setGlobalDataState((current) => current.withCardCollection(cardCollection));
  }, []);

  const setMusicSource = useCallback((url: string) => {
    fetchJson(url).then((jsonData) => {
      setGlobalDataState((current) => current.withFetchedSources(jsonData));
    }).catch((error) => {
      console.error("Failed to load the music source", error);
    });
  }, []);

  return {
    globalData,
    ready,
    setCardCollection,
    setMusicSource,
    musicSelection,
    setMusicSelection,
    playingOrder,
    setPlayingOrder,
    characterTemporaryDisabled,
    setCharacterTemporaryDisabled,
    currentCharacterId,
    setCurrentCharacterId,
  };
}
