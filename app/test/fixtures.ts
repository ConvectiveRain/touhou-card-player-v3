import { RefObject } from "react";
import {
  CharacterId, GlobalData, MusicSelectionMap, PlaybackSetting,
} from "../types/Configs";
import { GamePeer, OuterRefObject } from "../types/GameJudge";
import { Event } from "../types/GameEvents";

/**
 * Builds a GlobalData with a small, deterministic cast of characters so tests do not
 * depend on the real character.json payload.
 */
export function createTestGlobalData(
  characters: Record<string, { card: Array<string>; music?: Array<string> }> = {
    alice: { card: ["alice-1", "alice-2"], music: ["alice-music"] },
    marisa: { card: ["marisa-1"], music: ["marisa-music"] },
    reimu: { card: ["reimu-1"], music: ["reimu-music"] },
    youmu: { card: ["youmu-1"], music: ["youmu-music"] },
  },
): GlobalData {
  const data = new GlobalData();
  data.applyFetchedCharacters(characters);
  return data;
}

export type RecordedPeer = {
  eventsToClients: Array<{ event: unknown; except: number | null }>;
  eventsToServer: Array<unknown>;
  eventsToClient: Array<{ event: unknown; to: number }>;
};

/**
 * Minimal GamePeer stand-in that records outbound network calls instead of opening
 * WebRTC connections.
 */
export function createTestPeer(): GamePeer & { recorded: RecordedPeer } {
  const recorded: RecordedPeer = {
    eventsToClients: [],
    eventsToServer: [],
    eventsToClient: [],
  };
  return {
    recorded,
    sendEventToClients: (event: Event, except: number | null) => {
      recorded.eventsToClients.push({ event, except });
    },
    sendEventToServer: (event: Event) => { recorded.eventsToServer.push(event); },
    sendEventToClient: (event: Event, to: number) => { recorded.eventsToClient.push({ event, to }); },
  } as unknown as GamePeer & { recorded: RecordedPeer };
}

export type RecordedCalls = {
  turnStarted: Array<CharacterId>;
  turnWinnerDetermined: Array<unknown>;
  startGameOrders: Array<Array<CharacterId> | null>;
  nextTurnCountdown: number;
  stopGame: number;
  refresh: number;
  outerEvents: Array<{ sender: number; event: unknown }>;
  playingOrder: Array<CharacterId>;
  characterTemporaryDisabled: Map<CharacterId, boolean>;
  currentCharacterId: CharacterId;
};

type OuterRefWithCalls = RefObject<OuterRefObject> & { calls: RecordedCalls };

/**
 * A stand-in for the mutable `OuterRefObject` bag that GameJudge reaches into for
 * caller-owned state (playing order, music selection, UI notifications).
 */
export function createTestOuterRef(options: {
  globalData?: GlobalData;
  playingOrder?: Array<CharacterId>;
  characterTemporaryDisabled?: Map<CharacterId, boolean>;
  currentCharacterId?: CharacterId;
  musicSelection?: MusicSelectionMap;
  playbackSetting?: PlaybackSetting;
  peer?: GamePeer;
} = {}): OuterRefWithCalls {
  const globalData = options.globalData ?? createTestGlobalData();
  const playbackSetting: PlaybackSetting = options.playbackSetting ?? {
    countdown: false, randomStartPosition: false, playbackDuration: 0, pauseOnSwitch: false,
  };

  const calls: RecordedCalls = {
    turnStarted: [],
    turnWinnerDetermined: [],
    startGameOrders: [],
    nextTurnCountdown: 0,
    stopGame: 0,
    refresh: 0,
    outerEvents: [],
    playingOrder: options.playingOrder ?? [],
    characterTemporaryDisabled: options.characterTemporaryDisabled ?? new Map(),
    currentCharacterId: options.currentCharacterId ?? "",
  };

  const ref: OuterRefWithCalls = {
    calls,
    current: {
      globalData,
      playingOrder: calls.playingOrder,
      characterTemporaryDisabled: calls.characterTemporaryDisabled,
      currentCharacterId: calls.currentCharacterId,
      musicSelection: options.musicSelection ?? new Map(),
      playbackSetting,
      musicStartTimestamp: 0,
      peer: options.peer ?? ({} as GamePeer),

      setPlayingOrder: (order) => { calls.playingOrder = order; ref.current.playingOrder = order; },
      setCharacterTemporaryDisabled: (map) => {
        calls.characterTemporaryDisabled = map;
        ref.current.characterTemporaryDisabled = map;
      },
      setMusicSelection: (map) => { ref.current.musicSelection = map; },
      setCurrentCharacterId: (id) => {
        calls.currentCharacterId = id;
        ref.current.currentCharacterId = id;
      },
      setPlaybackSetting: (setting) => { ref.current.playbackSetting = setting; },
      setNextSongPRNGSeed: () => {},

      notifyTurnWinnerDetermined: (winner) => { calls.turnWinnerDetermined.push(winner); },
      notifyTurnStarted: (characterId) => { calls.turnStarted.push(characterId); },
      notifyStartGame: (order) => {
        calls.startGameOrders.push(order);
        // mirror the real page.tsx behaviour: build a fresh playing order
        const playingOrder = order ?? Array.from(globalData.characterConfigs.keys());
        calls.playingOrder = playingOrder;
        ref.current.playingOrder = playingOrder;
        return playingOrder;
      },
      notifyNextTurnCountdown: () => { calls.nextTurnCountdown += 1; },
      notifyStopGame: () => { calls.stopGame += 1; },
      notifyOuterEventHandler: (sender, event) => { calls.outerEvents.push({ sender, event }); },
      refresh: () => { calls.refresh += 1; },
    },
  };

  return ref;
}
